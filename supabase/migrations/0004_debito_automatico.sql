-- ============================================================
-- Marca contas pagas por débito automático, para confirmar todo mês
-- se o débito realmente caiu (bancos falham silenciosamente às vezes).
-- Já rodada manualmente em produção em 2026-08-17 — este arquivo é
-- só o registro histórico do schema.
-- ============================================================

alter table bill add column debito_automatico boolean not null default false;
