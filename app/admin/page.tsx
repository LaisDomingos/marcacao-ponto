import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect("/admin/login");

  const sb = getSupabase();

  // Colunas essenciais (sempre existem): nome e slug, que geram o código/link.
  const { data: core } = await sb
    .from("companies")
    .select("name, slug")
    .eq("id", admin.companyId)
    .maybeSingle();

  // Colunas opcionais (podem não existir se a migração ainda não rodou).
  // Buscadas à parte para não derrubar o código/link em caso de erro.
  const { data: extra } = await sb
    .from("companies")
    .select("logo_url, allow_manual_punch")
    .eq("id", admin.companyId)
    .maybeSingle();

  return (
    <AdminDashboard
      email={admin.email ?? ""}
      companyName={core?.name ?? "Minha empresa"}
      companySlug={core?.slug ?? ""}
      companyLogo={extra?.logo_url ?? null}
      allowManualPunch={extra?.allow_manual_punch ?? false}
    />
  );
}
