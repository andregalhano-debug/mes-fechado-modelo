-- ============================================================
-- Instalação fácil (sem SQL Editor):
-- - situacao_instalacao(): a tela de entrada sabe se o sistema já tem dono (só sim/não).
-- - dados de exemplo pelo botão em Configurações (carregar e apagar), só para o admin.
-- - progresso_da_casa(): marcos da trilha em sim/não, lidos só pelo servidor
--   (página /api/progresso com o código da casa), para a Lia conferir sem print.
-- ============================================================

create or replace function public.situacao_instalacao() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('tem_dono', exists (select 1 from member where papel = 'admin'))
$$;
revoke all on function public.situacao_instalacao() from public;
grant execute on function public.situacao_instalacao() to anon, authenticated;

-- ---------- dados de exemplo (100% fictícios, todos com "(exemplo)" no nome) ----------
create or replace function public._dados_exemplo(v_casa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pessoa uuid;
  v_cartao uuid;
  v_mes date := date_trunc('month', now())::date;
  cat record;
  c_moradia uuid; c_mercado uuid; c_transporte uuid; c_saude uuid; c_educacao uuid;
  c_lazer uuid; c_compras uuid; c_assinaturas uuid; c_salario uuid;
begin
  if v_casa is null then raise exception 'Crie o seu primeiro usuário antes.'; end if;
  if exists (select 1 from cartao where household_id = v_casa and nome like '%(exemplo)') then
    raise exception 'Os dados de exemplo já estão carregados.';
  end if;
  select id into v_pessoa from member where household_id = v_casa order by criado_em limit 1;

  for cat in select id, nome from category where household_id = v_casa loop
    case cat.nome
      when 'Moradia' then c_moradia := cat.id;
      when 'Mercado' then c_mercado := cat.id;
      when 'Transporte' then c_transporte := cat.id;
      when 'Saúde' then c_saude := cat.id;
      when 'Educação' then c_educacao := cat.id;
      when 'Lazer & viagens' then c_lazer := cat.id;
      when 'Compras' then c_compras := cat.id;
      when 'Assinaturas' then c_assinaturas := cat.id;
      when 'Salário' then c_salario := cat.id;
      else null;
    end case;
  end loop;

  insert into cartao (household_id, nome, bandeira, final, tipo, titular_id, banco)
  values (v_casa, 'Cartão roxo (exemplo)', 'Mastercard', '0000', 'fisico', v_pessoa, 'Banco Exemplo')
  returning id into v_cartao;

  insert into bill (household_id, responsavel_id, descricao, valor, vencimento, pago, pago_em, recorrente, periodicidade, mes, category_id, cartao_id, so_lembrete) values
    (v_casa, v_pessoa, 'Aluguel (exemplo)',            2400.00, v_mes + 4,  true,  v_mes + 3,  true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Condomínio (exemplo)',          690.00, v_mes + 9,  true,  v_mes + 8,  true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Energia elétrica (exemplo)',    213.47, v_mes + 9,  false, null,       true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Internet (exemplo)',            119.90, v_mes + 14, false, null,       true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Escola (exemplo)',             1350.00, v_mes + 4,  true,  v_mes + 4,  true,  'mensal', v_mes, c_educacao, null, false),
    (v_casa, v_pessoa, 'Plano de saúde (exemplo)',      780.00, v_mes + 19, false, null,       true,  'mensal', v_mes, c_saude, null, false),
    (v_casa, v_pessoa, 'Fatura do cartão roxo (exemplo)', 2746.15, v_mes + 11, false, null,    true,  'mensal', v_mes, null, v_cartao, false),
    (v_casa, v_pessoa, 'Seguro do carro (exemplo)',    2380.00, v_mes + 40, false, null,       true,  'anual',  date_trunc('month', v_mes + 40)::date, c_transporte, v_cartao, true);

  insert into transaction (household_id, category_id, descricao, valor, data, natureza, canal, parcela_num, parcela_total, member_id) values
    (v_casa, c_mercado,     'SUPERMERCADO EXEMPLO (exemplo)',  612.40, v_mes + 2,  'despesa', null,       null, null, v_pessoa),
    (v_casa, c_mercado,     'SUPERMERCADO EXEMPLO (exemplo)',  388.15, v_mes + 12, 'despesa', null,       null, null, v_pessoa),
    (v_casa, c_transporte,  'POSTO EXEMPLO (exemplo)',         240.00, v_mes + 5,  'despesa', null,       null, null, v_pessoa),
    (v_casa, c_lazer,       'RESTAURANTE EXEMPLO (exemplo)',   186.90, v_mes + 7,  'despesa', 'iFood',    null, null, v_pessoa),
    (v_casa, c_compras,     'LOJA DE ELETRÔNICOS (exemplo)',   350.00, v_mes + 1,  'despesa', null,       3,    10,   v_pessoa),
    (v_casa, c_compras,     'LOJA DE MÓVEIS (exemplo)',        280.00, v_mes + 1,  'despesa', null,       2,    6,    v_pessoa),
    (v_casa, c_assinaturas, 'STREAMING DE VÍDEO (exemplo)',     55.90, v_mes + 8,  'despesa', 'Streaming', null, null, v_pessoa),
    (v_casa, c_assinaturas, 'STREAMING DE MÚSICA (exemplo)',    34.90, v_mes + 8,  'despesa', 'Música',   null, null, v_pessoa),
    (v_casa, c_salario,     'SALÁRIO (exemplo)',             9800.00, v_mes + 4,  'receita', null,       null, null, v_pessoa);
end $$;
revoke all on function public._dados_exemplo(uuid) from public, anon, authenticated;

create or replace function public._apagar_dados_exemplo(v_casa uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from transaction where household_id = v_casa and descricao like '%(exemplo)';
  delete from bill where household_id = v_casa and descricao like '%(exemplo)';
  delete from cartao where household_id = v_casa and nome like '%(exemplo)';
end $$;
revoke all on function public._apagar_dados_exemplo(uuid) from public, anon, authenticated;

-- Botões de Configurações: só quem é admin da casa.
create or replace function public._casa_do_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select household_id into v from member where id = auth.uid() and papel = 'admin';
  if v is null then raise exception 'Só o administrador da casa pode fazer isso.'; end if;
  return v;
end $$;
revoke all on function public._casa_do_admin() from public, anon, authenticated;

create or replace function public.carregar_dados_exemplo() returns void
language plpgsql security definer set search_path = public as $$
begin perform _dados_exemplo(_casa_do_admin()); end $$;
create or replace function public.apagar_dados_exemplo() returns void
language plpgsql security definer set search_path = public as $$
begin perform _apagar_dados_exemplo(_casa_do_admin()); end $$;
revoke all on function public.carregar_dados_exemplo() from public, anon;
revoke all on function public.apagar_dados_exemplo() from public, anon;
grant execute on function public.carregar_dados_exemplo() to authenticated;
grant execute on function public.apagar_dados_exemplo() to authenticated;

-- ---------- marcos da trilha (só sim/não; nenhum valor, nome ou e-mail) ----------
create or replace function public.progresso_da_casa() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_casa uuid;
  v_admin uuid;
  v_2fa boolean := false;
begin
  select household_id, id into v_casa, v_admin from member where papel = 'admin' order by criado_em limit 1;
  if v_casa is null then
    return jsonb_build_object('banco_instalado', true, 'dono_criado', false);
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select exists (select 1 from auth.mfa_factors where user_id = $1 and status::text = ''verified'')'
      into v_2fa using v_admin;
  end if;
  return jsonb_build_object(
    'banco_instalado', true,
    'dono_criado', true,
    'dois_fatores', v_2fa,
    'biometria', exists (select 1 from passkey p join member m on m.id = p.member_id where m.household_id = v_casa),
    'outras_pessoas', (select count(*) from member where household_id = v_casa) > 1,
    'dados_exemplo', exists (select 1 from cartao where household_id = v_casa and nome like '%(exemplo)'),
    'cartao_proprio', exists (select 1 from cartao where household_id = v_casa and nome not like '%(exemplo)'),
    'contas_proprias', exists (select 1 from bill where household_id = v_casa and descricao not like '%(exemplo)'),
    'conta_recorrente', exists (select 1 from bill where household_id = v_casa and recorrente and descricao not like '%(exemplo)'),
    'renovacao_anual', exists (select 1 from bill where household_id = v_casa and periodicidade = 'anual' and descricao not like '%(exemplo)'),
    'fatura_lida', exists (select 1 from document where household_id = v_casa and status = 'confirmado'),
    'parcelas', exists (select 1 from transaction where household_id = v_casa and parcela_total is not null and descricao not like '%(exemplo)'),
    'fatura_do_email', exists (select 1 from email_processado where household_id = v_casa),
    'atualizado_em', now()
  );
end $$;
revoke all on function public.progresso_da_casa() from public, anon, authenticated;
