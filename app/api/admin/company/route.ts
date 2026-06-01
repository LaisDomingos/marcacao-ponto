import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAuthenticatedAdmin } from "@/lib/session";

// Atualiza configurações da empresa do admin logado.
// Body: { allowManualPunch?: boolean }
export async function PATCH(req: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.allowManualPunch === "boolean") {
    update.allow_manual_punch = body.allowManualPunch;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteração informada." },
      { status: 400 }
    );
  }

  const { error } = await getSupabase()
    .from("companies")
    .update(update)
    .eq("id", admin.companyId);
  if (error) {
    return NextResponse.json(
      { error: `Falha ao salvar: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
