'use client'

import { TabelaOrdenavel } from '@/components/tabela-ordenavel'

import { useState } from 'react'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const cartao =
  'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'

const ROTULO_TIPO: Record<string, string> = {
  conta: 'Conta',
  investimento: 'Investimento',
  bem: 'Bem',
  retido: 'Retido',
}

type ItemHistorico = {
  tipo: 'conta' | 'investimento' | 'bem' | 'retido'
  linhagemId: string
  rotulo: string
  mes: string
  valor: number
}

function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// Pílula de destaque do delta: fundo colorido + seta, pra variação saltar aos olhos.
function PilulaDelta({ d }: { d: ReturnType<typeof delta> | null }) {
  if (!d) return <span className="text-neutral-400">—</span>
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${d.pilula}`}>
      <span aria-hidden="true">{d.seta}</span>
      {d.texto}
    </span>
  )
}

function delta(atual: number, anterior: number) {
  const diferenca = atual - anterior
  const seta = diferenca > 0 ? '▲' : diferenca < 0 ? '▼' : '•'
  const pilula =
    diferenca === 0
      ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
      : diferenca > 0
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
        : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900'
  if (anterior === 0) return { texto: brl.format(diferenca), classe: 'text-neutral-500 dark:text-neutral-400', seta, pilula }
  const percentualDiferenca = (diferenca / Math.abs(anterior)) * 100
  const sinal = diferenca >= 0 ? '+' : ''
  const classe =
    diferenca === 0
      ? 'text-neutral-500 dark:text-neutral-400'
      : diferenca > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'
  return { texto: `${sinal}${brl.format(diferenca)} (${sinal}${percentual.format(percentualDiferenca)}%)`, classe, seta, pilula }
}

export function HistoricoPatrimonio({ itens }: { itens: ItemHistorico[] }) {
  const meses = Array.from(new Set(itens.map((i) => i.mes))).sort()

  if (meses.length < 2) {
    return (
      <section className={`${cartao} mt-6`}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Histórico</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Ainda só existe um mês registrado — inicie o mês seguinte pra começar a comparar.
        </p>
      </section>
    )
  }

  const totalPorMes = new Map<string, number>()
  for (const i of itens) totalPorMes.set(i.mes, (totalPorMes.get(i.mes) ?? 0) + i.valor)

  const porLinhagem = new Map<string, ItemHistorico[]>()
  for (const i of itens) {
    const lista = porLinhagem.get(i.linhagemId) ?? []
    lista.push(i)
    porLinhagem.set(i.linhagemId, lista)
  }

  const mesesDesc = [...meses].reverse()

  return (
    <section className={`${cartao} mt-6`}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Histórico e deltas</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Patrimônio total por mês, com o detalhamento item a item colapsado abaixo.
      </p>

      <div className="mt-4">
        <TabelaOrdenavel
          rotulo="meses"
          ordemInicial={{ chave: 'mes', direcao: 'desc' }}
          colunas={[
            { chave: 'mes', rotulo: 'Mês' },
            { chave: 'total', rotulo: 'Patrimônio total', alinhar: 'dir' },
            { chave: 'variacao', soma: 'brl', rotulo: 'Variação', alinhar: 'dir' },
          ]}
          linhas={mesesDesc.map((mes, indice) => {
            const anterior = mesesDesc[indice + 1]
            const total = totalPorMes.get(mes) ?? 0
            const totalAnterior = anterior ? (totalPorMes.get(anterior) ?? 0) : null
            const d = totalAnterior !== null ? delta(total, totalAnterior) : null
            return {
              id: mes,
              valores: { mes, total, variacao: totalAnterior !== null ? total - totalAnterior : null },
              celulas: {
                mes: <span className="font-medium text-neutral-900 dark:text-neutral-100">{nomeMes(mes)}</span>,
                total: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(total)}</span>,
                variacao: d ? <PilulaDelta d={d} /> : <span className="text-neutral-400">—</span>,
              },
            }
          })}
        />
      </div>

      <DetalhamentoColapsado porLinhagem={porLinhagem} meses={meses} />
    </section>
  )
}

function DetalhamentoColapsado({
  porLinhagem,
  meses,
}: {
  porLinhagem: Map<string, ItemHistorico[]>
  meses: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const mesAtual = meses[meses.length - 1]
  const mesAnterior = meses[meses.length - 2]

  const linhas = Array.from(porLinhagem.values())
    .map((serie) => {
      const ordenada = [...serie].sort((a, b) => a.mes.localeCompare(b.mes))
      const doMesAtual = ordenada.find((s) => s.mes === mesAtual)
      const doMesAnterior = ordenada.find((s) => s.mes === mesAnterior)
      return { referencia: ordenada[ordenada.length - 1], doMesAtual, doMesAnterior }
    })
    // só mostra quem existiu no mês atual ou no anterior — item que sumiu ou surgiu ainda aparece
    .filter((l) => l.doMesAtual || l.doMesAnterior)
    .sort((a, b) => (b.doMesAtual?.valor ?? 0) - (a.doMesAtual?.valor ?? 0))

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 rounded-lg border border-militar-600 px-3 py-1.5 text-sm font-semibold text-militar-700 transition hover:bg-militar-50 dark:text-militar-400 dark:hover:bg-militar-950/30"
      >
        <span aria-hidden="true">{aberto ? '▴' : '▾'}</span>
        {aberto ? 'Recolher detalhamento item a item' : 'Ver delta item a item vs mês anterior'}
      </button>

      {aberto && (
        <div className="mt-3">
          <TabelaOrdenavel
            rotulo="itens"
            ordemInicial={{ chave: 'valor', direcao: 'desc' }}
            colunas={[
              { chave: 'item', rotulo: 'Item' },
              { chave: 'tipo', rotulo: 'Tipo', ocultarNoCelular: true },
              { chave: 'valor', soma: 'brl', rotulo: 'Valor atual', alinhar: 'dir' },
              { chave: 'delta', soma: 'brl', rotulo: 'Delta', alinhar: 'dir', dica: 'Delta vs mês anterior' },
            ]}
            linhas={linhas.map((l, indice) => {
              const valorAtual = l.doMesAtual?.valor
              const valorAnterior = l.doMesAnterior?.valor
              const d = valorAtual !== undefined && valorAnterior !== undefined ? delta(valorAtual, valorAnterior) : null
              return {
                id: String(indice),
                valores: {
                  item: l.referencia.rotulo,
                  tipo: ROTULO_TIPO[l.referencia.tipo],
                  valor: valorAtual ?? null,
                  delta: valorAtual !== undefined && valorAnterior !== undefined ? valorAtual - valorAnterior : null,
                },
                celulas: {
                  item: (
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {l.referencia.rotulo}
                      {!l.doMesAtual && <span className="ml-1 text-xs text-neutral-400">(removido)</span>}
                      {!l.doMesAnterior && <span className="ml-1 text-xs text-neutral-400">(novo)</span>}
                    </span>
                  ),
                  tipo: <span className="text-neutral-500 dark:text-neutral-400">{ROTULO_TIPO[l.referencia.tipo]}</span>,
                  valor: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{valorAtual !== undefined ? brl.format(valorAtual) : '—'}</span>,
                  delta: <PilulaDelta d={d} />,
                },
              }
            })}
          />
        </div>
      )}
    </div>
  )
}
