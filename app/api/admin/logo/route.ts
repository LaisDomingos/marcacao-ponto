import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAuthenticatedAdmin } from "@/lib/session";

const BUCKET = "logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Garante que o bucket público de logos existe (cria na 1ª vez).
async function ensureBucket(
  sb: ReturnType<typeof getSupabase>
): Promise<string | null> {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return null;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED),
  });
  // Ignora corrida: se outro request criou em paralelo, segue em frente.
  if (error && !/exist/i.test(error.message)) return error.message;
  return null;
}

// Upload da logo da empresa (apenas admin autenticado).
// Body: multipart/form-data com o campo "file".
export async function POST(req: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Imagem muito grande (máx. 2 MB)." },
      { status: 400 }
    );
  }

  const sb = getSupabase();

  const bucketErr = await ensureBucket(sb);
  if (bucketErr) {
    return NextResponse.json(
      { error: `Falha ao preparar o armazenamento: ${bucketErr}` },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Um caminho fixo por empresa, sobrescrevendo a logo anterior.
  const path = `${admin.companyId}/logo.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Falha ao enviar a imagem: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(BUCKET).getPublicUrl(path);

  // Cache-buster para o navegador buscar a versão nova após a troca.
  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await sb
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", admin.companyId);
  if (updateErr) {
    return NextResponse.json(
      { error: `Falha ao salvar a logo: ${updateErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, logoUrl });
}

// Remove a logo da empresa.
export async function DELETE() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const sb = getSupabase();
  // Remove todos os arquivos da pasta da empresa.
  const { data: list } = await sb.storage
    .from(BUCKET)
    .list(String(admin.companyId));
  if (list?.length) {
    await sb.storage
      .from(BUCKET)
      .remove(list.map((f) => `${admin.companyId}/${f.name}`));
  }

  await sb
    .from("companies")
    .update({ logo_url: null })
    .eq("id", admin.companyId);

  return NextResponse.json({ ok: true });
}
