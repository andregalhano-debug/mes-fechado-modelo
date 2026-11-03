'use client'

import { TabelaOrdenavel } from '@/components/tabela-ordenavel'

import { useState } from 'react'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const cartao =
  'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'

type ItemHistorico = {
  linhagemId: string
  rotulo: string
  mes: string
  valor: number
  pago: boolean
}

function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function delta(atual: number, anterior: number) {
  const diferenca = atual - anterior
  if (anterior === 0) return { texto: brl.format(diferenca), classe: 'text-neutral-500 dark:text-neutral-400' }
  const percentualDiferenca = (diferenca / Math.abs(anterior)) * 100
  const sinal = diferenca >= 0 ? '+' : ''
  const classe =
    diferenca === 0
      ? 'text-neutral-500 dark:text-neutral-400'
      : diferenca > 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-emerald-600 dark:text-emerald-400'
  return { texto: `${sinal}${brl.format(diferenca)} (${sinal}${percentual.format(percentualDiferenca)}%)`, classe }
}

// Balanço mensal das contas a pagar: cada conta pertence ao mês do próprio vencimento
// (não ao "mês aberto") — pago ou não, ela conta pro balanço daquele mês. A mesma conta
// recorrente atravessa os meses pela linhagem_id, então dá pra comparar item a item.
const PERIODOS_HIST = [
  { id: '6m', rotulo: 'Últimos 6 meses' },
  { id: '12m', rotulo: 'Últimos 12 meses' },
  { id: 'ano', rotulo: 'Este ano' },
  { id: 'tudo', rotulo: 'Tudo' },
] as const

