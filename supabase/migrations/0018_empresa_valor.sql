-- ============================================================
-- Valor mensal informado à mão pra empresa/assinatura que ainda não aparece
-- nas faturas importadas (ex: Google Workspace cobrado no cartão da empresa).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table empresa_cartao add column if not exists valor_mensal numeric(12, 2)
  check (valor_mensal is null or valor_mensal >= 0);
