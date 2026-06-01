import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import type { Admin } from "@/lib/types";

// Body: { email: string, password: string }
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 }
    );
  }

  const { data } = await getSupabase()
    .from("admins")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  const admin = data as Admin | null;

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.adminId = admin.id;
  session.companyId = admin.company_id;
  session.email = admin.email;
  await session.save();

  return NextResponse.json({ ok: true, email: admin.email });
}
