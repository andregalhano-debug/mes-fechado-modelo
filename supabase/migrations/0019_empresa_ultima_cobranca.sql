-- ============================================================
-- Data da última cobrança informada à mão (empresa que não aparece nas faturas
-- importadas, ex: Google Workspace). Rodar no SQL Editor do Supabase.
-- ============================================================

alter table empresa_cartao add column if not exists ultima_cobranca date;
