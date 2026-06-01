// Seed de demonstração no Supabase: cria uma empresa "Empresa Demo" (slug "demo"),
// um administrador e alguns funcionários de exemplo.
//
// Pré-requisito: rodar supabase/schema.sql no SQL Editor do projeto.
// Uso: npm run seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { getSupabase } from "../lib/supabase";

const COMPANY_NAME = "Empresa Demo";
const COMPANY_SLUG = "demo";

async function main() {
  const sb = getSupabase();
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@demo.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // Empresa demo (idempotente pelo slug).
  let { data: company } = await sb
    .from("companies")
    .select("id")
    .eq("slug", COMPANY_SLUG)
    .maybeSingle();

  if (company) {
    console.log(`✔ Empresa "${COMPANY_SLUG}" já existe — mantida.`);
  } else {
    const inserted = await sb
      .from("companies")
      .insert({ name: COMPANY_NAME, slug: COMPANY_SLUG })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    company = inserted.data;
    console.log(`✔ Empresa criada: "${COMPANY_NAME}" (slug "${COMPANY_SLUG}").`);
  }

  const companyId = company!.id;

  // Admin (idempotente pelo email).
  const { data: existingAdmin } = await sb
    .from("admins")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existingAdmin) {
    console.log(`✔ Admin "${adminEmail}" já existe — mantido.`);
  } else {
    const { error } = await sb.from("admins").insert({
      company_id: companyId,
      email: adminEmail,
      password_hash: bcrypt.hashSync(adminPassword, 10),
    });
    if (error) throw error;
    console.log(`✔ Admin criado: ${adminEmail} / ${adminPassword}.`);
    if (adminPassword === "admin123") {
      console.log("  ⚠ Troque ADMIN_PASSWORD no .env antes de usar em produção.");
    }
  }

  // Funcionários de exemplo (só se a empresa ainda não tiver nenhum).
  const { count } = await sb
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (count && count > 0) {
    console.log(`✔ Empresa demo já tem ${count} funcionário(s) — exemplos mantidos.`);
  } else {
    const samples = [
      { name: "Maria Silva", weekly_hours: 40 },
      { name: "João Souza", weekly_hours: 32 },
      { name: "Ana Oliveira", weekly_hours: 20 },
    ];
    const { error } = await sb.from("employees").insert(
      samples.map((s) => ({
        company_id: companyId,
        name: s.name,
        pin_hash: null, // cada funcionário define o PIN no 1º acesso
        weekly_hours: s.weekly_hours,
      }))
    );
    if (error) throw error;
    for (const s of samples) {
      console.log(`✔ Funcionário de exemplo: ${s.name} (define o PIN no 1º acesso).`);
    }
  }

  console.log(`\nSeed concluído. Tela de ponto: /ponto/${COMPANY_SLUG}`);
}

main().catch((err) => {
  console.error("Erro no seed:", err.message ?? err);
  process.exit(1);
});
