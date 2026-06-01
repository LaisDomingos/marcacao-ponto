-- Permite que a empresa autorize o funcionário a lançar/ajustar manualmente
-- os pontos do mês atual (dias anteriores e o dia de hoje).
-- Execute no SQL Editor do seu projeto Supabase.

alter table companies
  add column if not exists allow_manual_punch boolean not null default false;
