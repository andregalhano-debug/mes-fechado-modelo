-- ============================================================
-- Faturas recebidas por e-mail (Gmail exclusivo de faturas, lido 1x por dia).
-- - documento pode ter origem 'email'
-- - email_processado registra cada e-mail já lido (pelo Message-ID), pra
--   nunca processar a mesma fatura duas vezes.
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table document drop constraint document_origem_check;
alter table document add constraint document_origem_check check (origem in ('app', 'telegram', 'email'));

create table email_processado (
  message_id text primary key,
  household_id uuid not null references household(id) on delete cascade,
  remetente text,
  assunto text,
  recebido_em timestamptz,
  documentos int not null default 0,
  observacao text,
  processado_em timestamptz not null default now()
);

alter table email_processado enable row level security;

create policy email_processado_household on email_processado for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
