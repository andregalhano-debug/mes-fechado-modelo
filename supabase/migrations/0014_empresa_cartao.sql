-- ============================================================
-- Em qual cartão cada empresa/assinatura está cadastrada (Netflix no virtual
-- X, Amazon no físico Y...). Uma linha por empresa — a lista é montada a
-- partir das faturas; aqui só fica o vínculo escolhido. Serve pra saber o que
-- está salvo em cada cartão e facilitar a troca quando um cartão muda.
-- Contas a pagar continuam usando bill.cartao_id (já existente).
--
-- Também: banco do cartão, pra agrupar os vários virtuais de cada banco.
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table cartao add column if not exists banco text;

create table if not exists empresa_cartao (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  chave text not null,
  nome text not null,
  cartao_id uuid references cartao(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (household_id, chave)
);

create index if not exists empresa_cartao_household on empresa_cartao (household_id);
create index if not exists empresa_cartao_cartao on empresa_cartao (cartao_id);

alter table empresa_cartao enable row level security;

drop policy if exists empresa_cartao_household on empresa_cartao;
create policy empresa_cartao_household on empresa_cartao for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
