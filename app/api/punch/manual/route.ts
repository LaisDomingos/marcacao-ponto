import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Punch, PunchType } from "@/lib/types";
import { verifyPin } from "@/lib/employee";
import { PUNCH_ORDER } from "@/lib/punch";
import { zonedWallTimeToUtc, workDate, monthStart } from "@/lib/time";

// Lançamento/ajuste manual de uma marcação pelo PRÓPRIO funcionário, quando a
// empresa autoriza (companies.allow_manual_punch). Permitido apenas para dias
// do mês atual, do dia 1 até hoje (sem datas futuras nem meses anteriores).
// Body: { employeeId, pin, workDate (YYYY-MM-DD), type, time (HH:MM) }
// Se time vier vazio, a marcação correspondente é removida.
export async function POST(req: Request) {
  const {
    employeeId,
    pin,
    workDate: date,
    type,
    time,
  } = await req.json().catch(() => ({}));

  if (!employeeId || typeof pin !== "string") {
    return NextResponse.json(
      { error: "Informe o funcionário e o PIN." },
      { status: 400 }
    );
  }
  if (!PUNCH_ORDER.includes(type as PunchType)) {
    return NextResponse.json({ error: "Marcação inválida." }, { status: 400 });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const emp = await verifyPin(Number(employeeId), pin);
  if (!emp) {
    return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  }

  const sb = getSupabase();

  // A empresa precisa autorizar o lançamento manual.
  const { data: company } = await sb
    .from("companies")
    .select("allow_manual_punch")
    .eq("id", emp.company_id)
    .maybeSingle();
  if (!company?.allow_manual_punch) {
    return NextResponse.json(
      { error: "Lançamento manual não permitido pela empresa." },
      { status: 403 }
    );
  }

  // Só pode lançar dentro do mês atual, até hoje.
  const today = workDate();
  if (date < monthStart(today) || date > today) {
    return NextResponse.json(
      { error: "Só é possível lançar dias do mês atual, até hoje." },
      { status: 400 }
    );
  }

  const { data: existingData } = await sb
    .from("punches")
    .select("*")
    .eq("company_id", emp.company_id)
    .eq("employee_id", emp.id)
    .eq("work_date", date)
    .eq("type", type)
    .maybeSingle();
  const existing = existingData as Punch | null;

  // Remoção quando o horário é apagado.
  if (typeof time !== "string" || time === "") {
    if (existing) await sb.from("punches").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, removed: true });
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: "Horário inválido (use HH:MM)." },
      { status: 400 }
    );
  }

  const iso = zonedWallTimeToUtc(date, time);

  if (existing) {
    await sb.from("punches").update({ punched_at: iso }).eq("id", existing.id);
  } else {
    await sb.from("punches").insert({
      company_id: emp.company_id,
      employee_id: emp.id,
      type,
      punched_at: iso,
      work_date: date,
    });
  }

  return NextResponse.json({ ok: true });
}
