'use client'

import { Children, useState, type ReactNode } from 'react'

// Padrão do app para listas longas: mostra os primeiros (por padrão 5, já ordenados do maior
// pro menor) e recolhe o resto atrás de um botão — nada de dezenas de linhas abertas.
export function ListaRecolhivel({
  children,
  limite = 5,
  rotulo = 'itens',
  className = 'divide-y divide-neutral-100 dark:divide-neutral-800',
}: {
  children: ReactNode
  limite?: number
  /** como chamar os itens no botão ("compras", "empresas"...) */
  rotulo?: string
  className?: string
}) {
  const itens = Children.toArray(children)
  const [aberto, setAberto] = useState(false)
  const escondidos = itens.length - limite
  return (
    <>
      <div className={className}>{aberto ? itens : itens.slice(0, limite)}</div>
      {escondidos > 0 && (
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-xs font-semibold text-militar-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-militar-500 dark:hover:bg-neutral-800/60"
        >
          {aberto ? `▲ Mostrar só os ${limite} primeiros` : `▼ Ver mais ${escondidos} ${rotulo} (${itens.length} no total)`}
        </button>
      )}
    </>
  )
}

/** Barrinha de participação (share) com o % ao lado. */
export function BarraShare({ pct, destaque = false }: { pct: number; destaque?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${destaque ? 'bg-militar-600' : 'bg-neutral-400 dark:bg-neutral-500'}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{Math.round(pct)}%</span>
    </span>
  )
}
