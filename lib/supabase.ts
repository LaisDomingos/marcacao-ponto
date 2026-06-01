import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase para uso EXCLUSIVO no servidor (API routes / scripts).
// Usa a service_role key, que ignora o RLS — nunca exponha esta chave no cliente.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !key) {
    throw new Error(
      "Configuração ausente: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env"
    );
  }

  // Aceita tanto a URL base quanto uma colada com sufixo /rest/v1 — o cliente
  // adiciona o caminho da API sozinho.
  const url = rawUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
