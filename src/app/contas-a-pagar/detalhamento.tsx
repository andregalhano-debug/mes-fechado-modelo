'use client'

import { BlocoAdicionar } from '@/components/bloco-adicionar'
import { useMemo, useState, useTransition } from 'react'
import { formatarData } from '@/lib/data'
import Link from 'next/link'
import { ListaRecolhivel } from '@/components/lista-recolhivel'
import { AcoesDocumentoErro } from './acoes-documento-erro'
import { FormularioComRascunho } from '@/components/formulario-com-rascunho'
import { FormularioComConfirmacao } from '@/components/formulario-com-confirmacao'
import { CampoMoeda } from '@/components/campo-moeda'
import { criarLancamento, removerLancamento, atualizarCategoriaLancamento, definirDonoDocumento, editarLancamento } from './actions'
import { ROTULO_COMPARTILHADO, ROTULO_JUNTOS } from '@/lib/donos'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const botao =
  'rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500'

export type LancamentoDetalhe = {
  id: string
  descricao: string
  valor: number
  data: string
  natureza: 'despesa' | 'receita'
  categoria: string | null
  categoriaId: string | null
  conta: string | null
  empresa: string | null
  // Banco de origem, lido do documento (fatura) de onde o lançamento veio — null quando foi
  // lançado à mão, sem documento.
  banco: string | null
  /** dono do lançamento (null = família) */
  donoId: string | null
  /** veio de uma fatura/documento (false = lançado à mão) */
  deDocumento: boolean
  contaId: string | null
}

export type DocumentoDetalhe = {
  id: string
  nomeArquivo: string
  origem: string
  status: string
  tipoDetectado: string | null
  confianca: number | null
  erro: string | null
  criadoEm: string
  enviadoPor: string | null
  instituicao: string | null
  valorTotal: number | null
  // Vencimento extraído pela IA quando existe, senão a data de envio — usado pro rótulo de
  // mês/ano e pro filtro de período.
  dataReferencia: string
  /** Dono dos lançamentos desta fatura (null = família / ainda sem dono) */
  donoId?: string | null
  temLancamentos?: boolean
}

type Categoria = { id: string; nome: string; natureza: 'despesa' | 'receita' }
type Conta = { id: string; nome: string }

const PERIODOS = [
  { id: 'mes', rotulo: 'Este mês' },
  { id: '3meses', rotulo: 'Últimos 3 meses' },
  { id: '12meses', rotulo: 'Últimos 12 meses' },
] as const

const PERIODOS_DOC = [
  { id: 'todos', rotulo: 'Todos os períodos' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: '3meses', rotulo: 'Últimos 3 meses' },
  { id: '12meses', rotulo: 'Últimos 12 meses' },
] as const

const ROTULO_TIPO_DOC: Record<string, string> = {
  fatura: 'Fatura',
  extrato: 'Extrato',
  saldo: 'Saldo',
  nota: 'Nota',
  desconhecido: 'Desconhecido',
}

const ROTULO_ORIGEM_DOC: Record<string, string> = {
  app: 'App',
  telegram: 'Telegram',
  email: 'E-mail',
}

