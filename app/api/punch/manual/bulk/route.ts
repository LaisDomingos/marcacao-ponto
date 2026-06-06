import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Punch, PunchType } from "@/lib/types";
import { verifyPin } from "@/lib/employee";
import { zonedWallTimeToUtc, workDate, monthStart } from "@/lib/time";

const HHMM = /^\d{2}:\d{2}$/;

// Preenchimento em massa do mês atual pelo PRÓPRIO funcionário, quando a
// empresa autoriza. Aplica horários-base aos dias da semana escolhidos, do
// dia 1 até hoje, SEM sobrescrever dias que já tenham qualquer marcação.
// Body: {
//   employeeId, pin,
//   times: { entrada, almocoSaida, almocoVolta, saida }  // "HH:MM" ou "" (ignora)
//   weekdays: number[]   // dias da semana trabalhados (0=Dom … 6=Sáb)
// }
export async function POST(req: Request) {
  const { employeeId, pin, times, weekdays } = await req
    .json()
    .catch(() => ({}));

  if (!employeeId || typeof pin !== "string") {
    return NextResponse.json(
      { error: "Informe o funcionário e o PIN." },
      { status: 400 }
    );
  }
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return NextResponse.json(
      { error: "Selecione os dias da semana trabalhados." },
      { status: 400 }
    );
  }
  const days = new Set(
    weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );

  // Monta o conjunto de marcações-base válidas.
  const order: PunchType[] = [
    "entrada",
    "almoco_saida",
    "almoco_volta",
    "saida",
  ];
  const keyOf: Record<PunchType, string> = {
    entrada: "entrada",
    almoco_saida: "almocoSaida",
    almoco_volta: "almocoVolta",
    saida: "saida",
  };
  const base: { type: PunchType; time: string }[] = [];
  for (const type of order) {
    const t = times?.[keyOf[type]];
    if (typeof t === "string" && t !== "") {
      if (!HHMM.test(t)) {
        return NextResponse.json(
          { error: "Horário inválido (use HH:MM)." },
          { status: 400 }
        );
      }
      base.push({ type, time: t });
    }
  }
  if (base.length === 0) {
    return NextResponse.json(
      { error: "Informe ao menos um horário-base." },
      { status: 400 }
    );
  }

  const emp = await verifyPin(Number(employeeId), pin);
  if (!emp) {
    return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  }

  const sb = getSupabase();

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

  const today = workDate();
  const start = monthStart(today);
  const ym = today.slice(0, 7);
  const [y, mo] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const end = `${ym}-${String(lastDay).padStart(2, "0")}`;

  // Dias que já têm alguma marcação no mês (para não sobrescrever).
  const { data: existing } = await sb
    .from("punches")
    .select("work_date")
    .eq("company_id", emp.company_id)
    .eq("employee_id", emp.id)
    .gte("work_date", start)
    .lte("work_date", end);
  const filledDays = new Set(
    ((existing ?? []) as Pick<Punch, "work_date">[]).map((p) => p.work_date)
  );

  const toInsert: Omit<Punch, "id" | "created_at">[] = [];
  let daysFilled = 0;

  // Mês inteiro: do dia 1 ao último dia do mês.
  for (let d = 1; d <= lastDay; d++) {
    const dd = String(d).padStart(2, "0");
    const wd = `${ym}-${dd}`;
    // Dia da semana da data (independente de fuso): meio-dia UTC.
    const dow = new Date(`${wd}T12:00:00Z`).getUTCDay();
    if (!days.has(dow)) continue;
    if (filledDays.has(wd)) continue; // já tem marcação → não mexe

    for (const { type, time } of base) {
      toInsert.push({
        company_id: emp.company_id,
        employee_id: emp.id,
        type,
        punched_at: zonedWallTimeToUtc(wd, time),
        work_date: wd,
      });
    }
    daysFilled++;
  }

  if (toInsert.length > 0) {
    const { error } = await sb.from("punches").insert(toInsert);
    if (error) {
      return NextResponse.json(
        { error: `Falha ao preencher: ${error.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, daysFilled });
}
