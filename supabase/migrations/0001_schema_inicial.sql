-- ============================================================
-- Finanças da Família — schema inicial
-- Rodar no SQL Editor do Supabase (uma vez).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. Núcleo: household e membros ----------

create table household (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  moeda_base text not null default 'BRL',
  criado_em timestamptz not null default now()
);

create table member (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references household(id) on delete cascade,
  nome text not null,
  apelido text,
  papel text not null default 'membro' check (papel in ('membro','admin')),
  criado_em timestamptz not null default now()
);

create index on member (household_id);

-- Perfis de custo: filho, pet. Não têm login.
create table cost_profile (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('filho','pet','outro')),
  ativo boolean not null default true
);

create index on cost_profile (household_id);

-- ---------- 2. Contas, categorias ----------

create table account (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  member_id uuid references member(id) on delete set null,
  nome text not null,
  instituicao text,
  tipo text not null check (tipo in ('corrente','poupanca','cartao','corretora','exchange','especie')),
  moeda text not null default 'BRL',
  saldo_atual numeric(16,2) not null default 0,
  saldo_atualizado_em timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index on account (household_id);

create table category (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  parent_id uuid references category(id) on delete cascade,
  nome text not null,
  natureza text not null check (natureza in ('despesa','receita')),
  cor text
);

create index on category (household_id);

-- ---------- 3. Documentos enviados (fatura, print, extrato) ----------

create table document (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  enviado_por uuid references member(id) on delete set null,
  storage_path text not null,
  nome_arquivo text,
  mime_type text,
  origem text not null default 'app' check (origem in ('app','whatsapp')),
  tipo_detectado text check (tipo_detectado in ('fatura','extrato','saldo','nota','desconhecido')),
  status text not null default 'pendente'
    check (status in ('pendente','processando','aguardando_confirmacao','confirmado','erro')),
  confianca numeric(4,3),
  extracao jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);

create index on document (household_id, status);

-- ---------- 4. Lançamentos ----------

create table transaction (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  account_id uuid references account(id) on delete set null,
  category_id uuid references category(id) on delete set null,
  cost_profile_id uuid references cost_profile(id) on delete set null,
  document_id uuid references document(id) on delete set null,
  descricao text not null,
  valor numeric(16,2) not null,
  moeda text not null default 'BRL',
  valor_brl numeric(16,2),
  data date not null,
  natureza text not null check (natureza in ('despesa','receita')),
  canal text,                       -- iFood, Mercado Livre, 99, Keeta...
  parcela_num int,
  parcela_total int,
  hash_dedupe text,
  criado_em timestamptz not null default now()
);

create index on transaction (household_id, data desc);
create index on transaction (household_id, category_id);
create unique index on transaction (household_id, hash_dedupe) where hash_dedupe is not null;

-- Item de linha: quando a fatura/nota detalha produto a produto
create table transaction_item (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transaction(id) on delete cascade,
  category_id uuid references category(id) on delete set null,
  cost_profile_id uuid references cost_profile(id) on delete set null,
  descricao text not null,
  valor numeric(16,2) not null,
  quantidade numeric(10,3)
);

create index on transaction_item (transaction_id);

-- ---------- 5. Cartão: faturas e parcelas futuras ----------

create table card_invoice (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  account_id uuid not null references account(id) on delete cascade,
  competencia date not null,
  valor_total numeric(16,2) not null default 0,
  vencimento date not null,
  fechamento date,
  status text not null default 'aberta' check (status in ('aberta','fechada','paga')),
  unique (account_id, competencia)
);

create index on card_invoice (household_id, vencimento);

create table installment (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  transaction_id uuid references transaction(id) on delete cascade,
  account_id uuid references account(id) on delete set null,
  descricao text not null,
  valor numeric(16,2) not null,
  competencia date not null,
  numero int not null,
  total int not null
);

create index on installment (household_id, competencia);

-- ---------- 6. Patrimônio: investimentos, bens, retidos ----------

create table investment_position (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  account_id uuid references account(id) on delete set null,
  member_id uuid references member(id) on delete set null,
  descricao text not null,
  classe text not null check (classe in ('renda_fixa','renda_variavel','internacional','cripto','fundo','outro')),
  quantidade numeric(20,8),
  custo numeric(16,2),
  valor_mercado numeric(16,2) not null,
  moeda text not null default 'BRL',
  atualizado_em timestamptz not null default now()
);

create index on investment_position (household_id);

create table physical_asset (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  descricao text not null,
  tipo text not null check (tipo in ('veiculo','imovel','outro')),
  valor_estimado numeric(16,2) not null,
  fonte_avaliacao text not null default 'manual' check (fonte_avaliacao in ('manual','fipe')),
  referencia_externa text,          -- código FIPE, matrícula...
  atualizado_em timestamptz not null default now()
);

create index on physical_asset (household_id);

-- FGTS e afins: contam no patrimônio, mas são bloqueados
create table retained_resource (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  member_id uuid references member(id) on delete set null,
  descricao text not null,
  tipo text not null default 'fgts' check (tipo in ('fgts','precatorio','outro')),
  saldo numeric(16,2) not null,
  atualizado_em timestamptz not null default now()
);

create index on retained_resource (household_id);

-- ---------- 7. Câmbio ----------

create table fx_rate (
  data date not null,
  moeda text not null,
  taxa_brl numeric(16,6) not null,
  primary key (data, moeda)
);

-- ---------- 8. Planejamento: receita, orçamento, metas, contas a pagar ----------

create table income_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  member_id uuid references member(id) on delete cascade,
  competencia date not null,
  valor_previsto numeric(16,2) not null,
  observacao text,                  -- "13º", "bônus"
  unique (member_id, competencia)
);

