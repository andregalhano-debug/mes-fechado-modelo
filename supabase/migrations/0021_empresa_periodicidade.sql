-- Empresa/assinatura cobrada uma vez por ano (ex.: a anuidade de um aplicativo): o "por mês" vira valor ÷ 12.
alter table empresa_cartao add column if not exists periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'anual'));
