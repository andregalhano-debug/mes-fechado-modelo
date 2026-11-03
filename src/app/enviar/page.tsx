'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ResultadoExtracao } from '@/lib/extracao'
import type { ContaCorrespondente } from '@/lib/conta-correspondente'
import { formatarData } from '@/lib/data'
import { ConferenciaCategorias } from '@/components/conferencia-categorias'
import { BotaoVoltar } from '@/components/botao-voltar'
import { ROTULO_COMPARTILHADO } from '@/lib/donos'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Pendente = {
  id: string
  nome: string
  origem: string
  criadoEm: string
  instituicao: string | null
  valorTotal: number | null
  qtd: number
}
type Membro = { id: string; nome: string; apelido: string | null }

export default function Enviar() {
  return (
    <Suspense fallback={null}>
      <EnviarConteudo />
    </Suspense>
  )
}

function EnviarConteudo() {
  const router = useRouter()
  const params = useSearchParams()
  const documentoParam = params.get('documento')
  // Aberto a partir da aba Documentos: ao terminar (confirmar, descartar, revisar depois), volta pra lá.
  const destinoFinal = params.get('de') === 'documentos' ? '/contas-a-pagar?aba=documentos' : null
  const [estado, setEstado] = useState<'ocioso' | 'lendo' | 'revisando' | 'salvando'>(documentoParam ? 'lendo' : 'ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [documentoId, setDocumentoId] = useState<string | null>(null)
  const [extracao, setExtracao] = useState<ResultadoExtracao | null>(null)
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [dono, setDono] = useState<string>('')
  const [origemDoc, setOrigemDoc] = useState<{ nome: string; origem: string } | null>(null)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [correspondentes, setCorrespondentes] = useState<ContaCorrespondente[]>([])
  const [modo, setModo] = useState<'conta' | 'lancamentos'>('lancamentos')
  const [contaEscolhida, setContaEscolhida] = useState('')
  const [nomesCategorias, setNomesCategorias] = useState<string[]>([])

  function aplicarCorrespondentes(lista: ContaCorrespondente[] | undefined) {
    const l = lista ?? []
    setCorrespondentes(l)
    setModo(l.length > 0 ? 'conta' : 'lancamentos')
    setContaEscolhida(l[0]?.id ?? '')
  }

  const carregarPendentes = useCallback(async () => {
    try {
      const r = await fetch('/api/documentos', { cache: 'no-store' })
      if (r.ok) setPendentes((await r.json()).pendentes ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    carregarPendentes()
  }, [carregarPendentes])

  // Abre um documento já lido (ex: fatura que chegou por e-mail) direto na revisão.
  useEffect(() => {
    if (!documentoParam) return
    let cancelado = false
    ;(async () => {
      setErro(null)
      setEstado('lendo')
      try {
        const r = await fetch(`/api/documentos/${documentoParam}`, { cache: 'no-store' })
        const dados = await r.json()
        if (cancelado) return
        if (!r.ok) throw new Error(dados.erro ?? 'Não consegui abrir o documento.')
        const d = dados.documento
        if (d.status === 'confirmado') throw new Error('Este documento já foi lançado.')
        if (!d.extracao) throw new Error('Este documento ainda não foi lido pela IA.')
        setDocumentoId(d.id)
        setExtracao(d.extracao)
        setMembros(dados.membros ?? [])
        setDono(d.enviado_por ?? '')
        setOrigemDoc({ nome: d.nome_arquivo, origem: d.origem })
        aplicarCorrespondentes(dados.correspondentes)
        setNomesCategorias(dados.categorias ?? [])
        setEstado('revisando')
      } catch (e) {
        if (cancelado) return
        setErro(e instanceof Error ? e.message : 'Não consegui abrir o documento.')
        setEstado('ocioso')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [documentoParam])

  function voltarAoInicio() {
    setExtracao(null)
    setDocumentoId(null)
    setOrigemDoc(null)
    setConfirmandoDescarte(false)
    aplicarCorrespondentes([])
    setEstado('ocioso')
    if (destinoFinal) {
      router.push(destinoFinal)
      router.refresh()
      return
    }
    if (documentoParam) router.replace('/enviar')
    carregarPendentes()
  }

  async function descartar() {
    if (!documentoId) return voltarAoInicio()
    setErro(null)
    try {
      const r = await fetch(`/api/documentos/${documentoId}`, { method: 'DELETE' })
      if (!r.ok) {
        const dados = await r.json().catch(() => ({}))
        setErro(dados.erro ?? 'Não consegui descartar.')
        setConfirmandoDescarte(false)
        return
      }
    } catch {
      setErro('Não consegui conectar para descartar. Tente de novo.')
      setConfirmandoDescarte(false)
      return
    }
    voltarAoInicio()
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEstado('lendo')

    try {
      const resposta = await fetch('/api/documentos', {
        method: 'POST',
        body: new FormData(evento.currentTarget),
      })

      if (resposta.redirected || !resposta.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Sua sessão expirou. Saia e entre de novo para continuar.')
      }

      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não consegui ler o arquivo.')
        setEstado('ocioso')
        return
      }

      setDocumentoId(dados.documento_id)
      setExtracao(dados.extracao)
      setOrigemDoc(null)
      setEstado('revisando')
      fetch(`/api/documentos/${dados.documento_id}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((x) => {
          if (!x) return
          setMembros(x.membros ?? [])
          setDono(x.documento?.enviado_por ?? '')
          aplicarCorrespondentes(x.correspondentes)
          setNomesCategorias(x.categorias ?? [])
        })
        .catch(() => {})
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : ''
      setErro(
        mensagem && mensagem !== 'Failed to fetch'
          ? mensagem
          : 'Não consegui conectar para enviar o arquivo. Verifique sua internet e tente de novo.',
      )
      setEstado('ocioso')
    }
  }

  async function confirmar() {
    if (!documentoId || !extracao) return
    setEstado('salvando')
    setErro(null)

    try {
      const resposta = await fetch(`/api/documentos/${documentoId}/confirmar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          modo === 'conta'
            ? { modo: 'conta', bill_id: contaEscolhida, lancamentos: [] }
            : {
                lancamentos: extracao.lancamentos,
                forcar: correspondentes.length > 0,
                ...(membros.length > 0 ? { member_id: dono } : {}),
              },
        ),
      })

      if (resposta.redirected || !resposta.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Sua sessão expirou. Saia e entre de novo para continuar.')
      }

      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não consegui lançar.')
        setEstado('revisando')
        return
      }

      router.push(destinoFinal ?? '/')
      router.refresh()
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : ''
      setErro(
        mensagem && mensagem !== 'Failed to fetch'
          ? mensagem
          : 'Não consegui conectar para lançar. Verifique sua internet e tente de novo.',
      )
      setEstado('revisando')
    }
  }

  return (
    <main className="w-full px-5 py-8 md:px-8 lg:px-10">
      {destinoFinal && (
        <div className="mb-2">
          <BotaoVoltar reserva={destinoFinal} rotulo="Voltar para Documentos" />
        </div>
      )}
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Enviar documento
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        PDF da fatura, print do saldo ou foto da nota. A IA lê e você confere antes de lançar.
      </p>
      <p className="mb-8 mt-2 max-w-2xl text-xs text-neutral-500 dark:text-neutral-400">
        🔒 Por segurança, o sistema não se conecta ao seu banco: ele só conhece o que você envia aqui ou pelo e-mail de faturas. Ninguém vai te pedir senha de banco, código de SMS ou conexão com banco. Se pedirem, é golpe.
      </p>

      {estado === 'ocioso' && pendentes.length > 0 && (
        <section className="mb-8 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Aguardando sua confirmação ({pendentes.length})
          </h2>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            Faturas já lidas pela IA (inclusive as que chegaram por e-mail). Revise e confirme para entrarem nos lançamentos.
          </p>
          <ul className="mt-3 divide-y divide-amber-200 dark:divide-amber-900">
            {pendentes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {p.instituicao ?? p.nome}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {p.origem === 'email' ? 'chegou por e-mail' : 'enviado'} {formatarData(p.criadoEm)} · {p.qtd} lançamento{p.qtd === 1 ? '' : 's'}
                    {p.valorTotal !== null ? ` · ${brl.format(p.valorTotal)}` : ''}
                  </p>
                </div>
                <Link
                  href={`/enviar?documento=${p.id}`}
                  className="shrink-0 rounded-lg bg-militar-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-militar-500"
                >
                  Revisar e confirmar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {estado === 'ocioso' && (
        <form onSubmit={enviar} className="flex max-w-2xl flex-col gap-4">
          <input
            type="file"
            name="arquivo"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm dark:border-neutral-700"
          />
          <button
            type="submit"
            className="rounded-lg bg-militar-600 px-4 py-3 font-semibold text-white transition hover:bg-militar-500"
          >
            Ler documento
          </button>
        </form>
      )}

      {estado === 'lendo' && (
        <p className="text-neutral-600 dark:text-neutral-300">{documentoParam ? 'Abrindo a fatura…' : 'Lendo o documento…'}</p>
      )}

      {erro && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {extracao && (estado === 'revisando' || estado === 'salvando') && (
        <section className="mt-6">
          {origemDoc && (
            <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
              Revisando <strong>{origemDoc.nome}</strong>
              {origemDoc.origem === 'email' ? ' · chegou por e-mail' : ''}
            </p>
          )}
          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-neutral-900 dark:text-neutral-100">
              <strong>{extracao.tipo_documento}</strong>
              {extracao.instituicao ? ` · ${extracao.instituicao}` : ''} · confiança{' '}
              {Math.round(extracao.confianca * 100)}%
            </p>
            {extracao.observacao && (
              <p className="mt-1 text-neutral-500 dark:text-neutral-400">{extracao.observacao}</p>
            )}
            {extracao.saldo !== null && (
              <p className="mt-1 text-neutral-900 dark:text-neutral-100">
                Saldo lido: <strong>{brl.format(extracao.saldo)}</strong>
              </p>
            )}
          </div>

          {extracao.valor_total !== null && (() => {
            const somaLancamentos = extracao.lancamentos.reduce((t, l) => t + l.valor, 0)
            const diferenca = somaLancamentos - extracao.valor_total
            const bate = Math.abs(diferenca) < 0.01
            return (
              <div
                className={`mb-4 rounded-lg border p-4 text-sm ${
                  bate
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                }`}
              >
                <p className="text-neutral-900 dark:text-neutral-100">
                  Total da fatura: <strong>{brl.format(extracao.valor_total)}</strong> · soma dos lançamentos:{' '}
                  <strong>{brl.format(somaLancamentos)}</strong>
                </p>
                <p
                  className={`mt-1 font-medium ${
                    bate ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {bate
                    ? 'Os valores batem ✓'
                    : `Diferença de ${brl.format(Math.abs(diferenca))} — confira antes de lançar.`}
                </p>
              </div>
            )
          })()}

          {extracao.lancamentos.length > 0 && (
            <ConferenciaCategorias
              itens={extracao.lancamentos.map((l, i) => ({
                chave: String(i),
                data: l.data,
                descricao: l.descricao,
                valor: l.valor,
                natureza: l.natureza,
                categoria: l.categoria_sugerida,
                extra:
                  [l.parcela_total ? `${l.parcela_num}/${l.parcela_total}` : null, l.canal, l.categoria_pelo_historico ? 'categoria pelo seu histórico' : null]
                    .filter(Boolean)
                    .join(' · ') || null,
              }))}
              categorias={Array.from(
                new Set([...nomesCategorias, ...extracao.lancamentos.map((l) => l.categoria_sugerida).filter((c): c is string => !!c)]),
              ).sort((a, b) => a.localeCompare(b, 'pt-BR'))}
              onMudarCategoria={(chave, categoria) =>
                setExtracao((x) =>
                  x ? { ...x, lancamentos: x.lancamentos.map((l, i) => (String(i) === chave ? { ...l, categoria_sugerida: categoria, categoria_pelo_historico: false } : l)) } : x,
                )
              }
            />
          )}

          {correspondentes.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Esta fatura já está em Contas a pagar</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                Lançar os itens dela somaria o mesmo gasto duas vezes. O recomendado é só atualizar a conta com o valor da fatura.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex items-start gap-2">
                  <input type="radio" name="modo" checked={modo === 'conta'} onChange={() => setModo('conta')} className="mt-1" />
                  <span className="text-neutral-800 dark:text-neutral-200">
                    <strong>Atualizar a conta a pagar</strong> (recomendado)
                    {correspondentes.length === 1 ? (
                      <span className="block text-xs text-neutral-600 dark:text-neutral-400">
                        {correspondentes[0].descricao} · vence {formatarData(correspondentes[0].vencimento)} · hoje {brl.format(correspondentes[0].valor)}
                        {extracao.valor_total !== null && !correspondentes[0].pago ? ` → ${brl.format(extracao.valor_total)}` : ''}
                        {correspondentes[0].pago ? ' · já paga (só marca a fatura como conferida)' : ''}
                      </span>
                    ) : (
                      <select
                        value={contaEscolhida}
                        onChange={(e) => {
                          setContaEscolhida(e.target.value)
                          setModo('conta')
                        }}
                        className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                      >
                        {correspondentes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.descricao} · vence {formatarData(c.vencimento)} · {brl.format(c.valor)}
                            {c.pago ? ' · paga' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="modo" checked={modo === 'lancamentos'} onChange={() => setModo('lancamentos')} className="mt-1" />
                  <span className="text-neutral-800 dark:text-neutral-200">
                    Lançar os {extracao.lancamentos.length} itens mesmo assim
                    <span className="block text-xs text-red-700 dark:text-red-400">pode duplicar o gasto do mês</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {membros.length > 0 && modo === 'lancamentos' && (
            <label className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">Fatura de</span>
              <select
                value={dono}
                onChange={(e) => setDono(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
              >
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apelido || m.nome.split(' ')[0]}
                  </option>
                ))}
                <option value="">{ROTULO_COMPARTILHADO}</option>
              </select>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">vale para todos os lançamentos desta fatura</span>
            </label>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={confirmar}
              disabled={estado === 'salvando'}
              className="rounded-lg bg-militar-600 px-4 py-3 font-semibold text-white transition hover:bg-militar-500 disabled:opacity-60"
            >
              {estado === 'salvando'
                ? 'Salvando…'
                : modo === 'conta'
                  ? 'Atualizar conta a pagar'
                  : `Confirmar ${extracao.lancamentos.length} lançamento${extracao.lancamentos.length === 1 ? '' : 's'}`}
            </button>
            {confirmandoDescarte ? (
              <>
                <button
                  onClick={descartar}
                  className="rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500"
                >
                  Sim, descartar esta fatura
                </button>
                <button
                  onClick={() => setConfirmandoDescarte(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={voltarAoInicio}
                  className="rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                >
                  Revisar depois
                </button>
                <button
                  onClick={() => setConfirmandoDescarte(true)}
                  className="rounded-lg px-4 py-3 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Descartar
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
