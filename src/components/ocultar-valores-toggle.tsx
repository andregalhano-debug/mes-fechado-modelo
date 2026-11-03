'use client'

import { useEffect, useState } from 'react'
import { CHAVE_OCULTAR as CHAVE } from '@/lib/mascara-valores'
const EVENTO = 'financas:ocultar-valores-mudou'

function lerOculto() {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

/** Liga/desliga o "ocultar valores" do sistema todo (classe no <html> + preferência salva + aviso
 *  para quem usa useOcultarValores, inclusive o próprio olho do topo). */
export function definirOculto(oculto: boolean) {
  try {
    localStorage.setItem(CHAVE, oculto ? '1' : '0')
  } catch {}
  document.documentElement.classList.toggle('valores-ocultos', oculto)
  window.dispatchEvent(new Event(EVENTO))
}

// Botão de "ocultar valores" vive no header (fixo, fora do fluxo do conteúdo), mas quem
// precisa mascarar números é a página — sincronizados via localStorage + um evento
// customizado (o evento nativo `storage` só dispara em OUTRAS abas).
export function useOcultarValores() {
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    setOculto(lerOculto())
    function aoMudar() {
      setOculto(lerOculto())
    }
    window.addEventListener(EVENTO, aoMudar)
    return () => window.removeEventListener(EVENTO, aoMudar)
  }, [])

  return oculto
}

export function OcultarValoresToggle({ tom }: { tom?: 'escuro' } = {}) {
  const oculto = useOcultarValores()

  return (
    <button
      onClick={() => definirOculto(!lerOculto())}
      aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}
      title={oculto ? 'Mostrar valores' : 'Ocultar valores'}
      aria-pressed={oculto}
      className={
        tom === 'escuro'
          ? `rounded-lg p-1.5 transition hover:bg-black/15 ${oculto ? 'bg-black/20 text-white' : 'text-white/80 hover:text-white'}`
          : 'rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
      }
    >
      {oculto ? <IconeOlhoFechado /> : <IconeOlho />}
    </button>
  )
}

function IconeOlho() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconeOlhoFechado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.4C10.2 5.2 11.1 5 12 5c7 0 11 7 11 7-.7 1.2-1.7 2.6-3.1 3.9M6.1 6.9C3.9 8.3 2.4 10.2 1 12c0 0 4 7 11 7 1.2 0 2.3-.2 3.3-.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
