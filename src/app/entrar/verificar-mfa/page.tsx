'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MARCA } from '@/lib/marca'

export default function VerificarMfa() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      const fator = data?.totp.find((f) => f.status === 'verified')
      if (error || !fator) {
        setErro('Não encontrei um segundo fator ativo nesta conta.')
        setCarregando(false)
        return
      }
      setFactorId(fator.id)
      setCarregando(false)
    }
    iniciar()
  }, [])

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!factorId) return
    setErro(null)
    setEnviando(true)

    const supabase = createClient()
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId })
    if (erroDesafio || !desafio) {
      setErro(erroDesafio?.message ?? 'Não consegui iniciar a verificação.')
      setEnviando(false)
      return
    }

    const { error: erroVerificar } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: desafio.id,
      code: codigo.trim(),
    })

    if (erroVerificar) {
      setErro('Código incorreto. Confira o app autenticador e tente de novo.')
      setEnviando(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-militar-700 dark:text-militar-500">
          {MARCA.titulo}
        </p>
        <h1 className="mt-2 mb-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Digite o código do seu app autenticador
        </h1>

        {carregando ? (
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">Carregando…</p>
        ) : factorId ? (
          <form onSubmit={confirmar} className="flex flex-col items-center gap-4">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.4em] text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {erro && (
              <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={enviando || codigo.trim().length < 6}
              className="w-full rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
            >
              {enviando ? 'Verificando…' : 'Confirmar'}
            </button>
          </form>
        ) : (
          <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
      </div>
    </main>
  )
}
