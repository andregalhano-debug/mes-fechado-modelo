-- ============================================================
-- Fechamento mensal: snapshot de patrimônio por mês, base pra
-- comparativos históricos. Rodar no SQL Editor do Supabase.
-- ============================================================

create table month_close (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  mes date not null, -- primeiro dia do mês fechado
  receitas numeric(16,2) not null,
  despesas numeric(16,2) not null,
  patrimonio_total numeric(16,2) not null,
  patrimonio_financeiro numeric(16,2) not null,
  fechado_por uuid references member(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (household_id, mes)
);

create index on month_close (household_id, mes desc);

alter table month_close enable row level security;

create policy month_close_household on month_close for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
