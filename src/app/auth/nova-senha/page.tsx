'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MARCA } from '@/lib/marca'

export default function NovaSenha() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [precisaCodigo, setPrecisaCodigo] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Fluxo PKCE (padrão neste projeto): o link volta com ?code=... na URL,
    // que precisa ser trocado por sessão manualmente — não é automático como
    // no fluxo antigo por #access_token.
    const code = new URLSearchParams(window.location.search).get('code')

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setPronto(true)
    })

    async function iniciar() {
      // Link gerado pelo administrador (sem depender do e-mail): ?token_hash=...&type=recovery
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      if (tokenHash && params.get('type') === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
        if (error) {
          // link já usado mas a sessão de recuperação continua aberta (ex.: recarregou a página)
          const { data } = await supabase.auth.getSession()
          if (data.session) return setPronto(true)
          setErro('Esse link expirou ou já foi usado. Peça um novo.')
          return
        }
        setPronto(true)
        return
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setErro('Esse link expirou ou já foi usado. Peça um novo.')
          return
        }
        setPronto(true)
        return
      }
      const { data } = await supabase.auth.getSession()
      if (data.session) setPronto(true)
    }
    iniciar()

    // Sem "?code=" e sem sessão: provavelmente o link foi "pré-visitado" por um
    // app de mensagens (WhatsApp/Telegram geram preview abrindo o link antes do
    // clique real, o que consome o token de uso único). Não trava esperando pra
    // sempre — avisa e sugere pedir outro link.
    const semCodigo = setTimeout(() => {
      setPronto((atual) => {
        if (!atual) {
          setErro(
            'Não consegui confirmar o link. Se você o recebeu por WhatsApp ou Telegram, o preview automático pode ter consumido o link antes do clique — peça um novo.',
          )
        }
        return atual
      })
    }, 4000)

    return () => {
      assinatura.subscription.unsubscribe()
      clearTimeout(semCodigo)
    }
  }, [])

  // Assim que o link é confirmado: se a conta tem 2FA, já mostra o campo do código.
  useEffect(() => {
    if (!pronto) return
    createClient()
      .auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => setPrecisaCodigo(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'))
  }, [pronto])

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
    // Conta com 2FA: o Supabase só troca a senha numa sessão AAL2 → confirma o código do app antes.
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (nivel && nivel.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') {
      if (!/^\d{6}$/.test(codigo.trim())) {
        setPrecisaCodigo(true)
        setEnviando(false)
        setErro('Sua conta tem verificação em duas etapas: informe o código de 6 dígitos do app autenticador.')
        return
      }
      const { data: fatores } = await supabase.auth.mfa.listFactors()
      const totp = fatores?.totp?.[0]
      if (!totp) {
        setEnviando(false)
        setErro('Não encontrei o app autenticador desta conta.')
        return
      }
      const { error: erroCodigo } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codigo.trim() })
      if (erroCodigo) {
        setEnviando(false)
        setErro('Código do app autenticador inválido ou expirado. Confira e tente de novo.')
        return
      }
    }
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)

    if (error) {
      setErro(error.message)
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
          Defina sua nova senha
        </h1>

        {!pronto ? (
          erro ? (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {erro}
            </p>
          ) : (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              Confirmando o link…
            </p>
          )
        ) : (
          <form onSubmit={salvar} className="flex flex-col gap-4">
            {precisaCodigo && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Código do app autenticador (2FA)
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.4em] text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Nova senha
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Confirmar senha
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
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
              {enviando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
