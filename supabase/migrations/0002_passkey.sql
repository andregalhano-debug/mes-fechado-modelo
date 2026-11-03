-- Credenciais de biometria (WebAuthn) por membro.

create table passkey (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references member(id) on delete cascade,
  credential_id text not null unique,
  chave_publica text not null,
  contador bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],
  apelido text,
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz
);

create index on passkey (member_id);

alter table passkey enable row level security;

create policy passkey_self on passkey
  for all using (member_id = auth.uid())
  with check (member_id = auth.uid());
