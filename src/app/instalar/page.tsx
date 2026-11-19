import { urlDoBotao } from '@/lib/instalacao/botao'
import { MARCA } from '@/lib/marca'

// Aparece quando o site está no ar, mas o banco ainda não foi ligado (sem as chaves do Supabase).
export const dynamic = 'force-static'

const caixa = 'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'
const titulo = 'font-semibold text-neutral-900 dark:text-neutral-100'
const lista = 'mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300'

export default function Instalar() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-militar-700 dark:text-militar-500">
          {MARCA.titulo}
        </p>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Falta ligar o banco de dados</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          O site já está no ar. Escolha um dos caminhos abaixo; o banco se instala sozinho na próxima publicação.
        </p>
      </div>

      <section className={caixa}>
        <h2 className={titulo}>Caminho 1 · Supabase pela Vercel (recomendado)</h2>
        <ol className={lista}>
          <li>Na Vercel, abra este projeto → aba <b>Storage</b> → <b>Create</b> → <b>Supabase</b>.</li>
          <li>Se pedir, entre no Supabase com <b>Continue with GitHub</b> (a mesma conta de sempre).</li>
          <li>Região: <b>South America (São Paulo)</b>. Plano: <b>Free</b>. Conecte ao projeto e confirme.</li>
          <li>
            Aba <b>Deployments</b> → no último → <b>⋯</b> → <b>Redeploy</b>. Quando terminar, abra o site: aparece a tela
            de primeiro acesso.
          </li>
        </ol>
      </section>

      <section className={caixa}>
        <h2 className={titulo}>Caminho 2 · Já tenho um projeto no Supabase</h2>
        <ol className={lista}>
          <li>No Supabase do seu projeto: <b>Project Settings → API Keys</b> e <b>Connect</b> (botão no topo).</li>
          <li>
            Na Vercel: <b>Settings → Environment Variables</b>, cadastre estas 4 (pode colar todas de uma vez):
            <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
              <li>NEXT_PUBLIC_SUPABASE_URL = Project URL</li>
              <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = chave publishable (ou a antiga anon)</li>
              <li>SUPABASE_SECRET_KEY = chave secret (ou a antiga service_role) · marque Sensitive</li>
              <li>POSTGRES_URL_NON_POOLING = Connect → Session pooler (URI, com a senha do banco) · Sensitive</li>
            </ul>
          </li>
          <li>
            <b>Deployments → ⋯ → Redeploy</b>. O banco é instalado nessa publicação. Se esse projeto já tinha as tabelas
            do Mês Fechado, nada é refeito.
          </li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          O plano grátis do Supabase permite 2 projetos ativos por pessoa. Se já tiver 2, use um deles ou pause um que não
          usa.
        </p>
      </section>

      <section className={caixa}>
        <h2 className={titulo}>Começando do zero?</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          O botão abaixo cria tudo de uma vez: o seu repositório no GitHub, o site na Vercel e o Supabase.
        </p>
        <a
          href={urlDoBotao()}
          className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500"
        >
          Publicar na Vercel
        </a>
      </section>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Travou? Copie a mensagem de erro (na Vercel: Deployments → o último → Build Logs) para o seu Claude ou para a Lia.
        Nunca cole chaves no chat.
      </p>
    </main>
  )
}
