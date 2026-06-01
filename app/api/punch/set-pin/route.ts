import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import type { Employee } from "@/lib/types";

// Primeiro acesso: o próprio funcionário define o PIN.
// Só é permitido quando o funcionário ainda NÃO tem PIN (pin_hash nulo),
// para que ninguém sobrescreva o PIN de outra pessoa.
// Body: { employeeId: number, pin: string }
export async function POST(req: Request) {
  const { employeeId, pin } = await req.json().catch(() => ({}));

  if (!employeeId || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Escolha um PIN de 4 dígitos." },
      { status: 400 }
    );
  }

  const sb = getSupabase();
  const { data } = await sb
    .from("employees")
    .select("id, pin_hash")
    .eq("id", Number(employeeId))
    .eq("active", true)
    .maybeSingle();
  const emp = data as Pick<Employee, "id" | "pin_hash"> | null;

  if (!emp) {
    return NextResponse.json(
      { error: "Funcionário não encontrado." },
      { status: 404 }
    );
  }
  if (emp.pin_hash) {
    return NextResponse.json(
      { error: "Este funcionário já tem um PIN definido." },
      { status: 409 }
    );
  }

  const { error } = await sb
    .from("employees")
    .update({ pin_hash: bcrypt.hashSync(pin, 10) })
    .eq("id", emp.id)
    .is("pin_hash", null); // trava de corrida: só grava se ainda estiver nulo
  if (error) {
    return NextResponse.json(
      { error: "Falha ao definir o PIN." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
