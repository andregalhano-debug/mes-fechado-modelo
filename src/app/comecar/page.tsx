'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MARCA } from '@/lib/marca'
import { criarDono } from './actions'

const campo =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const rotulo = 'text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400'
const link = 'font-medium text-militar-700 underline dark:text-militar-500'

type Situacao = { banco: boolean; tem_dono: boolean }

export default function Comecar() {
  const router = useRouter()
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch('/api/instalacao', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: Situacao) => setSituacao(s))
      .catch(() => setSituacao({ banco: false, tem_dono: false }))
  }, [])

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    const dados = new FormData(evento.currentTarget)
    const r = await criarDono(dados)
    if (!r.ok) {
      setErro(r.erro)
      setEnviando(false)
      return
    }
    const { error } = await createClient().auth.signInWithPassword({
      email: String(dados.get('email')).trim().toLowerCase(),
      password: String(dados.get('senha')),
    })
    if (error) {
      router.push('/entrar')
      return
    }
    router.push('/configuracoes?bem-vindo=1')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-semibold uppercase tracking-widest text-militar-700 dark:text-militar-500">
          {MARCA.titulo}
        </p>
        <h1 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Primeiro acesso</h1>

        {!situacao && <p className="mt-4 text-sm text-neutral-500">Conferindo o sistema…</p>}

        {situacao && !situacao.banco && (
          <div className="mt-4 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
            <p>O banco de dados ainda não foi instalado.</p>
            <p>
              Veja o passo a passo em <a href="/instalar" className={link}>/instalar</a>.
            </p>
          </div>
        )}

        {situacao?.banco && situacao.tem_dono && (
          <div className="mt-4 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
            <p>
              Este sistema já tem dono. Outras pessoas da casa entram com o acesso criado pelo dono, em Configurações
              → Pessoas da casa.
            </p>
            <a href="/entrar" className={link}>
              Ir para o login
            </a>
          </div>
        )}

        {situacao?.banco && !situacao.tem_dono && (
          <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Crie a sua conta. Você vira o dono do sistema: a sua casa, as categorias e o mês aberto já vêm prontos.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className={rotulo}>Seu nome</span>
              <input name="nome" required autoComplete="given-name" className={campo} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={rotulo}>E-mail</span>
              <input name="email" type="email" required autoComplete="email" className={campo} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={rotulo}>Senha (mínimo 8 caracteres)</span>
              <input name="senha" type="password" required minLength={8} autoComplete="new-password" className={campo} />
            </label>
            {erro && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={enviando}
              className="mt-2 rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
            >
              {enviando ? 'Criando…' : 'Criar minha conta'}
            </button>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Sem e-mail de confirmação: a conta já fica pronta. Depois, ligue a verificação em duas etapas em
              Configurações.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
