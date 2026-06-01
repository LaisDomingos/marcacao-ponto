import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuthenticatedAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { buildSheet, type SheetRow } from "@/lib/sheet";
import { formatDateBr, minutesToHHMM } from "@/lib/time";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};

// Gera o arquivo .xlsx da folha de ponto. Query: ?from=&to=&employeeId=
// Com employeeId → folha individual; sem ele → folha de todos os funcionários.
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

  const rows = await buildSheet({
    companyId: admin.companyId!,
    from,
    to,
    employeeId,
  });

  const periodo =
    from || to
      ? `${from ? formatDateBr(from) : "início"} a ${
          to ? formatDateBr(to) : "hoje"
        }`
      : "completo";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Ponto";

  let filename: string;

  if (employeeId) {
    // Nome e jornada do funcionário (mesmo sem marcações no período).
    const { data: emp } = await getSupabase()
      .from("employees")
      .select("name, weekly_hours")
      .eq("id", employeeId)
      .eq("company_id", admin.companyId!)
      .maybeSingle();
    const employeeName = emp?.name ?? rows[0]?.employeeName ?? "Funcionário";
    const weeklyHours = emp?.weekly_hours ?? 40;
    buildIndividualSheet(wb, employeeName, weeklyHours, periodo, rows);
    filename = `folha-ponto_${slugFilename(employeeName)}_${from || "inicio"}_${
      to || "hoje"
    }.xlsx`;
  } else {
    buildAllSheet(wb, periodo, rows);
    filename = `folha-ponto_${from || "inicio"}_${to || "hoje"}.xlsx`;
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

// ---- Folha individual: nome + período + carga horária no topo; tabela só
// com Data, Entrada, Almoço, Entrada Almoço, Saída. ----
function buildIndividualSheet(
  wb: ExcelJS.Workbook,
  employeeName: string,
  weeklyHours: number,
  periodo: string,
  rows: SheetRow[]
) {
  const ws = wb.addWorksheet("Folha de Ponto");
  const totalMinutes = rows.reduce((s, r) => s + r.workedMinutes, 0);

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = employeeName;
  ws.getCell("A1").font = { bold: true, size: 14 };

  ws.mergeCells("A2:E2");
  ws.getCell("A2").value = `Período: ${periodo}`;
  ws.getCell("A2").font = { italic: true };

  ws.mergeCells("A3:E3");
  ws.getCell("A3").value = `Jornada semanal: ${weeklyHours}h`;
  ws.getCell("A3").font = { italic: true };

  ws.mergeCells("A4:E4");
  ws.getCell("A4").value = `Carga horária no período: ${minutesToHHMM(
    totalMinutes
  )}`;
  ws.getCell("A4").font = { bold: true };

  ws.addRow([]);

  const headerRow = ws.addRow([
    "Data",
    "Entrada",
    "Almoço",
    "Entrada Almoço",
    "Saída",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });

  for (const r of rows) {
    ws.addRow([
      formatDateBr(r.workDate),
      r.entrada,
      r.almocoSaida,
      r.almocoVolta,
      r.saida,
    ]);
  }

  ws.columns = [
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 16 },
    { width: 10 },
  ];
}

// ---- Folha de todos: mantém a coluna Funcionário e Horas Trabalhadas. ----
function buildAllSheet(
  wb: ExcelJS.Workbook,
  periodo: string,
  rows: SheetRow[]
) {
  const ws = wb.addWorksheet("Folha de Ponto");

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "Folha de Ponto";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells("A2:G2");
  ws.getCell("A2").value = `Período: ${periodo}`;
  ws.getCell("A2").font = { italic: true };

  const headerRow = ws.addRow([
    "Funcionário",
    "Data",
    "Entrada",
    "Saída Almoço",
    "Volta Almoço",
    "Saída",
    "Horas Trabalhadas",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });

  let totalMinutes = 0;
  for (const r of rows) {
    totalMinutes += r.workedMinutes;
    ws.addRow([
      r.employeeName,
      formatDateBr(r.workDate),
      r.entrada,
      r.almocoSaida,
      r.almocoVolta,
      r.saida,
      r.worked,
    ]);
  }

  const totalRow = ws.addRow([
    "Total",
    "",
    "",
    "",
    "",
    "",
    minutesToHHMM(totalMinutes),
  ]);
  totalRow.font = { bold: true };

  ws.columns = [
    { width: 28 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 18 },
  ];
}

function slugFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
