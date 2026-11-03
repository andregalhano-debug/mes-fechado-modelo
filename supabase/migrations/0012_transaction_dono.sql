-- ============================================================
-- Dono (cada pessoa ou a casa) de cada lançamento, pra separar a visão de
-- cada um no app inteiro. Começa preenchido com quem enviou a fatura/extrato
-- de origem — primeiro palpite, corrigível por fatura inteira na aba
-- Documentos. Lançamento sem dono = da família (só aparece no Consolidado).
-- Rodar no SQL Editor do Supabase.
-- ============================================================

alter table transaction add column member_id uuid references member(id) on delete set null;
create index on transaction (member_id);

update transaction t set member_id = d.enviado_por
  from document d
  where t.document_id = d.id and t.member_id is null;
