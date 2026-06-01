import { NextResponse } from "next/server";
import { getActiveEmployees } from "@/lib/employee";

// Lista pública (id + nome) dos funcionários ativos de uma empresa.
// Query: ?companyId=N
export async function GET(req: Request) {
  const companyId = Number(new URL(req.url).searchParams.get("companyId"));
  if (!companyId) return NextResponse.json({ employees: [] });
  return NextResponse.json({ employees: await getActiveEmployees(companyId) });
}
