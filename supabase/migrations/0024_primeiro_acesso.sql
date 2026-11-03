-- ============================================================
-- Primeiro acesso e convites.
-- - O PRIMEIRO usuário criado no Supabase (Authentication → Users → Add user) cria a "casa",
--   as categorias e o mês aberto do patrimônio, e vira admin.
-- - Os próximos só entram na casa se o e-mail estiver na lista de CONVITES. Quem não foi
--   convidado consegue até ter uma conta, mas não vê nada (sem casa, o RLS não libera nenhum dado).
--
-- Para convidar alguém da casa, rode no SQL Editor ANTES de criar o usuário dela:
--   insert into convite (email, nome) values ('pessoa@exemplo.com', 'Ana');
--
-- Segurança extra: em Authentication → Sign In / Providers → Email, desligue
-- "Allow new users to sign up". Assim só existe conta criada por você no painel.
-- ============================================================

create table if not exists convite (
  email text primary key check (email = lower(email)),
  household_id uuid not null default current_household_id() references household(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

alter table convite enable row level security;
drop policy if exists convite_admin on convite;
create policy convite_admin on convite for all
  using (household_id = current_household_id() and exists (select 1 from member m where m.id = auth.uid() and m.papel = 'admin'))
  with check (household_id = current_household_id() and exists (select 1 from member m where m.id = auth.uid() and m.papel = 'admin'));

create or replace function public.primeiro_acesso() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa uuid;
  v_convite convite%rowtype;
  v_nome text;
begin
  select id into v_casa from household order by criado_em limit 1;

  if v_casa is null then
    -- primeiro usuário: cria a casa
    insert into household (nome) values ('Minha casa') returning id into v_casa;

    -- mesmas categorias que a leitura de faturas sugere (dá para renomear e criar outras depois)
    insert into category (household_id, nome, natureza) values
      (v_casa, 'Moradia', 'despesa'),
      (v_casa, 'Mercado', 'despesa'),
      (v_casa, 'Transporte', 'despesa'),
      (v_casa, 'Saúde', 'despesa'),
      (v_casa, 'Educação', 'despesa'),
      (v_casa, 'Pet', 'despesa'),
      (v_casa, 'Lazer & viagens', 'despesa'),
      (v_casa, 'Compras', 'despesa'),
      (v_casa, 'Assinaturas', 'despesa'),
      (v_casa, 'IA', 'despesa'),
      (v_casa, 'Celular', 'despesa'),
      (v_casa, 'Juros', 'despesa'),
      (v_casa, 'Presentes', 'despesa'),
      (v_casa, 'Outros', 'despesa'),
      (v_casa, 'Salário', 'receita'),
      (v_casa, 'Bônus & 13º', 'receita'),
      (v_casa, 'Rendimentos', 'receita'),
      (v_casa, 'Outras receitas', 'receita');

    insert into patrimonio_periodo (household_id, mes)
    values (v_casa, date_trunc('month', now())::date)
    on conflict (household_id) do nothing;

    v_nome := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), initcap(split_part(new.email, '@', 1)));
    insert into member (id, household_id, nome, papel) values (new.id, v_casa, v_nome, 'admin')
    on conflict (id) do nothing;
    return new;
  end if;

  -- demais usuários: só com convite
  select * into v_convite from convite where email = lower(new.email);
  if not found then
    return new;
  end if;

  v_nome := coalesce(nullif(trim(v_convite.nome), ''), nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), initcap(split_part(new.email, '@', 1)));
  insert into member (id, household_id, nome, papel) values (new.id, v_convite.household_id, v_nome, 'membro')
  on conflict (id) do nothing;
  delete from convite where email = v_convite.email;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.primeiro_acesso();
