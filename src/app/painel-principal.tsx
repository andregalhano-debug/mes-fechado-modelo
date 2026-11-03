'use client'

import { GraficoLinhas } from '@/components/grafico-linhas'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatarData } from '@/lib/data'
import { GraficoPizza, type FatiaPizza } from '@/components/grafico-pizza'
import { GraficoBarras, type Barra } from '@/components/grafico-barras'
import { useOcultarValores } from '@/components/ocultar-valores-toggle'
import { Desvios, type DesvioCategoria, type MaiorGasto } from './desvios'
import { ResumoDocumentos, type DocumentoResumo } from './resumo-documentos'
import { TabelaOrdenavel } from '@/components/tabela-ordenavel'
import { BarraShare } from '@/components/lista-recolhivel'

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const brlCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const CHAVE_COLAPSO = 'financas:contas-a-pagar-colapsado'
const MASCARA = '• • • • • •'

type ContaAberta = { id: string; descricao: string; valor: number; vencimento: string; atrasada?: boolean; mesAnterior?: boolean }
type MesFluxo = { mes: string; receitas: number; despesas: number; saldo: number; poupanca: number | null }

export type LinhaResumo = {
  mes: string
  emAndamento: boolean
  receitas: number
  gastoCartoes: number
  gastoOutras: number
  gastoAvulsos: number
  gasto: number
  saldo: number
  poupanca: number | null
}

type Props = {
  resumoGerencial: LinhaResumo[]
  contasDoMes: { total: number; pago: number; qtd: number; qtdPagas: number }
  desvios: DesvioCategoria[]
  documentosResumo: DocumentoResumo[]
  parcelas: { total: number; mensal: number; qtd: number }
  maioresGastos: MaiorGasto[]
  mesesHistorico: string[]
  mesReferenciaChave: string
  receitas: number
  despesas: number
  semDados: boolean
  /** período considerado em cada indicador */
  periodosIndicadores: { mes: string; fluxo: string; parcelas: string; comprometimento: string }
  mesReferencia: string
  categorias: FatiaPizza[]
  mesReferenciaGrafico: string
  mesAtualIncompleto: boolean
  mesesBarras: Barra[]
  historicoFluxo: MesFluxo[]
  empresasDoMes: [string, number][]
  comprometimentoRenda: number | null
  faturasCartao: { total: number; qtd: number; pagas: number }
  proximaRenovacao: { descricao: string; vencimento: string; valor: number; lembrete: boolean } | null
  documentosAguardando: number
  aPagar: ContaAberta[]
}

