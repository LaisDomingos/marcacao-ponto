-- Schema multi-empresa do Sistema de Ponto para o Supabase (Postgres).
-- Execute no SQL Editor do seu projeto Supabase.
--
-- ATENÇÃO: este script RECRIA o schema do zero (drop + create). Rode apenas em
-- um projeto novo ou sem dados de produção.

drop table if exists punches  cascade;
drop table if exists admins    cascade;
drop table if exists employees cascade;
drop table if exists companies cascade;

create table companies (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table employees (
  id           bigint generated always as identity primary key,
  company_id   bigint not null references companies(id) on delete cascade,
  name         text not null,
  pin_hash     text,                       -- nulo até o funcionário definir no 1º acesso
  weekly_hours smallint not null default 40 check (weekly_hours in (20, 32, 40)),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table admins (
  id            bigint generated always as identity primary key,
  company_id    bigint not null references companies(id) on delete cascade,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table punches (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  employee_id bigint not null references employees(id) on delete cascade,
  type        text not null check (type in ('entrada','almoco_saida','almoco_volta','saida')),
  punched_at  timestamptz not null,
  work_date   date not null,
  created_at  timestamptz not null default now()
);

create index idx_employees_company    on employees (company_id);
create index idx_punches_emp_date      on punches  (employee_id, work_date);
create index idx_punches_company_date  on punches  (company_id, work_date);

-- Segurança: habilita RLS sem políticas. O acesso anônimo/autenticado fica
-- bloqueado; apenas a service_role key (usada no servidor) tem acesso.
alter table companies enable row level security;
alter table employees enable row level security;
alter table admins    enable row level security;
alter table punches   enable row level security;
