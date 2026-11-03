'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { temaDaVisao } from '@/lib/tema-pessoa'

// Seletor global da visão: a casa toda ou cada pessoa (menu lateral e topo no celular).
// Grava a escolha no mesmo cookie lido por todas as páginas e recarrega os dados da tela atual.
export function SeletorPessoa({
  opcoes,
  atual,
  compacto = false,
}: {
  opcoes: { valor: string; rotulo: string }[]
  atual: string
  compacto?: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  if (opcoes.length <= 1) return null
  const tema = temaDaVisao(atual, opcoes.find((o) => o.valor === atual)?.rotulo)

  function escolher(valor: string) {
    document.cookie = `visao_pessoa=${valor}; path=/; max-age=31536000; samesite=lax`
    iniciar(() => router.refresh())
  }

  return (
    <div className={compacto ? '' : 'px-3 pb-3'}>
      {!compacto && (
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Vendo
        </p>
      )}
      <div
        role="group"
        aria-label="Ver dados de"
        className={`grid gap-1 rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950 ${
          pendente ? 'opacity-60' : ''
        }`}
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map((o) => {
          const ativo = o.valor === atual
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => escolher(o.valor)}
              aria-pressed={ativo}
              className={`truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                ativo
                  ? tema.botaoAtivo
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
            >
              {o.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}
