import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/session";
import { buildSheet } from "@/lib/sheet";

// Folha de ponto filtrada. Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=N
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

  const rows = await buildSheet({ companyId: admin.companyId!, from, to, employeeId });
  return NextResponse.json({ rows });
}
