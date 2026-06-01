-- Adiciona a logo da empresa.
-- Execute no SQL Editor do seu projeto Supabase.

-- 1) Coluna para guardar a URL pública da logo.
alter table companies add column if not exists logo_url text;

-- 2) Bucket público para armazenar as imagens das logos.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- 3) Leitura pública das logos (a tela do funcionário é anônima).
--    O upload é feito no servidor com a service_role key, que ignora o RLS,
--    então só precisamos liberar a leitura.
drop policy if exists "Logos são públicas para leitura" on storage.objects;
create policy "Logos são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'logos');
