'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Quadro que abre recolhido no celular e aberto no computador (dá pra abrir/fechar nos dois).
// O cabeçalho (resumo) fica sempre visível.
export function RecolhivelCelular({ resumo, children, className }: { resumo: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (ref.current && window.matchMedia('(min-width: 768px)').matches) ref.current.open = true
  }, [])
  return (
    <details ref={ref} className={`group ${className ?? ''}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="text-neutral-400 transition group-open:rotate-90" aria-hidden="true">
          ▸
        </span>
        <span className="min-w-0 flex-1">{resumo}</span>
      </summary>
      {children}
    </details>
  )
}
