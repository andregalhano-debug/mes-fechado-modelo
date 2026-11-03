'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { COOKIE_PERIODO, PRESETS, nomeMesCurto, resolverPeriodo } from '@/lib/periodo'

// Filtro mãe de período (topo de todas as telas): atalhos prontos + intervalo personalizado,
// no padrão dos painéis mais usados (Google Analytics, Stripe, Shopify). Guardado em cookie.
export function FiltroPeriodo({ valor, tom = 'claro' }: { valor: string; tom?: 'claro' | 'escuro' }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const p = resolverPeriodo(valor)

  // meses disponíveis pro personalizado: de mar/2023 até o mês atual
  const hoje = new Date()
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const meses: string[] = []
  for (let d = new Date(2023, 2, 1); ; d.setMonth(d.getMonth() + 1)) {
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    meses.push(m)
    if (m >= atual) break
  }
  const [de, setDe] = useState(p.de ?? meses[Math.max(0, meses.length - 12)])
  const [ate, setAte] = useState(p.ate ?? atual)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  function aplicar(v: string) {
    document.cookie = `${COOKIE_PERIODO}=${v}; path=/; max-age=31536000; samesite=lax`
    setAberto(false)
    iniciar(() => router.refresh())
  }

  const botao =
    tom === 'escuro'
      ? 'bg-black/15 text-white hover:bg-black/25'
      : 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left transition md:gap-2 md:px-3 ${botao} ${pendente ? 'opacity-70' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">Período</span>
          {/* celular: só o intervalo (curto e sempre do mesmo tamanho); desktop: atalho + intervalo */}
          <span className="block max-w-[8.5rem] truncate text-xs font-semibold md:hidden">{p.intervalo}</span>
          <span className="hidden truncate text-xs font-semibold md:block">
            {p.rotulo}
            <span className="ml-1 font-normal opacity-80">· {p.intervalo}</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-xs opacity-70">
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher período"
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-neutral-200 bg-white p-3 text-neutral-900 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Atalhos</p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((x) => {
              const ativo = p.preset === x.id
              const r = resolverPeriodo(x.id)
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => aplicar(x.id)}
                  className={`rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    ativo ? 'bg-militar-600 font-semibold text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  } ${x.id === 'empresa' || x.id === 'tudo' ? 'col-span-2' : ''}`}
                >
                  {x.rotulo}
                  <span className={`block text-[11px] ${ativo ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>{r.intervalo}</span>
                </button>
              )
            })}
          </div>

          <p className="mt-3 border-t border-neutral-100 px-1 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Personalizado
          </p>
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              De
              <select value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {nomeMesCurto(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              Até
              <select value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {nomeMesCurto(m)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => aplicar(`custom:${de}:${ate}`)}
              className="rounded-lg bg-militar-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-militar-500"
            >
              Aplicar
            </button>
          </div>
          <p className="mt-3 px-1 text-[11px] text-neutral-500 dark:text-neutral-400">Vale para todas as telas e fica salvo.</p>
        </div>
      )}
    </div>
  )
}
