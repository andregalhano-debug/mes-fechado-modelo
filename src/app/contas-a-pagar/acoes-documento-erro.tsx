'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Ações na linha de um documento que deu erro: tentar de novo, abrir com a senha do PDF,
// enviar o arquivo já desbloqueado ou descartar. Dando certo, abre a revisão da fatura.
export function AcoesDocumentoErro({ documentoId, pedeSenha }: { documentoId: string; pedeSenha: boolean }) {
  const router = useRouter()
  const [modo, setModo] = useState<'nada' | 'senha' | 'arquivo' | 'descartar'>('nada')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  async function reprocessar(rotulo: string, dados: FormData) {
    setErro(null)
    setOcupado(rotulo)
    try {
      const r = await fetch(`/api/documentos/${documentoId}/reprocessar`, { method: 'POST', body: dados })
      const corpo = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(corpo.erro ?? 'Não deu certo. Tente de novo.')
        router.refresh()
        return
      }
      router.push(`/enviar?documento=${documentoId}&de=documentos`)
    } catch {
      setErro('Não consegui conectar. Verifique a internet e tente de novo.')
    } finally {
      setSenha('')
      setOcupado(null)
    }
  }

  async function descartar() {
    setErro(null)
    setOcupado('descartar')
    try {
      const r = await fetch(`/api/documentos/${documentoId}`, { method: 'DELETE' })
      if (!r.ok) {
        const corpo = await r.json().catch(() => ({}))
        setErro(corpo.erro ?? 'Não consegui descartar.')
        return
      }
      router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  const botao =
    'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
  const principal = 'rounded-lg bg-militar-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-militar-500 disabled:opacity-50'

  return (
    <div className="mt-2.5 w-full">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!ocupado} onClick={() => reprocessar('tentar', new FormData())} className={botao}>
          {ocupado === 'tentar' ? 'Tentando…' : '↻ Tentar de novo'}
        </button>
        {pedeSenha && (
          <button type="button" disabled={!!ocupado} onClick={() => setModo(modo === 'senha' ? 'nada' : 'senha')} className={botao}>
            🔑 Abrir com a senha
          </button>
        )}
        <button type="button" disabled={!!ocupado} onClick={() => setModo(modo === 'arquivo' ? 'nada' : 'arquivo')} className={botao}>
          ⬆ Enviar arquivo desbloqueado
        </button>
        <button
          type="button"
          disabled={!!ocupado}
          onClick={() => setModo(modo === 'descartar' ? 'nada' : 'descartar')}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Descartar
        </button>
      </div>

      {modo === 'senha' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!senha) return
            const dados = new FormData()
            dados.set('senha', senha)
            reprocessar('senha', dados)
          }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha do PDF"
            autoComplete="off"
            className="w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button type="submit" disabled={!senha || !!ocupado} className={principal}>
            {ocupado === 'senha' ? 'Abrindo e lendo…' : 'Abrir e ler'}
          </button>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">usada só agora, não fica guardada</span>
        </form>
      )}

      {modo === 'arquivo' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!arquivo) return
            const dados = new FormData()
            dados.set('arquivo', arquivo)
            reprocessar('arquivo', dados)
          }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="max-w-full text-xs"
          />
          <button type="submit" disabled={!arquivo || !!ocupado} className={principal}>
            {ocupado === 'arquivo' ? 'Enviando e lendo…' : 'Enviar e ler'}
          </button>
        </form>
      )}

      {modo === 'descartar' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-600 dark:text-neutral-300">Descartar este documento?</span>
          <button type="button" disabled={!!ocupado} onClick={descartar} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50">
            {ocupado === 'descartar' ? 'Descartando…' : 'Sim, descartar'}
          </button>
          <button type="button" onClick={() => setModo('nada')} className={botao}>
            Cancelar
          </button>
        </div>
      )}

      {ocupado && ocupado !== 'descartar' && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">A IA está lendo a fatura, leva alguns segundos…</p>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  )
}
