'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Recolhe/expande os cards de uma grade: recolhido, cada card mostra só o cabeçalho (classe
// .card-corpo some via CSS). A escolha fica salva no aparelho.
export function AlternarResumo({ chave, children, rotuloExpandido = 'Recolher cards', rotuloResumo = 'Expandir cards' }: { chave: string; children: ReactNode; rotuloExpandido?: string; rotuloResumo?: string }) {
  const [resumo, setResumo] = useState(false)
  useEffect(() => {
    try {
      setResumo(localStorage.getItem(`resumo:${chave}`) === '1')
    } catch {}
  }, [chave])
  function alternar() {
    setResumo((r) => {
      try {
        localStorage.setItem(`resumo:${chave}`, r ? '0' : '1')
      } catch {}
      return !r
    })
  }
  return (
    <div data-resumo={resumo ? '1' : '0'}>
      <div className="flex justify-end border-t border-neutral-200 px-4 pt-3 sm:px-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={alternar}
          aria-pressed={resumo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <span aria-hidden="true">{resumo ? '⊞' : '⊟'}</span>
          {resumo ? rotuloResumo : rotuloExpandido}
        </button>
      </div>
      {children}
    </div>
  )
}
