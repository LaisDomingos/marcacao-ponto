import { getSupabase } from "./supabase";

/** Gera um slug-base a partir do nome da empresa. */
export function slugifyBase(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "empresa";
}

/** Gera um slug único, acrescentando -2, -3… se já existir. */
export async function generateUniqueSlug(name: string): Promise<string> {
  const sb = getSupabase();
  const base = slugifyBase(name);
  let slug = base;
  let n = 1;
  // Loop curto: na prática resolve na 1ª ou 2ª tentativa.
  for (;;) {
    const { data } = await sb
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}
