'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatarData } from '@/lib/data'
import { TabelaOrdenavel } from '@/components/tabela-ordenavel'

type Lancamento = {
  id: string
  descricao: string
  canal: string | null
  valor: number
  data: string
  natureza: 'despesa' | 'receita'
  parcela: string | null
  categoria: string | null
  documentoId: string | null
  fatura: string
}
type Conta = { id: string; descricao: string; valor: number; vencimento: string; pago: boolean; categoria: string | null }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const cartaoCss = 'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'

// Aba "Busca": encontra uma empresa em todas as faturas e contas a pagar, com resumo do que foi
// gasto (total, média por mês, em quais faturas) e cada cobrança, com link pra fatura.
export function AbaBusca() {
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ lancamentos: Lancamento[]; contas: Conta[] } | null>(null)

  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2) {
      setResultado(null)
      return
    }
    const controle = new AbortController()
    const espera = setTimeout(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, { signal: controle.signal, cache: 'no-store' })
        const dados = await r.json()
        if (!r.ok) throw new Error(dados.erro ?? 'Não consegui buscar.')
        setResultado(dados)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setErro(e instanceof Error ? e.message : 'Não consegui buscar.')
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => {
      clearTimeout(espera)
      controle.abort()
    }
  }, [termo])

  const resumo = useMemo(() => {
    if (!resultado) return null
    const despesas = resultado.lancamentos.filter((l) => l.natureza === 'despesa')
    const total = despesas.reduce((t, l) => t + l.valor, 0)
    const meses = new Set(despesas.map((l) => l.data.slice(0, 7)))
    const faturas = new Map<string, number>()
    for (const l of despesas) faturas.set(l.fatura.split(' · ')[0], (faturas.get(l.fatura.split(' · ')[0]) ?? 0) + l.valor)
    const datas = despesas.map((l) => l.data).sort()
    return {
      qtd: despesas.length,
      total,
      mediaMes: meses.size > 0 ? total / meses.size : 0,
      meses: meses.size,
      primeira: datas[0] ?? null,
      ultima: datas[datas.length - 1] ?? null,
      faturas: Array.from(faturas.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [resultado])

  return (
    <div className="flex flex-col gap-6">
      <section className={cartaoCss}>
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Buscar empresa nas faturas</h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Procura em todos os lançamentos das faturas e nas contas a pagar. Digite pelo menos 2 letras.
        </p>
        <div className="relative mt-3">
          <input
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
            placeholder="ex: Netflix, 99, Uber, Amazon…"
            aria-label="Buscar empresa"
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950"
          />
          {carregando && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-400">buscando…</span>}
        </div>
        {erro && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
      </section>

      {resultado && resumo && (
        <>
          {resultado.lancamentos.length === 0 && resultado.contas.length === 0 ? (
            <section className={cartaoCss}>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nada encontrado para “{termo.trim()}”.</p>
            </section>
          ) : (
            <>
              {resumo.qtd > 0 && (
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { rotulo: 'Total gasto', valor: brl.format(resumo.total), nota: `${resumo.qtd} cobrança${resumo.qtd === 1 ? '' : 's'}` },
                    { rotulo: 'Média por mês', valor: brl.format(resumo.mediaMes), nota: `${resumo.meses} ${resumo.meses === 1 ? 'mês' : 'meses'} com cobrança` },
                    { rotulo: 'Última cobrança', valor: resumo.ultima ? formatarData(resumo.ultima) : '—', nota: resumo.primeira ? `primeira em ${formatarData(resumo.primeira)}` : '' },
                    { rotulo: 'Em quais faturas', valor: String(resumo.faturas.length), nota: resumo.faturas.map(([f]) => f).join(', ') },
                  ].map((c) => (
                    <div key={c.rotulo} className="h-full rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{c.rotulo}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{c.valor}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400" title={c.nota}>
                        {c.nota}
                      </p>
                    </div>
                  ))}
                </section>
              )}

              {resultado.lancamentos.length > 0 && (
                <section className={cartaoCss}>
                  <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Cobranças nas faturas <span className="font-normal text-neutral-400">{resultado.lancamentos.length}</span>
                  </h3>
                  <TabelaOrdenavel
                    rotulo="cobranças"
                    limite={10}
                    ordemInicial={{ chave: 'data', direcao: 'desc' }}
                    colunas={[
                      { chave: 'data', rotulo: 'Data' },
                      { chave: 'descricao', rotulo: 'Descrição' },
                      { chave: 'fatura', rotulo: 'Fatura', ocultarNoCelular: true },
                      { chave: 'categoria', rotulo: 'Categoria', ocultarNoCelular: true },
                      { chave: 'valor', soma: 'brl', rotulo: 'Valor', alinhar: 'dir' },
                    ]}
                    linhas={resultado.lancamentos.map((l) => ({
                      id: l.id,
                      valores: { data: l.data, descricao: l.descricao, fatura: l.fatura, categoria: l.categoria, valor: l.valor },
                      celulas: {
                        data: <span className="whitespace-nowrap text-xs tabular-nums text-neutral-600 dark:text-neutral-300">{formatarData(l.data)}</span>,
                        descricao: (
                          <span className="block min-w-0">
                            <span className="block max-w-[14rem] truncate text-neutral-900 sm:max-w-[20rem] dark:text-neutral-100">{l.descricao}</span>
                            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {[l.parcela ? `parcela ${l.parcela}` : null, l.canal].filter(Boolean).join(' · ')}
                              <span className="sm:hidden">{l.fatura ? ` ${l.fatura}` : ''}</span>
                            </span>
                          </span>
                        ),
                        fatura: l.documentoId ? (
                          <Link href={`/documentos/${l.documentoId}`} className="text-xs font-medium text-militar-700 hover:underline dark:text-militar-500">
                            {l.fatura} →
                          </Link>
                        ) : (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{l.fatura}</span>
                        ),
                        categoria: <span className="text-xs text-neutral-500 dark:text-neutral-400">{l.categoria ?? '—'}</span>,
                        valor: (
                          <span className={`tabular-nums ${l.natureza === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                            {l.natureza === 'receita' ? '+' : ''}
                            {brl.format(l.valor)}
                          </span>
                        ),
                      },
                    }))}
                  />
                </section>
              )}

              {resultado.contas.length > 0 && (
                <section className={cartaoCss}>
                  <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Contas a pagar <span className="font-normal text-neutral-400">{resultado.contas.length}</span>
                  </h3>
                  <TabelaOrdenavel
                    rotulo="contas"
                    ordemInicial={{ chave: 'vencimento', direcao: 'desc' }}
                    colunas={[
                      { chave: 'vencimento', rotulo: 'Vencimento' },
                      { chave: 'descricao', rotulo: 'Conta' },
                      { chave: 'situacao', rotulo: 'Situação', ocultarNoCelular: true },
                      { chave: 'valor', soma: 'brl', rotulo: 'Valor', alinhar: 'dir' },
                    ]}
                    linhas={resultado.contas.map((c) => ({
                      id: c.id,
                      valores: { vencimento: c.vencimento, descricao: c.descricao, situacao: c.pago ? 'paga' : 'em aberto', valor: c.valor },
                      celulas: {
                        vencimento: <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">{formatarData(c.vencimento)}</span>,
                        descricao: <span className="text-neutral-900 dark:text-neutral-100">{c.descricao}</span>,
                        situacao: (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.pago ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                            {c.pago ? 'Paga' : 'Em aberto'}
                          </span>
                        ),
                        valor: <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(c.valor)}</span>,
                      },
                    }))}
                  />
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
