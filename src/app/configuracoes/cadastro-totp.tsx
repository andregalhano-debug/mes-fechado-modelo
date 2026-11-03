'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Fator = { id: string; status: string }

export function CadastroTotp({ fatorInicial }: { fatorInicial: Fator | null }) {
  const router = useRouter()
  const [fator, setFator] = useState(fatorInicial)
  const [pendenteId, setPendenteId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function iniciarCadastro() {
    setErro(null)
    setCarregando(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Autenticador',
    })
    setCarregando(false)
    if (error || !data) {
      setErro(error?.message ?? 'Não consegui iniciar o cadastro do 2FA.')
      return
    }
    setPendenteId(data.id)
    setQrCode(data.totp.qr_code)
  }

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!pendenteId) return
    setErro(null)
    setCarregando(true)

    const supabase = createClient()
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
      factorId: pendenteId,
    })
    if (erroDesafio || !desafio) {
      setErro(erroDesafio?.message ?? 'Não consegui verificar o código.')
      setCarregando(false)
      return
    }

    const { error: erroVerificar } = await supabase.auth.mfa.verify({
      factorId: pendenteId,
      challengeId: desafio.id,
      code: codigo.trim(),
    })
    setCarregando(false)
    if (erroVerificar) {
      setErro('Código incorreto. Confira o app autenticador e tente de novo.')
      return
    }

    setFator({ id: pendenteId, status: 'verified' })
    setQrCode(null)
    setPendenteId(null)
    setCodigo('')
    router.refresh()
  }

  async function desativar() {
    if (!fator) return
    setErro(null)
    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.unenroll({ factorId: fator.id })
    setCarregando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setFator(null)
    router.refresh()
  }

  if (fator) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          2FA ativado — pede código do app autenticador a cada login.
        </p>
        <button
          onClick={desativar}
          disabled={carregando}
          className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-60 dark:hover:text-red-400"
        >
          desativar
        </button>
      </div>
    )
  }

  if (qrCode) {
    return (
      <form onSubmit={confirmar} className="flex flex-col items-start gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Escaneie com Google Authenticator, Authy ou similar e digite o código de 6 dígitos.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCode}
          alt="QR code do 2FA"
          className="h-40 w-40 rounded-lg border border-neutral-200 dark:border-neutral-800"
        />
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="w-32 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center tracking-widest text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={carregando || codigo.trim().length < 6}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
        >
          {carregando ? 'Confirmando…' : 'Confirmar'}
        </button>
        {erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={iniciarCadastro}
        disabled={carregando}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
      >
        {carregando ? 'Preparando…' : 'Ativar 2FA'}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  )
}
