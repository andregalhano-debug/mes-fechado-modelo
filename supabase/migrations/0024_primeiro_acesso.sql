-- ============================================================
-- Primeiro acesso: quando um usuário é criado no Supabase (Authentication → Users → Add user),
-- ele entra sozinho na "casa" do sistema. O PRIMEIRO usuário cria a casa, as categorias e o mês
-- aberto do patrimônio, e vira admin; os seguintes entram como membros da mesma casa.
--
-- IMPORTANTE (segurança): em Authentication → Sign In / Providers → Email, DESLIGUE
-- "Allow new users to sign up". Assim só entra quem você mesmo criar ou convidar no painel.
-- ============================================================

create or replace function public.primeiro_acesso() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa uuid;
  v_primeiro boolean;
  v_nome text;
begin
  select id into v_casa from household order by criado_em limit 1;
  v_primeiro := v_casa is null;

  if v_primeiro then
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
  end if;

  -- nome: o que foi informado ao criar o usuário (metadado "nome") ou o começo do e-mail
  v_nome := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), initcap(split_part(new.email, '@', 1)));

  insert into member (id, household_id, nome, papel)
  values (new.id, v_casa, v_nome, case when v_primeiro then 'admin' else 'membro' end)
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.primeiro_acesso();
