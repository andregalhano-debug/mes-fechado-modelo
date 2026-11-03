-- ============================================================
-- Histórico das conversas com o assistente ("Perguntar").
-- Cada pessoa vê só as próprias conversas (ninguém vê as conversas de outra pessoa).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

create table if not exists assistente_conversa (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default current_household_id() references household(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null,
  mensagens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists assistente_conversa_user_data on assistente_conversa (user_id, atualizado_em desc);

alter table assistente_conversa enable row level security;

drop policy if exists assistente_conversa_dono on assistente_conversa;
create policy assistente_conversa_dono on assistente_conversa for all
  using (user_id = auth.uid() and household_id = current_household_id())
  with check (user_id = auth.uid() and household_id = current_household_id());
