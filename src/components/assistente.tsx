'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { abrirConversa, apagarConversa, listarConversas, salvarConversa, type Msg, type ResumoConversa } from './assistente-actions'

const SUGESTOES = [
  'Onde gastamos mais no mês passado?',
  'O que vence nos próximos 7 dias?',
  'Como está o patrimônio vs mês anterior?',
  'Tem alguma cobrança estranha na última fatura?',
]

const NOMES_FERRAMENTA: Record<string, string> = {
  resumo_meses: 'Comparando os últimos meses…',
  gastos_do_mes: 'Somando gastos por categoria…',
  buscar_lancamentos: 'Procurando lançamentos…',
  contas_a_pagar: 'Conferindo contas a pagar…',
  patrimonio: 'Lendo o patrimônio…',
  parcelas_em_aberto: 'Calculando parcelas…',
  alertas_de_cobranca: 'Procurando cobranças estranhas…',
}

// Assistente: botão discreto no canto que abre um painel lateral. Não ocupa espaço nas
// páginas enquanto fechado. Cada conversa fica salva no histórico (só de quem perguntou),
// pra voltar a um tópico depois; o histórico tem busca pelas perguntas.
export function Assistente({ visao }: { visao: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [verHistorico, setVerHistorico] = useState(false)
  const [conversas, setConversas] = useState<ResumoConversa[] | null>(null)
  const [busca, setBusca] = useState('')
  const [apagando, setApagando] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, status])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto])

  // carrega o histórico ao abrir o painel (e ao entrar na lista)
  useEffect(() => {
    if (!aberto) return
    listarConversas()
      .then(setConversas)
      .catch(() => setConversas([]))
  }, [aberto, verHistorico])

  if (pathname.startsWith('/entrar') || pathname.startsWith('/auth')) return null

  function novaConversa() {
    setMsgs([])
    setConversaId(null)
    setVerHistorico(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function retomar(id: string) {
    const m = await abrirConversa(id).catch(() => null)
    if (!m) return
    setMsgs(m)
    setConversaId(id)
    setVerHistorico(false)
  }

  async function apagar(id: string) {
    await apagarConversa(id).catch(() => {})
    setConversas((cs) => (cs ?? []).filter((c) => c.id !== id))
    setApagando(null)
    if (id === conversaId) novaConversa()
  }

  async function perguntar(pergunta: string) {
    const p = pergunta.trim()
    if (!p || carregando) return
    const historico: Msg[] = [...msgs, { role: 'user', content: p }]
    setMsgs([...historico, { role: 'assistant', content: '' }])
    setTexto('')
    setCarregando(true)
    setStatus('Pensando…')
    setVerHistorico(false)
    let final: Msg[] = historico
    try {
      const r = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: historico }),
      })
      if (!r.ok || !r.body) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.erro || 'Não consegui responder agora.')
      }
      const leitor = r.body.getReader()
      const dec = new TextDecoder()
      let resto = ''
      let resposta = ''
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        resto += dec.decode(value, { stream: true })
        const linhas = resto.split('\n')
        resto = linhas.pop() ?? ''
        for (const l of linhas) {
          if (!l.trim()) continue
          const ev = JSON.parse(l) as { t: string; v?: string }
          if (ev.t === 'ferramenta') {
            setStatus(NOMES_FERRAMENTA[ev.v ?? ''] ?? 'Consultando os dados…')
            if (resposta && !resposta.endsWith('\n')) resposta += '\n\n'
          } else if (ev.t === 'texto') {
            setStatus(null)
            resposta += ev.v ?? ''
            final = [...historico, { role: 'assistant', content: resposta }]
            setMsgs(final)
          } else if (ev.t === 'erro') {
            throw new Error(ev.v)
          }
        }
      }
      if (!resposta.trim()) {
        final = [...historico, { role: 'assistant', content: 'Não encontrei uma resposta. Tente perguntar de outro jeito.' }]
        setMsgs(final)
      }
    } catch (e) {
      final = [...historico, { role: 'assistant', content: `⚠️ ${(e as Error).message}` }]
      setMsgs(final)
    } finally {
      setCarregando(false)
      setStatus(null)
    }
    // guarda no histórico (cria na 1ª pergunta, atualiza nas seguintes)
    const id = await salvarConversa(conversaId, final).catch(() => null)
    if (id) setConversaId(id)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label="Abrir assistente"
        className={`fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-militar-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-militar-500 active:scale-95 md:bottom-6 md:right-6 ${
          aberto ? 'pointer-events-none opacity-0' : ''
        }`}
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
          <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z" strokeLinejoin="round" />
        </svg>
        Perguntar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20 md:bg-transparent" onClick={() => setAberto(false)}>
          <aside
            role="dialog"
            aria-label="Assistente financeiro"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full flex-col border-l border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 md:max-w-md"
          >
            <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Assistente financeiro</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Vendo: {visao} · só consulta, não altera nada
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setVerHistorico((v) => !v)}
                  aria-pressed={verHistorico}
                  title="Conversas anteriores"
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                    verHistorico ? 'bg-militar-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
                    <path d="M3 12a9 9 0 103-6.7M3 4v4h4M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Histórico
                </button>
                {(msgs.length > 0 || verHistorico) && (
                  <button
                    type="button"
                    onClick={novaConversa}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    + Nova
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {verHistorico ? (
                <Historico
                  conversas={conversas}
                  busca={busca}
                  setBusca={setBusca}
                  atual={conversaId}
                  apagando={apagando}
                  setApagando={setApagando}
                  onAbrir={retomar}
                  onApagar={apagar}
                />
              ) : msgs.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Pergunte sobre gastos, contas, parcelas ou patrimônio. As respostas usam só os dados do sistema.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => perguntar(s)}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 transition hover:border-militar-400 hover:bg-militar-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {conversas && conversas.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Conversas recentes</p>
                        <button type="button" onClick={() => setVerHistorico(true)} className="text-xs font-medium text-militar-700 hover:underline dark:text-militar-400">
                          Ver todas ({conversas.length})
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {conversas.slice(0, 3).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => retomar(c.id)}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                          >
                            <span className="min-w-0 truncate">{c.titulo}</span>
                            <span className="shrink-0 text-[11px] text-neutral-400">{quando(c.atualizadoEm)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {msgs.map((m, i) =>
                    m.role === 'user' ? (
                      <p key={i} className="ml-8 self-end rounded-2xl rounded-br-sm bg-militar-600 px-3 py-2 text-sm text-white">
                        {m.content}
                      </p>
                    ) : m.content ? (
                      <div
                        key={i}
                        className="mr-6 whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-sm leading-relaxed text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                      >
                        {m.content.replace(/\*\*(.+?)\*\*/g, '$1')}
                      </div>
                    ) : null,
                  )}
                  {status && (
                    <p className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-militar-600 border-t-transparent" />
                      {status}
                    </p>
                  )}
                  <div ref={fimRef} />
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                perguntar(texto)
              }}
              className="flex items-end gap-2 border-t border-neutral-200 px-3 py-3 dark:border-neutral-800"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <textarea
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    perguntar(texto)
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Ex: quanto gastamos com restaurante em setembro?"
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
              <button
                type="submit"
                disabled={carregando || !texto.trim()}
                className="rounded-xl bg-militar-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-militar-500 disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  )
}

function quando(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const dias = Math.floor((new Date(hoje.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  if (dias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dias === 1) return 'ontem'
  if (dias < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function grupoDe(iso: string) {
  const d = new Date(iso)
  const dias = Math.floor((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 7) return 'Últimos 7 dias'
  if (dias < 30) return 'Últimos 30 dias'
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const sem = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Lista das conversas anteriores, agrupada por data, com busca no título e em todas as perguntas.
function Historico({
  conversas,
  busca,
  setBusca,
  atual,
  apagando,
  setApagando,
  onAbrir,
  onApagar,
}: {
  conversas: ResumoConversa[] | null
  busca: string
  setBusca: (v: string) => void
  atual: string | null
  apagando: string | null
  setApagando: (v: string | null) => void
  onAbrir: (id: string) => void
  onApagar: (id: string) => void
}) {
  if (conversas === null) return <p className="text-sm text-neutral-500">Carregando o histórico…</p>
  const termo = sem(busca.trim())
  const filtradas = conversas
    .map((c) => {
      if (!termo) return { c, achou: null as string | null }
      if (sem(c.titulo).includes(termo)) return { c, achou: null }
      const p = c.perguntas.find((q) => sem(q).includes(termo))
      return p ? { c, achou: p } : null
    })
    .filter((x): x is { c: ResumoConversa; achou: string | null } => x !== null)
  const grupos: { nome: string; itens: typeof filtradas }[] = []
  for (const x of filtradas) {
    const g = grupoDe(x.c.atualizadoEm)
    const ult = grupos[grupos.length - 1]
    if (ult && ult.nome === g) ult.itens.push(x)
    else grupos.push({ nome: g, itens: [x] })
  }
  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar nas perguntas…"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
      />
      {conversas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma conversa ainda. As próximas perguntas ficam guardadas aqui.</p>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nada encontrado para “{busca}”.</p>
      ) : (
        grupos.map((g) => (
          <div key={g.nome}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 first-letter:uppercase dark:text-neutral-400">{g.nome}</p>
            <ul className="flex flex-col gap-1">
              {g.itens.map(({ c, achou }) => (
                <li
                  key={c.id}
                  className={`group flex items-start gap-1 rounded-xl border transition ${
                    c.id === atual ? 'border-militar-400 bg-militar-50/60 dark:border-militar-700 dark:bg-militar-950/30' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <button type="button" onClick={() => onAbrir(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                    <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.titulo}</span>
                    <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      {achou ? `… ${achou}` : c.perguntas.length > 1 ? `+${c.perguntas.length - 1} ${c.perguntas.length === 2 ? 'pergunta' : 'perguntas'} · ${c.perguntas[c.perguntas.length - 1]}` : '1 pergunta'}
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1 py-2 pr-2">
                    <span className="text-[11px] text-neutral-400">{quando(c.atualizadoEm)}</span>
                    {apagando === c.id ? (
                      <>
                        <button type="button" onClick={() => onApagar(c.id)} className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          Apagar
                        </button>
                        <button type="button" onClick={() => setApagando(null)} className="rounded-md px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                          Não
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setApagando(c.id)}
                        aria-label={`Apagar conversa ${c.titulo}`}
                        className="rounded-md p-1 text-neutral-400 opacity-100 transition hover:bg-neutral-200 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-neutral-800"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
