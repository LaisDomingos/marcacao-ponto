-- Migração: adiciona a jornada semanal contratada do funcionário (20h, 32h ou 40h).
-- Rode no SQL Editor do Supabase (uma vez).

alter table employees
  add column if not exists weekly_hours smallint not null default 40;

-- restringe aos valores permitidos
alter table employees
  drop constraint if exists employees_weekly_hours_check;
alter table employees
  add constraint employees_weekly_hours_check
  check (weekly_hours in (20, 32, 40));

notify pgrst, 'reload schema';
