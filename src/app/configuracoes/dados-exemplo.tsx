'use client'

import { useState } from 'react'
import { dadosDeExemplo } from './casa-actions'

export function DadosExemplo({ carregados, souAdmin }: { carregados: boolean; souAdmin: boolean }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function executar(acao: 'carregar' | 'apagar') {
    setErro(null)
    setEnviando(true)
    const r = await dadosDeExemplo(acao)
    setEnviando(false)
    if (!r.ok) setErro(r.erro)
  }

  if (!souAdmin) {
    return <p className="text-sm text-neutral-500">Só o dono do sistema carrega ou apaga os dados de exemplo.</p>
  }
  return (
    <div>
      <button
        onClick={() => executar(carregados ? 'apagar' : 'carregar')}
        disabled={enviando}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
      >
        {enviando ? 'Aguarde…' : carregados ? 'Apagar dados de exemplo' : 'Carregar dados de exemplo'}
      </button>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  )
}
