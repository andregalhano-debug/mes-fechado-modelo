-- ============================================================
-- Patrimônio mensal: account/investment_position/physical_asset/
-- retained_resource passam a ter uma linha por mês (em vez de um
-- valor único sempre editado por cima). Permite clonar o mês
-- anterior como ponto de partida do próximo e comparar deltas
-- item a item. Rodar no SQL Editor do Supabase.
--
-- Compatibilidade: linhas existentes ganham automaticamente
-- mes = mês corrente e uma linhagem_id própria (cada uma vira o
-- início da sua própria "linhagem" através dos meses) — nada
-- muda de comportamento até a próxima migração de código.
-- ============================================================

alter table account
  add column mes date not null default date_trunc('month', now())::date,
  add column linhagem_id uuid not null default gen_random_uuid();

alter table investment_position
  add column mes date not null default date_trunc('month', now())::date,
  add column linhagem_id uuid not null default gen_random_uuid();

alter table physical_asset
  add column mes date not null default date_trunc('month', now())::date,
  add column linhagem_id uuid not null default gen_random_uuid();

alter table retained_resource
  add column mes date not null default date_trunc('month', now())::date,
  add column linhagem_id uuid not null default gen_random_uuid();

create index on account (household_id, mes);
create index on account (linhagem_id, mes);
create index on investment_position (household_id, mes);
create index on investment_position (linhagem_id, mes);
create index on physical_asset (household_id, mes);
create index on physical_asset (linhagem_id, mes);
create index on retained_resource (household_id, mes);
create index on retained_resource (linhagem_id, mes);

-- Ponteiro: qual mês está aberto (editável) pra cada household.
create table patrimonio_periodo (
  household_id uuid primary key references household(id) on delete cascade,
  mes date not null
);

insert into patrimonio_periodo (household_id, mes)
select id, date_trunc('month', now())::date from household
on conflict (household_id) do nothing;

alter table patrimonio_periodo enable row level security;

create policy patrimonio_periodo_household on patrimonio_periodo for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
