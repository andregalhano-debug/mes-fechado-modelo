'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

// Botão de envio com feedback visível em cada etapa:
// - alterado: algum campo do formulário mudou → o botão ganha destaque (se `destacarAlteracao`)
// - enviando: trava (evita clique repetido que duplica lançamentos) e mostra um spinner
// - salvo: confirma com "✓" em verde por 2 segundos
// Os estilos de destaque e sucesso ficam em globals.css (button[data-alterado] / [data-salvo]).
export function BotaoEnviar({
  children,
  enviando = 'Salvando…',
  sucesso = 'Salvo',
  destacarAlteracao = false,
  className,
}: {
  children: ReactNode
  enviando?: string
  sucesso?: string | false
  destacarAlteracao?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()
  const ref = useRef<HTMLButtonElement>(null)
  const estavaEnviando = useRef(false)
  const [salvo, setSalvo] = useState(false)
  const [alterado, setAlterado] = useState(false)

  useEffect(() => {
    if (estavaEnviando.current && !pending && sucesso) {
      setSalvo(true)
      setAlterado(false)
      const t = setTimeout(() => setSalvo(false), 2000)
      estavaEnviando.current = false
      return () => clearTimeout(t)
    }
    estavaEnviando.current = pending
  }, [pending, sucesso])

  useEffect(() => {
    const form = ref.current?.form
    if (!form || !destacarAlteracao) return
    const marcar = () => setAlterado(true)
    form.addEventListener('input', marcar)
    form.addEventListener('change', marcar)
    return () => {
      form.removeEventListener('input', marcar)
      form.removeEventListener('change', marcar)
    }
  }, [destacarAlteracao])

  return (
    <button
      ref={ref}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-salvo={salvo ? '' : undefined}
      data-alterado={alterado && !pending && !salvo ? '' : undefined}
      className={`botao-enviar inline-flex items-center justify-center gap-1.5 ${className ?? ''} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 animate-spin">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {enviando}
        </>
      ) : salvo ? (
        <>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="botao-enviar-check h-3.5 w-3.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {sucesso}
        </>
      ) : (
        children
      )}
      <span className="sr-only" aria-live="polite">
        {salvo && sucesso ? sucesso : ''}
      </span>
    </button>
  )
}
