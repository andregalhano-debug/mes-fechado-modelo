'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Marca no aparelho que a biometria funciona NESTE endereço (passkey é amarrada ao domínio exato).
export const BIOMETRIA_OK = 'financas:biometria-ok'
const DISPENSADO = 'financas:biometria-aviso-dispensado'

// Depois de entrar com e-mail e senha num aparelho que tem leitor de digital/rosto mas ainda não
// tem biometria cadastrada para este endereço, sugere ativar — uma vez, com "agora não".
export function AvisoBiometria() {
  const pathname = usePathname()
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    let ativo = true
    try {
      if (localStorage.getItem(BIOMETRIA_OK) === '1' || localStorage.getItem(DISPENSADO) === '1') return
    } catch {
      return
    }
    window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then((tem) => ativo && setMostrar(tem))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  if (!mostrar || pathname === '/configuracoes') return null

  const marcar = (chave: string) => {
    try {
      localStorage.setItem(chave, '1')
    } catch {}
    setMostrar(false)
  }

  return (
    <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-militar-200 bg-militar-50 px-4 py-2.5 text-sm text-militar-900 md:mx-8 lg:mx-10 dark:border-militar-900 dark:bg-militar-950/40 dark:text-militar-200">
      <span>🔐 Entre sem senha: ative a biometria neste aparelho.</span>
      <span className="flex items-center gap-3">
        <Link href="/configuracoes#biometria" onClick={() => setMostrar(false)} className="rounded-lg bg-militar-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-militar-500">
          Ativar
        </Link>
        <button type="button" onClick={() => marcar(BIOMETRIA_OK)} className="text-xs text-militar-700 hover:underline dark:text-militar-300">
          Já uso aqui
        </button>
        <button type="button" onClick={() => marcar(DISPENSADO)} className="text-xs text-neutral-500 hover:underline">
          Agora não
        </button>
      </span>
    </div>
  )
}
