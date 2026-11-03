'use client'

import { useState, useTransition } from 'react'
import { buscarFaturasAgora } from '@/app/contas-a-pagar/actions'

// Faixa da aba Documentos: mostra se o Gmail de faturas está ligado e permite buscar na hora,
// sem esperar a verificação diária automática.
export function BuscarFaturasEmail({ ativo }: { ativo: boolean }) {
  const [pendente, iniciar] = useTransition()
  const [mensagem, setMensagem] = useState<string | null>(null)

  if (!ativo) {
    return (
      <p className="mb-4 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        Recebimento automático por e-mail ainda não configurado. Quando estiver, as faturas encaminhadas para o Gmail
        exclusivo aparecem aqui todo dia às 8h.
      </p>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-militar-200 bg-militar-50/60 px-4 py-3 dark:border-militar-900 dark:bg-militar-950/20">
      <p className="text-xs text-militar-900 dark:text-militar-300">
        <span className="font-semibold">Faturas por e-mail ligadas.</span> O app confere o Gmail de faturas todo dia às 8h.
      </p>
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setMensagem(null)
            const r = await buscarFaturasAgora()
            setMensagem(r.mensagem)
          })
        }
        className="inline-flex items-center gap-2 rounded-lg bg-militar-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-militar-500 disabled:opacity-60"
      >
        {pendente && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {pendente ? 'Buscando…' : 'Buscar agora'}
      </button>
      {mensagem && <p className="w-full text-xs text-neutral-700 dark:text-neutral-300">{mensagem}</p>}
    </div>
  )
}
