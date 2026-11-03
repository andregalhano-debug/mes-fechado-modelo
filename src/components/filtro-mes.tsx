'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

// Filtro explícito do mês exibido em Contas a pagar — complementa as setas e os atalhos,
// pra ficar óbvio qual mês está na tela e trocar direto pra qualquer um.
export function FiltroMes({
  meses,
  atual,
}: {
  meses: { valor: string; rotulo: string; href: string }[]
  atual: string
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400">Mês</span>
      <select
        value={atual}
        disabled={pendente}
        onChange={(e) => {
          const destino = meses.find((m) => m.valor === e.target.value)
          if (destino) iniciar(() => router.push(destino.href, { scroll: false }))
        }}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 outline-none focus:border-militar-600 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
      >
        {meses.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}
