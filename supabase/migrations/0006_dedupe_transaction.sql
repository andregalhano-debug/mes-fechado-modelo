-- ============================================================
-- Constraint que faltava pro upsert de deduplicação em
-- /api/documentos/[id]/confirmar funcionar (ON CONFLICT precisa de
-- uma unique constraint/index correspondente). Rodar no SQL Editor.
-- ============================================================

alter table transaction
  add constraint transaction_household_hash_dedupe_key unique (household_id, hash_dedupe);
