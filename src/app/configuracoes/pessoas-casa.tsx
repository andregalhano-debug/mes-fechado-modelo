'use client'

import { useState } from 'react'
import { adicionarPessoa } from './casa-actions'

const campo =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

type Pessoa = { id: string; nome: string; papel: string }

export function PessoasCasa({ pessoas, souAdmin }: { pessoas: Pessoa[]; souAdmin: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setAviso(null)
    setEnviando(true)
    const form = evento.currentTarget
    const r = await adicionarPessoa(new FormData(form))
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    form.reset()
    setAberto(false)
    setAviso(r.mensagem ?? 'Pessoa adicionada.')
  }

  return (
    <div>
      <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        {pessoas.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <span className="text-neutral-900 dark:text-neutral-100">{p.nome}</span>
            <span className="text-xs text-neutral-500">{p.papel === 'admin' ? 'dono' : 'pessoa da casa'}</span>
          </li>
        ))}
      </ul>
      {aviso && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {aviso}
        </p>
      )}
      {souAdmin && !aberto && (
        <button
          onClick={() => setAberto(true)}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500"
        >
          Adicionar pessoa
        </button>
      )}
      {souAdmin && aberto && (
        <form onSubmit={enviar} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input name="nome" required placeholder="Nome" className={campo} />
          <input name="email" type="email" required placeholder="E-mail" className={campo} />
          <input name="senha" type="text" required minLength={8} placeholder="Senha provisória" autoComplete="off" className={campo} />
          {erro && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-3 dark:text-red-400">
              {erro}
            </p>
          )}
          <div className="flex gap-3 sm:col-span-3">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-militar-600"
            >
              {enviando ? 'Adicionando…' : 'Adicionar'}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="text-sm text-neutral-600 underline dark:text-neutral-400">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-neutral-500 sm:col-span-3 dark:text-neutral-400">
            A conta já nasce confirmada e ligada à sua casa, sem e-mail. Passe a senha provisória pessoalmente.
          </p>
        </form>
      )}
    </div>
  )
}
