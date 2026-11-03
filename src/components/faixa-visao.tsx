'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { temaDaVisao } from '@/lib/tema-pessoa'
import { FiltroPeriodo } from './filtro-periodo'
import { OcultarValoresToggle } from './ocultar-valores-toggle'

// Faixa fixa no topo de todas as telas: de quem são os dados que você está vendo (cada pessoa ou
// a casa toda), na cor da pessoa, com troca rápida. Fica visível mesmo rolando a página; as barras
// fixas das telas (abas, resumo do Patrimônio) grudam logo abaixo dela (variável --altura-faixa).
// No celular vira uma linha só: pessoa num menu suspenso à esquerda e período à direita.
export function FaixaVisao({
  opcoes,
  atual,
  periodo,
}: {
  opcoes: { valor: string; rotulo: string }[]
  atual: string
  periodo: string
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [menuPessoa, setMenuPessoa] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const refPessoa = useRef<HTMLDivElement>(null)
  const rotuloAtual = opcoes.find((o) => o.valor === atual)?.rotulo ?? opcoes[0]?.rotulo ?? ''
  const tema = temaDaVisao(atual, rotuloAtual)
  const juntos = atual === 'todos'
  const pessoas = opcoes.filter((o) => o.valor !== 'todos').map((o) => o.rotulo)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const aplicar = () => document.documentElement.style.setProperty('--altura-faixa', `${el.offsetHeight}px`)
    aplicar()
    const obs = new ResizeObserver(aplicar)
    obs.observe(el)
    return () => {
      obs.disconnect()
      document.documentElement.style.setProperty('--altura-faixa', '0px')
    }
  }, [])

  useEffect(() => {
    if (!menuPessoa) return
    const fora = (e: MouseEvent | TouchEvent) => refPessoa.current && !refPessoa.current.contains(e.target as Node) && setMenuPessoa(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuPessoa(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('touchstart', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('touchstart', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [menuPessoa])

  function escolher(valor: string) {
    setMenuPessoa(false)
    if (valor === atual) return
    document.cookie = `visao_pessoa=${valor}; path=/; max-age=31536000; samesite=lax`
    iniciar(() => router.refresh())
  }

  const iniciaisDe = (valor: string, rotulo: string) =>
    valor === 'todos' ? pessoas.map((p) => p[0]).join('') : rotulo.slice(0, 1)
  const iniciais = iniciaisDe(atual, rotuloAtual)

  return (
    <div
      ref={ref}
      className={`sticky top-[var(--altura-topo,0px)] z-20 shadow-md transition-colors md:top-0 ${tema.faixa} ${pendente ? 'opacity-80' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 md:gap-3 md:px-8 md:py-2.5 lg:px-10">
        {/* Celular: a pessoa é o próprio botão de troca (sem repetir o seletor em outra linha) */}
        <div ref={refPessoa} className="relative min-w-0 md:hidden">
          <button
            type="button"
            onClick={() => setMenuPessoa((a) => !a)}
            aria-haspopup="listbox"
            aria-expanded={menuPessoa}
            aria-label={`Vendo dados de ${rotuloAtual}. Trocar`}
            className="flex min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-2.5 transition hover:bg-black/15 active:bg-black/20"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tema.avatar}`} aria-hidden="true">
              {iniciais}
            </span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">{pendente ? 'trocando…' : 'Vendo'}</span>
              <span className="block truncate text-sm font-semibold">{rotuloAtual}</span>
            </span>
            <span aria-hidden="true" className={`text-xs text-white/75 transition ${menuPessoa ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>
          {menuPessoa && (
            <div
              role="listbox"
              aria-label="Ver dados de"
              className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-neutral-200 bg-white p-1.5 text-neutral-900 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {opcoes.map((o) => {
                const t = temaDaVisao(o.valor, o.rotulo)
                const ativo = o.valor === atual
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => escolher(o.valor)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition ${
                      ativo ? 'bg-neutral-100 font-semibold dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${t.faixa}`} aria-hidden="true">
                      {iniciaisDe(o.valor, o.rotulo)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                    {ativo && (
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0 text-militar-600">
                        <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tablet/desktop: identificação completa */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tema.avatar}`} aria-hidden="true">
            {iniciais}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Você está vendo</span>
            <span className="block truncate text-base font-semibold leading-tight">
              {rotuloAtual}
              {pendente && <span className="ml-2 text-xs font-normal text-white/70">trocando…</span>}
            </span>
            <span className="block truncate text-xs text-white/75">
              {juntos
                ? `Tudo da casa: ${pessoas.join(', ')} e itens compartilhados.`
                : `Só os dados de ${rotuloAtual}. Itens da casa aparecem em ${opcoes.find((o) => o.valor === 'todos')?.rotulo ?? 'todos'}.`}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden md:inline-flex">
            <OcultarValoresToggle tom="escuro" />
          </span>
          <FiltroPeriodo valor={periodo} tom="escuro" />
          <div role="group" aria-label="Trocar visão" className="hidden shrink-0 items-center gap-1 rounded-xl bg-black/15 p-1 lg:flex">
            {opcoes.map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => escolher(o.valor)}
                aria-pressed={o.valor === atual}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${o.valor === atual ? tema.chipAtivo : tema.chip}`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
