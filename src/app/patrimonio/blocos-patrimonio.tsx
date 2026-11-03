'use client'

import { useState } from 'react'
import { GraficoLinhas } from '@/components/grafico-linhas'

export type Bloco = {
  id: string
  rotulo: string
  valor: number
  share: number | null
  delta: { diferenca: number; percentual: number | null } | null
  /** valor do bloco em cada mês de `meses` (null = sem dado no mês) */
  serie: (number | null)[]
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
// Cor fixa por bloco (segue a entidade, nunca a posição). Variáveis em globals.css (claro/escuro).
const COR: Record<string, string> = {
  total: 'var(--serie-1)',
  conta: 'var(--serie-2)',
  investimento: 'var(--serie-3)',
  bem: 'var(--serie-4)',
  retido: 'var(--serie-5)',
}


// Blocos do topo (Patrimônio, Contas, Investimentos...) + gráfico de linhas do histórico.
// Clicar num bloco liga/desliga a linha dele no gráfico.
export function BlocosPatrimonio({ blocos, meses, nomeMesAnterior }: { blocos: Bloco[]; meses: string[]; nomeMesAnterior: string | null }) {
  const [visiveis, setVisiveis] = useState<string[]>(() => blocos.map((b) => b.id))
  function alternar(id: string) {
    setVisiveis((v) => (v.includes(id) ? (v.length > 1 ? v.filter((x) => x !== id) : v) : [...v, id]))
  }

  return (
    <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {blocos.map((b) => {
          const ativo = visiveis.includes(b.id)
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => alternar(b.id)}
              aria-pressed={ativo}
              title={ativo ? 'Clique para tirar do gráfico' : 'Clique para mostrar no gráfico'}
              className={`rounded-2xl border bg-white p-6 text-left transition hover:shadow-sm dark:bg-neutral-900 ${
                ativo ? 'border-neutral-300 dark:border-neutral-600' : 'border-neutral-200 opacity-55 dark:border-neutral-800'
              }`}
              style={ativo ? { boxShadow: `inset 0 3px 0 0 ${COR[b.id]}` } : undefined}
            >
              <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COR[b.id] }} aria-hidden="true" />
                {b.rotulo}
              </p>
              <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{brl.format(b.valor)}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{b.share !== null && `${Math.round(b.share)}% do total`}</p>
              {b.delta && (
                <p
                  className={`mt-0.5 text-xs font-medium ${
                    b.delta.diferenca === 0
                      ? 'text-neutral-500 dark:text-neutral-400'
                      : b.delta.diferenca > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {b.delta.diferenca >= 0 ? '+' : ''}
                  {brl.format(b.delta.diferenca)}
                  {b.delta.percentual !== null && ` (${b.delta.percentual >= 0 ? '+' : ''}${b.delta.percentual.toFixed(2).replace('.', ',')}%)`}
                  {nomeMesAnterior ? ` vs ${nomeMesAnterior}` : ''}
                </p>
              )}
            </button>
          )
        })}
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Evolução mês a mês</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Clique nos blocos acima para escolher o que aparece</p>
        </div>

        <div className="mt-3">
          <GraficoLinhas
            meses={meses}
            visiveis={visiveis}
            series={blocos.map((b) => ({ id: b.id, rotulo: b.rotulo, cor: COR[b.id], valores: b.serie }))}
          />
        </div>
      </section>
    </>
  )
}
