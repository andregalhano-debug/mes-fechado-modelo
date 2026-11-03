'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { criarContasDeAssinaturas } from '@/app/contas-a-pagar/actions'

type Item = { chave: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'anual'; cartaoId: string | null }

// Opcional (NEXT_PUBLIC_ASSINATURAS_VIRAM_CONTAS=1): quando há assinatura/recorrente sem conta em aberto, cria a da próxima cobrança e
// recarrega a tela. Roda uma vez por abertura (a ação no servidor não duplica).
export function SincronizarAssinaturas({ itens }: { itens: Item[] }) {
  const router = useRouter()
  const feito = useRef(false)
  useEffect(() => {
    if (feito.current || !itens.length) return
    feito.current = true
    criarContasDeAssinaturas(itens)
      .then((n) => {
        if (n > 0) router.refresh()
      })
      .catch(() => {})
  }, [itens, router])
  return null
}
