import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Punch, PunchType } from "@/lib/types";
import { getAuthenticatedAdmin } from "@/lib/session";
import { PUNCH_ORDER } from "@/lib/punch";
import { zonedWallTimeToUtc } from "@/lib/time";

// Correção manual de uma marcação (cria ou ajusta o horário).
// Body: { employeeId, workDate (YYYY-MM-DD), type, time (HH:MM) }
// Se time vier vazio, a marcação correspondente é removida.
export async function POST(req: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { employeeId, workDate, type, time } = await req
    .json()
    .catch(() => ({}));

  if (!employeeId || !workDate || !PUNCH_ORDER.includes(type as PunchType)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const sb = getSupabase();

  // Garante que o funcionário pertence à empresa do admin.
  const { data: emp } = await sb
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("company_id", admin.companyId)
    .maybeSingle();
  if (!emp) {
    return NextResponse.json(
      { error: "Funcionário não encontrado." },
      { status: 404 }
    );
  }

  const { data: existingData } = await sb
    .from("punches")
    .select("*")
    .eq("company_id", admin.companyId)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .eq("type", type)
    .maybeSingle();
  const existing = existingData as Punch | null;

  // Remoção quando o horário é apagado.
  if (typeof time !== "string" || time === "") {
    if (existing) {
      await sb.from("punches").delete().eq("id", existing.id);
    }
    return NextResponse.json({ ok: true, removed: true });
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: "Horário inválido (use HH:MM)." },
      { status: 400 }
    );
  }

  const iso = zonedWallTimeToUtc(workDate, time);

  if (existing) {
    await sb.from("punches").update({ punched_at: iso }).eq("id", existing.id);
  } else {
    await sb.from("punches").insert({
      company_id: admin.companyId,
      employee_id: employeeId,
      type,
      punched_at: iso,
      work_date: workDate,
    });
  }

  return NextResponse.json({ ok: true });
}
