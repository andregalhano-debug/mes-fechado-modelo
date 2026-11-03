-- ============================================================
-- Cartões de crédito da família (físico e virtuais) e em qual cartão cada
-- conta a pagar / débito automático está cadastrado. Serve pra organizar os
-- pagamentos e, se um cartão for perdido ou cancelado, saber exatamente quais
-- cobranças precisam ser trocadas de cartão.
--
-- Segurança: guarda só apelido, bandeira e os 4 últimos dígitos — nunca o
-- número completo, a validade ou o CVV. Rodar no SQL Editor do Supabase.
-- ============================================================

create table cartao (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  nome text not null,
  bandeira text,
  final text check (final is null or final ~ '^[0-9]{4}$'),
  tipo text not null default 'fisico' check (tipo in ('fisico', 'virtual')),
  titular_id uuid references member(id) on delete set null,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now()
);

create index on cartao (household_id);

alter table cartao enable row level security;

create policy cartao_household on cartao for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

alter table bill add column cartao_id uuid references cartao(id) on delete set null;

create index on bill (cartao_id);
