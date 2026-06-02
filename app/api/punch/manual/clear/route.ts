import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/employee";

// Apaga TODAS as marcações do próprio funcionário (ferramenta de teste).
// Só funciona se a empresa permite lançamento manual.
// Body: { employeeId, pin }
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

  const { error } = await sb
    .from("punches")
    .delete()
    .eq("company_id", emp.company_id)
    .eq("employee_id", emp.id);
  if (error) {
    return NextResponse.json(
      { error: `Falha ao apagar: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
