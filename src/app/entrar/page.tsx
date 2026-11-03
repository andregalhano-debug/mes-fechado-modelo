'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '../theme-toggle'
import { BIOMETRIA_OK } from '@/components/aviso-biometria'
import { MARCA } from '@/lib/marca'

export default function Entrar() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [biometriaDisponivel, setBiometriaDisponivel] = useState(false)
  const [recuperarSenha, setRecuperarSenha] = useState(false)
  const [recuperarEnviado, setRecuperarEnviado] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setBiometriaDisponivel(true)
    }
  }, [])

  async function entrarComBiometria() {
    setErro(null)
    setEnviando(true)
    try {
      const resOpcoes = await fetch('/api/passkey/login/opcoes', { method: 'POST' })
      if (!resOpcoes.ok) throw new Error('Não consegui iniciar a biometria.')
      const opcoes = await resOpcoes.json()

      const respostaAuth = await startAuthentication({ optionsJSON: opcoes })

      const resVerificar = await fetch('/api/passkey/login/verificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(respostaAuth),
      })
      const dados = await resVerificar.json()
      if (!resVerificar.ok) throw new Error(dados.erro ?? 'Biometria não reconhecida.')

      try {
        localStorage.setItem(BIOMETRIA_OK, '1')
      } catch {}
      router.push('/')
      router.refresh()
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Não consegui usar a biometria.'
      // NotAllowed = cancelou no seletor do sistema OU o aparelho não tem biometria cadastrada
      // para ESTE endereço (passkey é amarrada ao domínio exato) — o Android não diferencia.
      if (e instanceof Error && (e.name === 'NotAllowedError' || mensagem.toLowerCase().includes('not allowed'))) {
        setErro(
          `A biometria não foi concluída. Se você não cancelou, este aparelho ainda não tem biometria cadastrada para ${window.location.hostname} — entre com e-mail e senha e ative em Configurações → Biometria.`,
        )
      } else setErro(mensagem)
      setEnviando(false)
    }
  }

  async function pedirRecuperacao(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)

    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nova-senha`,
    })

    // Não revela se o e-mail existe ou não — evita enumeração de contas.
    setEnviando(false)
    setRecuperarEnviado(true)
  }

  async function entrarComSenha(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha não conferem. Tente de novo.'
          : error.message,
      )
      setEnviando(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-militar-700 dark:text-militar-500">
            {MARCA.titulo}
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mt-2 mb-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Acesse suas finanças
        </h1>

        {biometriaDisponivel && !mostrarSenha && (
          <div className="flex flex-col items-center">
            <button
              onClick={entrarComBiometria}
              disabled={enviando}
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-militar-600 bg-militar-50 text-militar-700 transition hover:scale-105 disabled:opacity-60 dark:bg-militar-950/40 dark:text-militar-400"
              aria-label="Entrar com biometria"
            >
              <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
                <polyline points="8,20 8,8 20,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="44,8 56,8 56,20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="8,44 8,56 20,56" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="56,44 56,56 44,56" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="32" cy="28" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <path d="M19,50 Q32,38 45,50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <p className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {enviando ? 'Verificando…' : 'Toque para entrar'}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Face ID, Touch ID ou impressão digital
            </p>
            {erro && (
              <p role="alert" className="mt-3 text-center text-sm text-red-600 dark:text-red-400">
                {erro}
              </p>
            )}
            <button
              onClick={() => setMostrarSenha(true)}
              className="mt-6 text-sm font-medium text-militar-700 underline dark:text-militar-500"
            >
              Usar e-mail e senha
            </button>
          </div>
        )}

        {(!biometriaDisponivel || mostrarSenha) && recuperarSenha && (
          <form onSubmit={pedirRecuperacao} className="flex flex-col gap-4">
            {recuperarEnviado ? (
              <p className="text-center text-sm text-neutral-600 dark:text-neutral-300">
                Se esse e-mail tiver uma conta, chegou um link pra redefinir a senha. Confira sua caixa de
                entrada (e o spam).
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    E-mail
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={enviando}
                  className="mt-2 rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
                >
                  {enviando ? 'Enviando…' : 'Enviar link de redefinição'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setRecuperarSenha(false)
                setRecuperarEnviado(false)
              }}
              className="text-sm font-medium text-militar-700 underline dark:text-militar-500"
            >
              Voltar
            </button>
          </form>
        )}

        {(!biometriaDisponivel || mostrarSenha) && !recuperarSenha && (
          <form onSubmit={entrarComSenha} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                E-mail
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Senha
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={() => setRecuperarSenha(true)}
                className="self-end text-xs text-neutral-500 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Esqueci minha senha
              </button>
            </label>

            {erro && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-militar-600 dark:hover:bg-militar-500"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>

            {biometriaDisponivel && (
              <button
                type="button"
                onClick={() => setMostrarSenha(false)}
                className="text-sm font-medium text-militar-700 underline dark:text-militar-500"
              >
                Usar biometria
              </button>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
