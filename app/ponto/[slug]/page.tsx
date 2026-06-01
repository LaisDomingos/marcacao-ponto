import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import Kiosk from "./Kiosk";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PontoPage({ params }: Props) {
  const { slug } = await params;

  const { data: company } = await getSupabase()
    .from("companies")
    .select("id, name, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!company) notFound();

  return (
    <Kiosk
      companyId={company.id}
      companyName={company.name}
      companyLogo={company.logo_url}
    />
  );
}
