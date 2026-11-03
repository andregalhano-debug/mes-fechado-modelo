-- ============================================================
-- MODO DEMONSTRAÇÃO: dados 100% fictícios para mostrar o sistema sem expor nada real.
-- Rode no SQL Editor DEPOIS de criar o seu primeiro usuário (a casa já precisa existir).
-- Para apagar tudo depois, rode o bloco "APAGAR DADOS DE EXEMPLO" no fim deste arquivo.
-- Todos os itens de exemplo têm "(exemplo)" no nome, para você reconhecer.
-- ============================================================

do $$
declare
  v_casa uuid;
  v_pessoa uuid;
  v_cartao uuid;
  v_mes date := date_trunc('month', now())::date;
  cat record;
  c_moradia uuid; c_mercado uuid; c_transporte uuid; c_saude uuid; c_educacao uuid;
  c_lazer uuid; c_compras uuid; c_assinaturas uuid; c_salario uuid;
begin
  select id into v_casa from household order by criado_em limit 1;
  if v_casa is null then raise exception 'Crie o seu primeiro usuário antes (Authentication → Users → Add user).'; end if;
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

  -- contas do mês (algumas pagas, uma atrasando) e uma renovação anual
  insert into bill (household_id, responsavel_id, descricao, valor, vencimento, pago, pago_em, recorrente, periodicidade, mes, category_id, cartao_id, so_lembrete) values
    (v_casa, v_pessoa, 'Aluguel (exemplo)',            2400.00, v_mes + 4,  true,  v_mes + 3,  true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Condomínio (exemplo)',          690.00, v_mes + 9,  true,  v_mes + 8,  true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Energia elétrica (exemplo)',    213.47, v_mes + 9,  false, null,       true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Internet (exemplo)',            119.90, v_mes + 14, false, null,       true,  'mensal', v_mes, c_moradia, null, false),
    (v_casa, v_pessoa, 'Escola (exemplo)',             1350.00, v_mes + 4,  true,  v_mes + 4,  true,  'mensal', v_mes, c_educacao, null, false),
    (v_casa, v_pessoa, 'Plano de saúde (exemplo)',      780.00, v_mes + 19, false, null,       true,  'mensal', v_mes, c_saude, null, false),
    (v_casa, v_pessoa, 'Fatura do cartão roxo (exemplo)', 2746.15, v_mes + 11, false, null,    true,  'mensal', v_mes, null, v_cartao, false),
    (v_casa, v_pessoa, 'Seguro do carro (exemplo)',    2380.00, v_mes + 40, false, null,       true,  'anual',  date_trunc('month', v_mes + 40)::date, c_transporte, v_cartao, true);

  -- lançamentos da fatura (com parcelas) e a receita do mês
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

  raise notice 'Dados de exemplo criados na casa %', v_casa;
end $$;

-- ============================================================
-- APAGAR DADOS DE EXEMPLO (rode só este bloco quando quiser limpar)
-- ============================================================
-- delete from transaction where descricao like '%(exemplo)';
-- delete from bill where descricao like '%(exemplo)';
-- delete from cartao where nome like '%(exemplo)';
