'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { BIOMETRIA_OK } from '@/components/aviso-biometria'

export function CadastroBiometria() {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [apelido, setApelido] = useState('Este aparelho')

  async function cadastrar() {
    setErro(null)
    setEnviando(true)
    try {
      const resOpcoes = await fetch('/api/passkey/registro/opcoes', { method: 'POST' })
      const opcoes = await resOpcoes.json()
      if (!resOpcoes.ok) throw new Error(opcoes.erro ?? 'Não consegui iniciar o cadastro.')

      const resposta = await startRegistration({ optionsJSON: opcoes })

      const resVerificar = await fetch('/api/passkey/registro/verificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resposta, apelido }),
      })
      const dados = await resVerificar.json()
      if (!resVerificar.ok || !dados.ok) throw new Error(dados.erro ?? 'Não consegui salvar a biometria.')

      try {
        localStorage.setItem(BIOMETRIA_OK, '1')
      } catch {}
      router.refresh()
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Não consegui cadastrar a biometria.'
      if (e instanceof Error && e.name === 'InvalidStateError') {
        try {
          localStorage.setItem(BIOMETRIA_OK, '1')
        } catch {}
        setErro('Este aparelho já tem biometria cadastrada para este endereço — pode usar no login.')
      } else if (!mensagem.toLowerCase().includes('not allowed')) setErro(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Nome deste aparelho
        </span>
        <input
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          placeholder="ex: iPhone da Ana"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
      </label>
      <button
        onClick={cadastrar}
        disabled={enviando}
        className="rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
      >
        {enviando ? 'Cadastrando…' : 'Cadastrar biometria neste aparelho'}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:basis-full">
          {erro}
        </p>
      )}
    </div>
  )
}
