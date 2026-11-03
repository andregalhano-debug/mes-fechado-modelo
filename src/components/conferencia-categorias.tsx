'use client'

import { useMemo, useState } from 'react'
import { formatarData } from '@/lib/data'
import { GraficoPizza, type FatiaPizza } from '@/components/grafico-pizza'
import { ListaRecolhivel } from '@/components/lista-recolhivel'

export type ItemConferencia = {
  chave: string
  data: string
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  categoria: string | null
  /** texto miúdo ao lado da descrição (parcela, canal...) */
  extra?: string | null
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const CORES = ['#6b7a2e', '#b45309', '#1d4ed8', '#be123c', '#7c3aed', '#0f766e', '#a16207', '#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c']
const COR_OUTROS = '#78716c'
const SEM = 'Sem categoria'

// Conferência de uma fatura: pizza dos principais gastos + categorias abertas em sanfona, com
// o seletor de categoria em cada item. Corrigir um item move ele de grupo e a pizza acompanha.
export function ConferenciaCategorias({
  itens,
  categorias,
  onMudarCategoria,
  salvando,
}: {
  itens: ItemConferencia[]
  /** nomes das categorias disponíveis */
  categorias: string[]
  onMudarCategoria: (chave: string, categoria: string | null) => void
  /** chaves com gravação em andamento (feedback visual) */
  salvando?: Set<string>
}) {
  const despesas = itens.filter((i) => i.natureza === 'despesa')
  const receitas = itens.filter((i) => i.natureza === 'receita')
  const total = despesas.reduce((t, i) => t + i.valor, 0)

  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemConferencia[]>()
    for (const i of despesas) {
      const nome = i.categoria ?? SEM
      mapa.set(nome, [...(mapa.get(nome) ?? []), i])
    }
    return Array.from(mapa.entries())
      .map(([nome, lista]) => ({ nome, itens: lista.sort((a, b) => b.valor - a.valor), total: lista.reduce((t, i) => t + i.valor, 0) }))
      .sort((a, b) => (a.nome === SEM ? -1 : b.nome === SEM ? 1 : b.total - a.total))
  }, [despesas])

  const corDe = useMemo(() => {
    const ordem = grupos.filter((g) => g.nome !== SEM).sort((a, b) => b.total - a.total)
    return new Map(ordem.map((g, i) => [g.nome, i < CORES.length ? CORES[i] : COR_OUTROS]))
  }, [grupos])

  const fatias: FatiaPizza[] = useMemo(() => {
    // Todas as categorias na legenda (sem agrupar em "Outras"), da maior para a menor.
    return [...grupos]
      .sort((a, b) => b.total - a.total)
      .map((g) => ({ rotulo: g.nome, valor: g.total, cor: g.nome === SEM ? '#f59e0b' : (corDe.get(g.nome) ?? COR_OUTROS) }))
  }, [grupos, corDe])

  const [abertos, setAbertos] = useState<Set<string>>(() => new Set([SEM]))
  const alternar = (nome: string) =>
    setAbertos((s) => {
      const n = new Set(s)
      if (n.has(nome)) n.delete(nome)
      else n.add(nome)
      return n
    })
  const semCategoria = grupos.find((g) => g.nome === SEM)

  const seletor = (i: ItemConferencia) => (
    <select
      value={i.categoria ?? ''}
      onChange={(e) => onMudarCategoria(i.chave, e.target.value || null)}
      className={`w-full max-w-[13rem] rounded-lg border bg-white px-2 py-1 text-xs text-neutral-800 outline-none focus:border-militar-600 dark:bg-neutral-950 dark:text-neutral-200 ${
        i.categoria ? 'border-neutral-300 dark:border-neutral-700' : 'border-amber-400 dark:border-amber-700'
      } ${salvando?.has(i.chave) ? 'opacity-60' : ''}`}
      aria-label={`Categoria de ${i.descricao}`}
    >
      <option value="">— sem categoria —</option>
      {categorias.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Principais gastos</h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          {despesas.length} gastos · {brl.format(total)}
          {receitas.length > 0 && ` · ${receitas.length} créditos de ${brl.format(receitas.reduce((t, i) => t + i.valor, 0))}`}
        </p>
        {total > 0 ? <GraficoPizza dados={fatias} formatarValor={(v) => brl.format(v)} legendaCompleta /> : <p className="text-sm text-neutral-500">Sem gastos.</p>}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Conferir categorias</h2>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => setAbertos(new Set(grupos.map((g) => g.nome)))} className="font-medium text-militar-700 hover:underline dark:text-militar-500">
              abrir todas
            </button>
            <button type="button" onClick={() => setAbertos(new Set())} className="font-medium text-militar-700 hover:underline dark:text-militar-500">
              fechar todas
            </button>
          </div>
        </div>
        {semCategoria ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {semCategoria.itens.length} {semCategoria.itens.length === 1 ? 'gasto está' : 'gastos estão'} sem categoria. Escolha uma para cada.
          </p>
        ) : (
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Abra uma categoria para conferir os itens e mudar a categoria de qualquer um.</p>
        )}

        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {grupos.map((g) => {
            const aberto = abertos.has(g.nome)
            return (
              <li key={g.nome}>
                <button
                  type="button"
                  onClick={() => alternar(g.nome)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <span className="w-3 text-neutral-400">{aberto ? '▾' : '▸'}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.nome === SEM ? '#f59e0b' : (corDe.get(g.nome) ?? COR_OUTROS) }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {g.nome}
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">{g.itens.length}</span>
                  </span>
                  <span className="hidden w-24 sm:block">
                    <span className="block h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <span
                        className="block h-1.5 rounded-full"
                        style={{ width: `${total > 0 ? (g.total / total) * 100 : 0}%`, background: g.nome === SEM ? '#f59e0b' : (corDe.get(g.nome) ?? COR_OUTROS) }}
                      />
                    </span>
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-neutral-500">{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                  <span className="w-28 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(g.total)}</span>
                </button>
                {aberto && (
                  <div className="border-t border-neutral-100 bg-neutral-50/70 px-3 py-1 pb-2 dark:border-neutral-800 dark:bg-neutral-800/30">
                    <ListaRecolhivel rotulo="itens" className="">
                    {g.itens.map((i) => (
                      <div key={i.chave} className="grid grid-cols-1 items-center gap-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_13rem_6.5rem] sm:gap-3">
                        <span className="min-w-0 text-sm text-neutral-800 dark:text-neutral-200">
                          <span className="block truncate">{i.descricao}</span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatarData(i.data)}
                            {i.extra ? ` · ${i.extra}` : ''}
                          </span>
                        </span>
                        {seletor(i)}
                        <span className="text-sm tabular-nums text-neutral-900 sm:text-right dark:text-neutral-100">{brl.format(i.valor)}</span>
                      </div>
                    ))}
                    </ListaRecolhivel>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {receitas.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Créditos e estornos ({receitas.length})
            </summary>
            <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
              {receitas.map((i) => (
                <li key={i.chave} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                    {i.descricao} <span className="text-xs text-neutral-400">{formatarData(i.data)}</span>
                  </span>
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{brl.format(i.valor)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
