import { BotaoEnviar } from '@/components/botao-enviar'
import { definirRenovacao } from './actions'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

export type ContaAnual = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  pago: boolean
  pago_em: string | null
  linhagem_id: string | null
  cartao_id?: string | null
  so_lembrete?: boolean | null
}

// Próximas renovações das contas anuais (seguros, IPVA, anuidades…): uma linha por conta, com a
// próxima data em aberto, quanto falta e a última vez que foi paga. A data é editável ali mesmo.
export function RenovacoesAnuais({ contas, hoje }: { contas: ContaAnual[]; hoje: string }) {
  const porLinha = new Map<string, ContaAnual[]>()
  for (const c of contas) {
    const k = c.linhagem_id ?? c.id
    porLinha.set(k, [...(porLinha.get(k) ?? []), c])
  }
  const linhas = [...porLinha.values()]
    .map((cs) => {
      const proxima = cs.filter((c) => !c.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null
      const ultimaPaga = cs.filter((c) => c.pago).sort((a, b) => b.vencimento.localeCompare(a.vencimento))[0] ?? null
      return { proxima, ultimaPaga, descricao: (proxima ?? ultimaPaga)!.descricao }
    })
    .sort((a, b) => (a.proxima?.vencimento ?? '9999').localeCompare(b.proxima?.vencimento ?? '9999'))
  if (!linhas.length) return null

  const dias = (d: string) => Math.round((Date.parse(d) - Date.parse(hoje)) / 86400000)
  const total12 = linhas.filter((l) => l.proxima && dias(l.proxima.vencimento) <= 366).reduce((t, l) => t + Number(l.proxima!.valor), 0)

  return (
    <details className="group rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Próximas renovações anuais</span>
          <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
            {linhas.length} conta{linhas.length === 1 ? '' : 's'} · próximos 12 meses {brl.format(total12)}
          </span>
        </span>
        <span className="text-xs font-semibold text-militar-700 dark:text-militar-400">
          <span className="group-open:hidden">▾ ver</span>
          <span className="hidden group-open:inline">▴ recolher</span>
        </span>
      </summary>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Seguros, IPVA, anuidades: ao pagar, a renovação do ano seguinte é criada sozinha. Ajuste aqui a data quando a apólice
        vier com outra vigência.
      </p>
      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        {linhas.map((l) => {
          const d = l.proxima ? dias(l.proxima.vencimento) : null
          const tom =
            d == null ? 'text-neutral-400' : d < 0 ? 'text-red-600 dark:text-red-400' : d <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'
          return (
            <li key={l.proxima?.id ?? l.ultimaPaga!.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {l.descricao}
                  {(l.proxima ?? l.ultimaPaga)?.so_lembrete && (
                    <span title="Cobrada no cartão: o valor entra pela fatura; aqui é só o lembrete." className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      💳 no cartão · lembrete
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                  {l.ultimaPaga ? `última paga ${dataBR(l.ultimaPaga.pago_em ?? l.ultimaPaga.vencimento)} · ${brl.format(Number(l.ultimaPaga.valor))}` : 'ainda não paga'}
                </span>
              </span>
              {l.proxima ? (
                <form action={definirRenovacao} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={l.proxima.id} />
                  <span className={`text-xs font-semibold ${tom}`}>
                    {d! < 0 ? `venceu há ${-d!} dia${d === -1 ? '' : 's'}` : d === 0 ? 'vence hoje' : `em ${d} dia${d === 1 ? '' : 's'}`}
                  </span>
                  <input
                    type="date"
                    name="data"
                    defaultValue={l.proxima.vencimento}
                    aria-label={`Próxima renovação de ${l.descricao}`}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                  <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(Number(l.proxima.valor))}</span>
                  <BotaoEnviar className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
                    Salvar data
                  </BotaoEnviar>
                </form>
              ) : (
                <span className="text-xs text-neutral-400">sem próxima renovação cadastrada</span>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
