import { RecolhivelCelular } from '@/components/recolhivel-celular'
import { BlocoAdicionar } from '@/components/bloco-adicionar'
import { AbaBusca } from './aba-busca'
import { montarEmpresas } from '@/lib/empresas'
import { comprasParceladasEmAberto, type LinhaParcela } from '@/lib/parcelas'
import { ListaRecolhivel, BarraShare } from '@/components/lista-recolhivel'
import { TabelaOrdenavel } from '@/components/tabela-ordenavel'
import { createClient } from '@/lib/supabase/server'
import { criarConta, pagarConta, removerConta, replicarContas } from './actions'
import { formatarData } from '@/lib/data'
import { FormularioComRascunho } from '@/components/formulario-com-rascunho'
import { FormularioComConfirmacao } from '@/components/formulario-com-confirmacao'
import { CampoMoeda } from '@/components/campo-moeda'
import { BotaoEnviar } from '@/components/botao-enviar'
import Link from 'next/link'
import { FiltroMes } from '@/components/filtro-mes'
import { ReplicarMesAnterior } from '@/components/replicar-mes-anterior'
import { Abas } from '@/components/abas'
import { GraficoBarras, type Barra } from '@/components/grafico-barras'
import { AbaLancamentos, AbaDocumentos, type LancamentoDetalhe, type DocumentoDetalhe } from './detalhamento'
import { CategoriaContaInline } from '@/components/categoria-conta-inline'
import { EditarContaInline } from '@/components/editar-conta-inline'
import { MoverContaMes } from '@/components/mover-conta-mes'
import { ehLembrete } from '@/lib/lembrete'
import { RenovacoesAnuais, type ContaAnual } from './renovacoes-anuais'
import { AbaCartoes, type ContaNoCartao } from './aba-cartoes'
import type { FaturaCredito } from './credito-cartoes'
import { CentralAssinaturas } from './central-assinaturas'
import { rotuloCartao, type Cartao } from '@/lib/cartao'
import { obterVisao, donosEscolhiveis } from '@/lib/pessoa'
import { AvisoVisao } from '@/components/aviso-visao'
import { BuscarFaturasEmail } from '@/components/buscar-faturas-email'
import { emailConfigurado } from '@/lib/faturas-email'
import { corDono, primeiroNome, ROTULO_COMPARTILHADO } from '@/lib/donos'
import { HistoricoContas } from './historico-contas'
import { SincronizarAssinaturas } from '@/components/sincronizar-assinaturas'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const botao =
  'rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500'
const botaoPagar =
  'rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
const cartao =
  'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'

