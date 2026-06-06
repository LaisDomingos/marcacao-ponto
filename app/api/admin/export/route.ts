import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuthenticatedAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { buildSheet } from "@/lib/sheet";
import { workDate } from "@/lib/time";
import { buildMonthlySheet, slugFilename } from "@/lib/xlsx";

// Gera o .xlsx da folha de ponto no formato mensal "Registo Diário de Horas".
// Query: ?from=&to=&employeeId=  (o mês é derivado de `from`)
// Com employeeId → uma folha; sem ele → uma aba por funcionário ativo.
export async function GET(req: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const employeeIdParam = url.searchParams.get("employeeId");
  const employeeId = employeeIdParam ? Number(employeeIdParam) : undefined;

  const sb = getSupabase();

  // Nome da empresa (vai no título da folha).
  const { data: company } = await sb
    .from("companies")
    .select("name")
    .eq("id", admin.companyId!)
    .maybeSingle();
  const companyName = company?.name ?? "Empresa";

  // Mês da folha: derivado de `from` (ou `to`, ou mês atual).
  const month = (from || to || workDate()).slice(0, 7); // AAAA-MM
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mFrom = `${month}-01`;
  const mTo = `${month}-${String(lastDay).padStart(2, "0")}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Ponto";

  let filename: string;

  if (employeeId) {
    const { data: emp } = await sb
      .from("employees")
      .select("name, weekly_hours")
      .eq("id", employeeId)
      .eq("company_id", admin.companyId!)
      .maybeSingle();
    const employeeName = emp?.name ?? "Funcionário";
    const rows = await buildSheet({
      companyId: admin.companyId!,
      employeeId,
      from: mFrom,
      to: mTo,
    });
    buildMonthlySheet(wb, {
      companyName,
      employeeName,
      weeklyHours: emp?.weekly_hours ?? 40,
      month,
      rows,
    });
    filename = `folha-ponto_${slugFilename(employeeName)}_${month}.xlsx`;
  } else {
    // Uma aba por funcionário ativo.
    const { data: employees } = await sb
      .from("employees")
      .select("id, name, weekly_hours")
      .eq("company_id", admin.companyId!)
      .eq("active", true)
      .order("name");

    for (const emp of employees ?? []) {
      const rows = await buildSheet({
        companyId: admin.companyId!,
        employeeId: emp.id,
        from: mFrom,
        to: mTo,
      });
      buildMonthlySheet(wb, {
        companyName,
        employeeName: emp.name,
        weeklyHours: emp.weekly_hours ?? 40,
        month,
        rows,
        sheetName: emp.name,
      });
    }
    if ((employees ?? []).length === 0) {
      wb.addWorksheet("Sem funcionários");
    }
    filename = `folha-ponto_${slugFilename(companyName)}_${month}.xlsx`;
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