function badgeStatus(status: string) {
  switch (status) {
    case 'aguardando_confirmacao':
      return { texto: 'Aguardando confirmação', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' }
    case 'confirmado':
      return { texto: 'Confirmado', classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' }
    case 'erro':
      return { texto: 'Erro', classe: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' }
    case 'processando':
      return { texto: 'Processando', classe: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' }
    default:
      return { texto: status, classe: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' }
  }
}

function dentroDoPeriodo(dataIso: string, periodo: string): boolean {
  if (periodo === 'todos') return true
  const hoje = new Date()
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)
  const meses = periodo === 'mes' ? 0 : periodo === '3meses' ? 2 : 11
  const limite = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1)
  return data >= limite
}

function mesAnoDe(dataIso: string): string {
  const [ano, mes] = dataIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function AbaLancamentos({
  lancamentos,
  categorias,
  contas,
  hoje,
  membros,
  pessoaInicial,
}: {
  lancamentos: LancamentoDetalhe[]
  categorias: Categoria[]
  contas: Conta[]
  hoje: string
  membros: { id: string; nome: string; apelido: string | null }[]
  /** visão escolhida no menu ('todos' ou id do membro) — ponto de partida do filtro */
  pessoaInicial: string
}) {
  const [pessoa, setPessoa] = useState(pessoaInicial)
  const [naturezaNova, setNaturezaNova] = useState<'despesa' | 'receita'>('despesa')
  const [categoria, setCategoria] = useState('todas')
  const [empresa, setEmpresa] = useState('todas')
  const [bancoLancamento, setBancoLancamento] = useState('todos')
  const [tipoLancamento, setTipoLancamento] = useState<'todos' | 'despesa' | 'receita'>('todos')
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['id']>('3meses')

  const empresas = useMemo(
    () => Array.from(new Set(lancamentos.map((l) => l.empresa).filter((e): e is string => !!e))).sort(),
    [lancamentos],
  )

  const bancosLancamento = useMemo(
    () => Array.from(new Set(lancamentos.map((l) => l.banco).filter((b): b is string => !!b))).sort(),
    [lancamentos],
  )

  const filtrados = useMemo(
    () =>
      lancamentos.filter((l) => {
        if (pessoa !== 'todos' && l.donoId !== pessoa) return false
        if (categoria !== 'todas' && l.categoria !== categoria) return false
        if (empresa !== 'todas' && l.empresa !== empresa) return false
        if (bancoLancamento !== 'todos' && l.banco !== bancoLancamento) return false
        if (tipoLancamento !== 'todos' && l.natureza !== tipoLancamento) return false
        if (!dentroDoPeriodo(l.data, periodo)) return false
        return true
      }),
    [lancamentos, pessoa, categoria, empresa, bancoLancamento, periodo, tipoLancamento],
  )

  return (
    <>
      {membros.length > 1 && (
        <div role="group" aria-label="Lançamentos de" className="mb-3 inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {[{ valor: 'todos', rotulo: ROTULO_JUNTOS }, ...membros.map((m) => ({ valor: m.id, rotulo: m.apelido || m.nome.split(' ')[0] }))].map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setPessoa(o.valor)}
              aria-pressed={pessoa === o.valor}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                pessoa === o.valor
                  ? 'bg-militar-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={tipoLancamento} onChange={(e) => setTipoLancamento(e.target.value as 'todos' | 'despesa' | 'receita')} className={campo} aria-label="Tipo de lançamento">
          <option value="todos">Despesas e receitas</option>
          <option value="despesa">Só despesas</option>
          <option value="receita">Só receitas</option>
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
          <option value="todas">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.natureza === 'receita' ? '↑ ' : '↓ '}
              {c.nome}
            </option>
          ))}
        </select>
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={campo}>
          <option value="todas">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {bancosLancamento.length > 0 && (
          <select value={bancoLancamento} onChange={(e) => setBancoLancamento(e.target.value)} className={campo}>
            <option value="todos">Todos os bancos</option>
            {bancosLancamento.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} className={campo}>
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>

      <BlocoAdicionar titulo="+ Novo lançamento" descricao="Despesa ou receita lançada à mão — salário, PIX, dinheiro, reembolso…">
        <FormularioComRascunho
          chave="rascunho:lancamento"
          action={criarLancamento}
          className="flex flex-col gap-3"
        >
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input type="radio" name="natureza" value="despesa" checked={naturezaNova === 'despesa'} onChange={() => setNaturezaNova('despesa')} /> Despesa
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input type="radio" name="natureza" value="receita" checked={naturezaNova === 'receita'} onChange={() => setNaturezaNova('receita')} /> Receita
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
            <input name="descricao" required placeholder="ex: Mercado, salário" className={campo} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
              <CampoMoeda name="valor" required placeholder="0" className={`${campo} w-32 text-right tabular-nums`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Data</span>
              <input type="date" name="data" required defaultValue={hoje} className={campo} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Categoria</span>
              <select key={naturezaNova} name="category_id" className={campo}>
                <option value="">Sem categoria</option>
                {categorias
                  .filter((c) => c.natureza === naturezaNova)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </label>
            {membros.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">De quem</span>
                <select key={pessoa} name="member_id" defaultValue={pessoa === 'todos' ? '' : pessoa} className={campo}>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.apelido || m.nome.split(' ')[0]}
                    </option>
                  ))}
                  <option value="">{ROTULO_COMPARTILHADO}</option>
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Conta</span>
              <select name="account_id" className={campo}>
                <option value="">Sem conta</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className={`${botao} mt-1 self-start`}>
            Lançar
          </button>
        </FormularioComRascunho>
      </BlocoAdicionar>

      {/* Lançamentos já registrados, separados pela origem: à mão x vindos de faturas/documentos */}
      <ListaLancamentos
        titulo="Lançados à mão"
        descricao="Receitas e gastos que você registrou pelo formulário acima."
        itens={filtrados.filter((l) => !l.deDocumento)}
        categorias={categorias}
        vazio="Nenhum lançamento à mão com esses filtros."
        membros={membros}
        contas={contas}
      />
      <ListaLancamentos
        titulo="Vindos de faturas e documentos"
        descricao="Itens das faturas confirmadas. Para conferir uma fatura inteira, use a aba Documentos."
        itens={filtrados.filter((l) => l.deDocumento)}
        categorias={categorias}
        vazio="Nenhum lançamento de fatura com esses filtros."
        membros={membros}
        contas={contas}
      />
    </>
  )
}

export function AbaDocumentos({
  documentos,
  membros = [],
}: {
  documentos: DocumentoDetalhe[]
  membros?: { id: string; nome: string }[]
}) {
  const [banco, setBanco] = useState('todos')
  const [periodoDoc, setPeriodoDoc] = useState<(typeof PERIODOS_DOC)[number]['id']>('todos')

  const bancos = useMemo(
    () => Array.from(new Set(documentos.map((d) => d.instituicao).filter((b): b is string => !!b))).sort(),
    [documentos],
  )

  const documentosFiltrados = useMemo(
    () =>
      documentos.filter((d) => {
        if (banco !== 'todos' && d.instituicao !== banco) return false
        if (!dentroDoPeriodo(d.dataReferencia, periodoDoc)) return false
        return true
      }),
    [documentos, banco, periodoDoc],
  )

  const totalDocumentosFiltrados = documentosFiltrados.reduce((t, d) => t + (d.valorTotal ?? 0), 0)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Documentos no filtro</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{documentosFiltrados.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Total das faturas</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {brl.format(totalDocumentosFiltrados)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Aguardando confirmação</p>
          <p className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400">
            {documentosFiltrados.filter((d) => d.status === 'aguardando_confirmacao').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Com erro</p>
          <p className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">
            {documentosFiltrados.filter((d) => d.status === 'erro').length}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={banco} onChange={(e) => setBanco(e.target.value)} className={campo}>
          <option value="todos">Todos os bancos</option>
          {bancos.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={periodoDoc} onChange={(e) => setPeriodoDoc(e.target.value as typeof periodoDoc)} className={campo}>
          {PERIODOS_DOC.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>

      {documentosFiltrados.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {documentos.length === 0 ? 'Nenhum documento enviado ainda.' : 'Nada encontrado com esses filtros.'}
        </p>
      ) : (
        <ListaRecolhivel rotulo="documentos">
          {documentosFiltrados.map((d) => {
            const situacao = badgeStatus(d.status)
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{d.nomeArquivo}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {mesAnoDe(d.dataReferencia)}
                    </span>
                    {d.instituicao && (
                      <span className="rounded bg-militar-100 px-1.5 py-0.5 font-semibold text-militar-800 dark:bg-militar-950/50 dark:text-militar-400">
                        {d.instituicao}
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    enviado {formatarData(d.criadoEm)}
                    {d.enviadoPor ? ` · ${d.enviadoPor}` : ''}
                    {ROTULO_ORIGEM_DOC[d.origem] ? ` · ${ROTULO_ORIGEM_DOC[d.origem]}` : ''}
                    {d.tipoDetectado ? ` · ${ROTULO_TIPO_DOC[d.tipoDetectado] ?? d.tipoDetectado}` : ''}
                    {d.confianca !== null ? ` · confiança ${Math.round(d.confianca * 100)}%` : ''}
                  </p>
                  {d.erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{d.erro}</p>}
                  {d.status === 'erro' && (
                    <AcoesDocumentoErro documentoId={d.id} pedeSenha={/senha/i.test(d.erro ?? '')} />
                  )}
                  {d.temLancamentos && membros.length > 0 && (
                    <form
                      action={definirDonoDocumento}
                      onChange={(e) => e.currentTarget.requestSubmit()}
                      className="mt-2 flex items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="document_id" value={d.id} />
                      <span className="text-neutral-500 dark:text-neutral-400">Fatura de</span>
                      <select
                        name="member_id"
                        defaultValue={d.donoId ?? ''}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-800 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                      >
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome.split(' ')[0]}
                          </option>
                        ))}
                        <option value="">{ROTULO_COMPARTILHADO}</option>
                      </select>
                      <span className="text-neutral-400 dark:text-neutral-500">vale pra todos os lançamentos dela</span>
                    </form>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {d.valorTotal !== null && (
                    <span className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {brl.format(d.valorTotal)}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${situacao.classe}`}>
                    {situacao.texto}
                  </span>
                  {d.status === 'confirmado' && (
                    <Link
                      href={`/documentos/${d.id}`}
                      className="rounded-lg border border-militar-600 px-3 py-1.5 text-xs font-semibold text-militar-700 transition hover:bg-militar-50 dark:text-militar-400 dark:hover:bg-militar-950/40"
                    >
                      Conferir categorias →
                    </Link>
                  )}
                  {d.status === 'aguardando_confirmacao' && (
                    <Link
                      href={`/enviar?documento=${d.id}&de=documentos`}
                      className="rounded-lg bg-militar-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-militar-500"
                    >
                      Revisar e confirmar →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </ListaRecolhivel>
      )}
    </div>
  )
}

function ListaLancamentos({
  titulo,
  descricao,
  itens,
  categorias,
  vazio,
  membros,
  contas,
}: {
  titulo: string
  descricao: string
  itens: LancamentoDetalhe[]
  categorias: Categoria[]
  vazio: string
  membros: { id: string; nome: string; apelido: string | null }[]
  contas: Conta[]
}) {
  const [verTodos, setVerTodos] = useState(false)
  const despesas = itens.filter((l) => l.natureza === 'despesa').reduce((t, l) => t + l.valor, 0)
  const receitas = itens.filter((l) => l.natureza === 'receita').reduce((t, l) => t + l.valor, 0)
  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 pb-3 text-sm dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {titulo} <span className="ml-1 text-xs font-normal text-neutral-400">{itens.length}</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{descricao}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {brl.format(despesas)}
            <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">em despesas</span>
          </span>
          {receitas > 0 && (
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{brl.format(receitas)}
              <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">em receitas</span>
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {(verTodos ? itens : itens.slice(0, 5)).map((l) => (
          <LinhaLancamento key={l.id} l={l} categorias={categorias} membros={membros} contas={contas} />
        ))}
        {itens.length === 0 && <p className="py-4 text-sm text-neutral-500 dark:text-neutral-400">{vazio}</p>}
      </div>
      {itens.length > 5 && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          aria-expanded={verTodos}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-militar-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-militar-500 dark:hover:bg-neutral-800/60"
        >
          {verTodos ? '▲ Recolher' : `▼ Ver todos os ${itens.length}`}
        </button>
      )}
    </div>
  )
}

function LinhaLancamento({
  l,
  categorias,
  membros,
  contas,
}: {
  l: LancamentoDetalhe
  categorias: Categoria[]
  membros: { id: string; nome: string; apelido: string | null }[]
  contas: Conta[]
}) {
  const [editando, setEditando] = useState(false)
  const [editandoTudo, setEditandoTudo] = useState(false)
  const [natureza, setNatureza] = useState(l.natureza)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()
  const categoriasDaNatureza = categorias.filter((c) => c.natureza === l.natureza)

  if (editandoTudo) {
    const categoriasDoTipo = categorias.filter((c) => c.natureza === natureza)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const dados = new FormData(e.currentTarget)
          setErro(null)
          iniciar(async () => {
            try {
              await editarLancamento(dados)
              setEditandoTudo(false)
            } catch (err) {
              setErro(err instanceof Error ? err.message : 'Não consegui salvar.')
            }
          })
        }}
        className="my-2 flex flex-col gap-3 rounded-xl border border-militar-300 bg-militar-50/40 p-4 dark:border-militar-800 dark:bg-militar-950/20"
      >
        <input type="hidden" name="id" value={l.id} />
        <div className="flex gap-4 text-sm">
          {(['despesa', 'receita'] as const).map((n) => (
            <label key={n} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <input type="radio" name="natureza" value={n} checked={natureza === n} onChange={() => setNatureza(n)} />
              {n === 'despesa' ? 'Despesa' : 'Receita'}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
          <input name="descricao" required defaultValue={l.descricao} className={campo} />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
            <CampoMoeda name="valor" required defaultValue={l.valor} className={`${campo} w-full text-right tabular-nums sm:w-32`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Data</span>
            <input type="date" name="data" required defaultValue={l.data} className={campo} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Categoria</span>
            <select key={natureza} name="category_id" defaultValue={natureza === l.natureza ? (l.categoriaId ?? '') : ''} className={campo}>
              <option value="">Sem categoria</option>
              {categoriasDoTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          {membros.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">De quem</span>
              <select name="member_id" defaultValue={l.donoId ?? ''} className={campo}>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apelido || m.nome.split(' ')[0]}
                  </option>
                ))}
                <option value="">{ROTULO_COMPARTILHADO}</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Conta</span>
            <select name="account_id" defaultValue={l.contaId ?? ''} className={campo}>
              <option value="">Sem conta</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        {erro && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-militar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-militar-500 disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditandoTudo(false)
              setNatureza(l.natureza)
              setErro(null)
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{l.descricao}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{formatarData(l.data)}</span>

          {editando ? (
            <form
              action={atualizarCategoriaLancamento}
              onChange={(e) => e.currentTarget.requestSubmit()}
              className="inline-flex"
            >
              <input type="hidden" name="id" value={l.id} />
              <select
                name="category_id"
                defaultValue={l.categoriaId ?? ''}
                autoFocus
                onBlur={() => setEditando(false)}
                className="rounded border border-militar-400 bg-white px-1.5 py-0.5 text-xs text-neutral-700 outline-none dark:border-militar-600 dark:bg-neutral-950 dark:text-neutral-300"
              >
                <option value="">Sem categoria</option>
                {categoriasDaNatureza.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              title="Clique pra mudar a categoria"
              className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              {l.categoria ?? 'Sem categoria'}
            </button>
          )}

          {l.conta && <span>· {l.conta}</span>}
          {l.banco && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {l.banco}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span
          className={`text-sm font-medium tabular-nums ${
            l.natureza === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100'
          }`}
        >
          {l.natureza === 'receita' ? '+' : '-'}
          {brl.format(l.valor)}
        </span>
        <div className="flex items-center gap-3">
          {!l.deDocumento && (
            <button
              type="button"
              onClick={() => setEditandoTudo(true)}
              className="py-1 text-xs font-medium text-militar-700 hover:underline dark:text-militar-500"
            >
              editar
            </button>
          )}
          <FormularioComConfirmacao action={removerLancamento} mensagem={`Remover o lançamento "${l.descricao}"?`}>
            <input type="hidden" name="id" value={l.id} />
            <button type="submit" className="py-1 text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
              remover
            </button>
          </FormularioComConfirmacao>
        </div>
      </div>
    </div>
  )
}
