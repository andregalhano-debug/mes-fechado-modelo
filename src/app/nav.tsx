'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { MARCA } from '@/lib/marca'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSignOut } from '@/lib/supabase/useSignOut'
import { ThemeToggle } from './theme-toggle'
import { OcultarValoresToggle } from '@/components/ocultar-valores-toggle'
import { SeletorPessoa } from '@/components/seletor-pessoa'
import { IconeMenu as IconeItem } from './nav-icones'
import { Logo, Simbolo } from '@/components/logo'
import { temaDaVisao, type TemaPessoa } from '@/lib/tema-pessoa'

const CHAVE_RECOLHIDO = 'financas:menu-recolhido'

type Item = { href: string; rotulo: string; subitens?: { aba: string; rotulo: string }[] }

const TODOS_ITENS: Item[] = [
  { href: '/', rotulo: 'Visão geral' },
  {
    href: '/contas-a-pagar',
    rotulo: 'Contas a pagar',
    // As abas da tela viram subitens do menu (link com ?aba=).
    subitens: [
      { aba: 'contas', rotulo: 'Contas' },
      { aba: 'cartoes', rotulo: 'Cartões' },
      { aba: 'assinaturas', rotulo: 'Assinaturas' },
      { aba: 'historico', rotulo: 'Histórico' },
      { aba: 'parcelas', rotulo: 'Parcelas' },
      { aba: 'lancamentos', rotulo: 'Lançamentos' },
      { aba: 'documentos', rotulo: 'Documentos' },
      { aba: 'busca', rotulo: 'Busca' },
    ],
  },
  { href: '/patrimonio', rotulo: 'Patrimônio' },
  { href: '/configuracoes', rotulo: 'Configurações' },
]

const ITENS: Item[] = TODOS_ITENS

