'use client'

import { useEffect, useLayoutEffect } from 'react'
import { CHAVE_OCULTAR } from '@/lib/mascara-valores'
import { definirOculto } from './ocultar-valores-toggle'

/** Sem mexer no mouse/teclado por esse tempo, os valores voltam a ficar ocultos. */
const INATIVIDADE_MS = 60_000

// No carregamento direto da página, roda antes da primeira pintura (antes até do React):
// os números já nascem borrados, sem "piscar" visíveis.
const SCRIPT_OCULTAR_JA = `try{localStorage.setItem('${CHAVE_OCULTAR}','1')}catch(e){}document.documentElement.classList.add('valores-ocultos')`

/**
 * Telas sensíveis (Patrimônio, Plano): sempre abrem com os valores ocultos — para ver, clica no
 * olho do topo. Voltam a ocultar sozinhas após 1 minuto sem uso, quando a aba/app sai de foco e
 * ao sair da tela (os valores seguem ocultos no resto do sistema até clicar no olho de novo).
 */
export function ProtecaoValores() {
  // navegação dentro do app: oculta antes de o navegador pintar a tela nova
  useLayoutEffect(() => {
    definirOculto(true)
    return () => definirOculto(true)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const ocultar = () => {
      if (!document.documentElement.classList.contains('valores-ocultos')) definirOculto(true)
    }
    const reiniciar = () => {
      clearTimeout(timer)
      timer = setTimeout(ocultar, INATIVIDADE_MS)
    }
    const aoSairDeFoco = () => {
      if (document.visibilityState === 'hidden') ocultar()
    }
    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const
    for (const e of eventos) window.addEventListener(e, reiniciar, { passive: true })
    document.addEventListener('visibilitychange', aoSairDeFoco)
    window.addEventListener('pagehide', ocultar)
    reiniciar()
    return () => {
      clearTimeout(timer)
      for (const e of eventos) window.removeEventListener(e, reiniciar)
      document.removeEventListener('visibilitychange', aoSairDeFoco)
      window.removeEventListener('pagehide', ocultar)
    }
  }, [])

  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_OCULTAR_JA }} />
}
