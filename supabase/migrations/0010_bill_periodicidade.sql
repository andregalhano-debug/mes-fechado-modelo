-- ============================================================
-- Contas a pagar anuais (IPVA, IPTU, seguro, anuidade de cartão...).
-- "recorrente" continua dizendo SE a conta se repete; "periodicidade" diz
-- DE QUANTO EM QUANTO TEMPO: mensal (padrão, comportamento de hoje) ou anual.
-- Ao pagar uma conta anual, a próxima ocorrência abre 12 meses depois, e ela
-- não entra no "Trazer contas do mês anterior". Aditiva: contas existentes
-- ficam todas como mensais. Rodar no SQL Editor do Supabase.
-- ============================================================

alter table bill
  add column periodicidade text not null default 'mensal'
  check (periodicidade in ('mensal', 'anual'));