export function HistoricoContas({ itens: todosItens }: { itens: ItemHistorico[] }) {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS_HIST)[number]['id']>('12m')
  const hojeMes = new Date().toISOString().slice(0, 7) + '-01'
  const ano = hojeMes.slice(0, 4)
  const limite = (() => {
    const d = new Date(`${hojeMes}T12:00:00`)
    d.setMonth(d.getMonth() - (periodo === '6m' ? 5 : 11))
    return d.toISOString().slice(0, 7) + '-01'
  })()
  // período escolhido (meses futuros já lançados, como renovações, continuam visíveis no fim)
  const itens = todosItens.filter((i) => (periodo === 'tudo' ? true : periodo === 'ano' ? i.mes.startsWith(ano) || i.mes > hojeMes : i.mes >= limite))
  const meses = Array.from(new Set(itens.map((i) => i.mes))).sort()
  const seletor = (
    <div role="group" aria-label="Período do histórico" className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 p-1 dark:border-neutral-800">
      {PERIODOS_HIST.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setPeriodo(p.id)}
          aria-pressed={periodo === p.id}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${periodo === p.id ? 'bg-militar-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  )

  if (meses.length < 2) {
    return (
      <section className={cartao}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Histórico</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Ainda só existe um mês de contas registrado — quando houver contas em pelo menos dois
          meses diferentes, o balanço comparado aparece aqui.
        </p>
      </section>
    )
  }

  const totalPorMes = new Map<string, number>()
  const pagoPorMes = new Map<string, number>()
  for (const i of itens) {
    totalPorMes.set(i.mes, (totalPorMes.get(i.mes) ?? 0) + i.valor)
    if (i.pago) pagoPorMes.set(i.mes, (pagoPorMes.get(i.mes) ?? 0) + i.valor)
  }

  const porLinhagem = new Map<string, ItemHistorico[]>()
  for (const i of itens) {
    const lista = porLinhagem.get(i.linhagemId) ?? []
    lista.push(i)
    porLinhagem.set(i.linhagemId, lista)
  }

  const mesesDesc = [...meses].reverse()

  return (
    <section className={cartao}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Balanço mensal</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Total de contas por mês de vencimento (pagas + em aberto), com o detalhamento
        item a item colapsado abaixo. Alta em vermelho, queda em verde — porque aqui é gasto.
      </p>
      {seletor}

      <IndicadoresHistorico meses={meses} mesesDesc={mesesDesc} totalPorMes={totalPorMes} pagoPorMes={pagoPorMes} />

      <div className="mt-4">
        <TabelaOrdenavel
          rotulo="meses"
          ordemInicial={{ chave: 'mes', direcao: 'desc' }}
          colunas={[
            { chave: 'mes', rotulo: 'Mês' },
            { chave: 'total', soma: 'brl', rotulo: 'Total do mês', alinhar: 'dir' },
            { chave: 'pago', soma: 'brl', rotulo: 'Pago', alinhar: 'dir', ocultarNoCelular: true },
            { chave: 'aberto', soma: 'brl', rotulo: 'Em aberto', alinhar: 'dir' },
          ]}
          linhas={mesesDesc.map((mes, indice) => {
            const anterior = mesesDesc[indice + 1]
            const total = totalPorMes.get(mes) ?? 0
            const pago = pagoPorMes.get(mes) ?? 0
            const totalAnterior = anterior ? (totalPorMes.get(anterior) ?? 0) : null
            const d = totalAnterior !== null ? delta(total, totalAnterior) : null
            return {
              id: mes,
              valores: { mes, total, pago, aberto: total - pago },
              celulas: {
                mes: <span className="font-medium text-neutral-900 dark:text-neutral-100">{nomeMes(mes)}</span>,
                total: (
                  <span className="tabular-nums">
                    <span className="block text-neutral-900 dark:text-neutral-100">{brl.format(total)}</span>
                    {d && <span className={`block text-xs ${d.classe}`}>{d.texto}</span>}
                  </span>
                ),
                pago: <span className="tabular-nums text-neutral-700 dark:text-neutral-300">{brl.format(pago)}</span>,
                aberto: <span className="tabular-nums text-neutral-700 dark:text-neutral-300">{brl.format(total - pago)}</span>,
              },
            }
          })}
        />
      </div>

      <DetalhamentoColapsado porLinhagem={porLinhagem} meses={meses} />
    </section>
  )
}

// Indicadores do histórico: média recente, mês mais recente × anterior, maior mês e o que segue em aberto.
function IndicadoresHistorico({
  meses,
  mesesDesc,
  totalPorMes,
  pagoPorMes,
}: {
  meses: string[]
  mesesDesc: string[]
  totalPorMes: Map<string, number>
  pagoPorMes: Map<string, number>
}) {
  // só meses até o atual (o histórico também traz renovações futuras já lançadas)
  const hoje = new Date().toISOString().slice(0, 7) + '-01'
  mesesDesc = mesesDesc.filter((m) => m <= hoje)
  meses = meses.filter((m) => m <= hoje)
  if (!mesesDesc.length) return null
  const ult = mesesDesc.slice(0, 6)
  const media = ult.reduce((t, m) => t + (totalPorMes.get(m) ?? 0), 0) / (ult.length || 1)
  const [atual, anterior] = mesesDesc
  const vAtual = totalPorMes.get(atual) ?? 0
  const d = anterior ? delta(vAtual, totalPorMes.get(anterior) ?? 0) : null
  const maior = [...meses].sort((x, y) => (totalPorMes.get(y) ?? 0) - (totalPorMes.get(x) ?? 0))[0]
  const emAberto = meses.reduce((t, m) => t + (totalPorMes.get(m) ?? 0) - (pagoPorMes.get(m) ?? 0), 0)
  const itens = [
    { r: 'Média mensal', v: brl.format(media), n: `últimos ${ult.length} meses` },
    { r: `Mês mais recente (${nomeMes(atual)})`, v: brl.format(vAtual), n: d ? `vs anterior: ${d.texto}` : '' },
    { r: 'Maior mês', v: brl.format(totalPorMes.get(maior) ?? 0), n: nomeMes(maior) },
    { r: 'Ainda em aberto', v: brl.format(emAberto), n: 'até o mês atual' },
  ]
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((x) => (
        <div key={x.r} className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{x.r}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{x.v}</p>
          {x.n && <p className="mt-0.5 text-[11px] text-neutral-500">{x.n}</p>}
        </div>
      ))}
    </div>
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
        className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500"
      >
        {aberto ? 'Recolher detalhamento item a item' : 'Ver detalhamento item a item'}
      </button>

      {aberto && (
        <div className="mt-3">
          <TabelaOrdenavel
            rotulo="contas"
            ordemInicial={{ chave: 'valor', direcao: 'desc' }}
            colunas={[
              { chave: 'conta', rotulo: 'Conta' },
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
                  conta: l.referencia.rotulo,
                  valor: valorAtual ?? null,
                  delta: valorAtual !== undefined && valorAnterior !== undefined ? valorAtual - valorAnterior : null,
                },
                celulas: {
                  conta: (
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {l.referencia.rotulo}
                      {!l.doMesAtual && <span className="ml-1 text-xs text-neutral-400">(removido/quitado)</span>}
                      {!l.doMesAnterior && <span className="ml-1 text-xs text-neutral-400">(nova)</span>}
                    </span>
                  ),
                  valor: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{valorAtual !== undefined ? brl.format(valorAtual) : '—'}</span>,
                  delta: <span className={`text-xs tabular-nums ${d?.classe ?? 'text-neutral-400'}`}>{d ? d.texto : '—'}</span>,
                },
              }
            })}
          />
        </div>
      )}
    </div>
  )
}
