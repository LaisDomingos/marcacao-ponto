import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import { generateUniqueSlug } from "@/lib/slug";
import { getSession } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cadastro público de empresa + primeiro administrador.
// Body: { companyName, email, password, confirmPassword }
export async function POST(req: Request) {
  const { companyName, email, password, confirmPassword } = await req
    .json()
    .catch(() => ({}));

  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json(
      { error: "Informe o nome da empresa." },
      { status: 400 }
    );
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter ao menos 6 caracteres." },
      { status: 400 }
    );
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    return NextResponse.json(
      { error: "As senhas não conferem." },
      { status: 400 }
    );
  }

  const sb = getSupabase();
  const trimmedName = companyName.trim();

  // 1º) E-mail é único globalmente (identifica o admin no login).
  const { data: emailTaken } = await sb
    .from("admins")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (emailTaken) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado." },
      { status: 409 }
    );
  }

  // 2º) Nome do estabelecimento também não pode repetir (sem distinção de maiúsculas).
  const { data: nameTaken } = await sb
    .from("companies")
    .select("id")
    .ilike("name", trimmedName)
    .maybeSingle();
  if (nameTaken) {
    return NextResponse.json(
      { error: "Já existe uma empresa cadastrada com este nome." },
      { status: 409 }
    );
  }

  const slug = await generateUniqueSlug(companyName);

  const { data: company, error: companyErr } = await sb
    .from("companies")
    .insert({ name: trimmedName, slug })
    .select("id, slug")
    .single();
  if (companyErr || !company) {
    return NextResponse.json(
      { error: "Erro ao criar a empresa." },
      { status: 500 }
    );
  }

  const { data: admin, error: adminErr } = await sb
    .from("admins")
    .insert({
      company_id: company.id,
      email: email.toLowerCase(),
      password_hash: bcrypt.hashSync(password, 10),
    })
    .select("id")
    .single();
  if (adminErr || !admin) {
    // desfaz a empresa para não deixar órfã
    await sb.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      { error: "Erro ao criar o administrador." },
      { status: 500 }
    );
  }

  // Já deixa o admin logado.
  const session = await getSession();
  session.adminId = admin.id;
  session.companyId = company.id;
  session.email = email.toLowerCase();
  await session.save();

  return NextResponse.json({ ok: true, slug: company.slug });
}
