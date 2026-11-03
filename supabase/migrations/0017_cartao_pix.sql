-- ============================================================
-- PIX como forma de pagamento (além de cartão físico, virtual e débito em conta).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table cartao drop constraint if exists cartao_tipo_check;
alter table cartao add constraint cartao_tipo_check check (tipo in ('fisico', 'virtual', 'debito', 'pix'));
