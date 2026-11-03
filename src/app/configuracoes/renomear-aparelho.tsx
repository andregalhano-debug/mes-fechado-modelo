'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removerPasskey, renomearPasskey } from './actions'

// Nome do aparelho da biometria: clica em "renomear", edita e salva — o campo fecha sozinho
// e o nome novo aparece com uma confirmação breve (Esc cancela).
export function RenomearAparelho({ id, apelido, uso }: { id: string; apelido: string | null; uso: string }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(apelido ?? '')
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editando) campo.current?.select()
  }, [editando])
  useEffect(() => {
    if (!salvo) return
    const t = setTimeout(() => setSalvo(false), 2500)
    return () => clearTimeout(t)
  }, [salvo])

  function salvar() {
    const novo = nome.trim()
    if (!novo || novo === (apelido ?? '')) return setEditando(false)
    setErro(null)
    iniciar(async () => {
      try {
        const f = new FormData()
        f.set('id', id)
        f.set('apelido', novo)
        await renomearPasskey(f)
        setEditando(false)
        setSalvo(true)
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
      }
    })
  }

  function remover() {
    if (!window.confirm(`Remover "${nome || 'aparelho sem nome'}" da biometria? Esse aparelho passa a entrar só com e-mail e senha até ser cadastrado de novo.`)) return
    iniciar(async () => {
      try {
        const f = new FormData()
        f.set('id', id)
        await removerPasskey(f)
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui remover.')
      }
    })
  }

  if (!editando)
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-neutral-900 dark:text-neutral-100">{nome || 'Aparelho sem nome'}</span>
          {salvo ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ salvo</span>
          ) : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              aria-label={`Renomear ${nome || 'aparelho'}`}
            >
              ✎ renomear
            </button>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-neutral-500 dark:text-neutral-400">{uso}</span>
          <button
            type="button"
            disabled={pendente}
            onClick={remover}
            aria-label={`Remover ${nome || 'aparelho'}`}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {pendente ? 'removendo…' : 'remover'}
          </button>
        </span>
        {erro && <span className="basis-full text-xs text-red-600">{erro}</span>}
      </div>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        salvar()
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        ref={campo}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setNome(apelido ?? '')
            setEditando(false)
          }
        }}
        maxLength={60}
        placeholder="ex: iPhone da Ana"
        aria-label="Nome do aparelho"
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
      />
      <button type="submit" disabled={pendente} className="rounded-lg bg-militar-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
        {pendente ? 'Salvando…' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={() => {
          setNome(apelido ?? '')
          setEditando(false)
        }}
        className="rounded-lg px-2 py-2 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        Cancelar
      </button>
      {erro && <span className="basis-full text-xs text-red-600">{erro}</span>}
    </form>
  )
}
