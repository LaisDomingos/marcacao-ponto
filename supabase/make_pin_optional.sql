-- Migração: o PIN passa a ser definido pelo próprio funcionário no primeiro
-- acesso. Logo, ao criar o funcionário o admin não informa PIN — pin_hash
-- pode ficar nulo até o primeiro acesso.
-- Rode no SQL Editor do Supabase (uma vez).

alter table employees alter column pin_hash drop not null;

notify pgrst, 'reload schema';
