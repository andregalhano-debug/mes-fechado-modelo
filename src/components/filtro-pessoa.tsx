'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export type OpcaoPessoa = { valor: string; rotulo: string; pendentes: number }

// Filtro por pessoa do Patrimônio (a casa toda ou cada pessoa). Lembra a última escolha num cookie,
// então quem abre a tela cai direto na própria visão sem precisar escolher de novo.
export function FiltroPessoa({ opcoes, atual }: { opcoes: OpcaoPessoa[]; atual: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  function escolher(valor: string) {
    document.cookie = `visao_pessoa=${valor}; path=/; max-age=31536000; samesite=lax`
    iniciar(() => {
      router.replace('/patrimonio', { scroll: false })
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="Ver patrimônio de"
      className={`inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900 ${pendente ? 'opacity-70' : ''}`}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === atual
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => escolher(o.valor)}
            aria-pressed={ativo}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
              ativo
                ? 'bg-militar-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            {o.rotulo}
            {o.pendentes > 0 && (
              <span
                className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                  ativo ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
                title={`${o.pendentes} para atualizar`}
              >
                {o.pendentes}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
