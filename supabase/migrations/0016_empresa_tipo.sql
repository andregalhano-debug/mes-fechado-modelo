-- ============================================================
-- Tipo da empresa escolhido pela família (sobrepõe a detecção automática):
-- assinatura | recorrente | avulsa. "avulsa" tira a empresa da lista
-- principal (compras esporádicas como posto, restaurante pontual...).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table empresa_cartao add column if not exists tipo text
  check (tipo is null or tipo in ('assinatura', 'recorrente', 'avulsa'));
