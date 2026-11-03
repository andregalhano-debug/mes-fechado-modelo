-- ============================================================
-- Contas a pagar ganham o mesmo modelo mensal do Patrimônio
-- (0008_patrimonio_mensal.sql): cada linha de "bill" carrega o mês
-- do próprio vencimento e uma linhagem_id que liga a mesma conta
-- recorrente através dos meses — permite comparar o balanço de um
-- mês vs o outro (aba Histórico) sem perder o histórico.
--
-- Diferença importante em relação ao Patrimônio: aqui NÃO existe
-- trava de "mês aberto" pra edição. Conta não paga continua sempre
-- editável/pagável, não importa o mês — só vira histórico de fato
-- depois de paga. "mes" é só um carimbo de categorização (o mês do
-- vencimento), não um controle de acesso.
--
-- Compatibilidade: linhas existentes ganham mes = mês do vencimento
-- (mais preciso que "mês corrente") e uma linhagem_id própria (cada
-- uma começa sua própria linhagem). Nada muda de comportamento até
-- a próxima atualização de código. Rodar no SQL Editor do Supabase.
-- ============================================================

alter table bill
  add column mes date not null default date_trunc('month', now())::date,
  add column linhagem_id uuid not null default gen_random_uuid();

update bill set mes = date_trunc('month', vencimento)::date;

create index on bill (household_id, mes);
create index on bill (linhagem_id, mes);
