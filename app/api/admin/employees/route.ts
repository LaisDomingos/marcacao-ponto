import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAuthenticatedAdmin } from "@/lib/session";
import { ALLOWED_WEEKLY_HOURS } from "@/lib/employee";

// Lista completa de funcionários da empresa do admin logado.
export async function GET() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { data, error } = await getSupabase()
    .from("employees")
    .select("id, name, weekly_hours, active, created_at, pin_hash")
    .eq("company_id", admin.companyId)
    .order("active", { ascending: false })
    .order("name");
  if (error) {
    return NextResponse.json({ error: "Erro ao listar." }, { status: 500 });
  }
  // Não expõe o hash — só informa se o PIN já foi definido.
  const employees = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    weekly_hours: e.weekly_hours,
    active: e.active,
    created_at: e.created_at,
    has_pin: e.pin_hash != null,
  }));
  return NextResponse.json({ employees });
}

// Cria funcionário na empresa do admin (sem PIN — o funcionário define no
// primeiro acesso). Body: { name: string, weeklyHours?: number }
export async function POST(req: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { name, weeklyHours } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  }
  const hours = Number(weeklyHours ?? 40);
  if (!ALLOWED_WEEKLY_HOURS.includes(hours)) {
    return NextResponse.json(
      { error: "Jornada inválida (use 20, 32 ou 40 horas)." },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabase()
    .from("employees")
    .insert({
      company_id: admin.companyId,
      name: name.trim(),
      pin_hash: null, // definido pelo funcionário no 1º acesso
      weekly_hours: hours,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Erro ao criar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