// Linha de filtros (chips): cada opção é um link; a ativa fica destacada.
type OpcaoChip = { rotulo: string; href: string; ativo: boolean; nota?: string }
function Chip({ o }: { o: OpcaoChip }) {
  return (
    <Link
      href={o.href}
      scroll={false}
      aria-current={o.ativo ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${o.ativo ? 'border-militar-600 bg-militar-600 text-white shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
    >
      {o.rotulo}
      {o.nota && (
        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${o.ativo ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{o.nota}</span>
      )}
    </Link>
  )
}
// Grupo de filtro: rótulo à esquerda e as opções; com `limite`, o excedente fica em "+ mais".
function Chips({ titulo, opcoes, limite }: { titulo: string; opcoes: OpcaoChip[]; limite?: number }) {
  const visiveis = limite ? opcoes.slice(0, limite) : opcoes
  const resto = limite ? opcoes.slice(limite) : []
  const ativoNoResto = resto.some((o) => o.ativo)
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-20 shrink-0 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{titulo}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {visiveis.map((o) => (
          <Chip key={o.rotulo} o={o} />
        ))}
        {resto.length > 0 && (
          <details className="group w-full" open={ativoNoResto}>
            <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-xs font-medium text-militar-700 hover:underline group-open:hidden dark:text-militar-400 [&::-webkit-details-marker]:hidden">
              + {resto.length} mais
            </summary>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {resto.map((o) => (
                <Chip key={o.rotulo} o={o} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

// Indicadores do topo de cada aba (cada subcategoria mostra os seus principais números)
function FaixaKpis({ itens }: { itens: { rotulo: string; valor: string; nota?: string; tom?: 'alerta' }[] }) {
  return (
    <section className={`mb-6 grid grid-cols-2 gap-3 ${itens.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {itens.map((k) => (
        <div key={k.rotulo} className="h-full min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{k.rotulo}</p>
          <p className={`mt-1 break-words text-lg font-semibold tabular-nums sm:text-xl ${k.tom === 'alerta' ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{k.valor}</p>
          {k.nota && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{k.nota}</p>}
        </div>
      ))}
    </section>
  )
}

function inicioDoMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

function somarMeses(data: Date, meses: number) {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1)
}

function chaveMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

type LinhaTransacao = {
  member_id: string | null
  descricao: string
  valor: number
  data: string
  parcela_num: number | null
  parcela_total: number | null
  account_id: string | null
  account: { nome: string } | { nome: string }[] | null
}

type LinhaLancamentoDetalhado = {
  id: string
  member_id: string | null
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  data: string
  canal: string | null
  document_id: string | null
  account_id: string | null
  category: { id: string; nome: string } | { id: string; nome: string }[] | null
  account: { nome: string } | { nome: string }[] | null
}

type LinhaDocumento = {
  id: string
  nome_arquivo: string
  origem: string
  status: string
  tipo_detectado: string | null
  confianca: number | null
  erro: string | null
  criado_em: string
  extracao: { instituicao?: string | null; vencimento?: string | null; valor_total?: number | null } | null
  enviado_por: { nome: string; apelido: string | null } | { nome: string; apelido: string | null }[] | null
}

function empresaDeLancamento(descricao: string, canal: string | null): string {
  if (canal) return canal
  return descricao.trim().split(/\s+/)[0] || descricao
}

function inicioDoMesIso(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1).toISOString().slice(0, 10)
}

function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function nomeMesCurto(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

// Primeira letra maiúscula só na frase (não em cada palavra, como faria o capitalize do Tailwind).
function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Desloca um mês no formato YYYY-MM-01 (UTC, pra não depender do fuso do servidor).
function deslocarMes(mesIso: string, n: number) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1 + n, 1)).toISOString().slice(0, 10)
}

function linkMesBase(mesIso: string, pagasExtras: string[] = []) {
  const extras = pagasExtras.map((m) => m.slice(0, 7)).filter((m) => m !== mesIso.slice(0, 7))
  return `/contas-a-pagar?aba=contas&mes=${mesIso.slice(0, 7)}${extras.length ? `&pagas=${extras.join(',')}` : ''}`
}

export default async function ContasAPagar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()

  const hoje = new Date().toISOString().slice(0, 10)
  const inicioMes = hoje.slice(0, 8) + '01'

  // Mês exibido na aba Contas: ?mes=YYYY-MM na URL, ou o mês corrente.
  const parametros = await searchParams
  const mesParam = typeof parametros?.mes === 'string' && /^\d{4}-\d{2}$/.test(parametros.mes) ? parametros.mes : null
  const mesSel = mesParam ? `${mesParam}-01` : inicioMes
  const mesAnteriorSel = deslocarMes(mesSel, -1)
  const mesSeguinteSel = deslocarMes(mesSel, 1)
  const ehMesAtual = mesSel === inicioMes
  // Pagas: por padrão só o mês exibido; ?pagas=YYYY-MM,YYYY-MM inclui outros meses.
  const pagasExtras = (typeof parametros?.pagas === 'string' ? parametros.pagas.split(',') : [])
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .map((m) => `${m}-01`)
    .filter((m) => m !== mesSel)

  // ---- filtros por aba (na URL, para dar para compartilhar e manter ao trocar de mês) ----
  const p1 = (k: string) => (typeof parametros?.[k] === 'string' ? (parametros[k] as string) : null)
  const fSituacao = p1('st') // aberto | atrasada | paga
  const fForma = p1('forma') // cartao | debito | pix | outro
  const fCategoria = p1('cat')
  const fBancoParcela = p1('pb')
  const fFimParcela = p1('pfim') // '3' = termina em até 3 meses
  const fCartaoStatus = p1('cs') // ativos | cancelados
  const fBancoAssinatura = p1('cb')
  /** URL da página com os filtros atuais, trocando o que vier em `mudar` (null apaga). */
  const urlCom = (aba: string, mudar: Record<string, string | null>) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(parametros ?? {})) if (typeof v === 'string' && k !== 'aba') q.set(k, v)
    q.set('aba', aba)
    for (const [k, v] of Object.entries(mudar)) (v == null ? q.delete(k) : q.set(k, v))
    return `/contas-a-pagar?${q.toString()}`
  }
  const filtrosContasQS = ['st', 'forma', 'cat'].map((k) => (p1(k) ? `&${k}=${encodeURIComponent(p1(k)!)}` : '')).join('')
  const linkMes = (mesIso: string, extras: string[] = []) => linkMesBase(mesIso, extras) + filtrosContasQS

  const dozeMesesAtras = new Date()
  dozeMesesAtras.setMonth(dozeMesesAtras.getMonth() - 11)
  const inicioJanelaLancamentos = inicioDoMesIso(dozeMesesAtras)

  const { data: periodo } = await supabase.from('patrimonio_periodo').select('mes').single()
  const mesAberto = periodo?.mes ?? inicioDoMesIso()

  const [
    contasDoMesData,
    atrasadasData,
    membros,
    contasMesAnteriorSelData,
    parcelasTransacoes,
    lancamentosData,
    documentosData,
    categoriasData,
    contasAtivasData,
    histContasData,
    cartoesData,
    contasComCartaoData,
    gastosEmpresasData,
    instituicoesDocData,
    contasEmpresasData,
    vinculosEmpresaData,
    faturasCreditoData,
  ] = await Promise.all([
    supabase
      .from('bill')
      .select('*, responsavel:pago_por(nome, apelido), category:category_id(id, nome)')
      .eq('mes', mesSel)
      .order('vencimento'),
    supabase
      .from('bill')
      .select('*, category:category_id(id, nome)')
      .eq('pago', false)
      .lt('mes', inicioMes)
      .order('vencimento'),
    supabase.from('member').select('id, nome, apelido').order('nome'),
    supabase
      .from('bill')
      .select('id, descricao, valor, vencimento, recorrente, debito_automatico, account_id, category_id, linhagem_id, cartao_id, responsavel_id')
      .eq('mes', mesAnteriorSel)
      .neq('periodicidade', 'anual')
      .order('vencimento'),
    supabase
      .from('transaction')
      .select('descricao, valor, data, parcela_num, parcela_total, account_id, member_id, account:account_id(nome), document:document_id(vencimento:extracao->>vencimento, instituicao:extracao->>instituicao)')
      .eq('natureza', 'despesa')
      .not('parcela_total', 'is', null)
      .gt('parcela_total', 1)
      .order('data', { ascending: false }),
    supabase
      .from('transaction')
      .select('id, descricao, valor, natureza, data, canal, document_id, member_id, account_id, category:category_id(id, nome), account:account_id(nome)')
      .gte('data', inicioJanelaLancamentos)
      .order('data', { ascending: false })
      .limit(300),
    supabase
      .from('document')
      .select(
        'id, nome_arquivo, mime_type, origem, status, tipo_detectado, confianca, erro, criado_em, processado_em, extracao, enviado_por:enviado_por(nome, apelido)',
      )
      .order('criado_em', { ascending: false })
      .limit(50),
    supabase.from('category').select('id, nome, natureza').order('natureza').order('nome'),
    supabase.from('account').select('id, nome').eq('mes', mesAberto).eq('ativo', true).order('nome'),
    supabase.from('bill').select('linhagem_id, mes, descricao, valor, pago, responsavel_id, cartao_id, so_lembrete'),
    supabase.from('cartao').select('id, nome, bandeira, banco, final, tipo, titular_id, ativo, observacao').order('nome'),
    supabase
      .from('bill')
      .select('id, descricao, valor, vencimento, pago, recorrente, periodicidade, debito_automatico, linhagem_id, cartao_id, responsavel_id')
      .not('cartao_id', 'is', null),
    // Relação empresa ↔ cartão (aba Cartões): gastos dos últimos 12 meses, contas e vínculos.
    supabase
      .from('transaction')
      .select('descricao, canal, valor, data, document_id, member_id, category:category_id(nome)')
      .eq('natureza', 'despesa')
      .gte('data', inicioDoMes(somarMeses(inicioDoMes(), -11)).toISOString().slice(0, 10))
      .limit(5000),
    supabase.from('document').select('id, instituicao:extracao->>instituicao'),
    supabase.from('bill').select('linhagem_id, descricao, valor, vencimento, cartao_id, recorrente, periodicidade, responsavel_id, category:category_id(nome)'),
    supabase.from('empresa_cartao').select('chave, nome, cartao_id, tipo, valor_mensal, ultima_cobranca, periodicidade'),
    // dados de crédito lidos das faturas (limite, ciclo, juros, encargos) — cards de Cartões
    supabase
      .from('document')
      .select('id, instituicao:extracao->>instituicao, vencimento:extracao->>vencimento, credito:extracao->credito')
      .eq('tipo_detectado', 'fatura')
      .in('status', ['confirmado', 'aguardando_confirmacao'])
      .not('extracao->credito', 'is', null),
  ])
  const cartoesTodos = (cartoesData.data ?? []) as Cartao[]
  const cartaoPorId = new Map(cartoesTodos.map((c) => [c.id, c]))

  // -------- Visão por pessoa (seletor do menu) --------
  // Dono de uma conta a pagar: o "De quem" dela ou, se vazio, o titular do cartão em que está.
  // Sem dono = da família (compartilhada) → só aparece no Consolidado.
  const visao = await obterVisao(supabase)
  const membrosVisao = visao.membros
  // quem pode ser escolhido como dono/pagador
  const donosEscolha = donosEscolhiveis(visao.membros, visao.eu)
  const donoConta = (b: { responsavel_id?: string | null; cartao_id?: string | null }) =>
    b.responsavel_id ?? (b.cartao_id ? (cartaoPorId.get(b.cartao_id)?.titular_id ?? null) : null)
  const contaVisivel = (b: { responsavel_id?: string | null; cartao_id?: string | null }) => visao.mostra(donoConta(b))
  const cartoes = visao.pessoa === 'todos' ? cartoesTodos : cartoesTodos.filter((c) => c.titular_id === visao.pessoa)
  function seloDono(donoId: string | null) {
    if (visao.pessoa !== 'todos') return null
    const m = membrosVisao.find((x) => x.id === donoId)
    return (
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${corDono(donoId, membrosVisao)}`}>
        {m ? primeiroNome(m.nome) : ROTULO_COMPARTILHADO}
      </span>
    )
  }

  // -------- Histórico e balanço mensal das contas (aba Histórico) --------
  const itensHistoricoContas = ((histContasData.data ?? []).filter((b) => contaVisivel(b)) as {
    linhagem_id: string
    mes: string
    descricao: string
    valor: number
    pago: boolean
  }[]).map((b) => ({
    linhagemId: b.linhagem_id,
    lembrete: (b as { so_lembrete?: boolean }).so_lembrete === true,
    rotulo: b.descricao,
    mes: b.mes,
    valor: Number(b.valor),
    pago: b.pago,
  }))

  const pagasExtrasData = pagasExtras.length
    ? await supabase
        .from('bill')
        .select('*, responsavel:pago_por(nome, apelido), category:category_id(id, nome)')
        .eq('pago', true)
        .in('mes', pagasExtras)
    : null

  // -------- Organização por mês (aba Contas) --------
  // Cada conta pertence ao mês do próprio vencimento. A tela mostra um mês por vez, pra
  // outubro e novembro nunca aparecerem misturados na mesma lista.
  type ContaLinha = {
    id: string
    descricao: string
    valor: number
    vencimento: string
    pago: boolean
    pago_em: string | null
    recorrente: boolean
    periodicidade: 'mensal' | 'anual'
    debito_automatico: boolean
    cartao_id: string | null
    so_lembrete?: boolean | null
    responsavel_id: string | null
    responsavel?: { nome: string; apelido: string | null } | { nome: string; apelido: string | null }[] | null
    category: { id: string; nome: string } | { id: string; nome: string }[] | null
  }
  // filtros da aba Contas: situação, forma de pagamento e categoria
  const formaDe = (b: { cartao_id: string | null; debito_automatico?: boolean }) => {
    const c = b.cartao_id ? cartaoPorId.get(b.cartao_id) : null
    if (!c) return b.debito_automatico ? 'debito' : 'outro'
    return c.tipo === 'debito' ? 'debito' : c.tipo === 'pix' ? 'pix' : 'cartao'
  }
  const categoriaIdDe = (b: ContaLinha) => (Array.isArray(b.category) ? b.category[0]?.id : b.category?.id) ?? 'sem'
  const passaFiltroConta = (b: ContaLinha) =>
    (!fSituacao || (fSituacao === 'paga' ? b.pago : fSituacao === 'aberto' ? !b.pago : !b.pago && b.vencimento < hoje)) &&
    (!fForma || formaDe(b) === fForma) &&
    (!fCategoria || categoriaIdDe(b) === fCategoria)
  const contasMesSemFiltro = ((contasDoMesData.data ?? []) as ContaLinha[]).filter(contaVisivel)
  const contasMes = contasMesSemFiltro.filter(passaFiltroConta)
  const filtroContasAtivo = !!(fSituacao || fForma || fCategoria)
  const abertasMes = contasMes.filter((b) => !b.pago)
  const pagasMes = contasMes.filter((b) => b.pago).sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? ''))
  const atrasadasAnteriores = ehMesAtual ? ((atrasadasData.data ?? []) as ContaLinha[]).filter(contaVisivel).filter(passaFiltroConta) : []
  // Lembretes (anuais no cartão) ficam nas listas, mas fora dos totais e contagens.
  const somar = (l: ContaLinha[]) => l.filter((b) => !ehLembrete(b)).reduce((t, b) => t + Number(b.valor), 0)
  const totalAbertoMes = somar(abertasMes)
  const totalPagoMes = somar(pagasMes)
  const totalMes = totalAbertoMes + totalPagoMes
  const totalAtrasadas = somar(atrasadasAnteriores)
  const nAbertasMes = abertasMes.filter((b) => !ehLembrete(b)).length
  const nPagasMes = pagasMes.filter((b) => !ehLembrete(b)).length
  const nContasMes = nAbertasMes + nPagasMes

  // Grupos da lista de pagas: mês exibido primeiro, depois os meses adicionados (mais recente antes).
  const pagasOutros = ((pagasExtrasData?.data ?? []) as (ContaLinha & { mes: string })[]).filter(contaVisivel).filter(passaFiltroConta)
  const gruposPagas = [
    { mes: mesSel, contas: pagasMes },
    ...[...pagasExtras]
      .sort()
      .reverse()
      .map((m) => ({
        mes: m,
        contas: pagasOutros
          .filter((b) => b.mes === m)
          .sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? '')),
      })),
  ]
  const totalPagasListadas = gruposPagas.reduce((t, g) => t + somar(g.contas), 0)

  // Meses no seletor: todos os que têm conta, mais o mês atual, o próximo e o selecionado.
  const resumoPorMes = new Map<string, { total: number; abertas: number; valor: number; valorAberto: number }>()
  for (const i of itensHistoricoContas) {
    const r = resumoPorMes.get(i.mes) ?? { total: 0, abertas: 0, valor: 0, valorAberto: 0 }
    r.total += 1
    if (!i.pago) r.abertas += 1
    if (!i.lembrete) {
      r.valor += Number(i.valor)
      if (!i.pago) r.valorAberto += Number(i.valor)
    }
    resumoPorMes.set(i.mes, r)
  }
  const mesesNav = Array.from(
    new Set([...resumoPorMes.keys(), inicioMes, deslocarMes(inicioMes, 1), mesSel]),
  ).sort()
  // Chips: sempre 5 meses seguidos com o escolhido no meio (2 antes, 2 depois); o seletor alcança os demais.
  const mesesChips = [-2, -1, 0, 1, 2].map((n) => deslocarMes(mesSel, n))
  // Meses que podem ser somados à lista de pagas (têm pelo menos uma conta paga).
  const mesesComPagas = Array.from(
    new Set(itensHistoricoContas.filter((i) => i.pago && i.mes < mesSel).map((i) => i.mes)),
  )
    .sort()
    .reverse()
    // no máximo 4 meses anteriores (+ este mês = 5); um já incluído continua aparecendo
    .filter((m, i) => i < 4 || pagasExtras.includes(m))

  // "Trazer contas do mês anterior": oferece clonar o mês anterior ao exibido, sem as
  // linhagens que já existem no mês exibido (nunca duplica).
  const linhagensNoMesSel = new Set(itensHistoricoContas.filter((i) => i.mes === mesSel).map((i) => i.linhagemId))
  const contasParaTrazer = (contasMesAnteriorSelData.data ?? []).filter(
    (b) => !linhagensNoMesSel.has(b.linhagem_id) && contaVisivel(b),
  )

  const diaHoje = Number(hoje.slice(8, 10))
  const vencimentoPadrao = ehMesAtual
    ? hoje
    : (() => {
        const [ano, mes] = mesSel.slice(0, 7).split('-').map(Number)
        const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
        return `${mesSel.slice(0, 8)}${String(Math.min(diaHoje, ultimoDia)).padStart(2, '0')}`
      })()

  const categoriasDespesa = (categoriasData.data ?? []).filter((c) => c.natureza === 'despesa')

  function linhaAberta(b: ContaLinha) {
    const atrasada = b.vencimento < hoje
    const categoriaB = Array.isArray(b.category) ? b.category[0] : b.category
    return (
      <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{b.descricao}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={atrasada ? 'font-medium text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}>
              vence {formatarData(b.vencimento)}
              {atrasada ? ' · atrasada' : ''}
              {b.recorrente ? (b.periodicidade === 'anual' ? ' · anual' : ' · todo mês') : ''}
              {b.debito_automatico ? ' · débito automático' : ''}
            </span>
            {ehLembrete(b) && (
              <span
                title="Cobrada no cartão: o valor já entra pela fatura. Aqui é só o lembrete da renovação e não soma nos totais."
                className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                🔔 lembrete · não soma
              </span>
            )}
            {seloDono(donoConta(b))}
            {b.cartao_id && cartaoPorId.get(b.cartao_id) && (
              <span
                title="Cartão onde a cobrança está cadastrada"
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  cartaoPorId.get(b.cartao_id)!.ativo
                    ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                }`}
              >
                💳 {rotuloCartao(cartaoPorId.get(b.cartao_id)!)}
                {cartaoPorId.get(b.cartao_id)!.ativo ? '' : ' · cancelado'}
              </span>
            )}
            <CategoriaContaInline
              id={b.id}
              categoriaId={categoriaB?.id ?? null}
              categoriaNome={categoriaB?.nome ?? null}
              categorias={categoriasDespesa}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 has-[.edicao-conta]:w-full">
          <EditarContaInline
            id={b.id}
            descricao={b.descricao}
            valor={Number(b.valor)}
            vencimento={b.vencimento}
            repeticao={!b.recorrente ? 'nao' : b.periodicidade === 'anual' ? 'anual' : 'mensal'}
            cartaoId={b.cartao_id}
            cartoes={cartoesTodos}
            responsavelId={b.responsavel_id}
            membros={donosEscolha}
            soLembrete={!!b.so_lembrete}
          />
          <MoverContaMes id={b.id} vencimento={b.vencimento} />
          <form action={pagarConta} className="flex items-center gap-2">
            <input type="hidden" name="id" value={b.id} />
            <select
              name="pago_por"
              defaultValue=""
              hidden={ehLembrete(b)}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
            >
              <option value="">Quem pagou?</option>
              {donosEscolhiveis(membros.data ?? [], visao.eu).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.apelido || m.nome}
                </option>
              ))}
            </select>
            <BotaoEnviar className={botaoPagar} enviando="Salvando…">
              {ehLembrete(b) ? 'Renovado' : b.debito_automatico ? 'Confirmar débito' : 'Marcar paga'}
            </BotaoEnviar>
          </form>
          <FormularioComConfirmacao action={removerConta} mensagem={`Remover a conta "${b.descricao}"?`}>
            <input type="hidden" name="id" value={b.id} />
            <button type="submit" className="text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
              remover
            </button>
          </FormularioComConfirmacao>
        </div>
      </div>
    )
  }

  // -------- Lançamentos + Documentos: mesma lógica que já existia na Visão geral --------
  const bancoPorDocumento = new Map<string, string>()
  for (const d of (documentosData.data as { id: string; extracao: { instituicao?: string | null } | null }[] | null) ?? []) {
    if (d.extracao?.instituicao) bancoPorDocumento.set(d.id, d.extracao.instituicao)
  }

  // Dono de cada fatura = dono dos lançamentos que vieram dela (primeiro com dono definido).
  const idsDocumentos = ((documentosData.data as { id: string }[] | null) ?? []).map((d) => d.id)
  const { data: donosLancDocs } = idsDocumentos.length
    ? await supabase.from('transaction').select('document_id, member_id').in('document_id', idsDocumentos)
    : { data: [] as { document_id: string; member_id: string | null }[] }
  const donoPorDocumento = new Map<string, string | null>()
  for (const t of (donosLancDocs ?? []) as { document_id: string; member_id: string | null }[]) {
    if (!donoPorDocumento.has(t.document_id) || (donoPorDocumento.get(t.document_id) === null && t.member_id))
      donoPorDocumento.set(t.document_id, t.member_id)
  }

  const lancamentosDetalhe: LancamentoDetalhe[] = (
    // Todos os lançamentos vão pra aba; o filtro por pessoa é feito lá (começa na visão do menu).
    (lancamentosData.data as LinhaLancamentoDetalhado[] | null) ?? []
  ).map((t) => {
    const categoria = Array.isArray(t.category) ? t.category[0] : t.category
    const conta = Array.isArray(t.account) ? t.account[0] : t.account
    return {
      id: t.id,
      descricao: t.descricao,
      valor: Number(t.valor),
      data: t.data,
      natureza: t.natureza,
      categoria: categoria?.nome ?? null,
      categoriaId: categoria?.id ?? null,
      conta: conta?.nome ?? null,
      empresa: t.natureza === 'despesa' ? empresaDeLancamento(t.descricao, t.canal) : null,
      banco: t.document_id ? (bancoPorDocumento.get(t.document_id) ?? null) : null,
      donoId: t.member_id ?? null,
      deDocumento: !!t.document_id,
      contaId: t.account_id ?? null,
    }
  })

  const documentosDetalhe: DocumentoDetalhe[] = ((documentosData.data as LinhaDocumento[] | null) ?? [])
    .filter((d) => visao.pessoa === 'todos' || donoPorDocumento.get(d.id) === visao.pessoa)
    .map((d) => {
    const membro = Array.isArray(d.enviado_por) ? d.enviado_por[0] : d.enviado_por
    const dataReferencia = d.extracao?.vencimento ?? d.criado_em.slice(0, 10)
    return {
      id: d.id,
      nomeArquivo: d.nome_arquivo ?? 'arquivo',
      origem: d.origem,
      status: d.status,
      tipoDetectado: d.tipo_detectado,
      confianca: d.confianca,
      erro: d.erro,
      criadoEm: d.criado_em,
      enviadoPor: membro ? membro.apelido || membro.nome : null,
      instituicao: d.extracao?.instituicao ?? null,
      valorTotal: d.extracao?.valor_total ?? null,
      dataReferencia,
      donoId: donoPorDocumento.get(d.id) ?? null,
      temLancamentos: donoPorDocumento.has(d.id),
    }
  })

  // -------- Validação: documentos com erro ou parados sem confirmar --------
  // Cheguei a implementar também um check de "soma dos lançamentos x valor_total da fatura",
  // mas descartei: faturas que têm compras parceladas costumam trazer no mesmo documento
  // lançamentos de meses bem diferentes (parcela já paga em março, cobrança atual de julho,
  // parcela futura projetada até dezembro) — por exemplo, uma fatura pode ter
  // R$ 2.000,00 de total declarado mas R$ 2.600,00 somando todos os lançamentos vinculados a
  // ela, sem nenhum erro de verdade, só porque o "total da fatura" não inclui as parcelas
  // futuras que também vieram na mesma extração. Comparar os dois geraria alarme falso na
  // maioria das faturas parceladas, então não é uma checagem confiável — melhor não ter do
  // que ter uma que erra.
  type TipoValidacao = 'pendente' | 'erro'
  type Validacao = { tipo: TipoValidacao; titulo: string; descricao: string; recomendacao: string }

  const validacoes: Validacao[] = []
  for (const d of documentosDetalhe) {
    if (d.status === 'erro') {
      validacoes.push({
        tipo: 'erro',
        titulo: d.nomeArquivo,
        descricao: d.erro ?? 'Erro ao processar o documento.',
        recomendacao: 'Use os botões na linha do documento, na aba Documentos: tentar de novo, abrir com a senha ou enviar o arquivo desbloqueado.',
      })
      continue
    }
    if (d.status === 'aguardando_confirmacao') {
      const dias = Math.floor((Date.now() - new Date(d.criadoEm).getTime()) / 86_400_000)
      if (dias >= 2) {
        validacoes.push({
          tipo: 'pendente',
          titulo: d.nomeArquivo,
          descricao: `Enviado há ${dias} dias e ainda não foi confirmado.`,
          recomendacao: 'Clique em "Revisar e confirmar" na aba Documentos.',
        })
      }
    }
  }

  const nomeMesSel = nomeMes(mesSel)

  // -------- Parcelas: mesma lógica que já existia em /parcelas --------

  function empresaDe(descricao: string) {
    return descricao.trim().split(/\s+/)[0] || descricao
  }

  const parcelasTodas = comprasParceladasEmAberto((parcelasTransacoes.data as LinhaParcela[] | null) ?? [], (dono) => visao.mostra(dono))
  const bancosParcelas = Array.from(new Set(parcelasTodas.compras.map((c) => c.banco ?? 'Sem banco'))).sort()
  const compras = parcelasTodas.compras.filter(
    (c) => (!fBancoParcela || (c.banco ?? 'Sem banco') === fBancoParcela) && (!fFimParcela || c.parcela_total - c.parcela_num <= Number(fFimParcela)),
  )
  const totalFaltante = compras.reduce((t, c) => t + c.valor * (c.parcela_total - c.parcela_num), 0)
  const parcelaMensal = compras.reduce((t, c) => t + c.valor, 0)
  const filtroParcelasAtivo = !!(fBancoParcela || fFimParcela)

  const porEmpresaMapa = new Map<string, number>()
  for (const c of compras) {
    const empresa = empresaDe(c.descricao)
    porEmpresaMapa.set(empresa, (porEmpresaMapa.get(empresa) ?? 0) + c.valor * (c.parcela_total - c.parcela_num))
  }
  const empresasOrdenadas = Array.from(porEmpresaMapa.entries()).sort((a, b) => b[1] - a[1])
  const qtdPorEmpresa = new Map<string, number>()
  for (const c of compras) qtdPorEmpresa.set(empresaDe(c.descricao), (qtdPorEmpresa.get(empresaDe(c.descricao)) ?? 0) + 1)

  const porConta = new Map<string, { qtd: number; valor: number; mensal: number }>()
  const comprasPorConta = new Map<string, typeof compras>()
  for (const c of compras) {
    const atual = porConta.get(c.banco ?? c.contaNome) ?? { qtd: 0, valor: 0, mensal: 0 }
    atual.qtd += 1
    atual.valor += c.valor * (c.parcela_total - c.parcela_num)
    atual.mensal += c.valor
    porConta.set(c.banco ?? c.contaNome, atual)
    comprasPorConta.set(c.banco ?? c.contaNome, [...(comprasPorConta.get(c.banco ?? c.contaNome) ?? []), c])
  }
  for (const lista of comprasPorConta.values())
    lista.sort((a, b) => b.valor * (b.parcela_total - b.parcela_num) - a.valor * (a.parcela_total - a.parcela_num))

  const projecao = new Map<string, number>()
  for (const c of compras) {
    // a próxima parcela cai na próxima fatura: este mês se ainda estamos na 1ª quinzena, senão o mês que vem
    const dataBase = somarMeses(inicioDoMes(), Number(hoje.slice(8, 10)) <= 15 ? -1 : 0)
    for (let n = c.parcela_num + 1; n <= c.parcela_total; n++) {
      const dataParcela = somarMeses(dataBase, n - c.parcela_num)
      const chave = chaveMes(dataParcela)
      projecao.set(chave, (projecao.get(chave) ?? 0) + c.valor)
    }
  }

  const mesesBarras: Barra[] = []
  let cursor = inicioDoMes()
  for (let i = 0; i < 6; i++) {
    mesesBarras.push({
      rotulo: cursor.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      valor: projecao.get(chaveMes(cursor)) ?? 0,
    })
    cursor = somarMeses(cursor, 1)
  }

  const contasOrdenadas = Array.from(porConta.entries()).sort((a, b) => b[1].valor - a[1].valor)
  const comprasOrdenadas = [...compras].sort(
    (a, b) => b.valor * (b.parcela_total - b.parcela_num) - a.valor * (a.parcela_total - a.parcela_num),
  )


  // empresas/assinaturas (uma linha por empresa), usadas em Cartões e na Central de assinaturas
  const empresasLinhas = montarEmpresas({
      transacoes: ((gastosEmpresasData.data ?? []) as (Parameters<typeof montarEmpresas>[0]['transacoes'][number] & { member_id: string | null })[]).filter(
        (t) => visao.mostra(t.member_id),
      ),
      contas: ((contasEmpresasData.data ?? []) as (Parameters<typeof montarEmpresas>[0]['contas'][number] & { responsavel_id: string | null })[]).filter(
        (c) => contaVisivel(c),
      ),
      instituicaoPorDocumento: new Map(
        ((instituicoesDocData.data ?? []) as { id: string; instituicao: string | null }[])
          .filter((d) => d.instituicao)
          .map((d) => [d.id, d.instituicao as string]),
      ),
      vinculos: new Map(((vinculosEmpresaData.data ?? []) as { chave: string; cartao_id: string | null }[]).map((v) => [v.chave, v.cartao_id])),
      manuais: new Map(((vinculosEmpresaData.data ?? []) as { chave: string; nome: string }[]).map((v) => [v.chave, v.nome])),
      datasManuais: new Map(
        ((vinculosEmpresaData.data ?? []) as { chave: string; ultima_cobranca: string | null }[])
          .filter((v) => v.ultima_cobranca)
          .map((v) => [v.chave, v.ultima_cobranca as string]),
      ),
      valoresManuais: new Map(
        ((vinculosEmpresaData.data ?? []) as { chave: string; valor_mensal: number | string | null }[])
          .filter((v) => v.valor_mensal !== null)
          .map((v) => [v.chave, Number(v.valor_mensal)]),
      ),
      anuais: new Set(
        ((vinculosEmpresaData.data ?? []) as { chave: string; periodicidade: string | null }[]).filter((v) => v.periodicidade === 'anual').map((v) => v.chave),
      ),
      tiposManuais: new Map(
        ((vinculosEmpresaData.data ?? []) as { chave: string; tipo: 'assinatura' | 'recorrente' | 'avulsa' | null }[])
          .filter((v) => v.tipo)
          .map((v) => [v.chave, v.tipo as 'assinatura' | 'recorrente' | 'avulsa']),
      ),
    })

  // Opcional (NEXT_PUBLIC_ASSINATURAS_VIRAM_CONTAS=1): assinaturas/recorrentes sem conta em aberto viram
  // a conta da próxima cobrança, como lembrete (já é cobrada no cartão, não soma de novo).
  const assinaturasSemConta = await (async () => {
    if (process.env.NEXT_PUBLIC_ASSINATURAS_VIRAM_CONTAS !== '1') return []
    const { data: abertas } = await supabase.from('bill').select('detalhe').eq('pago', false).not('detalhe', 'is', null)
    const comConta = new Set((abertas ?? []).map((b) => (b.detalhe as { empresa_chave?: string } | null)?.empresa_chave).filter(Boolean))
    const proxima = (d: string, anual: boolean) => {
      const x = new Date(`${d}T12:00:00`)
      x.setMonth(x.getMonth() + (anual ? 12 : 1))
      return x.toISOString().slice(0, 10)
    }
    return empresasLinhas
      .filter((e) => (e.tipo === 'assinatura' || e.tipo === 'recorrente') && !!e.ultimaData && !comConta.has(e.chave))
      .map((e) => {
        const anual = e.periodicidade === 'anual'
        return {
          chave: e.chave,
          nome: e.nome,
          valor: anual ? (e.valorAnual ?? e.mediaMensal * 12) : e.ultimoValor || e.mediaMensal,
          vencimento: proxima(e.ultimaData, anual),
          periodicidade: (anual ? 'anual' : 'mensal') as 'mensal' | 'anual',
          cartaoId: e.cartaoId,
        }
      })
      .filter((i) => i.valor > 0)
  })()

  // Contas anuais (seguros, IPVA, anuidades) para o painel de próximas renovações.
  const { data: anuaisData } = await supabase
    .from('bill')
    .select('*')
    .eq('periodicidade', 'anual')
    .eq('recorrente', true)

  return (
    <main className="w-full flex-1 px-5 py-8 md:px-8 lg:px-10">
      <SincronizarAssinaturas itens={assinaturasSemConta} />
      <AvisoVisao nomePessoa={visao.nomePessoa} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Contas a pagar</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Compromissos recorrentes e parcelados — o que sai da conta, agora e nos próximos meses.
      </p>

      <div className="mt-6">
        <Abas ocultarBarraNoDesktop
          abas={[
            {
              id: 'contas',
              rotulo: 'Contas',
              conteudo: (
                <>
                      <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:items-stretch">
                      {/* Âncora única do mês: tudo abaixo (indicadores e listas) se refere a ele */}
                      <section className={`${cartao} flex h-full flex-col gap-4 border-2 border-militar-600/40 dark:border-militar-700/60`}>
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={linkMes(mesAnteriorSel)}
                            scroll={false}
                            aria-label={`Ver ${nomeMes(mesAnteriorSel)}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            ‹
                          </Link>
                          <div className="min-w-0 text-center">
                            <h2 className="inline-block rounded-xl bg-militar-600 px-5 py-1.5 text-xl font-bold tracking-tight text-white shadow-sm sm:text-2xl">{maiuscula(nomeMesSel)}</h2>
                            <p className="mt-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              {ehMesAtual ? 'mês atual' : mesSel > inicioMes ? 'mês futuro' : 'mês anterior'}
                              {!ehMesAtual && (
                                <>
                                  {' · '}
                                  <Link
                                    href={linkMes(inicioMes)}
                                    scroll={false}
                                    className="font-medium text-militar-700 hover:underline dark:text-militar-500"
                                  >
                                    voltar pro mês atual
                                  </Link>
                                </>
                              )}
                            </p>
                          </div>
                          <Link
                            href={linkMes(mesSeguinteSel)}
                            scroll={false}
                            aria-label={`Ver ${nomeMes(mesSeguinteSel)}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            ›
                          </Link>
                        </div>

                        <div className="grid flex-1 grid-cols-5 gap-2 p-0.5">
                          {mesesChips.map((m) => {
                            const r = resumoPorMes.get(m)
                            const ativo = m === mesSel
                            return (
                              <Link
                                key={m}
                                href={linkMes(m)}
                                scroll={false}
                                aria-current={ativo ? 'page' : undefined}
                                className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-xs transition ${
                                  ativo
                                    ? 'border-militar-700 bg-militar-600 text-white shadow-md ring-2 ring-militar-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
                                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
                                }`}
                              >
                                <span className="text-sm font-semibold capitalize">
                                  {nomeMesCurto(m)}
                                  {m.slice(0, 4) !== inicioMes.slice(0, 4) ? ` ${m.slice(2, 4)}` : ''}
                                </span>
                                <span className={`truncate text-[11px] font-semibold tabular-nums ${ativo ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'}`}>
                                  {r && r.valor > 0 ? brl.format(r.valor).replace(/,\d{2}$/, '') : '—'}
                                </span>
                                <span className={`text-[10px] ${ativo ? 'text-white/80' : r && r.abertas > 0 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                                  {!r ? 'vazio' : r.abertas > 0 ? `${r.abertas} em aberto` : 'tudo pago'}
                                </span>
                              </Link>
                            )
                          })}
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                          <FiltroMes
                            atual={mesSel}
                            meses={mesesNav.map((m) => ({ valor: m, rotulo: maiuscula(nomeMes(m)), href: linkMes(m) }))}
                          />
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Cada conta fica no mês do próprio vencimento.</span>
                        </div>
                      </section>

                      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
                        <div className={`${cartao} flex flex-col justify-center !py-4`}>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">A pagar no mês</p>
                          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                            {brl.format(totalAbertoMes)}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {nAbertasMes} conta{nAbertasMes === 1 ? '' : 's'} em aberto
                          </p>
                          {abertasMes.some((b) => ehLembrete(b)) && (
                            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                              + {brl.format(abertasMes.filter((b) => ehLembrete(b)).reduce((t, b) => t + Number(b.valor), 0))} em cobranças no cartão (lembrete)
                            </p>
                          )}
                        </div>
                        <div className={`${cartao} flex flex-col justify-center !py-4`}>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Parcelas em aberto</p>
                          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                            {brl.format(totalFaltante)}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {compras.length} compra{compras.length === 1 ? '' : 's'} · {brl.format(parcelaMensal)}/mês nas faturas
                          </p>
                        </div>
                        <div className={`${cartao} flex flex-col justify-center !py-4`}>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Pago no mês</p>
                          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                            {brl.format(totalPagoMes)}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {nPagasMes} de {nContasMes} conta{nContasMes === 1 ? '' : 's'} · de {brl.format(totalMes)}
                          </p>
                          {contasMes.length > 0 && (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                              <div className="h-full rounded-full bg-militar-600" style={{ width: `${totalMes > 0 ? Math.round((totalPagoMes / totalMes) * 100) : 0}%` }} />
                            </div>
                          )}
                        </div>
                      </section>
                      </div>
                  {(() => {
                    const nSit = (k: string) => contasMesSemFiltro.filter((b) => (k === 'paga' ? b.pago : k === 'aberto' ? !b.pago : !b.pago && b.vencimento < hoje)).length
                    const nForma = (k: string) => contasMesSemFiltro.filter((b) => formaDe(b) === k).length
                    const cats = new Map<string, { nome: string; n: number; valor: number }>()
                    for (const b of contasMesSemFiltro) {
                      const c = Array.isArray(b.category) ? b.category[0] : b.category
                      const k = c?.id ?? 'sem'
                      const a = cats.get(k) ?? { nome: c?.nome ?? 'Sem categoria', n: 0, valor: 0 }
                      a.n++
                      a.valor += Number(b.valor)
                      cats.set(k, a)
                    }
                    const FORMAS: [string, string][] = [
                      ['cartao', 'Cartão de crédito'],
                      ['debito', 'Débito em conta'],
                      ['pix', 'Pix'],
                      ['outro', 'Boleto / outros'],
                    ]
                    const SITS: [string, string][] = [
                      ['aberto', 'Em aberto'],
                      ['atrasada', 'Atrasadas'],
                      ['paga', 'Pagas'],
                    ]
                    const formas = FORMAS.filter(([k]) => nForma(k) > 0)
                    const catsOrd = Array.from(cats.entries()).sort((a, b) => b[1].valor - a[1].valor)
                    // etiquetas do que está filtrado (clicar no ✕ remove só aquele filtro)
                    const ativos = [
                      fSituacao && { rotulo: SITS.find(([k]) => k === fSituacao)?.[1] ?? fSituacao, tirar: urlCom('contas', { st: null }) },
                      fForma && { rotulo: FORMAS.find(([k]) => k === fForma)?.[1] ?? fForma, tirar: urlCom('contas', { forma: null }) },
                      fCategoria && { rotulo: cats.get(fCategoria)?.nome ?? 'Categoria', tirar: urlCom('contas', { cat: null }) },
                    ].filter(Boolean) as { rotulo: string; tirar: string }[]
                    return (
                      <details open={ativos.length > 0} className={`group/f ${cartao} mb-6 !p-0`}>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 text-neutral-500">
                              <path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                            Filtrar
                          </span>
                          {ativos.length === 0 ? (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              situação · forma de pagamento · categoria — {contasMesSemFiltro.length} conta{contasMesSemFiltro.length === 1 ? '' : 's'} no mês
                            </span>
                          ) : (
                            <>
                              {ativos.map((a) => (
                                <Link
                                  key={a.rotulo}
                                  href={a.tirar}
                                  scroll={false}
                                  className="inline-flex items-center gap-1 rounded-full bg-militar-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-militar-500"
                                  aria-label={`Tirar filtro ${a.rotulo}`}
                                >
                                  {a.rotulo} <span aria-hidden="true">✕</span>
                                </Link>
                              ))}
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                {contasMes.length} de {contasMesSemFiltro.length} contas
                              </span>
                              <Link href={urlCom('contas', { st: null, forma: null, cat: null })} scroll={false} className="text-xs font-semibold text-militar-700 hover:underline dark:text-militar-400">
                                limpar
                              </Link>
                            </>
                          )}
                          <span className="ml-auto text-xs text-neutral-400 transition group-open/f:rotate-180" aria-hidden="true">
                            ▾
                          </span>
                        </summary>
                        <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
                          <Chips
                            titulo="Situação"
                            opcoes={[
                              { rotulo: 'Todas', href: urlCom('contas', { st: null }), ativo: !fSituacao },
                              ...SITS.filter(([k]) => nSit(k) > 0 || fSituacao === k).map(([k, r]) => ({ rotulo: r, nota: String(nSit(k)), href: urlCom('contas', { st: k }), ativo: fSituacao === k })),
                            ]}
                          />
                          {(formas.length > 1 || fForma) && (
                            <Chips
                              titulo="Pagamento"
                              opcoes={[
                                { rotulo: 'Todas', href: urlCom('contas', { forma: null }), ativo: !fForma },
                                ...formas.map(([k, r]) => ({ rotulo: r, nota: String(nForma(k)), href: urlCom('contas', { forma: k }), ativo: fForma === k })),
                              ]}
                            />
                          )}
                          {(catsOrd.length > 1 || fCategoria) && (
                            <Chips
                              titulo="Categoria"
                              limite={7}
                              opcoes={[
                                { rotulo: 'Todas', href: urlCom('contas', { cat: null }), ativo: !fCategoria },
                                ...catsOrd.map(([k, c]) => ({ rotulo: c.nome, nota: brl.format(c.valor), href: urlCom('contas', { cat: k }), ativo: fCategoria === k })),
                              ]}
                            />
                          )}
                          {ativos.length > 0 && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Os indicadores e as listas abaixo mostram só o que passa no filtro. O filtro continua ao trocar de mês.</p>
                          )}
                        </div>
                      </details>
                    )
                  })()}

                  {atrasadasAnteriores.length > 0 && (
                    <section className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-6 dark:border-red-900 dark:bg-red-950/20">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-semibold text-red-800 dark:text-red-300">Atrasadas de meses anteriores</h2>
                        <span className="text-sm font-semibold tabular-nums text-red-800 dark:text-red-300">
                          {brl.format(totalAtrasadas)}
                        </span>
                      </div>
                      <div className="mt-2 divide-y divide-red-100 dark:divide-red-900/50">
                        {atrasadasAnteriores.map(linhaAberta)}
                      </div>
                    </section>
                  )}

                  {contasParaTrazer.length > 0 && (
                    <section className={`${cartao} mb-6`}>
                      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {contasMes.length === 0
                          ? `${maiuscula(nomeMesSel)} ainda não tem contas`
                          : `Faltam ${contasParaTrazer.length} conta${contasParaTrazer.length === 1 ? '' : 's'} de ${nomeMes(mesAnteriorSel)}`}
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Traga a lista de {nomeMes(mesAnteriorSel)} pra {nomeMesSel}: você só ajusta os valores que mudaram e
                        confirma. Contas que já existem neste mês ficam de fora, então nada se duplica.
                      </p>
                      <ReplicarMesAnterior
                        contas={contasParaTrazer.map((b) => ({
                          id: b.id,
                          descricao: b.descricao,
                          valor: Number(b.valor),
                          vencimento: b.vencimento,
                          recorrente: b.recorrente,
                          debito_automatico: b.debito_automatico,
                          account_id: b.account_id,
                          category_id: b.category_id,
                          linhagem_id: b.linhagem_id,
                          cartao_id: b.cartao_id,
                          responsavel_id: b.responsavel_id,
                        }))}
                        mesAlvo={mesSel}
                        action={replicarContas}
                        rotuloBotao={`Trazer contas de ${nomeMes(mesAnteriorSel)}`}
                        inicialAberto={false}
                      />
                    </section>
                  )}

                  <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
                    <section className={cartao}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Em aberto</h2>
                        <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                          {brl.format(totalAbertoMes)}
                        </span>
                      </div>
                      <div className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {abertasMes.map(linhaAberta)}
                        {abertasMes.length === 0 && (
                          <p className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                            {contasMes.length > 0 ? 'Tudo pago neste mês.' : 'Nenhuma conta neste mês.'}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 border-t border-neutral-100 pt-3 text-right dark:border-neutral-800">
                        <Link
                          href={linkMes(mesSeguinteSel)}
                          scroll={false}
                          className="text-sm font-medium text-militar-700 hover:underline dark:text-militar-500"
                        >
                          Preparar {nomeMes(mesSeguinteSel)} →
                        </Link>
                      </div>
                    </section>

                    <section className={cartao}>
                      <RecolhivelCelular
                        resumo={
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {pagasExtras.length === 0 ? 'Pagas' : 'Pagas (vários meses)'}
                              <span className="ml-1.5 text-xs font-normal text-neutral-400">{gruposPagas.reduce((t, g) => t + g.contas.length, 0)}</span>
                            </span>
                            <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{brl.format(totalPagasListadas)}</span>
                          </span>
                        }
                      >

                      {mesesComPagas.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">Incluir outros meses</p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-militar-600 bg-militar-600 px-3 py-1 text-xs font-semibold text-white">
                              Este mês
                            </span>
                            {mesesComPagas.map((m) => {
                              const incluido = pagasExtras.includes(m)
                              const novos = incluido ? pagasExtras.filter((x) => x !== m) : [...pagasExtras, m]
                              return (
                                <Link
                                  key={m}
                                  href={linkMes(mesSel, novos)}
                                  scroll={false}
                                  aria-pressed={incluido}
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    incluido
                                      ? 'border-militar-600 bg-militar-50 text-militar-700 dark:bg-militar-600/20 dark:text-militar-400'
                                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  {incluido ? '✓ ' : '+ '}
                                  {maiuscula(nomeMesCurto(m))} {m.slice(2, 4)}
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {gruposPagas.map((g) => {
                        const subtotal = g.contas.reduce((t, b) => t + Number(b.valor), 0)
                        return (
                          <div key={g.mes} className="mt-4">
                            {gruposPagas.length > 1 && (
                              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                                <span>{nomeMes(g.mes)}</span>
                                <span className="tabular-nums normal-case">{brl.format(subtotal)}</span>
                              </div>
                            )}
                            <ListaRecolhivel rotulo="contas pagas">
                              {g.contas.map((b) => {
                                const responsavel = Array.isArray(b.responsavel) ? b.responsavel[0] : b.responsavel
                                const categoriaB = Array.isArray(b.category) ? b.category[0] : b.category
                                return (
                                  <div key={b.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm text-neutral-500 line-through dark:text-neutral-400">
                                        {b.descricao}
                                      </p>
                                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                                        {ehLembrete(b) ? 'renovado (lembrete, não soma)' : b.debito_automatico ? 'débito confirmado' : 'paga'}{' '}
                                        {b.pago_em ? formatarData(b.pago_em) : ''}
                                        {responsavel ? ` · ${responsavel.apelido || responsavel.nome}` : ''}
                                        {categoriaB ? ` · ${categoriaB.nome}` : ''}
                                      </p>
                                    </div>
                                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                                      <span className="text-sm tabular-nums text-neutral-400 dark:text-neutral-500">{brl.format(b.valor)}</span>
                                      <MoverContaMes id={b.id} vencimento={b.vencimento} discreto />
                                    </span>
                                  </div>
                                )
                              })}
                              {g.contas.length === 0 && (
                                <p className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                                  Nada pago em {nomeMes(g.mes)} ainda.
                                </p>
                              )}
                            </ListaRecolhivel>
                          </div>
                        )
                      })}
                      </RecolhivelCelular>
                    </section>
                  </div>

                  <div className="mt-6">
                    <RenovacoesAnuais contas={(anuaisData ?? []) as ContaAnual[]} hoje={new Date().toISOString().slice(0, 10)} />
                  </div>

                  <div className="mt-6">
                    <BlocoAdicionar titulo="+ Nova conta a pagar" descricao="Aluguel, condomínio, escola, assinatura… — mensal, anual ou única.">
                    <FormularioComRascunho
                      chave="rascunho:conta-a-pagar"
                      action={criarConta}
                      className="flex flex-col gap-3"
                    >
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
                        <input name="descricao" required placeholder="ex: Condomínio, luz" className={campo} />
                      </label>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
                          <CampoMoeda
                            name="valor"
                            required
                            placeholder="0"
                            className={`${campo} w-32 text-right tabular-nums`}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Vencimento (define o mês)</span>
                          <input type="date" name="vencimento" required defaultValue={vencimentoPadrao} className={campo} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Categoria</span>
                          <select name="category_id" className={campo} defaultValue="">
                            <option value="">Sem categoria</option>
                            {categoriasDespesa.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Repete</span>
                          <select name="repeticao" className={campo} defaultValue="mensal">
                            <option value="nao">Não repete</option>
                            <option value="mensal">Todo mês</option>
                            <option value="anual">Todo ano (IPVA, IPTU, seguro…)</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">De quem</span>
                          <select
                            name="responsavel_id"
                            className={campo}
                            defaultValue={visao.pessoa === 'todos' ? '' : visao.pessoa}
                          >
                            {membrosVisao.map((m) => (
                              <option key={m.id} value={m.id}>
                                {primeiroNome(m.nome)}
                              </option>
                            ))}
                            <option value="">{ROTULO_COMPARTILHADO} (compartilhada)</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Cartão</span>
                          <select name="cartao_id" className={campo} defaultValue="">
                            <option value="">Não é cartão / não sei</option>
                            {cartoes
                              .filter((c) => c.ativo)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {rotuloCartao(c)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <input type="checkbox" name="debito_automatico" /> Débito automático
                        </label>
                        <BotaoEnviar className={botao} enviando="Adicionando…">
                          Adicionar
                        </BotaoEnviar>
                      </div>
                    </FormularioComRascunho>
                    </BlocoAdicionar>
                  </div>
                </>
              ),
            },
            {
              id: 'cartoes',
              rotulo: 'Cartões',
              conteudo: (
                <>
                <FaixaKpis
                  itens={(() => {
                    const ativos = cartoes.filter((c) => c.ativo && (c.tipo === 'fisico' || c.tipo === 'virtual'))
                    const cancelados = cartoes.filter((c) => !c.ativo && (c.tipo === 'fisico' || c.tipo === 'virtual')).length
                    const faturas = contasMes.filter((b) => {
                      const cat = Array.isArray(b.category) ? b.category[0] : b.category
                      return /cart[aã]o/i.test(`${cat?.nome ?? ''} ${b.descricao}`) && !ehLembrete(b)
                    })
                    const totalFaturas = faturas.reduce((t, b) => t + Number(b.valor), 0)
                    const recorrentes = empresasLinhas.filter((e) => e.tipo === 'assinatura' || e.tipo === 'recorrente')
                    return [
                      { rotulo: 'Faturas do mês', valor: brl.format(totalFaturas), nota: `${faturas.length} fatura${faturas.length === 1 ? '' : 's'} em ${nomeMesSel}` },
                      { rotulo: 'Cartões ativos', valor: String(ativos.length), nota: cancelados ? `${cancelados} cancelado${cancelados === 1 ? '' : 's'}` : 'nenhum cancelado' },
                      { rotulo: 'Recorrentes nos cartões', valor: `${brl.format(recorrentes.reduce((t, e) => t + e.mediaMensal, 0))}/mês`, nota: `${recorrentes.length} assinaturas e cobranças fixas` },
                      { rotulo: 'Parcelas nas faturas', valor: `${brl.format(parcelaMensal)}/mês`, nota: `saldo ${brl.format(totalFaltante)}` },
                    ]
                  })()}
                />
                <section className={`${cartao} mb-6 !py-4`}>
                  <Chips
                    titulo="Cartões"
                    opcoes={[
                      { rotulo: 'Todos', href: urlCom('cartoes', { cs: null }), ativo: !fCartaoStatus },
                      { rotulo: 'Só ativos', nota: String(cartoes.filter((c) => c.ativo).length), href: urlCom('cartoes', { cs: 'ativos' }), ativo: fCartaoStatus === 'ativos' },
                      { rotulo: 'Cancelados', nota: String(cartoes.filter((c) => !c.ativo).length), href: urlCom('cartoes', { cs: 'cancelados' }), ativo: fCartaoStatus === 'cancelados' },
                    ]}
                  />
                </section>
                <AbaCartoes
                  faturasCredito={((faturasCreditoData.data ?? []) as { id: string; instituicao: string | null; vencimento: string | null; credito: FaturaCredito['credito'] }[]).map((f) => ({ docId: f.id, instituicao: f.instituicao, vencimento: f.vencimento, credito: f.credito }))}
                  cartoes={fCartaoStatus === 'ativos' ? cartoes.filter((c) => c.ativo) : fCartaoStatus === 'cancelados' ? cartoes.filter((c) => !c.ativo) : cartoes}
                  contas={((contasComCartaoData.data ?? []) as (ContaNoCartao & { responsavel_id: string | null })[]).filter(
                    (c) => contaVisivel(c),
                  )}
                  membros={membros.data ?? []}
                  empresas={empresasLinhas}
                />
                </>
              ),
            },
            {
              id: 'assinaturas',
              rotulo: 'Assinaturas',
              conteudo: (
                <CentralAssinaturas
                  classe={typeof parametros.classe === 'string' ? parametros.classe : 'todas'}
                  banco={fBancoAssinatura}
                  empresas={empresasLinhas}
                  cartoes={cartoes}
                />
              ),
            },
            {
              id: 'historico',
              rotulo: 'Histórico',
              // lembretes (renovação cobrada no cartão) não entram no balanço: o valor já está na fatura
              conteudo: <HistoricoContas itens={itensHistoricoContas.filter((i) => !i.lembrete)} />,
            },
            {
              id: 'parcelas',
              rotulo: 'Parcelas',
              conteudo: (
                <>
                <FaixaKpis
                  itens={(() => {
                    const maxFaltam = compras.reduce((m, c) => Math.max(m, c.parcela_total - c.parcela_num), 0)
                    const fim = deslocarMes(inicioMes, maxFaltam)
                    const maior = [...compras].sort((a, b) => b.valor * (b.parcela_total - b.parcela_num) - a.valor * (a.parcela_total - a.parcela_num))[0]
                    return [
                      { rotulo: 'Saldo a pagar', valor: brl.format(totalFaltante), nota: `${compras.length} compra${compras.length === 1 ? '' : 's'} parcelada${compras.length === 1 ? '' : 's'} em aberto` },
                      { rotulo: 'Parcelas por mês', valor: brl.format(parcelaMensal), nota: 'peso mensal nas faturas' },
                      { rotulo: 'Maior saldo', valor: maior ? brl.format(maior.valor * (maior.parcela_total - maior.parcela_num)) : '—', nota: maior ? `${maior.descricao.slice(0, 28)} · ${maior.parcela_num}/${maior.parcela_total}` : undefined },
                      { rotulo: 'Tudo quitado em', valor: maxFaltam ? maiuscula(nomeMes(fim)) : '—', nota: maxFaltam ? `última parcela daqui a ${maxFaltam} mes${maxFaltam === 1 ? '' : 'es'}` : 'nenhuma parcela em aberto' },
                    ]
                  })()}
                />
                <section className={`${cartao} mb-6 flex flex-col gap-2 !py-4`}>
                  <Chips
                    titulo="Banco"
                    opcoes={[
                      { rotulo: 'Todos', href: urlCom('parcelas', { pb: null }), ativo: !fBancoParcela },
                      ...bancosParcelas.map((b) => {
                        const l = parcelasTodas.compras.filter((c) => (c.banco ?? 'Sem banco') === b)
                        return { rotulo: b, nota: brl.format(l.reduce((t, c) => t + c.valor * (c.parcela_total - c.parcela_num), 0)), href: urlCom('parcelas', { pb: b }), ativo: fBancoParcela === b }
                      }),
                    ]}
                  />
                  <Chips
                    titulo="Prazo"
                    opcoes={[
                      { rotulo: 'Todas', href: urlCom('parcelas', { pfim: null }), ativo: !fFimParcela },
                      { rotulo: 'Terminam em até 3 meses', href: urlCom('parcelas', { pfim: '3' }), ativo: fFimParcela === '3' },
                      { rotulo: 'Terminam em até 6 meses', href: urlCom('parcelas', { pfim: '6' }), ativo: fFimParcela === '6' },
                    ]}
                  />
                  {filtroParcelasAtivo && (
                    <p className="text-xs text-militar-800 dark:text-militar-300">
                      Filtro ativo ·{' '}
                      <Link href={urlCom('parcelas', { pb: null, pfim: null })} scroll={false} className="font-semibold underline">
                        limpar filtros
                      </Link>
                    </p>
                  )}
                </section>
                <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
                  <section className={`${cartao} flex flex-col`}>
                    <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Projeção dos próximos 6 meses
                    </h2>
                    <div className="flex-1">
                      <GraficoBarras dados={mesesBarras} formatarValor={(v) => brl.format(v)} preencher />
                    </div>
                  </section>

                  <section className={cartao}>
                    <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Por cartão</h2>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Saldo a pagar das compras parceladas e o share de cada cartão. Toque num cartão para abrir as compras dele.
                    </p>
                    {contasOrdenadas.length === 0 ? (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Nenhuma compra parcelada em aberto no momento.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {contasOrdenadas.map(([conta, dados], i) => {
                          const doCartao = comprasPorConta.get(conta) ?? []
                          return (
                            <details key={conta} className="group py-1" open={i === 0 && contasOrdenadas.length === 1}>
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    <span className="text-neutral-400 transition group-open:rotate-90">▸</span>
                                    {conta}
                                  </span>
                                  <span className="ml-4 text-xs text-neutral-500 dark:text-neutral-400">
                                    {dados.qtd} compra{dados.qtd === 1 ? '' : 's'} · {brl.format(dados.mensal)}/mês
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-0.5">
                                  <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                                    {brl.format(dados.valor)}
                                  </span>
                                  <BarraShare pct={totalFaltante > 0 ? (dados.valor / totalFaltante) * 100 : 0} destaque={i === 0} />
                                </span>
                              </summary>
                              <div className="mb-2 ml-4 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
                                <ListaRecolhivel rotulo="compras">
                                  {doCartao.map((c, j) => {
                                    const restante = c.valor * (c.parcela_total - c.parcela_num)
                                    return (
                                      <div key={j} className="flex items-center justify-between gap-3 py-2">
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm text-neutral-800 dark:text-neutral-200">{c.descricao}</span>
                                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {c.parcela_num}/{c.parcela_total} · {brl.format(c.valor)}/mês
                                          </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                                          <span className="text-sm tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(restante)}</span>
                                          <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                                            {dados.valor > 0 ? Math.round((restante / dados.valor) * 100) : 0}% do cartão ·{' '}
                                            {totalFaltante > 0 ? Math.round((restante / totalFaltante) * 100) : 0}% do total
                                          </span>
                                        </span>
                                      </div>
                                    )
                                  })}
                                </ListaRecolhivel>
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  <section className={cartao}>
                    <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Por empresa</h2>
                    <p className="mb-3 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Agrupado pelo início da descrição no extrato — pode juntar compras diferentes da mesma empresa.
                    </p>
                    <TabelaOrdenavel
                      rotulo="empresas"
                      vazio="Nada em aberto."
                      ordemInicial={{ chave: 'falta', direcao: 'desc' }}
                      colunas={[
                        { chave: 'empresa', rotulo: 'Empresa' },
                        { chave: 'qtd', soma: 'num', rotulo: 'Compras', alinhar: 'dir', ocultarNoCelular: true },
                        { chave: 'falta', soma: 'brl', rotulo: 'Falta pagar', alinhar: 'dir' },
                        { chave: 'share', rotulo: 'Share', alinhar: 'dir' },
                      ]}
                      linhas={empresasOrdenadas.map(([empresa, valor]) => {
                        const share = totalFaltante > 0 ? (valor / totalFaltante) * 100 : 0
                        const qtd = qtdPorEmpresa.get(empresa) ?? 0
                        return {
                          id: empresa,
                          valores: { empresa, qtd, falta: valor, share },
                          celulas: {
                            empresa: <span className="font-medium text-neutral-900 dark:text-neutral-100">{empresa}</span>,
                            qtd: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{qtd}</span>,
                            falta: <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(valor)}</span>,
                            share: <BarraShare pct={share} />,
                          },
                        }
                      })}
                    />
                  </section>

                  <section className={`${cartao} lg:col-span-2`}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Compras parceladas em aberto</h2>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        saldo total a pagar {brl.format(totalFaltante)} · toque no título da coluna para ordenar
                      </span>
                    </div>
                    <TabelaOrdenavel
                      rotulo="compras"
                      vazio="Nada em aberto."
                      larguraMinima={0}
                      ordemInicial={{ chave: 'falta', direcao: 'desc' }}
                      colunas={[
                        { chave: 'compra', rotulo: 'Compra' },
                        { chave: 'cartao', rotulo: 'Cartão', ocultarNoCelular: true },
                        { chave: 'parcela', rotulo: 'Parcela', alinhar: 'dir', ocultarNoCelular: true, dica: 'Parcela atual / total' },
                        { chave: 'mensal', soma: 'brl', rotulo: 'Valor/mês', alinhar: 'dir', ocultarNoCelular: true },
                        { chave: 'restantes', soma: 'num', rotulo: 'Faltam', alinhar: 'dir', ocultarNoCelular: true, dica: 'Parcelas que ainda faltam' },
                        { chave: 'falta', soma: 'brl', rotulo: 'Falta pagar', alinhar: 'dir' },
                        { chave: 'share', rotulo: 'Share', alinhar: 'dir', ocultarNoCelular: true },
                      ]}
                      linhas={comprasOrdenadas.map((c, i) => {
                        const restantes = c.parcela_total - c.parcela_num
                        const falta = c.valor * restantes
                        const share = totalFaltante > 0 ? (falta / totalFaltante) * 100 : 0
                        return {
                          id: `${c.descricao}-${c.contaNome}-${i}`,
                          valores: { compra: c.descricao, cartao: c.contaNome, parcela: c.parcela_num / c.parcela_total, mensal: c.valor, restantes, falta, share },
                          celulas: {
                            compra: (
                              <span className="block min-w-0">
                                <span className="block max-w-[16rem] truncate font-medium text-neutral-900 sm:max-w-[22rem] dark:text-neutral-100">{c.descricao}</span>
                                <span className="text-xs text-neutral-500 sm:hidden dark:text-neutral-400">
                                  {c.contaNome} · {c.parcela_num}/{c.parcela_total} · {brl.format(c.valor)}/mês · {Math.round(share)}%
                                </span>
                              </span>
                            ),
                            cartao: <span className="text-neutral-600 dark:text-neutral-300">{c.contaNome}</span>,
                            parcela: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{c.parcela_num}/{c.parcela_total}</span>,
                            mensal: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{brl.format(c.valor)}</span>,
                            restantes: <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{restantes}</span>,
                            falta: <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(falta)}</span>,
                            share: <BarraShare pct={share} />,
                          },
                        }
                      })}
                    />
                  </section>
                </div>
                </>
              ),
            },
            {
              id: 'lancamentos',
              rotulo: 'Lançamentos',
              conteudo: (
                <AbaLancamentos
                  lancamentos={lancamentosDetalhe}
                  categorias={categoriasData.data ?? []}
                  contas={contasAtivasData.data ?? []}
                  hoje={hoje}
                  membros={membrosVisao}
                  pessoaInicial={visao.pessoa}
                />
              ),
            },
            {
              id: 'busca',
              rotulo: 'Busca',
              conteudo: <AbaBusca />,
            },
            {
              id: 'documentos',
              rotulo: 'Documentos',
              conteudo: (
                <>
                  <BuscarFaturasEmail ativo={emailConfigurado()} />
                  <AbaDocumentos documentos={documentosDetalhe} membros={membrosVisao} />
                </>
              ),
            },
          ]}
        />
      </div>

      <section className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Validação</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Sinaliza documentos com erro de processamento ou parados há dias sem confirmar. Não cruza
          o valor total da fatura com a soma dos lançamentos: faturas com compras parceladas
          costumam trazer, no mesmo documento, cobranças de meses diferentes (parcela já paga,
          cobrança atual e parcelas futuras projetadas), o que tornaria essa comparação pouco
          confiável.
        </p>

        {validacoes.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <span className="text-lg text-emerald-600 dark:text-emerald-400">✓</span>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Nenhum documento pendente ou com erro no momento.
            </p>
          </div>
        ) : (
          <div className="mt-4"><ListaRecolhivel rotulo="avisos" className="flex flex-col gap-3">
            {validacoes.map((v, i) => {
              const estilo =
                v.tipo === 'erro'
                  ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                  : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
              const corTexto =
                v.tipo === 'erro'
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-neutral-700 dark:text-neutral-300'
              const rotuloTipo = v.tipo === 'erro' ? 'Erro' : 'Pendente'
              return (
                <div key={i} className={`rounded-xl border px-5 py-4 ${estilo}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${corTexto}`}>{v.titulo}</p>
                    <span className={`shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium ${corTexto} dark:bg-black/20`}>
                      {rotuloTipo}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{v.descricao}</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Sugestão: {v.recomendacao}</p>
                </div>
              )
            })}
          </ListaRecolhivel></div>
        )}
      </section>
    </main>
  )
}
