import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/employee";
import { buildSheet } from "@/lib/sheet";
import { workDate } from "@/lib/time";

// Histórico do próprio funcionário (autenticado pelo PIN), para ele conferir
// o seu ponto. Retorna os últimos ~31 dias, do mais recente para o mais antigo.
// Body: { employeeId: number, pin: string }
export async function POST(req: Request) {
  const { employeeId, pin } = await req.json().catch(() => ({}));

  if (!employeeId || typeof pin !== "string") {
    return NextResponse.json(
      { error: "Informe o funcionário e o PIN." },
      { status: 400 }
    );
  }

  const emp = await verifyPin(Number(employeeId), pin);
  if (!emp) {
    return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  }

  const fromIso = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await buildSheet({
    companyId: emp.company_id,
    employeeId: emp.id,
    from: workDate(fromIso),
  });
  rows.reverse(); // mais recente primeiro

  return NextResponse.json({ rows });
}
