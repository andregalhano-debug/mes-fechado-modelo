import Link from 'next/link'
import type { EmpresaLinha } from '@/lib/empresas'
import type { Cartao } from '@/lib/cartao'
import { TabelaOrdenavel } from '@/components/tabela-ordenavel'
import { BarraShare } from '@/components/lista-recolhivel'

// Central de assinaturas: tudo que é cobrado de forma recorrente (assinaturas, serviços, contas
// fixas no cartão), com o cartão de cada uma, mensal × anual, datas e o peso de cada uma —
// para a gestão macro (onde está, quanto custa por mês/ano, o que vence agora, o que está em risco).

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const cartaoCss = 'rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900'
const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '—')

function somar(d: string, meses: number) {
  const x = new Date(`${d}T12:00:00`)
  x.setMonth(x.getMonth() + meses)
  return x.toISOString().slice(0, 10)
}
/** Próxima cobrança: última + 1 mês (ou + 1 ano), avançando até passar de hoje. */
function proxima(ultima: string | null, anual: boolean, hoje: string) {
  if (!ultima) return null
  let p = somar(ultima, anual ? 12 : 1)
  while (p < hoje) p = somar(p, anual ? 12 : 1)
  return p
}
const diasAte = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

function corBanco(banco: string | null | undefined) {
  const b = (banco ?? '').toLowerCase()
  if (b.includes('ita')) return 'bg-orange-500'
  if (b.includes('nu')) return 'bg-violet-600'
  if (b.includes('bradesco')) return 'bg-red-600'
  return 'bg-militar-600'
}

function Kpi({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota?: string; tom?: 'alerta' }) {
  return (
    <div className="h-full rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tom === 'alerta' ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{nota}</p>}
    </div>
  )
}

// Filtro por classificação (vale para a central inteira: indicadores, próximas, por cartão, tabela).
const CLASSES: { k: string; rotulo: string }[] = [
  { k: 'todas', rotulo: 'Todas' },
  { k: 'assinatura', rotulo: 'Assinaturas' },
  { k: 'recorrente', rotulo: 'Recorrentes' },
  { k: 'conta', rotulo: 'Contas no cartão' },
  { k: 'anual', rotulo: 'Anuais' },
]

