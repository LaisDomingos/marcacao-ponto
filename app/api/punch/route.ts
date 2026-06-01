import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildDayStatus, getTodaysPunches, verifyPin } from "@/lib/employee";
import { nextPunchType, PUNCH_LABELS } from "@/lib/punch";
import { nowIso, workDate } from "@/lib/time";

// Registra a próxima marcação do funcionário.
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

  const punches = await getTodaysPunches(emp.id);
  const next = nextPunchType(punches.map((p) => p.type));

  if (!next) {
    return NextResponse.json(
      { error: "Expediente já encerrado hoje.", status: await buildDayStatus(emp) },
      { status: 409 }
    );
  }

  const iso = nowIso();
  const { error } = await getSupabase().from("punches").insert({
    company_id: emp.company_id,
    employee_id: emp.id,
    type: next,
    punched_at: iso,
    work_date: workDate(iso),
  });
  if (error) {
    return NextResponse.json(
      { error: "Falha ao registrar a marcação." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    registered: { type: next, label: PUNCH_LABELS[next] },
    status: await buildDayStatus(emp),
  });
}
