import { custoDoMinimo, prazos, type CreditoFatura } from '@/lib/credito-cartao'
import type { Cartao } from '@/lib/cartao'

// Crédito dos cartões, lido das faturas: limites, ciclo (melhor dia de compra), custo do crédito
// e encargos — com o que o banco não destaca (quanto custa o mínimo, o parcelamento, o IOF…).

export type FaturaCredito = { docId: string; instituicao: string | null; vencimento: string | null; credito: CreditoFatura }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = (v: number, casas = 1) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
const dataBR = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—')
const cartaoCss = 'rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900'

export const encargosCobrados = (c: CreditoFatura) => (c.encargos?.juros ?? 0) + (c.encargos?.multa ?? 0) + (c.encargos?.iof ?? 0) + (c.encargos?.anuidade ?? 0)

/** Última fatura lida de cada conta de crédito (pelo final do titular) + o mapa final → conta. */
export function contasDeCredito(faturas: FaturaCredito[]) {
  const porTitular = new Map<string, FaturaCredito>()
  for (const f of [...faturas].sort((a, b) => (a.credito.vencimento ?? a.vencimento ?? '').localeCompare(b.credito.vencimento ?? b.vencimento ?? ''))) {
    const t = f.credito.final_titular ?? f.credito.finais[0]
    if (t) porTitular.set(t, f)
  }
  const doFinal = new Map<string, { titular: string; fatura: FaturaCredito }>()
  for (const [t, f] of porTitular) {
    doFinal.set(t, { titular: t, fatura: f })
    for (const x of f.credito.finais) if (!doFinal.has(x)) doFinal.set(x, { titular: t, fatura: f })
  }
  return { porTitular, doFinal }
}

