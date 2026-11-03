// Testa as migrações num Postgres de verdade (PGlite, sem instalar nada): primeiro acesso, convites,
// dados de exemplo e se alguém de fora consegue ler a casa (não pode). Uso: npm run testar:banco
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PASTA = fileURLToPath(new URL('../supabase/', import.meta.url))
const db = new PGlite({ extensions: { pgcrypto } })

// --- o pedaço do Supabase de que as migrações dependem ---
await db.exec(`
  create role authenticated; create role anon; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`)

let ok = true
for (const arq of readdirSync(PASTA + 'migrations').sort()) {
  try {
    await db.exec(readFileSync(PASTA + 'migrations/' + arq, 'utf8'))
    console.log('✅', arq)
  } catch (e) {
    ok = false
    console.log('❌', arq, '→', e.message)
  }
}

// --- primeiro acesso: 1º usuário cria a casa; 2º entra como membro ---
await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('ana@exemplo.com', '{"nome":"Ana"}')`)
const casaId = (await db.query('select id from household')).rows[0].id
await db.exec(`insert into convite (email, household_id, nome) values ('bruno@exemplo.com', '${casaId}', 'Bruno')`)
await db.exec(`insert into auth.users (email) values ('bruno@exemplo.com')`)
const conviteSobrou = (await db.query('select count(*)::int n from convite')).rows[0].n
if (conviteSobrou !== 0) { ok = false; console.log('❌ convite não foi consumido') }
const casas = (await db.query('select count(*)::int n from household')).rows[0].n
const membros = (await db.query('select nome, papel from member order by criado_em')).rows
const cats = (await db.query('select count(*)::int n from category')).rows[0].n
const periodo = (await db.query('select count(*)::int n from patrimonio_periodo')).rows[0].n
console.log(`\nPrimeiro acesso → casas: ${casas} · pessoas: ${membros.map((m) => `${m.nome} (${m.papel})`).join(', ')} · categorias: ${cats} · mês aberto: ${periodo}`)
if (casas !== 1 || membros.length !== 2 || membros[0].papel !== 'admin' || membros[1].papel !== 'membro' || cats !== 18 || periodo !== 1) ok = false

// --- dados de exemplo ---
try {
  await db.exec(readFileSync(PASTA + 'dados-exemplo.sql', 'utf8'))
  const c = (await db.query(`select (select count(*) from bill)::int contas, (select count(*) from transaction)::int lancamentos, (select count(*) from cartao)::int cartoes`)).rows[0]
  console.log(`Dados de exemplo → contas: ${c.contas} · lançamentos: ${c.lancamentos} · cartões: ${c.cartoes}`)
  if (c.contas !== 8 || c.lancamentos !== 9 || c.cartoes !== 1) ok = false
} catch (e) {
  ok = false
  console.log('❌ dados-exemplo.sql →', e.message)
}

// --- RLS: alguém de fora não vê nada da casa ---
await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000dead', 'intruso@exemplo.com')`)
const intrusoVirouMembro = (await db.query(`select count(*)::int n from member where id = '00000000-0000-0000-0000-00000000dead'`)).rows[0].n
console.log(`Usuário SEM convite entrou na casa? ${intrusoVirouMembro ? 'SIM (falha)' : 'não (correto)'}`)
if (intrusoVirouMembro) ok = false

// --- leitura como usuário logado (RLS, igual ao Supabase) ---
await db.exec('grant usage on schema public, auth to authenticated; grant select on all tables in schema public to authenticated; grant execute on all functions in schema public, auth to authenticated')
const anaId = (await db.query(`select id from member where papel = 'admin'`)).rows[0].id
async function contarComo(uid) {
  await db.exec(`set teste.uid = '${uid}'; set role authenticated`)
  const r = (await db.query('select (select count(*) from bill)::int contas, (select count(*) from transaction)::int lanc, (select count(*) from member)::int pessoas, (select count(*) from category)::int cats')).rows[0]
  await db.exec('reset role')
  return r
}
const comoAna = await contarComo(anaId)
const comoIntruso = await contarComo('00000000-0000-0000-0000-00000000dead')
console.log(`RLS → Ana vê: ${comoAna.contas} contas, ${comoAna.lanc} lançamentos, ${comoAna.pessoas} pessoas, ${comoAna.cats} categorias`)
console.log(`RLS → Intruso vê: ${comoIntruso.contas} contas, ${comoIntruso.lanc} lançamentos, ${comoIntruso.pessoas} pessoas, ${comoIntruso.cats} categorias`)
if (comoAna.contas !== 8 || comoAna.lanc !== 9 || comoIntruso.contas + comoIntruso.lanc + comoIntruso.pessoas + comoIntruso.cats !== 0) ok = false

console.log(ok ? '\nRESULTADO: tudo certo' : '\nRESULTADO: há problemas acima')
process.exit(ok ? 0 : 1)