export function PainelPrincipal({
  resumoGerencial,
  contasDoMes,
  desvios,
  documentosResumo,
  parcelas,
  maioresGastos,
  mesesHistorico,
  mesReferenciaChave,
  receitas,
  despesas,
  semDados,
  periodosIndicadores,
  mesReferencia,
  categorias,
  mesReferenciaGrafico,
  mesAtualIncompleto,
  mesesBarras,
  historicoFluxo,
  empresasDoMes,
  comprometimentoRenda,
  faturasCartao,
  proximaRenovacao,
  documentosAguardando,
  aPagar,
}: Props) {
  const oculto = useOcultarValores()
  const [colapsado, setColapsado] = useState(false)
  const [todosMeses, setTodosMeses] = useState(false)
  const [todasEmpresas, setTodasEmpresas] = useState(false)
  const resumoRef = resumoGerencial.find((r) => r.mes === mesReferenciaChave) ?? null
  const resumoBase = resumoGerencial.filter((r) => r.mes < mesReferenciaChave && r.gasto > 0).slice(-3)
  const saidasMedia = resumoBase.length > 0 ? resumoBase.reduce((t, r) => t + r.gasto, 0) / resumoBase.length : null

  useEffect(() => {
    setColapsado(localStorage.getItem(CHAVE_COLAPSO) === '1')
  }, [])

  function alternarColapso() {
    setColapsado((atual) => {
      const novo = !atual
      localStorage.setItem(CHAVE_COLAPSO, novo ? '1' : '0')
      return novo
    })
  }

  const totalAPagar = aPagar.reduce((t, c) => t + c.valor, 0)
  const totalEmpresas = empresasDoMes.reduce((t, [, v]) => t + v, 0)
  // Pareto das faturas e contas (lista já vem da maior pra menor): acumulado e quantas fazem 80%.
  const acumuladoFonte: number[] = []
  empresasDoMes.reduce((acum, [, v]) => {
    const novo = acum + v
    acumuladoFonte.push(totalEmpresas > 0 ? (novo / totalEmpresas) * 100 : 0)
    return novo
  }, 0)
  const qtdParetoFontes = Math.max(1, acumuladoFonte.findIndex((p) => p >= 80) + 1)


  return (
    <>
      {semDados && (
        <div className="mb-8 rounded-xl border border-militar-300 bg-militar-50 p-5 dark:border-militar-800 dark:bg-militar-950/40">
          <p className="font-semibold text-militar-900 dark:text-militar-200">
            Ainda não há nada lançado.
          </p>
          <p className="mt-1 text-sm text-militar-800 dark:text-militar-300">
            Envie o PDF de uma fatura ou um print de saldo e a IA organiza o resto.
          </p>
        </div>
      )}

      {/* Indicadores de Contas a pagar (patrimônio fica só na tela Patrimônio, protegida) */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Contas a pagar · {mesReferencia}</h2>
        <Link href="/contas-a-pagar" className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500">
          abrir Contas a pagar →
        </Link>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          rotulo="A pagar no mês"
          tom={aPagar.some((c) => c.atrasada) ? 'negativo' : undefined}
          valor={oculto ? MASCARA : brlCentavos.format(totalAPagar)}
          nota={
            aPagar.length === 0
              ? 'tudo pago neste mês'
              : `${aPagar.length} conta${aPagar.length > 1 ? 's' : ''} em aberto${aPagar.some((c) => c.atrasada) ? ` · ${aPagar.filter((c) => c.atrasada).length} atrasada${aPagar.filter((c) => c.atrasada).length > 1 ? 's' : ''}` : ''}`
          }
          periodo={periodosIndicadores.mes}
          href="/contas-a-pagar?aba=contas"
        />
        <Cartao
          rotulo="Contas pagas"
          tom={contasDoMes.qtd > 0 && contasDoMes.qtdPagas === contasDoMes.qtd ? 'positivo' : undefined}
          valor={`${contasDoMes.qtdPagas} de ${contasDoMes.qtd}`}
          nota={
            oculto
              ? '• • •'
              : `${brlCentavos.format(contasDoMes.pago)} de ${brlCentavos.format(contasDoMes.total)} (${contasDoMes.total > 0 ? Math.round((contasDoMes.pago / contasDoMes.total) * 100) : 0}%)`
          }
          periodo={periodosIndicadores.mes}
          href="/contas-a-pagar?aba=contas"
        />
        <Cartao
          rotulo="Faturas de cartão"
          valor={oculto ? MASCARA : brlCentavos.format(faturasCartao.total)}
          nota={faturasCartao.qtd === 0 ? 'nenhuma fatura no mês' : `${faturasCartao.qtd} fatura${faturasCartao.qtd > 1 ? 's' : ''} · ${faturasCartao.pagas} paga${faturasCartao.pagas === 1 ? '' : 's'}`}
          periodo={periodosIndicadores.mes}
          href="/contas-a-pagar?aba=cartoes"
        />
        <Cartao
          rotulo="Parcelas em aberto"
          valor={oculto ? MASCARA : brl.format(parcelas.total)}
          nota={
            oculto
              ? '• • •'
              : parcelas.qtd === 0
                ? 'nenhuma compra parcelada em aberto'
                : `${parcelas.qtd} compra${parcelas.qtd === 1 ? '' : 's'} · ${brl.format(parcelas.mensal)}/mês nas próximas faturas`
          }
          periodo={periodosIndicadores.parcelas}
          href="/contas-a-pagar?aba=parcelas"
        />
        <Cartao
          rotulo="Fluxo do mês"
          tom={receitas - despesas < 0 ? 'negativo' : 'positivo'}
          valor={oculto ? MASCARA : brl.format(receitas - despesas)}
          nota={oculto ? '• • •' : `receita ${brl.format(receitas)} · saídas ${brl.format(despesas)}`}
          periodo={periodosIndicadores.fluxo}
          href="/contas-a-pagar?aba=lancamentos"
        />
        <Cartao
          rotulo="Comprometimento com contas fixas"
          valor={comprometimentoRenda === null ? '—' : `${percentual.format(comprometimentoRenda)}%`}
          nota="contas recorrentes ÷ receita do mês"
          periodo={periodosIndicadores.comprometimento}
          href="/contas-a-pagar?aba=contas"
        />
        <Cartao
          rotulo="Próxima renovação anual"
          valor={proximaRenovacao ? formatarData(proximaRenovacao.vencimento) : '—'}
          nota={
            proximaRenovacao
              ? `${proximaRenovacao.descricao} · ${oculto ? '• • •' : brlCentavos.format(proximaRenovacao.valor)}${proximaRenovacao.lembrete ? ' · só lembrete (cobrada no cartão)' : ''}`
              : 'nenhuma conta anual cadastrada'
          }
          href="/contas-a-pagar?aba=contas"
        />
        <Cartao
          rotulo="Documentos para revisar"
          tom={documentosAguardando > 0 ? 'negativo' : undefined}
          valor={String(documentosAguardando)}
          nota={documentosAguardando > 0 ? 'faturas e comprovantes aguardando sua confirmação' : 'nada aguardando confirmação'}
          href="/contas-a-pagar?aba=documentos"
        />
      </section>

      {!semDados && (
        <Desvios
          desvios={desvios}
          maioresGastos={maioresGastos}
          mesReferencia={mesReferenciaGrafico}
          mesReferenciaChave={mesReferenciaChave}
          mesesHistorico={mesesHistorico}
          saidasAtual={resumoRef ? resumoRef.gasto : null}
          saidasMedia={saidasMedia}
          oculto={oculto}
        />
      )}

      {/* Visão gerencial: evolução histórica das saídas */}
      <section className="mt-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Saídas x receitas por mês</h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">saídas = contas a pagar (com faturas de cartão) + avulsos</span>
          </div>
          <GraficoLinhas
            chips
            ocultar={oculto}
            meses={resumoGerencial.map((r) => `${r.mes}-01`)}
            series={[
              { id: 'gasto', rotulo: 'Saídas totais', cor: 'var(--serie-2)', valores: resumoGerencial.map((r) => r.gasto) },
              { id: 'cartoes', rotulo: 'Faturas de cartão', cor: 'var(--serie-4)', valores: resumoGerencial.map((r) => r.gastoCartoes) },
              { id: 'outras', rotulo: 'Demais contas', cor: 'var(--serie-5)', valores: resumoGerencial.map((r) => r.gastoOutras) },
              { id: 'receita', rotulo: 'Receitas', cor: 'var(--serie-3)', valores: resumoGerencial.map((r) => (r.receitas > 0 ? r.receitas : null)) },
            ]}
          />
        </div>
      </section>

      {/* Gastos por categoria + despesas dos últimos 6 meses, antes do envio e das últimas faturas */}
      {!semDados && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Gastos por categoria · {mesReferenciaGrafico}
            </h2>
            {mesAtualIncompleto && (
              <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                {mesReferencia} ainda tem poucos gastos confirmados — mostrando o mês mais recente com dados.
              </p>
            )}
            {oculto ? (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Valores ocultos.</p>
            ) : (
              <div className="flex flex-1 items-center [&>div]:w-full">
                <GraficoPizza dados={categorias} formatarValor={(v) => brl.format(v)} semRolagem />
              </div>
            )}
          </div>
          <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Despesas nos últimos 6 meses
            </h2>
            <div className="flex-1">
              <GraficoBarras dados={mesesBarras} formatarValor={(v) => brl.format(v)} ocultarValores={oculto} preencher />
            </div>
          </div>
        </section>
      )}

      {/* Ação principal */}
      <Link
        href="/enviar"
        className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-dashed border-militar-400 bg-militar-50 px-5 py-4 transition hover:border-militar-500 hover:bg-militar-100 dark:border-militar-700 dark:bg-militar-950/30 dark:hover:bg-militar-950/50"
      >
        <div>
          <p className="font-semibold text-militar-900 dark:text-militar-200">Enviar fatura ou saldo</p>
          <p className="mt-0.5 text-sm text-militar-800 dark:text-militar-300">
            PDF da fatura, print do saldo ou foto da nota — a IA lê e você confere antes de lançar.
            {documentosAguardando > 0 &&
              ` ${documentosAguardando} documento${documentosAguardando > 1 ? 's' : ''} aguardando confirmação — clique para revisar.`}
          </p>
        </div>
        <span className="shrink-0 text-militar-700 dark:text-militar-400" aria-hidden="true">
          →
        </span>
      </Link>

      {/* Logo depois de enviar: acompanhar as últimas faturas (revisar, conferir, resolver) */}
      <ResumoDocumentos documentos={documentosResumo} oculto={oculto} />

      {!semDados && (
        <>

          <section className="mt-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Faturas e contas · {mesReferenciaGrafico}
              </h2>
              {oculto ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Valores ocultos.</p>
              ) : empresasDoMes.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Sem gastos categorizados ainda.</p>
              ) : (
                <div className="mt-3">
                  <p className="pb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    <span className="mr-1 rounded bg-amber-100 px-1 py-px text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">80%</span>
                    {qtdParetoFontes} de {empresasDoMes.length} faturas e contas fazem 80% das saídas (Pareto)
                  </p>
                  <TabelaOrdenavel
                    rotulo="faturas e contas"
                    ordemInicial={{ chave: 'valor', direcao: 'desc' }}
                    colunas={[
                      { chave: 'nome', rotulo: 'Fatura / conta' },
                      { chave: 'valor', soma: 'brl', rotulo: 'Valor', alinhar: 'dir' },
                      { chave: 'share', rotulo: 'Share', alinhar: 'dir' },
                      { chave: 'acum', rotulo: 'Pareto acum.', alinhar: 'dir', ocultarNoCelular: true, dica: 'Acumulado do maior para o menor' },
                    ]}
                    linhas={empresasDoMes.map(([nome, valor], i) => ({
                      id: nome,
                      destaque: i < qtdParetoFontes,
                      valores: { nome, valor, share: totalEmpresas > 0 ? (valor / totalEmpresas) * 100 : 0, acum: acumuladoFonte[i] ?? 0 },
                      celulas: {
                        nome: (
                          <span className="text-neutral-800 dark:text-neutral-200">
                            {nome}
                            {i < qtdParetoFontes && (
                              <span className="ml-1.5 rounded bg-amber-100 px-1 py-px align-middle text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                80%
                              </span>
                            )}
                          </span>
                        ),
                        valor: <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(valor)}</span>,
                        share: <BarraShare pct={totalEmpresas > 0 ? (valor / totalEmpresas) * 100 : 0} destaque={i < qtdParetoFontes} />,
                        acum: <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{Math.round(acumuladoFonte[i] ?? 0)}%</span>,
                      },
                    }))}
                  />
                </div>
              )}
            </div>
          </section>

          {!oculto && resumoGerencial.length > 1 && (
            <section className="mt-6">
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Resumo gerencial mês a mês</h2>
                <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
                  Saídas = contas a pagar do mês (inclui o pagamento das faturas de cartão) + lançamentos avulsos. Os lançamentos das faturas ficam no detalhe por categoria, sem somar de novo. O mês atual ainda está em andamento.
                </p>
                {/* Celular: um cartão por mês, sem rolagem lateral */}
                <ul className="space-y-2 sm:hidden">
                  {[...resumoGerencial].reverse().slice(0, todosMeses ? undefined : 4).map((r) => (
                    <li key={r.mes} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {nomeMesCurto(r.mes)}
                          {r.emAndamento && <span className="ml-1.5 text-xs font-normal text-neutral-400">em andamento</span>}
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brlCentavos.format(r.gasto)}</p>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-neutral-500 dark:text-neutral-400">Faturas de cartão</dt>
                        <dd className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">{brlCentavos.format(r.gastoCartoes)}</dd>
                        <dt className="text-neutral-500 dark:text-neutral-400">Demais contas</dt>
                        <dd className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">{brlCentavos.format(r.gastoOutras)}</dd>
                        <dt className="text-neutral-500 dark:text-neutral-400">Receita</dt>
                        <dd className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">{r.receitas > 0 ? brlCentavos.format(r.receitas) : '—'}</dd>
                        <dt className="text-neutral-500 dark:text-neutral-400">Saldo · poupança</dt>
                        <dd className={`text-right tabular-nums ${r.receitas === 0 ? 'text-neutral-400' : r.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {r.receitas > 0 ? `${brlCentavos.format(r.saldo)} · ${r.poupanca === null ? '—' : `${percentual.format(r.poupanca)}%`}` : '—'}
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className="hidden sm:block">
                  <TabelaOrdenavel
                    rotulo="meses"
                    larguraMinima={640}
                    ordemInicial={{ chave: 'mes', direcao: 'desc' }}
                    colunas={[
                      { chave: 'mes', rotulo: 'Mês' },
                      { chave: 'gasto', soma: 'brl', rotulo: 'Saídas', alinhar: 'dir' },
                      { chave: 'cartoes', soma: 'brl', rotulo: 'Faturas de cartão', alinhar: 'dir' },
                      { chave: 'outras', soma: 'brl', rotulo: 'Demais contas', alinhar: 'dir' },
                      { chave: 'receitas', soma: 'brl', rotulo: 'Receita', alinhar: 'dir' },
                      { chave: 'saldo', soma: 'brl', rotulo: 'Saldo', alinhar: 'dir' },
                      { chave: 'poupanca', soma: 'brl', rotulo: 'Poupança', alinhar: 'dir' },
                    ]}
                    linhas={resumoGerencial.map((r) => ({
                      id: r.mes,
                      valores: {
                        mes: r.mes,
                        gasto: r.gasto,
                        cartoes: r.gastoCartoes,
                        outras: r.gastoOutras,
                        receitas: r.receitas > 0 ? r.receitas : null,
                        saldo: r.receitas > 0 ? r.saldo : null,
                        poupanca: r.poupanca,
                      },
                      celulas: {
                        mes: (
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {nomeMesCurto(r.mes)}
                            {r.emAndamento && <span className="ml-1.5 text-xs font-normal text-neutral-400">em andamento</span>}
                          </span>
                        ),
                        gasto: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{brlCentavos.format(r.gasto)}</span>,
                        cartoes: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{brlCentavos.format(r.gastoCartoes)}</span>,
                        outras: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{brlCentavos.format(r.gastoOutras)}</span>,
                        receitas: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{r.receitas > 0 ? brlCentavos.format(r.receitas) : '—'}</span>,
                        saldo: (
                          <span className={`tabular-nums ${r.receitas === 0 ? 'text-neutral-400' : r.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {r.receitas > 0 ? brlCentavos.format(r.saldo) : '—'}
                          </span>
                        ),
                        poupanca: <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{r.poupanca === null ? '—' : `${percentual.format(r.poupanca)}%`}</span>,
                      },
                    }))}
                  />
                </div>
                {resumoGerencial.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setTodosMeses((t) => !t)}
                    className="mt-3 text-xs font-medium text-militar-700 hover:underline sm:hidden dark:text-militar-500"
                  >
                    {todosMeses ? 'Mostrar só os últimos 4 meses' : `Ver todos os ${resumoGerencial.length} meses`}
                  </button>
                )}
                {resumoGerencial.every((r) => r.receitas === 0) && (
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    Nenhuma receita lançada ainda: lance salário e outras entradas para ver saldo e taxa de poupança.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Contas em aberto
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={alternarColapso}
              className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500"
            >
              {colapsado ? 'Ver detalhes' : 'Recolher'}
            </button>
            <Link
              href="/contas-a-pagar"
              className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500"
            >
              Gerenciar
            </Link>
          </div>
        </div>

        {!colapsado && aPagar.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {aPagar.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 bg-white px-4 py-3 dark:bg-neutral-900"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{c.descricao}</p>
                  <p className={`text-xs ${c.atrasada ? 'font-medium text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    vence {formatarData(c.vencimento)}
                    {c.atrasada ? ' · atrasada' : ''}
                    {c.mesAnterior ? ' · de mês anterior' : ''}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {oculto ? MASCARA : brlCentavos.format(c.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function nomeMesCurto(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function Cartao({
  rotulo,
  valor,
  nota,
  href,
  tom,
  periodo,
}: {
  rotulo: string
  valor: string
  nota: string
  /** período considerado (aparece numa linha com calendário) */
  periodo?: string
  /** cor do valor (ex: fluxo negativo em vermelho) */
  tom?: 'positivo' | 'negativo'
  // Quando presente, o indicador vira link pro lugar do sistema que detalha esse número.
  href?: string
}) {
  const conteudo = (
    <>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{rotulo}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tom === 'negativo'
            ? 'text-red-600 dark:text-red-400'
            : tom === 'positivo'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{nota}</p>
      {periodo && (
        <p className="mt-2 flex items-center gap-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3 w-3 shrink-0">
            <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Período considerado:</span>
          {periodo}
        </p>
      )}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-militar-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-militar-700"
      >
        {conteudo}
        <span className="mt-auto pt-2 text-xs font-medium text-militar-700 opacity-70 transition group-hover:opacity-100 dark:text-militar-500">
          ver detalhes →
        </span>
      </Link>
    )
  }

  return (
    <div className="h-full rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      {conteudo}
    </div>
  )
}
