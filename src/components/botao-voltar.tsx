'use client'

import { useRouter } from 'next/navigation'

// Volta para onde a pessoa estava (mesma aba, filtros e rolagem). Se a página foi aberta
// direto (link colado, nova aba), cai no endereço de reserva.
export function BotaoVoltar({ reserva, rotulo }: { reserva: string; rotulo: string }) {
  const router = useRouter()
  function voltar() {
    const veioDoApp = typeof document !== 'undefined' && document.referrer.startsWith(window.location.origin)
    if (veioDoApp && window.history.length > 1) router.back()
    else router.push(reserva)
  }
  return (
    <button type="button" onClick={voltar} className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500">
      ← {rotulo}
    </button>
  )
}
