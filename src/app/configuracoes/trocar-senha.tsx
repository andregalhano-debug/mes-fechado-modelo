'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const campo =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

export function TrocarSenha() {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    setAberto(false)
    setSenha('')
    setConfirmarSenha('')
    setErro(null)
    setSucesso(false)
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não conferem.')
      return
    }

    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setSenha('')
    setConfirmarSenha('')
    setSucesso(true)
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500"
      >
        Trocar senha
      </button>
    )
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Senha atualizada ✓
        </p>
        <button
          onClick={fechar}
          className="text-sm font-medium text-militar-700 underline dark:text-militar-500"
        >
          Fechar
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="flex flex-col items-start gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Nova senha</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={`${campo} w-56`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Confirmar senha</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          className={`${campo} w-56`}
        />
      </label>

      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
        >
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
        <button
          type="button"
          onClick={fechar}
          className="text-sm font-medium text-militar-700 underline dark:text-militar-500"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
