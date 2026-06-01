import { NextResponse } from "next/server";
import { buildDayStatus, verifyPin } from "@/lib/employee";

// Retorna o status do dia do funcionário (sem gravar marcação).
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

  return NextResponse.json({ status: await buildDayStatus(emp) });
}
