'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Fato = { id: string; titulo: string; detalhe: string; link: string; peso: number; tom: 'alerta' | 'atencao' | 'info' | 'bom' }
type Sugestao = { titulo: string; acao: string; base: string }

const COR_TOM: Record<Fato['tom'], string> = {
  alerta: 'bg-red-500',
  atencao: 'bg-amber-500',
  info: 'bg-sky-500',
  bom: 'bg-emerald-500',
}

function ler<T>(chave: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? 'null')
  } catch {
    return null
  }
}

// Card compacto de insights na Visão geral: até 3 fatos calculados por código (grátis),
// dispensáveis, e um botão opcional para a IA sugerir ações (guardado por dia neste aparelho).
export function Insights() {
  const [fatos, setFatos] = useState<Fato[] | null>(null)
  const [pessoa, setPessoa] = useState('todos')
  const [dispensados, setDispensados] = useState<string[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recolhido, setRecolhido] = useState(false)

  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    setDispensados(ler<string[]>('insights:dispensados') ?? [])
    setRecolhido(localStorage.getItem('insights:recolhido') === '1')
    fetch('/api/assistente/fatos')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFatos(d.fatos)
        setPessoa(d.pessoa)
        const salvas = ler<{ dia: string; pessoa: string; sugestoes: Sugestao[] }>('insights:sugestoes')
        if (salvas && salvas.dia === hoje && salvas.pessoa === d.pessoa) setSugestoes(salvas.sugestoes)
      })
      .catch(() => setFatos([]))
  }, [hoje])

  if (fatos === null) {
    return <div className="mb-6 h-24 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />
  }

  const visiveis = fatos.filter((f) => !dispensados.includes(f.id)).slice(0, 4)
  if (visiveis.length === 0 && !sugestoes) return null

  function dispensar(id: string) {
    const novos = [...dispensados, id].slice(-100)
    setDispensados(novos)
    localStorage.setItem('insights:dispensados', JSON.stringify(novos))
  }

  async function pedirSugestoes() {
    setGerando(true)
    setErro(null)
    try {
      const r = await fetch('/api/assistente/sugestoes', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro)
      setSugestoes(d.sugestoes)
      localStorage.setItem('insights:sugestoes', JSON.stringify({ dia: hoje, pessoa, sugestoes: d.sugestoes }))
    } catch (e) {
      setErro((e as Error).message || 'Não consegui gerar as sugestões.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Insights</h2>
        <button
          type="button"
          onClick={() => {
            setRecolhido(!recolhido)
            localStorage.setItem('insights:recolhido', recolhido ? '0' : '1')
          }}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {recolhido ? `Mostrar (${visiveis.length})` : 'Recolher'}
        </button>
      </div>

      {!recolhido && (
        <>
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
            {visiveis.map((f) => (
              <li key={f.id} className="flex items-start gap-3 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COR_TOM[f.tom]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Link href={f.link} className="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100">
                    {f.titulo}
                  </Link>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{f.detalhe}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dispensar(f.id)}
                  aria-label="Dispensar este insight"
                  title="Dispensar"
                  className="rounded p-1 text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {sugestoes ? (
            <div className="mt-3 rounded-xl bg-militar-50 p-3 dark:bg-militar-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-militar-800 dark:text-militar-400">O que fazer agora</p>
              <ol className="mt-2 flex flex-col gap-2">
                {sugestoes.map((s, i) => (
                  <li key={i} className="text-sm text-neutral-800 dark:text-neutral-200">
                    <span className="font-semibold">{s.titulo}.</span> {s.acao}
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">Base: {s.base}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={pedirSugestoes}
                disabled={gerando}
                className="inline-flex items-center gap-2 rounded-lg border border-militar-600 px-3 py-1.5 text-xs font-semibold text-militar-700 transition hover:bg-militar-50 disabled:opacity-60 dark:text-militar-400 dark:hover:bg-militar-950/30"
              >
                {gerando && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {gerando ? 'Analisando…' : 'Sugerir ações com IA'}
              </button>
              {erro && <span className="text-xs text-red-600 dark:text-red-400">{erro}</span>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
