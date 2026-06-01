import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect("/admin/login");

  const { data: company } = await getSupabase()
    .from("companies")
    .select("name, slug, logo_url")
    .eq("id", admin.companyId)
    .maybeSingle();

  return (
    <AdminDashboard
      email={admin.email ?? ""}
      companyName={company?.name ?? "Minha empresa"}
      companySlug={company?.slug ?? ""}
      companyLogo={company?.logo_url ?? null}
    />
  );
}