create index on income_plan (household_id, competencia);

create table budget_rule (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  category_id uuid not null references category(id) on delete cascade,
  limite_mensal numeric(16,2) not null,
  alerta_percentual int not null default 80,
  unique (category_id)
);

create index on budget_rule (household_id);

create table goal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  cost_profile_id uuid references cost_profile(id) on delete set null,
  nome text not null,
  valor_alvo numeric(16,2) not null,
  valor_atual numeric(16,2) not null default 0,
  aporte_mensal numeric(16,2),
  prazo date,
  concluida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index on goal (household_id);

create table bill (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  responsavel_id uuid references member(id) on delete set null,
  account_id uuid references account(id) on delete set null,
  descricao text not null,
  valor numeric(16,2) not null,
  vencimento date not null,
  pago boolean not null default false,
  pago_em date,
  pago_por uuid references member(id) on delete set null,
  recorrente boolean not null default false,
  criado_em timestamptz not null default now()
);

create index on bill (household_id, vencimento);
create index on bill (household_id, pago);

create table alert (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  tipo text not null check (tipo in ('orcamento','vencimento','atraso','gasto_atipico','meta')),
  severidade text not null check (severidade in ('info','atencao','critico')),
  mensagem text not null,
  referencia_id uuid,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create index on alert (household_id, resolvido, criado_em desc);

-- ---------- 9. RLS: tudo isolado por household ----------

create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from member where id = auth.uid()
$$;

alter table household            enable row level security;
alter table member               enable row level security;
alter table cost_profile         enable row level security;
alter table account              enable row level security;
alter table category             enable row level security;
alter table document             enable row level security;
alter table transaction          enable row level security;
alter table transaction_item     enable row level security;
alter table card_invoice         enable row level security;
alter table installment          enable row level security;
alter table investment_position  enable row level security;
alter table physical_asset       enable row level security;
alter table retained_resource    enable row level security;
alter table income_plan          enable row level security;
alter table budget_rule          enable row level security;
alter table goal                 enable row level security;
alter table bill                 enable row level security;
alter table alert                enable row level security;
alter table fx_rate              enable row level security;

create policy household_self on household
  for all using (id = current_household_id())
  with check (id = current_household_id());

do $$
declare t text;
begin
  foreach t in array array[
    'member','cost_profile','account','category','document','transaction',
    'card_invoice','installment','investment_position','physical_asset',
    'retained_resource','income_plan','budget_rule','goal','bill','alert'
  ]
  loop
    execute format(
      'create policy %I_household on %I for all
         using (household_id = current_household_id())
         with check (household_id = current_household_id())', t, t);
  end loop;
end $$;

-- transaction_item herda o household da transação-pai
create policy transaction_item_household on transaction_item
  for all using (
    exists (select 1 from transaction x
            where x.id = transaction_item.transaction_id
              and x.household_id = current_household_id())
  )
  with check (
    exists (select 1 from transaction x
            where x.id = transaction_item.transaction_id
              and x.household_id = current_household_id())
  );

-- cotações são públicas para qualquer usuário autenticado
create policy fx_rate_read on fx_rate for select to authenticated using (true);

-- ---------- 10. Storage: bucket privado dos documentos ----------

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy documentos_household on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = current_household_id()::text
  )
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = current_household_id()::text
  );
