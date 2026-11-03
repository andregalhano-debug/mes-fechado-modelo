'use client'

import { useState } from 'react'
import { formatarData } from '@/lib/data'
import { ListaRecolhivel } from '@/components/lista-recolhivel'

export type ItemDesvio = { descricao: string; data: string; valor: number; origem: 'lancamento' | 'conta' }
export type DesvioCategoria = {
  categoria: string
  atual: number
  media: number
  desvio: number
  percentual: number | null
  /** valor da categoria em cada um dos meses-base + mês de referência (mesma ordem de `mesesHistorico`) */
  historico: number[]
  itens: ItemDesvio[]
}
export type MaiorGasto = ItemDesvio & { categoria: string }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MASCARA = '• • • •'
// Diverging: acima da média = laranja (atenção), abaixo = azul. Sempre com sinal e seta, nunca só cor.
const COR_ACIMA = 'var(--serie-2)'
const COR_ABAIXO = 'var(--serie-1)'

function nomeMesCurto(chave: string) {
  const [ano, mes] = chave.split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function Sparkline({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 1)
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-hidden="true">
      {valores.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-t-sm ${i === valores.length - 1 ? 'bg-neutral-700 dark:bg-neutral-200' : 'bg-neutral-300 dark:bg-neutral-600'}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  )
}

function BarraDivergente({ desvio, escala }: { desvio: number; escala: number }) {
  const largura = (Math.abs(desvio) / escala) * 50
  return (
    <span className="relative block h-3.5 w-full">
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-neutral-300 dark:bg-neutral-600" />
      <span
        className="absolute inset-y-0 rounded-sm"
        style={{ background: desvio >= 0 ? COR_ACIMA : COR_ABAIXO, width: `${largura}%`, left: desvio >= 0 ? '50%' : `${50 - largura}%` }}
      />
    </span>
  )
}

function SeloPareto() {
  return (
    <span
      title="Entre as linhas que somam 80% (Pareto)"
      className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1 py-px align-middle text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
    >
      80%
    </span>
  )
}

function BarraPareto({ acumulado, destaque }: { acumulado: number; destaque: boolean }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${destaque ? 'bg-amber-500' : 'bg-neutral-400 dark:bg-neutral-500'}`}
          style={{ width: `${Math.min(100, acumulado)}%` }}
        />
        <span className="absolute inset-y-0 left-[80%] w-px bg-neutral-500 dark:bg-neutral-400" />
      </span>
      <span className={`w-10 text-right text-xs tabular-nums ${destaque ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {Math.round(acumulado)}%
      </span>
    </span>
  )
}

function Seta({ desvio }: { desvio: number }) {
  if (Math.abs(desvio) < 1) return <span className="text-neutral-400">—</span>
  return desvio > 0 ? (
    <span className="text-orange-600 dark:text-orange-400">▲</span>
  ) : (
    <span className="text-blue-600 dark:text-blue-400">▼</span>
  )
}

export function Desvios({
  desvios,
  maioresGastos,
  mesReferencia,
  mesReferenciaChave,
  mesesHistorico,
  saidasAtual,
  saidasMedia,
  oculto,
}: {
  desvios: DesvioCategoria[]
  maioresGastos: MaiorGasto[]
  mesReferencia: string
  mesReferenciaChave: string
  mesesHistorico: string[]
  saidasAtual: number | null
  saidasMedia: number | null
  oculto: boolean
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [todas, setTodas] = useState(false)
  const [maisGastos, setMaisGastos] = useState(false)
  const [ordem, setOrdem] = useState<{ chave: string; direcao: 'asc' | 'desc' }>({ chave: 'desvio', direcao: 'desc' })

  if (desvios.length === 0) return null
  const v = (n: number, centavos = false) => (oculto ? MASCARA : (centavos ? brlCentavos : brl).format(n))
  const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')

  const acima = desvios.filter((d) => d.desvio > 0)
  const abaixo = desvios.filter((d) => d.desvio < 0)
  const totalAcima = acima.reduce((t, d) => t + d.desvio, 0)
  const totalAbaixo = abaixo.reduce((t, d) => t + d.desvio, 0)
  const maiorAlta = acima[0] ?? null
  const escala = Math.max(...desvios.map((d) => Math.abs(d.desvio)), 1)
  // Pareto: participação acumulada no desvio total (as linhas já vêm do maior pro menor desvio).
  // As primeiras que somam 80% são "onde está o problema".
  const totalDesvioAbs = desvios.reduce((t, d) => t + Math.abs(d.desvio), 0)
  const pareto = new Map<string, number>()
  {
    let acum = 0
    for (const d of desvios) {
      acum += Math.abs(d.desvio)
      pareto.set(d.categoria, totalDesvioAbs > 0 ? (acum / totalDesvioAbs) * 100 : 0)
    }
  }
  const qtdPareto = Math.max(1, desvios.findIndex((d) => (pareto.get(d.categoria) ?? 0) >= 80) + 1)
  const detalhe = (d: DesvioCategoria) => (
    <>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        {d.historico.map((h, i) => (
          <span key={i} className="tabular-nums">
            {nomeMesCurto(mesesHistorico[i])}: {v(h)}
          </span>
        ))}
      </div>
      {d.itens.length === 0 ? (
        <p className="text-xs text-neutral-500">Nenhum gasto nesta categoria em {mesReferencia}.</p>
      ) : (
        <ListaRecolhivel rotulo="lançamentos" className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {d.itens.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-neutral-700 dark:text-neutral-300">
                <span className="block truncate">{it.descricao}</span>
                <span className="text-xs text-neutral-400">
                  {formatarData(it.data)}
                  {it.origem === 'conta' ? ' · conta a pagar' : ''}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-100">{v(it.valor, true)}</span>
            </div>
          ))}
        </ListaRecolhivel>
      )}
    </>
  )
  // Ordenação pelos cabeçalhos (padrão: tamanho do desvio). O selo/coluna de Pareto segue o
  // ranking pelo desvio, qualquer que seja a ordem escolhida.
  const topPareto = new Set(desvios.slice(0, qtdPareto).map((d) => d.categoria))
  const chaveOrdem: Record<string, (d: DesvioCategoria) => number | string> = {
    categoria: (d) => d.categoria,
    atual: (d) => d.atual,
    media: (d) => d.media,
    desvio: (d) => Math.abs(d.desvio),
    pareto: (d) => -(pareto.get(d.categoria) ?? 0),
  }
  const ordenados = [...desvios].sort((a, b) => {
    const fa = chaveOrdem[ordem.chave](a)
    const fb = chaveOrdem[ordem.chave](b)
    const fator = ordem.direcao === 'asc' ? 1 : -1
    return typeof fa === 'number' && typeof fb === 'number' ? (fa - fb) * fator : String(fa).localeCompare(String(fb), 'pt-BR') * fator
  })
  const linhasTabela = todas ? ordenados : ordenados.slice(0, 5)
  const cabecalho = (chave: string, rotulo: string, alinhar: 'esq' | 'dir' = 'dir') => {
    const ativa = ordem.chave === chave
    return (
      <button
        type="button"
        onClick={() =>
          setOrdem((o) =>
            o.chave === chave ? { chave, direcao: o.direcao === 'desc' ? 'asc' : 'desc' } : { chave, direcao: chave === 'categoria' ? 'asc' : 'desc' },
          )
        }
        className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${ativa ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''} ${alinhar === 'dir' ? 'flex-row-reverse' : ''}`}
        aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        {rotulo}
        <span aria-hidden="true" className={ativa ? '' : 'opacity-30'}>
          {ativa ? (ordem.direcao === 'desc' ? '▼' : '▲') : '↕'}
        </span>
      </button>
    )
  }
  const baseRotulo =
    mesesHistorico.length > 1
      ? `média de ${mesesHistorico.slice(0, -1).map(nomeMesCurto).join(', ')}`
      : 'média dos meses anteriores'

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Onde estão os desvios · {mesReferencia}</h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">gasto por categoria vs {baseRotulo}</span>
      </div>

      {/* Destaques */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Saídas do mês vs média</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {saidasAtual === null ? '—' : v(saidasAtual)}
          </p>
          {saidasAtual !== null && saidasMedia !== null && saidasMedia > 0 && (
            <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
              <Seta desvio={saidasAtual - saidasMedia} /> {sinal(saidasAtual - saidasMedia)}
              {v(Math.abs(saidasAtual - saidasMedia))} ({sinal(saidasAtual - saidasMedia)}
              {Math.abs(((saidasAtual - saidasMedia) / saidasMedia) * 100).toFixed(1).replace('.', ',')}%)
            </p>
          )}
        </div>
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Categorias acima da média</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {acima.length} <span className="text-sm font-normal text-neutral-500">· {sinal(totalAcima)}{v(Math.abs(totalAcima))}</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Categorias abaixo da média</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {abaixo.length} <span className="text-sm font-normal text-neutral-500">· {sinal(totalAbaixo)}{v(Math.abs(totalAbaixo))}</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Maior alta</p>
          <p className="mt-1 truncate text-lg font-semibold text-neutral-900 dark:text-neutral-100">{maiorAlta ? maiorAlta.categoria : '—'}</p>
          {maiorAlta && (
            <p className="text-xs tabular-nums text-orange-700 dark:text-orange-400">
              ▲ +{v(maiorAlta.desvio)}
              {maiorAlta.percentual !== null && ` (+${maiorAlta.percentual.toFixed(0)}%)`}
            </p>
          )}
        </div>
      </div>

      {/* Detalhe por categoria: o gráfico divergente mora dentro da própria linha da tabela */}
      <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Desvio por categoria</h3>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Ordenado pelo tamanho do desvio. Toque numa categoria para ver os lançamentos.
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              <SeloPareto /> {qtdPareto} de {desvios.length} categorias explicam 80% dos desvios (Pareto)
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ACIMA }} /> ▲ gastou mais que a média
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ABAIXO }} /> ▼ gastou menos
            </span>
          </div>
        </div>
      </div>

      {/* Celular: cartões empilhados (sem rolagem lateral) */}
      <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 sm:hidden dark:divide-neutral-800 dark:border-neutral-800">
        {linhasTabela.map((d, idx) => {
          const expandida = aberta === d.categoria
          const noPareto = topPareto.has(d.categoria)
          return (
            <li key={d.categoria} className={expandida ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}>
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : d.categoria)}
                aria-expanded={expandida}
                className="flex w-full flex-col gap-2 px-3 py-3 text-left"
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
                      <span className="w-3 text-neutral-400">{expandida ? '▾' : '▸'}</span>
                      <span className="truncate">{d.categoria}</span>
                      {noPareto && <SeloPareto />}
                    </span>
                    <span className="ml-[18px] block text-xs text-neutral-500 dark:text-neutral-400">
                      {v(d.atual)} · média {v(d.media)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                    <Seta desvio={d.desvio} /> {sinal(d.desvio)}
                    {v(Math.abs(d.desvio))}
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                      {d.percentual === null ? 'novo' : `${sinal(d.percentual)}${Math.abs(d.percentual).toFixed(0)}%`} · acum.{' '}
                      {Math.round(pareto.get(d.categoria) ?? 0)}%
                    </span>
                  </span>
                </span>
                <BarraDivergente desvio={d.desvio} escala={escala} />
              </button>
              {expandida && <div className="px-3 pb-4">{detalhe(d)}</div>}
            </li>
          )
        })}
      </ul>

      {/* Tablet/desktop: tabela */}
      <div className="mt-3 hidden overflow-x-auto rounded-lg border border-neutral-200 sm:block dark:border-neutral-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/60">
            <tr className="text-left text-xs text-neutral-500 dark:text-neutral-400">
              <th className="py-2.5 pl-3 pr-3 font-medium">{cabecalho('categoria', 'Categoria', 'esq')}</th>
              <th className="py-2.5 pr-3 font-medium" title={`Últimos ${mesesHistorico.length} meses; a barra escura é ${mesReferencia}`}>
                Últimos meses
              </th>
              <th className="py-2.5 pr-3 text-right font-medium">{cabecalho('atual', `Gasto em ${nomeMesCurto(mesReferenciaChave)}`)}</th>
              <th className="py-2.5 pr-3 text-right font-medium">{cabecalho('media', 'Média anterior')}</th>
              <th className="w-[30%] py-2.5 pr-3 text-center font-medium">{cabecalho('desvio', 'Desvio vs média', 'esq')}</th>
              <th className="py-2.5 pr-3 text-right font-medium" title="Pareto: quanto do desvio total as linhas até aqui explicam (ranking pelo desvio)">
                {cabecalho('pareto', 'Pareto (acum.)')}
              </th>
            </tr>
          </thead>
          <tbody>
            {linhasTabela.map((d, idx) => {
              const expandida = aberta === d.categoria
              const noPareto = topPareto.has(d.categoria)
              const acumulado = pareto.get(d.categoria) ?? 0
              return (
                <FragmentoLinha key={d.categoria}>
                  <tr
                    className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50 ${expandida ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}`}
                    aria-expanded={expandida}
                    onClick={() => setAberta(expandida ? null : d.categoria)}
                  >
                    <td className="py-2.5 pl-3 pr-3 font-medium text-neutral-900 dark:text-neutral-100">
                      <span className="mr-1.5 inline-block w-3 text-neutral-400">{expandida ? '▾' : '▸'}</span>
                      {d.categoria}
                      {noPareto && <SeloPareto />}
                      <span className="ml-1.5 text-xs font-normal text-neutral-400">
                        {d.itens.length} {d.itens.length === 1 ? 'item' : 'itens'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Sparkline valores={d.historico} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-900 dark:text-neutral-100">{v(d.atual)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{v(d.media)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <BarraDivergente desvio={d.desvio} escala={escala} />
                        <span className="w-32 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                          <Seta desvio={d.desvio} /> {sinal(d.desvio)}
                          {v(Math.abs(d.desvio))}
                          <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {d.percentual === null ? 'novo' : `${sinal(d.percentual)}${Math.abs(d.percentual).toFixed(0)}%`}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <BarraPareto acumulado={acumulado} destaque={noPareto} />
                    </td>
                  </tr>
                  {expandida && (
                    <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                      <td colSpan={6} className="px-3 pb-4 pt-1">
                        <div className="ml-4 border-l-2 border-neutral-300 pl-4 dark:border-neutral-600">{detalhe(d)}</div>
                      </td>
                    </tr>
                  )}
                </FragmentoLinha>
              )
            })}
          </tbody>
        </table>
      </div>
      {desvios.length > 5 && (
        <button
          type="button"
          onClick={() => setTodas((t) => !t)}
          className="mt-3 text-xs font-medium text-militar-700 hover:underline dark:text-militar-500"
        >
          {todas ? '▲ Mostrar só os 5 maiores desvios' : `▼ Ver mais ${desvios.length - 5} categorias (${desvios.length} no total)`}
        </button>
      )}

      {/* Maiores gastos do mês */}
      {maioresGastos.length > 0 && (
        <details className="group mt-5 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <span>
              <span className="mr-1.5 inline-block text-neutral-400 transition group-open:rotate-90">▸</span>
              Maiores gastos de {mesReferencia}
            </span>
            <span className="text-xs font-normal text-neutral-500">{maioresGastos.length} itens</span>
          </summary>
          <ul className="divide-y divide-neutral-100 border-t border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
            {(maisGastos ? maioresGastos : maioresGastos.slice(0, 5)).map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-neutral-800 dark:text-neutral-200">{g.descricao}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {g.categoria} · {formatarData(g.data)}
                    {g.origem === 'conta' ? ' · conta a pagar' : ''}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">{v(g.valor, true)}</span>
              </li>
            ))}
          </ul>
          {maioresGastos.length > 5 && (
            <button
              type="button"
              onClick={() => setMaisGastos((m) => !m)}
              className="px-4 pb-3 pt-1 text-xs font-medium text-militar-700 hover:underline dark:text-militar-500"
            >
              {maisGastos ? 'Mostrar menos' : `Ver os ${maioresGastos.length}`}
            </button>
          )}
        </details>
      )}
    </section>
  )
}

function FragmentoLinha({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
