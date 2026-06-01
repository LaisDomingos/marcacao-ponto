import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAuthenticatedAdmin } from "@/lib/session";
import { ALLOWED_WEEKLY_HOURS } from "@/lib/employee";

type Params = { params: Promise<{ id: string }> };

// Atualiza funcionário: renomear, ativar/desativar, alterar jornada e/ou
// redefinir o PIN (apenas LIMPA — o funcionário cria um novo no 1º acesso;
// o admin nunca escolhe nem vê o PIN).
// Body: { name?: string, active?: boolean, weeklyHours?: number, resetPin?: true }
export async function PATCH(req: Request, { params }: Params) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const id = Number((await params).id);
  const { name, active, weeklyHours, resetPin } = await req
    .json()
    .catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof active === "boolean") update.active = active;
  if (weeklyHours !== undefined) {
    const hours = Number(weeklyHours);
    if (!ALLOWED_WEEKLY_HOURS.includes(hours)) {
      return NextResponse.json(
        { error: "Jornada inválida (use 20, 32 ou 40 horas)." },
        { status: 400 }
      );
    }
    update.weekly_hours = hours;
  }
  if (resetPin === true) {
    update.pin_hash = null; // força novo primeiro acesso
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("employees")
    .update(update)
    .eq("id", id)
    .eq("company_id", admin.companyId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Erro ao atualizar." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Funcionário não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}

// Desativa o funcionário (soft delete — preserva o histórico de marcações).
export async function DELETE(_req: Request, { params }: Params) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const id = Number((await params).id);
  const { error } = await getSupabase()
    .from("employees")
    .update({ active: false })
    .eq("id", id)
    .eq("company_id", admin.companyId);
  if (error) {
    return NextResponse.json({ error: "Erro ao desativar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
