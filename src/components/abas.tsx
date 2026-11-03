'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function Abas({
  abas,
  ocultarBarraNoDesktop = false,
}: {
  abas: { id: string; rotulo: string; conteudo: ReactNode }[]
  /** no desktop as abas já estão no menu lateral (subitens): esconde a barra duplicada */
  ocultarBarraNoDesktop?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // A aba inicial pode vir de ?aba=xxx na URL — permite linkar direto pra uma aba
  // específica (ex: indicador do dash apontando pra "Contas a pagar → Lançamentos").
  const abaDaUrl = searchParams.get('aba')
  const [ativa, setAtiva] = useState(
    abaDaUrl && abas.some((a) => a.id === abaDaUrl) ? abaDaUrl : abas[0]?.id,
  )
  // Clique num subitem do menu muda só a ?aba= (mesma página): acompanha a URL.
  useEffect(() => {
    if (abaDaUrl && abas.some((a) => a.id === abaDaUrl)) setAtiva(abaDaUrl)
  }, [abaDaUrl, abas])

  function selecionar(id: string) {
    setAtiva(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('aba', id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      {/* Fixo ao rolar (abaixo do header mobile, no topo no desktop) — com várias seções
          por aba, a barra precisa continuar visível pra trocar sem rolar de volta pro topo. */}
      <div
        className={`${ocultarBarraNoDesktop ? 'md:hidden ' : ''}sticky top-[calc(var(--altura-topo,3.5rem)+var(--altura-faixa,0px))] z-[5] -mx-1 mb-6 flex gap-1.5 overflow-x-auto border-b border-neutral-200 bg-white/95 px-1 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:top-[var(--altura-faixa,0px)]`}
      >
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => selecionar(a.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              ativa === a.id
                ? 'bg-militar-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div>{abas.find((a) => a.id === ativa)?.conteudo}</div>
    </div>
  )
}
