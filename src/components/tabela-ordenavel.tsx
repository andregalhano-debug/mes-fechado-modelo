'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'

// Padrão do app para tabelas: cabeçalho com as colunas, clique no cabeçalho ordena (número:
// maior → menor no 1º clique; texto: A → Z) e clicar de novo inverte. Mostra as primeiras
// linhas (5) e recolhe o resto atrás de um botão.

export type ColunaTabela = {
  chave: string
  rotulo: string
  alinhar?: 'esq' | 'dir' | 'centro'
  /** false = coluna sem ordenação (ex: barra de share) */
  ordenavel?: boolean
  /** some no celular (a informação costuma ir como subtítulo de outra coluna) */
  ocultarNoCelular?: boolean
  /** dica no cabeçalho */
  dica?: string
  classe?: string
  /** soma a coluna na linha de total (brl = R$, num = quantidade). Todas as linhas entram, não só as visíveis. */
  soma?: 'brl' | 'num'
}

export type LinhaTabela = {
  id: string
  /** valor usado na ordenação, por coluna (número ou texto; null vai pro fim) */
  valores: Record<string, number | string | null>
  /** o que aparece em cada célula */
  celulas: Record<string, ReactNode>
  /** linha destacada (ex: top do Pareto) */
  destaque?: boolean
  /** sub-linhas (ex: cobranças de uma mesma marca) — a linha vira um grupo que abre */
  filhos?: LinhaTabela[]
}

type Ordem = { chave: string; direcao: 'asc' | 'desc' }

const brlTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function formatarSoma(linhas: LinhaTabela[], c: ColunaTabela) {
  const total = linhas.reduce((t, l) => (typeof l.valores[c.chave] === 'number' ? t + (l.valores[c.chave] as number) : t), 0)
  return c.soma === 'brl' ? brlTotal.format(total) : total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function TabelaOrdenavel({
  colunas,
  linhas,
  ordemInicial,
  limite = 5,
  rotulo = 'linhas',
  larguraMinima,
  vazio = 'Nada para mostrar.',
  rodape,
}: {
  colunas: ColunaTabela[]
  linhas: LinhaTabela[]
  ordemInicial?: Ordem
  limite?: number
  rotulo?: string
  /** largura mínima da tabela (px) — acima disso rola na horizontal */
  larguraMinima?: number
  vazio?: string
  /** linha de totais no fim da tabela (por coluna); soma TODAS as linhas, não só as visíveis */
  rodape?: Record<string, ReactNode>
}) {
  const [ordem, setOrdem] = useState<Ordem | null>(ordemInicial ?? null)
  const [aberto, setAberto] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set())
  // grupos com todas as sub-linhas à mostra (por padrão, até 10)
  const [gruposCompletos, setGruposCompletos] = useState<Set<string>>(new Set())
  const temGrupos = linhas.some((l) => l.filhos && l.filhos.length > 0)
  function expandirTudo() {
    setAberto(true)
    const ids = linhas.filter((l) => l.filhos && l.filhos.length > 0).map((l) => l.id)
    setGruposAbertos(new Set(ids))
    setGruposCompletos(new Set(ids))
  }
  function recolherTudo() {
    setAberto(false)
    setGruposAbertos(new Set())
    setGruposCompletos(new Set())
  }
  const alternarGrupo = (id: string) =>
    setGruposAbertos((g) => {
      const n = new Set(g)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas
    const fator = ordem.direcao === 'asc' ? 1 : -1
    return [...linhas].sort((a, b) => {
      const va = a.valores[ordem.chave]
      const vb = b.valores[ordem.chave]
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * fator
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * fator
    })
  }, [linhas, ordem])

  function ordenarPor(c: ColunaTabela) {
    if (c.ordenavel === false) return
    setOrdem((atual) => {
      if (atual?.chave === c.chave) return { chave: c.chave, direcao: atual.direcao === 'desc' ? 'asc' : 'desc' }
      const numerica = linhas.some((l) => typeof l.valores[c.chave] === 'number')
      return { chave: c.chave, direcao: numerica ? 'desc' : 'asc' }
    })
  }

  const visiveis = aberto ? ordenadas : ordenadas.slice(0, limite)
  const escondidas = ordenadas.length - limite
  const alinhamento = (c: ColunaTabela) => (c.alinhar === 'dir' ? 'text-right' : c.alinhar === 'centro' ? 'text-center' : 'text-left')
  const celular = (c: ColunaTabela) => (c.ocultarNoCelular ? 'hidden sm:table-cell' : '')

  if (linhas.length === 0) return <p className="text-sm text-neutral-500 dark:text-neutral-400">{vazio}</p>

  return (
    <>
      {(temGrupos || ordenadas.length > limite) && (
        <div className="mb-2 flex justify-end gap-1">
          <button
            type="button"
            onClick={expandirTudo}
            className="rounded-md px-2 py-1 text-xs font-medium text-militar-700 hover:bg-militar-50 dark:text-militar-500 dark:hover:bg-militar-950/40"
          >
            ⊞ Expandir tudo
          </button>
          <button
            type="button"
            onClick={recolherTudo}
            className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ⊟ Recolher tudo
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm" style={larguraMinima ? { minWidth: larguraMinima } : undefined}>
          <thead className="bg-neutral-50 dark:bg-neutral-800/60">
            <tr className="text-xs text-neutral-500 dark:text-neutral-400">
              {colunas.map((c) => {
                const ativa = ordem?.chave === c.chave
                return (
                  <th
                    key={c.chave}
                    scope="col"
                    aria-sort={ativa ? (ordem!.direcao === 'asc' ? 'ascending' : 'descending') : undefined}
                    title={c.dica}
                    className={`px-2.5 py-1.5 font-medium sm:px-3 sm:py-2.5 ${alinhamento(c)} ${celular(c)} ${c.classe ?? ''}`}
                  >
                    {c.ordenavel === false ? (
                      c.rotulo
                    ) : (
                      <button
                        type="button"
                        onClick={() => ordenarPor(c)}
                        className={`inline-flex min-h-[32px] items-center gap-1 rounded hover:text-neutral-900 dark:hover:text-neutral-100 ${
                          ativa ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''
                        } ${c.alinhar === 'dir' ? 'flex-row-reverse' : ''}`}
                      >
                        {c.rotulo}
                        <span aria-hidden="true" className={ativa ? '' : 'opacity-30'}>
                          {ativa ? (ordem!.direcao === 'desc' ? '▼' : '▲') : '↕'}
                        </span>
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visiveis.map((l) => {
              const grupo = !!l.filhos && l.filhos.length > 0
              const abertoGrupo = grupo && gruposAbertos.has(l.id)
              return (
                <Fragment key={l.id}>
                  <tr className={`${l.destaque ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''} ${abertoGrupo ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''}`}>
                    {colunas.map((c, i) => (
                      <td key={c.chave} className={`px-2.5 py-2.5 align-middle sm:px-3 ${alinhamento(c)} ${celular(c)} ${c.classe ?? ''}`}>
                        {i === 0 && grupo ? (
                          <button
                            type="button"
                            onClick={() => alternarGrupo(l.id)}
                            aria-expanded={abertoGrupo}
                            className="flex w-full items-start gap-1.5 text-left"
                          >
                            <span className="mt-0.5 w-3 shrink-0 text-neutral-400">{abertoGrupo ? '▾' : '▸'}</span>
                            <span className="min-w-0">{l.celulas[c.chave] ?? '—'}</span>
                          </button>
                        ) : (
                          (l.celulas[c.chave] ?? '—')
                        )}
                      </td>
                    ))}
                  </tr>
                  {abertoGrupo &&
                    (gruposCompletos.has(l.id) ? l.filhos! : l.filhos!.slice(0, 10)).map((f) => (
                      <tr key={f.id} className="bg-neutral-50/70 dark:bg-neutral-800/20">
                        {colunas.map((c, i) => (
                          <td
                            key={c.chave}
                            className={`px-2.5 py-2 align-middle sm:px-3 ${alinhamento(c)} ${celular(c)} ${c.classe ?? ''} ${i === 0 ? 'pl-8 sm:pl-9' : ''}`}
                          >
                            {f.celulas[c.chave] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  {abertoGrupo && !gruposCompletos.has(l.id) && l.filhos!.length > 10 && (
                    <tr className="bg-neutral-50/70 dark:bg-neutral-800/20">
                      <td colSpan={colunas.length} className="py-1.5 pl-8 sm:pl-9">
                        <button
                          type="button"
                          onClick={() => setGruposCompletos((g) => new Set(g).add(l.id))}
                          className="text-xs font-medium text-militar-700 hover:underline dark:text-militar-500"
                        >
                          ▼ Ver mais {l.filhos!.length - 10} ({l.filhos!.length} no total)
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {(rodape || colunas.some((c) => c.soma)) && (
            <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-800/50">
              <tr>
                {colunas.map((c, i) => (
                  <td key={c.chave} className={`px-2.5 py-2.5 align-middle tabular-nums sm:px-3 ${alinhamento(c)} ${celular(c)} ${c.classe ?? ''}`}>
                    {rodape?.[c.chave] ?? (c.soma ? formatarSoma(linhas, c) : i === 0 ? `Total · ${linhas.length} ${rotulo}` : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {escondidas > 0 && (
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-xs font-semibold text-militar-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-militar-500 dark:hover:bg-neutral-800/60"
        >
          {aberto ? `▲ Mostrar só as ${limite} primeiras` : `▼ Ver mais ${escondidas} ${rotulo} (${ordenadas.length} no total)`}
        </button>
      )}
    </>
  )
}
