-- Conta a pagar ganha a identidade do documento que a originou e do pagamento que a quitou.
alter table bill add column if not exists numero_documento text;   -- nº do DARF/DAS/boleto
alter table bill add column if not exists codigo_barras text;      -- linha digitável
alter table bill add column if not exists competencia text;        -- período de apuração (ex.: 07/2026)
alter table bill add column if not exists id_pagamento text;       -- ID do Pix / autenticação do pagamento
alter table bill add column if not exists documento_path text;     -- PDF da guia (armazenamento privado)
alter table bill add column if not exists comprovante_path text;   -- comprovante do pagamento
alter table bill add column if not exists detalhe jsonb;           -- composição (principal, multa, juros, código da receita)

-- Nunca a mesma guia ou o mesmo pagamento duas vezes.
create unique index if not exists bill_numero_documento_unico on bill (household_id, numero_documento) where numero_documento is not null;
create unique index if not exists bill_id_pagamento_unico on bill (household_id, id_pagamento) where id_pagamento is not null;
