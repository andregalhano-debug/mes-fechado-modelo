-- "Só lembrete": conta de renovação cobrada no cartão (o valor já entra pela fatura).
-- Aparece nas listas e nas renovações, mas não soma nos totais. Marcação explícita por conta.
alter table bill add column if not exists so_lembrete boolean not null default false;