function Mini({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg px-2.5 py-2 ${destaque ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-neutral-50 dark:bg-neutral-800/50'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{rotulo}</p>
      <p className={`text-sm font-semibold tabular-nums ${destaque ? 'text-emerald-800 dark:text-emerald-300' : 'text-neutral-900 dark:text-neutral-100'}`}>{valor}</p>
      {nota && <p className="truncate text-[10px] text-neutral-500 dark:text-neutral-400">{nota}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- bloco de crédito de UM cartão
export function PainelCreditoCartao({
  fatura,
  titular,
  final,
  hoje,
  herdadoDe = null,
}: {
  fatura: FaturaCredito | null
  titular: string | null
  final: string | null
  hoje: string
  /** cartão novo sem fatura: mostrando os dados da última fatura do cartão que ele substituiu */
  herdadoDe?: string | null
}) {
  if (!fatura)
    return (
      <div className="flex min-h-[15rem] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-4 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">Sem fatura lida deste cartão</p>
        <p className="mt-1">Envie a fatura para ver limite, melhor dia de compra, juros e encargos.</p>
      </div>
    )
  const c = fatura.credito
  const p = prazos(c, hoje)
  const usado = c.limite_utilizado ?? (c.limite_total != null && c.limite_disponivel != null ? c.limite_total - c.limite_disponivel : null)
  const uso = c.limite_total && usado != null ? (usado / c.limite_total) * 100 : null
  const enc = encargosCobrados(c)
  const extraMinimo = custoDoMinimo(c)
  const extraParcelar = c.parcelamento_total_a_pagar && c.total_fatura ? c.parcelamento_total_a_pagar - c.total_fatura : null
  return (
    <div className="flex flex-col gap-3">
      {herdadoDe && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Cartão novo: mostrando a última fatura do ••{herdadoDe} (substituído) até chegar a primeira deste cartão.
        </p>
      )}
      {titular && final && titular !== final && (
        <p className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">Limite compartilhado com o cartão ••{titular}</p>
      )}
      {/* Limite */}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Limite</span>
          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
            {c.limite_total != null ? brl0.format(c.limite_total) : '—'} · em {dataBR(c.vencimento ?? fatura.vencimento)}
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${uso != null && uso > 30 ? 'bg-amber-500' : 'bg-militar-600'}`}
            style={{ width: `${Math.min(100, uso ?? 0)}%` }}
          />
          {c.parcelas_futuras && c.limite_total ? (
            <span
              className="absolute inset-y-0 rounded-full bg-neutral-400/60"
              style={{ left: `${Math.min(100, uso ?? 0)}%`, width: `${Math.min(100 - (uso ?? 0), (c.parcelas_futuras / c.limite_total) * 100)}%` }}
              title="parcelas futuras"
            />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
          <span>
            usado {usado != null ? brl0.format(usado) : '—'}
            {uso != null && <span className={uso > 30 ? ' font-semibold text-amber-700 dark:text-amber-400' : ''}> ({pct(uso, 0)})</span>}
          </span>
          {c.parcelas_futuras ? <span>parcelas futuras {brl0.format(c.parcelas_futuras)}</span> : null}
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">livre {c.limite_disponivel != null ? brl0.format(c.limite_disponivel) : '—'}</span>
        </div>
      </div>

      {/* Ciclo */}
      {p && (
        <div className="grid grid-cols-4 gap-1.5">
          <Mini rotulo="Fecha" valor={`dia ${p.diaFechamento}`} />
          <Mini rotulo="Vence" valor={`dia ${p.diaVencimento}`} nota={`${p.diasFechVenc}d após`} />
          <Mini rotulo="Melhor dia" valor={`dia ${p.melhorDia}`} nota={`até ${p.prazoMaximo} dias`} destaque />
          <Mini rotulo="Compra hoje" valor={`${p.compraHoje.dias} dias`} nota={`paga ${dataBR(p.compraHoje.vence)}`} />
        </div>
      )}

      {/* Custo do crédito */}
      <div className="rounded-xl border border-neutral-100 p-2.5 text-[11px] dark:border-neutral-800">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Custo se não pagar o total</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
          <dt className="text-neutral-600 dark:text-neutral-300">Rotativo (mínimo)</dt>
          <dd className="text-right font-semibold text-red-700 dark:text-red-400">
            {c.juros_rotativo_am != null ? `${pct(c.juros_rotativo_am, 2)} a.m.` : '—'}
            {c.cet_rotativo_aa != null && <span className="font-normal text-neutral-500"> · CET {pct(c.cet_rotativo_aa, 0)} a.a.</span>}
          </dd>
          <dt className="text-neutral-600 dark:text-neutral-300">Parcelar a fatura</dt>
          <dd className="text-right font-semibold text-neutral-800 dark:text-neutral-200">
            {c.juros_parcelamento_am != null ? `${pct(c.juros_parcelamento_am, 2)} a.m.` : '—'}
            {c.cet_parcelamento_aa != null && <span className="font-normal text-neutral-500"> · CET {pct(c.cet_parcelamento_aa, 0)} a.a.</span>}
          </dd>
          <dt className="text-neutral-600 dark:text-neutral-300">Atraso</dt>
          <dd className="text-right text-neutral-700 dark:text-neutral-300">
            {c.multa_atraso_pct != null ? `multa ${pct(c.multa_atraso_pct, 0)}` : '—'}
            {c.juros_atraso_am != null ? ` + mora ${pct(c.juros_atraso_am, 0)} a.m.` : ''}
          </dd>
          {extraMinimo != null && extraMinimo > 0 && (
            <>
              <dt className="text-neutral-600 dark:text-neutral-300">Pagar só o mínimo desta fatura</dt>
              <dd className="text-right font-semibold text-red-700 dark:text-red-400">
                +{brl.format(extraMinimo)} <span className="font-normal text-neutral-500">({pct((extraMinimo / c.total_fatura!) * 100)})</span>
              </dd>
            </>
          )}
          {extraParcelar != null && extraParcelar > 0 && (
            <>
              <dt className="text-neutral-600 dark:text-neutral-300">Parcelar esta fatura{c.parcelamento_qtd ? ` em ${c.parcelamento_qtd}x` : ''}</dt>
              <dd className="text-right font-semibold text-red-700 dark:text-red-400">
                +{brl.format(extraParcelar)} <span className="font-normal text-neutral-500">({pct((extraParcelar / c.total_fatura!) * 100)})</span>
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Encargos cobrados */}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-2.5 py-2 text-[11px] dark:bg-neutral-800/50">
        <span className="text-neutral-600 dark:text-neutral-300">
          Encargos na fatura de {dataBR(c.vencimento ?? fatura.vencimento)}
          {enc > 0 && (
            <span className="block text-[10px] text-neutral-500">
              {[c.encargos.juros && `juros ${brl.format(c.encargos.juros)}`, c.encargos.multa && `multa ${brl.format(c.encargos.multa)}`, c.encargos.iof && `IOF ${brl.format(c.encargos.iof)}`, c.encargos.anuidade && `anuidade ${brl.format(c.encargos.anuidade)}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${enc > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {enc > 0 ? `${brl.format(enc)}${c.total_fatura ? ` · ${pct((enc / c.total_fatura) * 100, 2)}` : ''}` : 'nenhum ✓'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- raio-x consolidado
export function RaioXCredito({ faturas, cartoes, hoje }: { faturas: FaturaCredito[]; cartoes: Cartao[]; hoje: string }) {
  const { porTitular } = contasDeCredito(faturas)
  const contas = [...porTitular.entries()].map(([final, f]) => {
    const cartao = cartoes.find((c) => c.final === final)
    return { final, f, cartao, p: prazos(f.credito, hoje) }
  })
  if (!contas.length) return null
  const nome = (x: (typeof contas)[number]) => `${x.cartao?.nome ?? x.f.instituicao ?? 'Cartão'} ••${x.final}`
  const ativos = contas.filter((x) => x.cartao?.ativo !== false)
  const limite = ativos.reduce((t, x) => t + (x.f.credito.limite_total ?? 0), 0)
  const livre = ativos.reduce((t, x) => t + (x.f.credito.limite_disponivel ?? 0), 0)
  const usado = limite - livre
  const futuras = ativos.reduce((t, x) => t + (x.f.credito.parcelas_futuras ?? 0), 0)
  const encTotal = faturas.reduce((t, f) => t + encargosCobrados(f.credito), 0)
  const encPor = { juros: 0, multa: 0, iof: 0, anuidade: 0 }
  for (const f of faturas) for (const k of Object.keys(encPor) as (keyof typeof encPor)[]) encPor[k] += f.credito.encargos?.[k] ?? 0
  const vencs = faturas.map((f) => f.credito.vencimento ?? f.vencimento).filter(Boolean).sort() as string[]
  const melhorHoje = [...ativos].filter((x) => x.p).sort((a, b) => b.p!.compraHoje.dias - a.p!.compraHoje.dias)[0]
  const intl = faturas.filter((f) => (f.credito.compras_internacionais ?? 0) > 0)
  const iofIntl = intl.reduce((t, f) => t + (f.credito.encargos?.iof ?? 0), 0)
  const baseIntl = intl.reduce((t, f) => t + (f.credito.compras_internacionais ?? 0), 0)
  const piorRot = [...ativos].filter((x) => x.f.credito.juros_rotativo_am != null).sort((a, b) => b.f.credito.juros_rotativo_am! - a.f.credito.juros_rotativo_am!)[0]
  const altoUso = ativos.filter((x) => x.f.credito.limite_total && (x.f.credito.limite_utilizado ?? 0) / x.f.credito.limite_total > 0.3)

  const dicas: { tom: 'alerta' | 'ok' | 'info'; texto: string }[] = []
  for (const x of ativos) {
    const c = x.f.credito
    const extra = custoDoMinimo(c)
    if (extra && c.total_fatura)
      dicas.push({ tom: 'alerta', texto: `${nome(x)}: pagar só o mínimo da fatura de ${brl0.format(c.total_fatura)} custaria ${brl.format(extra)} de juros e IOF em 1 mês (${pct((extra / c.total_fatura) * 100)} da fatura) — e o saldo continua crescendo.` })
  }
  const parcPior = [...ativos]
    .filter((x) => x.f.credito.parcelamento_total_a_pagar && x.f.credito.total_fatura)
    .map((x) => ({ x, extra: x.f.credito.parcelamento_total_a_pagar! - x.f.credito.total_fatura! }))
    .sort((a, b) => b.extra / b.x.f.credito.total_fatura! - a.extra / a.x.f.credito.total_fatura!)[0]
  if (parcPior && parcPior.extra > 0)
    dicas.push({ tom: 'alerta', texto: `Parcelar a fatura é caro: no ${nome(parcPior.x)} você pagaria ${brl.format(parcPior.extra)} a mais (${pct((parcPior.extra / parcPior.x.f.credito.total_fatura!) * 100, 0)} sobre a fatura). Se precisar de prazo, um empréstimo pessoal costuma sair bem mais barato.` })
  if (piorRot) dicas.push({ tom: 'info', texto: `Rotativo mais caro: ${nome(piorRot)} a ${pct(piorRot.f.credito.juros_rotativo_am!, 2)} ao mês${piorRot.f.credito.cet_rotativo_aa ? ` (CET ${pct(piorRot.f.credito.cet_rotativo_aa, 0)} ao ano)` : ''}. Débito automático da fatura total evita qualquer chance de cair nele.` })
  if (baseIntl > 0)
    dicas.push({ tom: 'info', texto: `Compras no exterior: ${brl.format(baseIntl)} com ${brl.format(iofIntl)} de IOF (${pct((iofIntl / baseIntl) * 100, 2)}) — além do spread embutido na cotação do banco${intl[0].credito.cotacao_dolar ? ` (ex.: dólar a R$ ${intl[0].credito.cotacao_dolar.toFixed(2)})` : ''}. Assinaturas em dólar (Slack, Claude…) pagam esse custo todo mês; conta global/cartão em dólar costuma sair mais barato.` })
  if (altoUso.length)
    dicas.push({ tom: 'alerta', texto: `Uso acima de 30% do limite em ${altoUso.map(nome).join(', ')} — bancos e birôs de crédito leem isso como risco (score). Pagar antes do fechamento reduz o uso que aparece.` })
  else dicas.push({ tom: 'ok', texto: `Uso do limite saudável em todos os cartões (abaixo de 30%) — ponto positivo para o score.` })
  if (futuras > 0) dicas.push({ tom: 'info', texto: `${brl.format(futuras)} do limite já estão presos em parcelas das próximas faturas (${pct((futuras / Math.max(1, limite)) * 100)} do limite total).` })
  if (encPor.anuidade === 0) dicas.push({ tom: 'ok', texto: 'Nenhuma anuidade cobrada nas faturas lidas.' })

  const Kpi = ({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) => (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{rotulo}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{nota}</p>}
    </div>
  )

  return (
    <section className={cartaoCss}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Raio-x do crédito</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Lido das faturas · {ativos.length} conta{ativos.length === 1 ? '' : 's'} de crédito · última fatura de cada cartão
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Limite total" valor={brl0.format(limite)} nota={`${ativos.length} cartões com fatura lida`} />
        <Kpi rotulo="Usado" valor={brl0.format(usado)} nota={`${pct((usado / Math.max(1, limite)) * 100)} do limite`} />
        <Kpi rotulo="Livre para usar" valor={brl0.format(livre)} />
        <Kpi rotulo="Preso em parcelas futuras" valor={brl0.format(futuras)} />
        <Kpi
          rotulo="Encargos pagos"
          valor={brl.format(encTotal)}
          nota={`${vencs.length ? `${dataBR(vencs[0])}/${vencs[0].slice(2, 4)} – ${dataBR(vencs[vencs.length - 1])}/${vencs[vencs.length - 1].slice(2, 4)} · ` : ''}juros ${brl0.format(encPor.juros)} · IOF ${brl0.format(encPor.iof)} · multa ${brl0.format(encPor.multa)}`}
        />
        <Kpi
          rotulo="Melhor cartão para comprar hoje"
          valor={melhorHoje ? `••${melhorHoje.final}` : '—'}
          nota={melhorHoje?.p ? `${melhorHoje.cartao?.nome ?? melhorHoje.f.instituicao} · paga em ${melhorHoje.p.compraHoje.dias} dias (${dataBR(melhorHoje.p.compraHoje.vence)})` : undefined}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">O que o banco não destaca</p>
          <ul className="flex flex-col gap-2">
            {dicas.map((d, i) => (
              <li
                key={i}
                className={`rounded-lg border-l-4 px-3 py-2 text-xs leading-relaxed ${
                  d.tom === 'alerta'
                    ? 'border-l-amber-500 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200'
                    : d.tom === 'ok'
                      ? 'border-l-emerald-500 bg-emerald-50/60 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200'
                      : 'border-l-sky-500 bg-sky-50/60 text-sky-950 dark:bg-sky-950/20 dark:text-sky-200'
                }`}
              >
                {d.texto}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Calendário de compra (mais prazo primeiro)</p>
          <div className="overflow-hidden rounded-xl border border-neutral-100 dark:border-neutral-800">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Cartão</th>
                  <th className="px-2 py-2 text-right font-semibold">Fecha</th>
                  <th className="px-2 py-2 text-right font-semibold">Vence</th>
                  <th className="px-2 py-2 text-right font-semibold">Melhor dia</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Compra hoje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[...ativos]
                  .filter((x) => x.p)
                  .sort((a, b) => b.p!.compraHoje.dias - a.p!.compraHoje.dias)
                  .map((x) => (
                    <tr key={x.final}>
                      <td className="px-2.5 py-2">
                        <span className="font-mono font-semibold tracking-wider text-neutral-900 dark:text-neutral-100">••{x.final}</span>
                        <span className="ml-1.5 text-neutral-500">{x.cartao?.nome ?? x.f.instituicao}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">dia {x.p!.diaFechamento}</td>
                      <td className="px-2 py-2 text-right tabular-nums">dia {x.p!.diaVencimento}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        dia {x.p!.melhorDia} <span className="font-normal text-neutral-500">({x.p!.prazoMaximo}d)</span>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">
                        {x.p!.compraHoje.dias} dias <span className="text-neutral-500">· {dataBR(x.p!.compraHoje.vence)}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            Comprar no dia seguinte ao fechamento joga a compra para a fatura seguinte: o maior prazo sem juros. Ao lado do fechamento, o prazo despenca.
          </p>
        </div>
      </div>
    </section>
  )
}

/** Uma linha com o essencial do crédito, para o botão recolhido do card. */
export function ResumoCredito({ fatura, hoje }: { fatura: FaturaCredito | null; hoje: string }) {
  if (!fatura) return <span className="text-[11px] text-neutral-400">sem fatura lida</span>
  const c = fatura.credito
  const p = prazos(c, hoje)
  const enc = encargosCobrados(c)
  const livre = c.limite_disponivel
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
      {livre != null && <span>livre {brl0.format(livre)}</span>}
      {p && <span>· melhor dia {p.melhorDia}</span>}
      <span className={enc > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>· {enc > 0 ? `encargos ${brl.format(enc)}` : 'sem encargos'}</span>
    </span>
  )
}