export function Nav({
  opcoesPessoa = [],
  pessoaAtual = 'todos',
}: {
  opcoesPessoa?: { valor: string; rotulo: string }[]
  pessoaAtual?: string
}) {
  const pathname = usePathname()
  const sair = useSignOut()
  const [menuAberto, setMenuAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(false)
  const tema = temaDaVisao(pessoaAtual, opcoesPessoa.find((o) => o.valor === pessoaAtual)?.rotulo)
  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === '1')
    } catch {}
  }, [])
  function alternarRecolhido() {
    setRecolhido((r) => {
      try {
        localStorage.setItem(CHAVE_RECOLHIDO, r ? '0' : '1')
      } catch {}
      return !r
    })
  }
  const cabecalho = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  // Esc fecha o menu. Com ele aberto a página de trás fica congelada no ponto em que estava
  // (position: fixed — overflow: hidden não segura o iPhone e fazia a tela pular pro topo).
  // Fechar sem navegar devolve à mesma altura; tocar num link deixa a nova tela no topo.
  const saiuPorLink = useRef(false)
  useEffect(() => {
    if (!menuAberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false)
    document.addEventListener('keydown', aoTeclar)
    const y = window.scrollY
    const b = document.body.style
    const antes = { position: b.position, top: b.top, left: b.left, right: b.right, overflow: b.overflow }
    b.position = 'fixed'
    b.top = `-${y}px`
    b.left = '0'
    b.right = '0'
    b.overflow = 'hidden'
    saiuPorLink.current = false
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      Object.assign(b, antes)
      window.scrollTo(0, saiuPorLink.current ? 0 : y)
    }
  }, [menuAberto])

  // Altura real do cabeçalho do celular (logo + ações; a pessoa fica na faixa colorida logo abaixo) numa variável CSS: as barras
  // fixas das telas (abas, resumo do Patrimônio) grudam logo abaixo dele, sem ficar escondidas.
  useEffect(() => {
    const el = cabecalho.current
    if (!el) return
    const aplicar = () => document.documentElement.style.setProperty('--altura-topo', `${el.offsetHeight}px`)
    aplicar()
    const obs = new ResizeObserver(aplicar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (pathname.startsWith('/entrar')) return null


  return (
    <>
      {/* Mobile/tablet: header fixo no topo com menu em ícone */}
      {menuAberto && (
        // Menu do celular: tela própria, fixa sobre a página — sempre aparece onde você está.
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[2px]" />
          <div className="menu-escuro relative flex h-full w-[86%] max-w-sm flex-col shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" aria-label={`${MARCA.nome} — início`} onClick={() => { saiuPorLink.current = true; setMenuAberto(false) }}>
                <Logo />
              </Link>
              <button
                type="button"
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-2.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                <IconeMenu aberto />
              </button>
            </div>
            {opcoesPessoa.length > 1 && (
              <div className="px-1 pb-2">
                <SeletorPessoa opcoes={opcoesPessoa} atual={pessoaAtual} />
              </div>
            )}
            <nav
              // qualquer link fecha o menu e a tela nova abre no topo
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) {
                  saiuPorLink.current = true
                  setMenuAberto(false)
                }
              }}
              className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain border-t border-neutral-200 px-3 pb-4 pt-3"
            >
              <ItensNav pathname={pathname} tema={tema} />
            </nav>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button
                onClick={sair}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                Sair
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-neutral-200 border-t-2 border-t-[#a8864f] bg-white/95 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:hidden">
        <div ref={cabecalho}>
        <div className="flex items-center justify-between py-1 pl-4 pr-2">
          <Link href="/" aria-label={`${MARCA.nome} — início`} className="py-1.5">
            <Logo />
          </Link>
          <div className="flex items-center gap-0.5">
            <OcultarValoresToggle />
            <ThemeToggle />
            <button
              onClick={() => setMenuAberto((a) => !a)}
              aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuAberto}
              className="rounded-lg p-2.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <IconeMenu aberto={menuAberto} />
            </button>
          </div>
        </div>
        </div>

      </header>

      {/* Desktop: sidebar fixa à esquerda — recolhível (só ícones) pra ampliar a tela */}
      <aside
        className={`menu-escuro hidden shrink-0 border-r border-neutral-200 shadow-sm transition-[width] dark:border-neutral-800 md:sticky md:top-0 md:flex md:h-screen md:flex-col ${
          recolhido ? 'md:w-16' : 'md:w-56'
        }`}
      >
        <div className={`flex items-center pt-5 pb-3 ${recolhido ? 'flex-col gap-2 px-2' : 'justify-between gap-2 px-5'}`}>
          {recolhido ? (
            <Link href="/" aria-label={`${MARCA.nome} — início`} title={MARCA.nome}>
              <Simbolo className="h-9 w-9" />
            </Link>
          ) : (
            <Link href="/" aria-label={`${MARCA.nome} — início`}>
              <Logo />
            </Link>
          )}
          <div className={`flex items-center ${recolhido ? 'flex-col gap-1' : 'gap-0.5'}`}>
            <button
              type="button"
              onClick={alternarRecolhido}
              aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
              title={recolhido ? 'Expandir menu' : 'Recolher menu (só ícones)'}
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d={recolhido ? 'M9 6l6 6-6 6M4 4v16' : 'M15 6l-6 6 6 6M20 4v16'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        {!recolhido && <SeletorPessoa opcoes={opcoesPessoa} atual={pessoaAtual} />}
        {recolhido ? (
          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pt-2">
            {ITENS.map((item) => {
              const ativo = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.rotulo}
                  aria-label={item.rotulo}
                  aria-current={ativo ? 'page' : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                    ativo
                      ? tema.itemAtivo
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                  }`}
                >
                  <IconeItem chave={item.href} />
                </Link>
              )
            })}
            <div className="my-2 w-8 border-t border-neutral-200 dark:border-neutral-800" />
            <button
              onClick={sair}
              title="Sair"
              aria-label="Sair"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <IconeItem chave="sair" />
            </button>
          </nav>
        ) : (
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
            <ItensNav pathname={pathname} tema={tema} />
            <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />
            <button
              onClick={sair}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              Sair
            </button>
          </nav>
        )}
        <div className="flex items-center justify-center border-t border-neutral-200 px-2 py-3 dark:border-neutral-800">
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}

function ItensNav({ pathname, tema }: { pathname: string; tema: TemaPessoa }) {
  // Seção com subitens: a seta abre/fecha a lista sem sair da tela atual (no celular, tocar no
  // nome navegava e fechava o menu antes de mostrar as opções). Dentro da seção, já vem aberta.
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  useEffect(() => {
    setAbertos(new Set())
  }, [pathname])
  return (
    <>
      {ITENS.map((item) => {
        const naSecao = pathname === item.href
        const aberto = !!item.subitens && (naSecao || abertos.has(item.href))
        return (
          <div key={item.href} className="flex flex-col gap-0.5">
            {item.subitens ? (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ItemNav item={item} ativo={naSecao} bloco tema={tema} />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAbertos((a) => {
                      const n = new Set(a)
                      if (aberto) n.delete(item.href)
                      else n.add(item.href)
                      return n
                    })
                  }
                  aria-expanded={aberto}
                  aria-label={`${aberto ? 'Recolher' : 'Mostrar'} opções de ${item.rotulo}`}
                  disabled={naSecao}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-900"
                >
                  <span className={`transition ${aberto ? 'rotate-90' : ''}`}>▸</span>
                </button>
              </div>
            ) : (
              <ItemNav item={item} ativo={naSecao} bloco tema={tema} />
            )}
            {aberto && (
              <Suspense fallback={<SubItens item={item} abaAtiva={null} tema={tema} />}>
                <SubItensComUrl item={item} pathname={pathname} tema={tema} />
              </Suspense>
            )}
          </div>
        )
      })}
    </>
  )
}

function SubItensComUrl({ item, pathname, tema }: { item: Item; pathname: string; tema: TemaPessoa }) {
  const params = useSearchParams()
  const naPagina = pathname === item.href
  const abaAtiva = naPagina ? (params.get('aba') ?? item.subitens?.[0]?.aba ?? null) : null
  return <SubItens item={item} abaAtiva={abaAtiva} tema={tema} />
}

function SubItens({ item, abaAtiva, tema }: { item: Item; abaAtiva: string | null; tema: TemaPessoa }) {
  return (
    <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-neutral-200 pl-2 dark:border-neutral-800">
      {item.subitens!.map((s) => {
        const ativo = abaAtiva === s.aba
        return (
          <Link
            key={s.aba}
            href={`${item.href}?aba=${s.aba}`}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded-md px-2.5 py-2 text-[13px] transition md:py-1.5 ${
              ativo
                ? tema.subAtivo
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {s.rotulo}
          </Link>
        )
      })}
    </div>
  )
}

function ItemNav({
  item,
  ativo,
  bloco = false,
  tema,
}: {
  item: { href: string; rotulo: string }
  ativo: boolean
  bloco?: boolean
  tema?: TemaPessoa
}) {
  return (
    <Link
      href={item.href}
      className={`rounded-lg px-3 py-2.5 text-sm transition ${bloco ? '' : 'shrink-0'} ${
        ativo
          ? (tema?.itemAtivo ?? 'bg-militar-100 font-semibold text-militar-900 dark:bg-militar-950/60 dark:text-militar-400')
          : 'font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900'
      }`}
    >
      {item.rotulo}
    </Link>
  )
}

function IconeMenu({ aberto }: { aberto: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {aberto ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
