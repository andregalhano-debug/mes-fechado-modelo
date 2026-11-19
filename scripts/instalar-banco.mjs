// Instala e atualiza o banco sozinho, a cada publicação na Vercel (roda antes do `next build`).
// - Usa a conexão direta do Postgres que a Vercel/Supabase cadastram (POSTGRES_URL_NON_POOLING).
// - Guarda em `_migracao` o que já rodou: cada arquivo de supabase/migrations roda UMA vez, em ordem.
// - Banco que já tinha sido instalado à mão (SQL Editor) é reconhecido e não é refeito.
// - Sem a variável (ex.: no seu computador), só avisa e segue: nada é alterado.
// Uso manual: npm run banco:instalar
import postgres from 'postgres'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PASTA = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const URL_BANCO = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || ''

if (!URL_BANCO) {
  console.log('[banco] POSTGRES_URL_NON_POOLING não definida: instalação automática do banco pulada.')
  process.exit(0)
}

// O Supabase exige SSL; o certificado do pooler não fecha a cadeia, então não validamos a cadeia.
// (sslmode=disable só para testes com um Postgres local)
const semSsl = /sslmode=disable/.test(URL_BANCO)
const endereco = URL_BANCO.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '')
const sql = postgres(endereco, { ssl: semSsl ? false : { rejectUnauthorized: false }, max: 1, onnotice: () => {}, connect_timeout: 20 })

const arquivos = readdirSync(PASTA).filter((a) => a.endsWith('.sql')).sort()

try {
  // Um build por vez mexe no banco (produção e prévia podem publicar juntas).
  await sql`select pg_advisory_lock(727274)`
  await sql`create table if not exists public._migracao (arquivo text primary key, aplicada_em timestamptz not null default now())`
  await sql`alter table public._migracao enable row level security`

  const feitas = new Set((await sql`select arquivo from public._migracao`).map((r) => r.arquivo))

  // Instalação antiga, feita à mão pelo SQL Editor: a casa já existe, mas não há registro.
  if (feitas.size === 0) {
    const [{ existe }] = await sql`select to_regclass('public.convite') is not null as existe`
    if (existe) {
      const antigas = arquivos.filter((a) => a <= '0024_primeiro_acesso.sql')
      for (const a of antigas) await sql`insert into public._migracao (arquivo) values (${a}) on conflict do nothing`
      antigas.forEach((a) => feitas.add(a))
      console.log(`[banco] Instalação feita à mão reconhecida (${antigas.length} arquivos).`)
    }
  }

  let novas = 0
  for (const arq of arquivos) {
    if (feitas.has(arq)) continue
    const texto = readFileSync(PASTA + arq, 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(texto)
      await tx`insert into public._migracao (arquivo) values (${arq})`
    })
    novas++
    console.log(`[banco] ✅ ${arq}`)
  }
  console.log(novas ? `[banco] ${novas} atualização(ões) aplicada(s).` : '[banco] Banco já está em dia.')
} catch (e) {
  console.error('[banco] ❌ Falha ao instalar o banco:', e.message)
  console.error('[banco] A publicação foi interrompida para não subir um site com banco pela metade.')
  console.error('[banco] Copie esta mensagem de erro para o seu Claude.')
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
