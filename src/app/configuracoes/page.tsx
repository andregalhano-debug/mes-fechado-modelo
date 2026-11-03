import { createClient } from '@/lib/supabase/server'
import { CadastroBiometria } from './cadastro-biometria'
import { RenomearAparelho } from './renomear-aparelho'
import { CadastroTotp } from './cadastro-totp'
import { TrocarSenha } from './trocar-senha'
import { Categorias } from './categorias'

export default async function Configuracoes() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: passkeys } = await supabase
    .from('passkey')
    .select('id, apelido, device_type, criado_em, ultimo_uso')
    .order('criado_em', { ascending: false })

  const { data: fatoresMfa } = await supabase.auth.mfa.listFactors()
  const fatorTotp = fatoresMfa?.totp.find((f) => f.status === 'verified') ?? null

  const { data: categorias } = await supabase
    .from('category')
    .select('id, nome, natureza')
    .order('natureza')
    .order('nome')

  return (
    <main className="w-full flex-1 px-5 py-8 md:px-8 lg:px-10">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Configurações
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{user?.email}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Senha</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Defina uma nova senha de acesso.
          </p>
          <div className="mt-4">
            <TrocarSenha />
          </div>
        </section>

        <section id="biometria" className="scroll-mt-24 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Biometria (Face ID, Touch ID, impressão digital)
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Cadastre este aparelho para entrar sem digitar senha.
          </p>

          <div className="mt-4">
            <CadastroBiometria />
          </div>

          {passkeys && passkeys.length > 0 && (
            <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
              {passkeys.map((p) => (
                <li key={p.id} className="py-3 text-sm">
                  <RenomearAparelho
                    id={p.id}
                    apelido={p.apelido}
                    uso={p.ultimo_uso ? `último uso ${new Date(p.ultimo_uso).toLocaleDateString("pt-BR")}` : "nunca usado"}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Verificação em duas etapas (2FA)
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Além da senha ou biometria, pede um código de 6 dígitos de um app autenticador.
          </p>
          <div className="mt-4">
            <CadastroTotp fatorInicial={fatorTotp} />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Segurança do seu sistema</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Este sistema não se conecta a nenhum banco, de propósito. Ele só conhece o que você envia: o PDF da fatura, um print de saldo ou o e-mail da fatura.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            <li><b>Nenhuma chave guardada:</b> conectar um banco deixa guardada uma chave digital que vê o seu extrato o tempo todo. Aqui ela não existe, então não tem o que vazar.</li>
            <li><b>Ninguém no meio do caminho:</b> os seus dados vão direto de você para o seu sistema, sem empresa intermediária.</li>
            <li><b>Sem número errado escondido:</b> a fonte é a própria fatura do banco, e nada entra sem você conferir.</li>
          </ul>
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <b>Regra anti-golpe:</b> este sistema nunca pede senha de banco, código de SMS ou conexão com banco. Se aparecer um pedido assim, é golpe.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          <Categorias categorias={categorias ?? []} />
        </section>
      </div>
    </main>
  )
}
