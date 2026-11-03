'use client'

import Link from 'next/link'
import { formatarData } from '@/lib/data'
import { ListaRecolhivel } from '@/components/lista-recolhivel'

export type DocumentoResumo = {
  id: string
  titulo: string
  tipo: string | null
  status: string
  origem: string
  criadoEm: string
  vencimento: string | null
  valorTotal: number | null
  erro: string | null
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MASCARA = '• • • •'
const TIPO: Record<string, string> = { fatura: 'Fatura', extrato: 'Extrato', saldo: 'Saldo', nota: 'Nota', desconhecido: 'Documento' }

function situacao(status: string) {
  if (status === 'confirmado') return { texto: 'Lançada', classe: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  if (status === 'aguardando_confirmacao') return { texto: 'Aguardando', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' }
  if (status === 'erro') return { texto: 'Com erro', classe: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  return { texto: 'Lendo…', classe: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' }
}

// Próxima ação de cada documento, direto do resumo: revisar o que está pendente, conferir o que
// já foi lançado, resolver o que deu erro.
function acao(d: DocumentoResumo) {
  if (d.status === 'aguardando_confirmacao') return { href: `/enviar?documento=${d.id}`, texto: 'Revisar e confirmar', principal: true }
  if (d.status === 'confirmado') return { href: `/documentos/${d.id}`, texto: 'Conferir', principal: false }
  if (d.status === 'erro') return { href: '/contas-a-pagar?aba=documentos', texto: 'Resolver', principal: true }
  return null
}

export function ResumoDocumentos({ documentos, oculto }: { documentos: DocumentoResumo[]; oculto: boolean }) {
  const pendentes = documentos.filter((d) => d.status === 'aguardando_confirmacao' || d.status === 'erro').length
  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Últimas faturas e documentos</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {pendentes > 0
              ? `${pendentes} precisa${pendentes === 1 ? '' : 'm'} da sua atenção`
              : 'Tudo lançado. Toque em uma fatura para conferir as categorias.'}
          </p>
        </div>
        <Link href="/contas-a-pagar?aba=documentos" className="text-xs font-medium text-militar-700 hover:underline dark:text-militar-500">
          ver todos em Documentos →
        </Link>
      </div>

      {documentos.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum documento enviado ainda.</p>
      ) : (
        <ListaRecolhivel rotulo="documentos">
          {documentos.map((d) => {
            const s = situacao(d.status)
            const a = acao(d)
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{d.titulo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.classe}`}>{s.texto}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {TIPO[d.tipo ?? ''] ?? 'Documento'}
                    {d.vencimento ? ` · vence ${formatarData(d.vencimento)}` : ''}
                    {` · ${d.origem === 'email' ? 'chegou por e-mail' : 'enviado'} ${formatarData(d.criadoEm)}`}
                  </p>
                  {d.status === 'erro' && d.erro && <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">{d.erro}</p>}
                </div>
                <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  {d.valorTotal !== null && (
                    <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {oculto ? MASCARA : brl.format(d.valorTotal)}
                    </span>
                  )}
                  {a && (
                    <Link
                      href={a.href}
                      className={
                        a.principal
                          ? 'rounded-lg bg-militar-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-militar-500 sm:py-1.5'
                          : 'rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:py-1.5 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                      }
                    >
                      {a.texto}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </ListaRecolhivel>
      )}
    </section>
  )
}