export function CentralAssinaturas({ empresas, cartoes, classe = 'todas', banco = null }: { empresas: EmpresaLinha[]; cartoes: Cartao[]; classe?: string; banco?: string | null }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const porId = new Map(cartoes.map((c) => [c.id, c]))
  const todosItens = empresas
    // só o que é cobrado no cartão de forma recorrente (contas pagas por boleto/Pix ficam em Contas)
    // conta a pagar só entra quando é cobrada em cartão de crédito (débito em conta/PIX ficam em Contas)
    .filter((e) => {
      if (e.tipo === 'assinatura' || e.tipo === 'recorrente') return true
      const c = e.tipo === 'conta' && e.cartaoId ? porId.get(e.cartaoId) : null
      return !!c && (c.tipo === 'fisico' || c.tipo === 'virtual')
    })
    .map((e) => {
      const anual = e.periodicidade === 'anual'
      const cartao = e.cartaoId ? (porId.get(e.cartaoId) ?? null) : null
      const valorCobranca = anual ? (e.valorAnual ?? e.mediaMensal * 12) : e.ultimoValor || e.mediaMensal
      const ultima = e.ultimaData || null
      // conta a pagar no cartão: a próxima é o vencimento cadastrado (se ainda não passou)
      const prox = e.tipo === 'conta' && ultima && ultima >= hoje ? ultima : proxima(ultima, anual, hoje)
      // mensal sem cobrança há mais de 45 dias: pode ter sido cancelada ou mudado de cartão
      const sumida = !anual && e.tipo !== 'conta' && !e.adicionadaManual && !!ultima && diasAte(ultima, hoje) > 45
      return {
        e,
        anual,
        cartao,
        mensal: e.mediaMensal,
        anualValor: anual ? valorCobranca : e.mediaMensal * 12,
        valorCobranca,
        ultima,
        prox,
        sumida,
        risco: !cartao ? 'sem cartão' : !cartao.ativo ? 'cartão cancelado' : null,
      }
    })
    .filter((x) => x.mensal > 0 || x.valorCobranca > 0)
    .sort((a, b) => b.mensal - a.mensal)
  const naClasse = (x: (typeof todosItens)[number], k: string) =>
    k === 'todas' ? true : k === 'anual' ? x.anual : x.e.tipo === k
  const filtroAtual = CLASSES.some((c) => c.k === classe) ? classe : 'todas'
  const bancoDe = (x: (typeof todosItens)[number]) => x.cartao?.banco ?? 'Sem cartão'
  const bancos = Array.from(new Set(todosItens.map(bancoDe))).sort()
  const itens = todosItens.filter((x) => naClasse(x, filtroAtual) && (!banco || bancoDe(x) === banco))

  const totalMensal = itens.reduce((t, x) => t + x.mensal, 0)
  const totalAnual = itens.reduce((t, x) => t + x.anualValor, 0)
  const nAnuais = itens.filter((x) => x.anual).length
  const emRisco = itens.filter((x) => x.risco)
  const sumidas = itens.filter((x) => x.sumida)
  const proximas = itens
    .filter((x) => x.prox && diasAte(hoje, x.prox) <= 30)
    .sort((a, b) => a.prox!.localeCompare(b.prox!))
  const totalProximas = proximas.reduce((t, x) => t + x.valorCobranca, 0)

  const porCartao = new Map<string, { id: string; nome: string; banco: string | null; final: string | null; ativo: boolean; total: number; n: number }>()
  for (const x of itens) {
    const k = x.cartao?.id ?? 'sem'
    const a = porCartao.get(k) ?? { id: k, nome: x.cartao?.nome ?? 'Sem cartão definido', banco: x.cartao?.banco ?? null, final: x.cartao?.final ?? null, ativo: x.cartao?.ativo ?? true, total: 0, n: 0 }
    a.total += x.mensal
    a.n++
    porCartao.set(k, a)
  }
  const cartoesOrd = Array.from(porCartao.values()).sort((a, b) => b.total - a.total)
  const anualPorCartao = new Map<string, number>()
  for (const x of itens) anualPorCartao.set(x.cartao?.id ?? 'sem', (anualPorCartao.get(x.cartao?.id ?? 'sem') ?? 0) + x.anualValor)
  const porCategoria = new Map<string, number>()
  for (const x of itens) porCategoria.set(x.e.categoria ?? 'Sem categoria', (porCategoria.get(x.e.categoria ?? 'Sem categoria') ?? 0) + x.mensal)

  if (!todosItens.length)
    return (
      <section className={cartaoCss}>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Nenhuma assinatura ou cobrança recorrente identificada ainda.</p>
      </section>
    )

  const filtros = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Mostrar</span>
      {CLASSES.map((c) => {
        const lista = todosItens.filter((x) => naClasse(x, c.k))
        if (c.k !== 'todas' && !lista.length) return null
        const ativo = filtroAtual === c.k
        return (
          <Link
            key={c.k}
            href={`/contas-a-pagar?aba=assinaturas${c.k === 'todas' ? '' : `&classe=${c.k}`}${banco ? `&cb=${encodeURIComponent(banco)}` : ''}`}
            scroll={false}
            aria-current={ativo ? 'true' : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${ativo ? 'border-militar-600 bg-militar-600 text-white' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
          >
            {c.rotulo} <span className={ativo ? 'text-white/80' : 'text-neutral-400'}>{lista.length} · {brl0.format(lista.reduce((t, x) => t + x.mensal, 0))}/mês</span>
          </Link>
        )
      })}
      <span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Banco</span>
      {[null, ...bancos].map((b) => {
        const ativo = (banco ?? null) === b
        const lista = todosItens.filter((x) => naClasse(x, filtroAtual) && (!b || bancoDe(x) === b))
        return (
          <Link
            key={b ?? 'todos'}
            href={`/contas-a-pagar?aba=assinaturas${filtroAtual === 'todas' ? '' : `&classe=${filtroAtual}`}${b ? `&cb=${encodeURIComponent(b)}` : ''}`}
            scroll={false}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${ativo ? 'border-militar-600 bg-militar-600 text-white' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
          >
            {b ?? 'Todos'} <span className={ativo ? 'text-white/80' : 'text-neutral-400'}>{brl0.format(lista.reduce((t, x) => t + x.mensal, 0))}/mês</span>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {filtros}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi rotulo="Custo mensal das assinaturas" valor={`${brl0.format(totalMensal)}/mês`} nota={`${itens.length} cobranças${filtroAtual === 'todas' ? ' recorrentes' : ` · ${CLASSES.find((c) => c.k === filtroAtual)?.rotulo.toLowerCase()}`}`} />
        <Kpi rotulo="No ano" valor={brl0.format(totalAnual)} nota={`${nAnuais} anua${nAnuais === 1 ? 'l' : 'is'} incluída${nAnuais === 1 ? '' : 's'} (÷12 no mensal)`} />
        <Kpi rotulo="Próximos 30 dias" valor={brl0.format(totalProximas)} nota={`${proximas.length} cobrança${proximas.length === 1 ? '' : 's'} previstas`} />
        <Kpi rotulo="Em risco" valor={String(emRisco.length)} nota="em cartão cancelado ou sem cartão" tom={emRisco.length ? 'alerta' : undefined} />
        <Kpi rotulo="Sem cobrança recente" valor={String(sumidas.length)} nota="mensais paradas há 45+ dias" tom={sumidas.length ? 'alerta' : undefined} />
      </section>

      {(emRisco.length > 0 || sumidas.length > 0) && (
        <section className={`${cartaoCss} border-amber-200 dark:border-amber-900`}>
          <h2 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Atenção</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {emRisco.map((x) => (
              <li key={'r' + x.e.chave} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>{x.e.nome}</strong> ({brl.format(x.valorCobranca)}{x.anual ? '/ano' : '/mês'}) — {x.risco}. Atualize o cartão para não perder o serviço.
              </li>
            ))}
            {sumidas.map((x) => (
              <li key={'s' + x.e.chave} className="rounded-lg bg-neutral-100 px-3 py-2 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                <strong>{x.e.nome}</strong>: última cobrança em {dataBR(x.ultima)} — foi cancelada, mudou de cartão ou a fatura ainda não foi enviada?
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${cartaoCss} flex flex-col`}>
          <h2 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Próximas cobranças (30 dias)</h2>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Previsão pela última cobrança + 1 mês (ou + 1 ano nas anuais).</p>
          {proximas.length ? (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {proximas.map((x) => (
                <li key={'p' + x.e.chave} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-14 shrink-0 rounded-lg bg-neutral-100 px-2 py-1 text-center text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {dataBR(x.prox).slice(0, 5)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-neutral-900 dark:text-neutral-100">{x.e.nome}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {x.cartao ? `${x.cartao.banco ?? ''} •••• ${x.cartao.final ?? '—'}` : 'sem cartão'} · em {diasAte(hoje, x.prox!)} dia{diasAte(hoje, x.prox!) === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{brl.format(x.valorCobranca)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">Nenhuma cobrança prevista nos próximos 30 dias.</p>
          )}
          {proximas.length > 0 && (
            <p className="mt-2 flex items-center justify-between border-t-2 border-neutral-200 pt-2 text-sm font-semibold dark:border-neutral-700">
              <span>Total dos próximos 30 dias · {proximas.length} cobrança{proximas.length === 1 ? '' : 's'}</span>
              <span className="tabular-nums">{brl.format(totalProximas)}</span>
            </p>
          )}
        </section>

        <section className={`${cartaoCss} flex flex-col`}>
          <h2 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Por cartão</h2>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Onde as assinaturas estão cadastradas (custo mensal equivalente).</p>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {cartoesOrd.map((c) => (
              <li key={c.nome + c.final} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-8 w-1.5 shrink-0 rounded-full ${c.ativo ? corBanco(c.banco) : 'bg-neutral-400'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold tracking-wider text-neutral-900 dark:text-neutral-100">{c.final ? `•••• ${c.final}` : '—'}</span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {c.nome} · {c.n} cobrança{c.n === 1 ? '' : 's'}
                      {!c.ativo ? ' · CANCELADO' : ''}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{brl.format(c.total)}/mês</span>
                    <span className="block text-[10px] text-neutral-500">{brl0.format(anualPorCartao.get(c.id) ?? 0)}/ano</span>
                  </span>
                  <BarraShare pct={totalMensal ? (c.total / totalMensal) * 100 : 0} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-center justify-between border-t-2 border-neutral-200 pt-2 text-sm font-semibold dark:border-neutral-700">
            <span>Total · {cartoesOrd.length} cart{cartoesOrd.length === 1 ? 'ão' : 'ões'}</span>
            <span className="text-right tabular-nums">
              <span className="block">{brl.format(totalMensal)}/mês</span>
              <span className="block text-[10px] font-normal text-neutral-500">{brl0.format(totalAnual)}/ano</span>
            </span>
          </p>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Por categoria</p>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from(porCategoria.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, v]) => (
                <li key={cat} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">{cat}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{brl.format(v)}</span>
                    <BarraShare pct={totalMensal ? (v / totalMensal) * 100 : 0} />
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className={cartaoCss}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Todas as assinaturas e cobranças recorrentes</h2>
          <Link href="/contas-a-pagar?aba=cartoes" className="text-xs font-medium text-militar-700 hover:underline dark:text-militar-400">
            trocar cartão, tag ou mensal/anual em Cartões →
          </Link>
        </div>
        <TabelaOrdenavel
          rotulo="assinaturas"
          limite={15}
          rodape={{
            empresa: `Total · ${itens.length} cobrança${itens.length === 1 ? '' : 's'}`,
            mensal: brl.format(totalMensal),
            anual: brl.format(totalAnual),
            share: '100%',
          }}
          ordemInicial={{ chave: 'mensal', direcao: 'desc' }}
          colunas={[
            { chave: 'empresa', rotulo: 'Empresa' },
            { chave: 'cartao', rotulo: 'Cartão' },
            { chave: 'cobranca', rotulo: 'Cobrança', alinhar: 'dir' },
            { chave: 'mensal', rotulo: 'Por mês', alinhar: 'dir' },
            { chave: 'anual', rotulo: 'No ano', alinhar: 'dir', ocultarNoCelular: true },
            { chave: 'prox', rotulo: 'Próxima', alinhar: 'dir', ocultarNoCelular: true },
            { chave: 'share', rotulo: '% do total', alinhar: 'dir', ocultarNoCelular: true },
          ]}
          linhas={itens.map((x) => ({
            id: x.e.chave,
            destaque: !!x.risco,
            valores: {
              empresa: x.e.nome,
              cartao: x.cartao ? `${x.cartao.banco ?? ''} ${x.cartao.final ?? ''}` : '',
              cobranca: x.valorCobranca,
              mensal: x.mensal,
              anual: x.anualValor,
              prox: x.prox ?? '',
              share: totalMensal ? (x.mensal / totalMensal) * 100 : 0,
            },
            celulas: {
              empresa: (
                <span className="block min-w-0">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{x.e.nome}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-semibold">
                    <span className={`rounded px-1.5 py-px ${x.anual ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      {x.anual ? 'ANUAL' : x.e.tipo === 'conta' ? 'CONTA' : 'MENSAL'}
                    </span>
                    {x.e.categoria && <span className="font-normal text-neutral-500">{x.e.categoria}</span>}
                  </span>
                </span>
              ),
              cartao: x.cartao ? (
                <span className="flex items-center gap-2">
                  <span className={`h-6 w-1 rounded-full ${x.cartao.ativo ? corBanco(x.cartao.banco) : 'bg-neutral-400'}`} aria-hidden="true" />
                  <span>
                    <span className="block font-mono text-xs font-semibold tracking-wider">{x.cartao.final ? `•••• ${x.cartao.final}` : x.cartao.nome}</span>
                    <span className="block text-[10px] text-neutral-500">
                      {x.cartao.banco ?? ''}
                      {!x.cartao.ativo ? ' · cancelado' : ''}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-600">sem cartão</span>
              ),
              cobranca: (
                <span className="tabular-nums">
                  {brl.format(x.valorCobranca)}
                  <span className="block text-[10px] text-neutral-500">{x.anual ? 'por ano' : 'por mês'}</span>
                </span>
              ),
              mensal: <span className="font-semibold tabular-nums">{brl.format(x.mensal)}</span>,
              anual: <span className="tabular-nums text-neutral-700 dark:text-neutral-300">{brl.format(x.anualValor)}</span>,
              prox: (
                <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                  {x.prox ? dataBR(x.prox) : '—'}
                  <span className="block text-[10px] text-neutral-500">última {dataBR(x.ultima)}</span>
                </span>
              ),
              share: <BarraShare pct={totalMensal ? (x.mensal / totalMensal) * 100 : 0} />,
            },
          }))}
        />
      </section>
    </div>
  )
}
