-- ============================================================
-- Cartão de débito como terceiro tipo (além de físico e virtual de crédito).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table cartao drop constraint if exists cartao_tipo_check;
alter table cartao add constraint cartao_tipo_check check (tipo in ('fisico', 'virtual', 'debito'));
