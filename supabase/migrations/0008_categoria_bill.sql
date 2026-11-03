-- ============================================================
-- Permite categorizar cada conta a pagar (aluguel, condomínio, Unimed...),
-- pra elas entrarem no "Gastos por categoria" da Visão geral junto com os
-- lançamentos de cartão/extrato. Aditiva, não quebra nada existente.
-- ============================================================

alter table bill add column category_id uuid references category(id) on delete set null;

create index on bill (household_id, category_id);
