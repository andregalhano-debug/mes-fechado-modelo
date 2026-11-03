-- ============================================================
-- Origem do documento: enviado pelo app (o envio por e-mail entra numa migração seguinte).
-- ============================================================

alter table document drop constraint document_origem_check;
alter table document add constraint document_origem_check check (origem in ('app','telegram'));
