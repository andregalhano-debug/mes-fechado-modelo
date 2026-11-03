'use client'

import { useState } from 'react'
import { CampoMoeda } from './campo-moeda'
import { BotaoEnviar } from './botao-enviar'

type ContaMesAnterior = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  recorrente: boolean
  debito_automatico: boolean
  account_id: string | null
  category_id: string | null
  cartao_id?: string | null
  responsavel_id?: string | null
  linhagem_id: string
}

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

// Mesmo dia do vencimento anterior, mas caindo no mês alvo (o mês corrente) — não soma
// "+1 mês" porque o mês anterior com contas pode não ser literalmente o mês passado.
function vencimentoNoMesAlvo(vencimento: string, mesAlvo: string): string {
  const dia = Number(vencimento.slice(8, 10))
  const [anoAlvo, mesAlvoNum] = mesAlvo.slice(0, 7).split('-').map(Number)
  return new Date(anoAlvo, mesAlvoNum - 1, dia).toISOString().slice(0, 10)
}

export function ReplicarMesAnterior({
  contas,
  mesAlvo,
  action,
  rotuloBotao = 'Replicar contas do mês anterior',
  inicialAberto = true,
}: {
  contas: ContaMesAnterior[]
  mesAlvo: string
  action: (formData: FormData) => Promise<void>
  rotuloBotao?: string
  inicialAberto?: boolean
}) {
  const [aberto, setAberto] = useState(inicialAberto)

  if (contas.length === 0) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-3 rounded-lg bg-militar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-militar-500"
      >
        {rotuloBotao}
      </button>
    )
  }

  return (
    <form
      action={async (formData) => {
        await action(formData)
        setAberto(false)
      }}
      className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Ajuste os valores que forem diferentes e desmarque o que não quiser trazer pra este mês. O
        vencimento já vem sugerido pro mesmo dia, neste mês.
      </p>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {contas.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
            <input type="hidden" name="ids" value={c.id} />
            <input type="hidden" name={`descricao_${c.id}`} value={c.descricao} />
            <input type="hidden" name={`recorrente_${c.id}`} value={c.recorrente ? '1' : ''} />
            <input type="hidden" name={`debito_automatico_${c.id}`} value={c.debito_automatico ? '1' : ''} />
            <input type="hidden" name={`account_id_${c.id}`} value={c.account_id ?? ''} />
            <input type="hidden" name={`category_id_${c.id}`} value={c.category_id ?? ''} />
            <input type="hidden" name={`cartao_id_${c.id}`} value={c.cartao_id ?? ''} />
            <input type="hidden" name={`responsavel_id_${c.id}`} value={c.responsavel_id ?? ''} />
            <input type="hidden" name={`linhagem_id_${c.id}`} value={c.linhagem_id} />
            <input type="checkbox" name={`incluir_${c.id}`} defaultChecked className="h-4 w-4 shrink-0" />
            <span className="min-w-[120px] flex-1 truncate text-sm text-neutral-900 dark:text-neutral-100">
              {c.descricao}
            </span>
            <input
              type="date"
              name={`vencimento_${c.id}`}
              defaultValue={vencimentoNoMesAlvo(c.vencimento, mesAlvo)}
              className={`${campo} shrink-0`}
            />
            <CampoMoeda
              name={`valor_${c.id}`}
              defaultValue={c.valor}
              className={`${campo} w-28 shrink-0 text-right tabular-nums`}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <BotaoEnviar
          enviando="Replicando…"
          className="rounded-lg bg-militar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-militar-500"
        >
          Confirmar replicação
        </BotaoEnviar>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
