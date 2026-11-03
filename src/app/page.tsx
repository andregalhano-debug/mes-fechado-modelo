import { createClient } from '@/lib/supabase/server'
import { idsLembrete } from '@/lib/lembrete'
import { obterVisao } from '@/lib/pessoa'
import { AvisoVisao } from '@/components/aviso-visao'
import { Insights } from '@/components/insights'
import type { DesvioCategoria, ItemDesvio, MaiorGasto } from './desvios'
import { comprasParceladasEmAberto, type LinhaParcela } from '@/lib/parcelas'
import { cookies } from 'next/headers'
import { COOKIE_PERIODO, nomeMesCurto, noPeriodo, resolverPeriodo } from '@/lib/periodo'
import type { DocumentoResumo } from './resumo-documentos'
import { PainelPrincipal } from './painel-principal'
import type { FatiaPizza } from '@/components/grafico-pizza'
import type { Barra } from '@/components/grafico-barras'

const CORES_CATEGORIA = ['#6b7a2e', '#b45309', '#1d4ed8', '#be123c', '#7c3aed', '#0f766e', '#0891b2', '#ca8a04']
const COR_OUTROS = '#78716c'

function inicioDoMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1).toISOString().slice(0, 10)
}

function chaveMes(data: string) {
  return data.slice(0, 7)
}

function empresaDe(descricao: string, canal: string | null): string {
  if (canal) return canal
  return descricao.trim().split(/\s+/)[0] || descricao
}

type LinhaTransacao = {
  id: string
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  data: string
  canal: string | null
  category: { id: string; nome: string } | { id: string; nome: string }[] | null
  account: { nome: string } | { nome: string }[] | null
}

type LinhaConta = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  category: { id: string; nome: string } | { id: string; nome: string }[] | null
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export default async function Painel() {
  const supabase = await createClient()

  const dozeMesesAtras = new Date()
  dozeMesesAtras.setMonth(dozeMesesAtras.getMonth() - 11)
  const inicioJanela = inicioDoMes(dozeMesesAtras)

  const [
    { data: transacoesBrutas },
    { data: billsRecorrentesTodas },
    { data: billsCategoriaTodas },
    { count: documentosAguardando },
    { data: cartoesTitular },
    { data: billsJanelaTodas },
    { data: tiposDocumento },
    { data: transacoesParceladas },
    { data: ultimosDocumentos },
  ] = await Promise.all([
    supabase
      .from('transaction')
      .select('id, descricao, valor, natureza, data, canal, member_id, document_id, category:category_id(id, nome), account:account_id(nome)')
      .gte('data', inicioJanela)
      .order('data', { ascending: false })
      .limit(2000),
    supabase
      .from('bill')
      .select('id, descricao, valor, vencimento, periodicidade, linhagem_id, responsavel_id, cartao_id')
      .eq('recorrente', true),
    // Contas a pagar do mês (aluguel, condomínio, Unimed...) pra entrar no "Gastos por
    // categoria" junto com os lançamentos de cartão/extrato — janela igual à das transações
    // pra cobrir também o mês de fallback quando o atual está incompleto.
    supabase
      .from('bill')
      .select('id, mes, descricao, valor, vencimento, responsavel_id, cartao_id, category:category_id(id, nome)')
      .gte('mes', inicioJanela),
    // Só a contagem — o detalhamento completo dos documentos mora em /contas-a-pagar agora.
    supabase.from('document').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_confirmacao'),
    supabase.from('cartao').select('id, titular_id'),
    // Contas a pagar por mês — base da visão gerencial (gráfico e resumo mês a mês).
    // Patrimônio NÃO é lido aqui: ele só aparece na tela Patrimônio (protegida).
    supabase.from('bill').select('id, mes, descricao, valor, vencimento, pago, responsavel_id, cartao_id').gte('mes', inicioJanela),
    supabase.from('document').select('id, tipo_detectado, vencimento:extracao->>vencimento, instituicao:extracao->>instituicao'),
    // Compras parceladas (mesma consulta da aba Parcelas) pro indicador "Parcelas em aberto".
    supabase
      .from('transaction')
      .select('descricao, valor, data, parcela_num, parcela_total, account_id, member_id, account:account_id(nome), document:document_id(vencimento:extracao->>vencimento, instituicao:extracao->>instituicao)')
      .eq('natureza', 'despesa')
      .not('parcela_total', 'is', null)
      .gt('parcela_total', 1)
      .order('data', { ascending: false }),
    // Últimos documentos (resumo na Visão geral).
    supabase
      .from('document')
      .select('id, nome_arquivo, origem, status, tipo_detectado, criado_em, erro, enviado_por, instituicao:extracao->>instituicao, valor_total:extracao->>valor_total, vencimento:extracao->>vencimento')
      .order('criado_em', { ascending: false })
      .limit(30),
  ])

  // Contas "só lembrete" (renovação cobrada no cartão) não entram em nenhum total do Painel.
  const lembretes = await idsLembrete(supabase)
  const semLembrete = <T extends { id?: string }>(l: T[] | null) => (l ?? []).filter((b) => !b.id || !lembretes.has(b.id))
  const billsRecorrentesBrutas = semLembrete(billsRecorrentesTodas)
  const billsCategoriaBrutas = semLembrete(billsCategoriaTodas)
  const billsJanela = semLembrete(billsJanelaTodas)

  // -------- Visão por pessoa (seletor do menu) --------
  // Patrimônio pelo dono de cada item; lançamentos pelo dono da fatura; contas pelo "De quem"
  // (ou titular do cartão). Bens e itens sem dono são da família → só no Consolidado.
  const visao = await obterVisao(supabase)
  const titularCartao = new Map((cartoesTitular ?? []).map((c) => [c.id, c.titular_id as string | null]))
  const donoConta = (b: { responsavel_id?: string | null; cartao_id?: string | null }) =>
    b.responsavel_id ?? (b.cartao_id ? (titularCartao.get(b.cartao_id) ?? null) : null)
  const transacoes = (transacoesBrutas ?? []).filter((t) => visao.mostra(t.member_id))
  const billsRecorrentes = (billsRecorrentesBrutas ?? []).filter((b) => visao.mostra(donoConta(b)))
  const billsCategoria = (billsCategoriaBrutas ?? []).filter((b) => visao.mostra(donoConta(b)))

  const mesAtualIso = inicioDoMes()
  const mesAtualChave = chaveMes(mesAtualIso)
  const todasTransacoes = (transacoes as LinhaTransacao[] | null) ?? []
  const doMes = todasTransacoes.filter((t) => chaveMes(t.data) === mesAtualChave)

  const receitas = doMes.filter((t) => t.natureza === 'receita').reduce((t, x) => t + Number(x.valor), 0)
  const despesas = doMes.filter((t) => t.natureza === 'despesa').reduce((t, x) => t + Number(x.valor), 0)

  const semDados = todasTransacoes.length === 0 && (billsJanela ?? []).length === 0
  const mesReferencia = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // -------- Gasto consolidado por mês (base da pizza, das barras, dos desvios e das faturas) --------
  // Mesma regra das "Saídas do mês": a fatura de cartão entra INTEIRA no mês em que vence (todas
  // as compras e parcelas dela, cada uma com a sua categoria); as demais contas a pagar entram no
  // mês delas; e os lançamentos avulsos (fora de fatura) pela data. Assim a pizza consolida os
  // cartões e as contas, em vez de espalhar cada fatura pelos meses das compras.
  type ItemGasto = ItemDesvio & { categoria: string; fonte: string }
  const infoDoc = new Map(
    (tiposDocumento ?? []).map((d) => [
      d.id as string,
      d as { tipo_detectado: string | null; vencimento: string | null; instituicao: string | null },
    ]),
  )
  const nomeCategoria = (c: LinhaTransacao['category']) => (Array.isArray(c) ? c[0] : c)?.nome ?? 'Sem categoria'
  const itensPorMes = new Map<string, ItemGasto[]>()
  const adicionarGasto = (mes: string, item: ItemGasto) => {
    if (mes > mesAtualChave) return
    itensPorMes.set(mes, [...(itensPorMes.get(mes) ?? []), item])
  }
  for (const t of todasTransacoes as (LinhaTransacao & { document_id: string | null })[]) {
    if (t.natureza !== 'despesa') continue
    const doc = t.document_id ? infoDoc.get(t.document_id) : undefined
    const daFatura = doc?.tipo_detectado === 'fatura'
    adicionarGasto(chaveMes(daFatura && doc?.vencimento ? doc.vencimento : t.data), {
      descricao: t.descricao,
      data: t.data,
      valor: Number(t.valor),
      origem: 'lancamento',
      categoria: nomeCategoria(t.category),
      fonte: daFatura ? `Fatura ${doc?.instituicao ?? 'de cartão'}` : 'Lançamentos avulsos',
    })
  }
  // "Cartão Nubank/Bradesco/Itaú" é o pagamento da fatura: se a fatura do mês já foi importada,
  // os itens dela já estão acima; se ainda não foi, entra o valor da conta (sem detalhamento),
  // pra o total do mês não ficar faltando esse cartão.
  function ehFaturaDeCartao(descricao: string) {
    const d = normalizar(descricao)
    return d.includes('cartao') || d.includes('fatura')
  }
  const IGNORAR_CARTAO = new Set(['cartao', 'fatura', 'credito', 'de', 'do', 'da', 'visa', 'master', 'mastercard', 'black', 'platinum'])
  for (const b of (billsCategoria as (LinhaConta & { mes: string })[] | null) ?? []) {
    const mes = chaveMes(b.mes)
    const itensMes = itensPorMes.get(mes) ?? []
    if (ehFaturaDeCartao(b.descricao)) {
      const chaves = normalizar(b.descricao).split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !IGNORAR_CARTAO.has(p))
      const importada = itensMes.some((i) => i.fonte.startsWith('Fatura ') && chaves.some((c) => normalizar(i.fonte).includes(c)))
      if (importada) continue
      adicionarGasto(mes, {
        descricao: b.descricao,
        data: b.vencimento,
        valor: Number(b.valor),
        origem: 'conta',
        categoria: 'Fatura ainda não importada',
        fonte: b.descricao,
      })
      continue
    }
    // Conta paga por lançamento avulso já capturado (ex: TED do aluguel num extrato): não soma de novo.
    const alvo = normalizar(b.descricao)
    const jaLancada = itensMes.some((i) => i.fonte === 'Lançamentos avulsos' && (normalizar(i.descricao).includes(alvo) || alvo.includes(normalizar(i.descricao))))
    if (jaLancada) continue
    adicionarGasto(mes, {
      descricao: b.descricao,
      data: b.vencimento,
      valor: Number(b.valor),
      origem: 'conta',
      categoria: nomeCategoria(b.category),
      fonte: b.descricao,
    })
  }
  const totalPorMes = new Map(Array.from(itensPorMes.entries()).map(([m, itens]) => [m, itens.reduce((t, i) => t + i.valor, 0)]))

  // O mês corrente costuma estar incompleto (faturas ainda chegando). Pra não mostrar uma pizza
  // quase vazia, cai pro mês mais recente com gasto quando o atual está muito abaixo da média.
  const mesesAnterioresComDado = Array.from(totalPorMes.entries())
    .filter(([chave, valor]) => chave < mesAtualChave && valor > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
  const mediaTresUltimosComDado = (() => {
    const valores = mesesAnterioresComDado.slice(0, 3).map(([, v]) => v)
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
  })()
  const gastoMesAtual = totalPorMes.get(mesAtualChave) ?? 0
  const mesAtualIncompleto =
    mediaTresUltimosComDado > 0 && gastoMesAtual < mediaTresUltimosComDado * 0.3 && mesesAnterioresComDado.length > 0
  const mesParaGrafico = mesAtualIncompleto ? mesesAnterioresComDado[0][0] : mesAtualChave
  const itensDoGrafico = itensPorMes.get(mesParaGrafico) ?? []
  const mesReferenciaGrafico = (() => {
    const [ano, mes] = mesParaGrafico.split('-').map(Number)
    return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  })()

  // Pizza: gasto por categoria (top 8 + "Outras categorias"). Cada fatia abre mostrando de quais
  // faturas e contas aquele gasto veio (ex: Restaurante → Fatura Nubank, Fatura Itaú).
  const porCategoriaMapa = new Map<string, number>()
  const porCategoriaFonte = new Map<string, Map<string, number>>()
  for (const i of itensDoGrafico) {
    porCategoriaMapa.set(i.categoria, (porCategoriaMapa.get(i.categoria) ?? 0) + i.valor)
    const sub = porCategoriaFonte.get(i.categoria) ?? new Map<string, number>()
    sub.set(i.fonte, (sub.get(i.fonte) ?? 0) + i.valor)
    porCategoriaFonte.set(i.categoria, sub)
  }
  function detalhePorFonte(nomeCategoria: string) {
    const mapa = porCategoriaFonte.get(nomeCategoria)
    if (!mapa || mapa.size < 2) return undefined
    return Array.from(mapa.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([rotulo, valor]) => ({ rotulo, valor }))
  }
  const categoriasOrdenadas = Array.from(porCategoriaMapa.entries()).sort((a, b) => b[1] - a[1])
  const topCategorias = categoriasOrdenadas.slice(0, 8)
  const restoCategorias = categoriasOrdenadas.slice(8)
  const restoCategoriasTotal = restoCategorias.reduce((t, [, v]) => t + v, 0)
  const categorias: FatiaPizza[] = topCategorias.map(([nome, valor], i) => ({
    rotulo: nome,
    valor,
    cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
    detalhe: detalhePorFonte(nome),
  }))
  if (restoCategoriasTotal > 0) {
    categorias.push({
      rotulo: 'Outras categorias',
      valor: restoCategoriasTotal,
      cor: COR_OUTROS,
      detalhe: restoCategorias.map(([rotulo, valor]) => ({ rotulo, valor, detalhe: detalhePorFonte(rotulo) })),
    })
  }

  // -------- Desvios: gasto por categoria no mês de referência vs média dos 3 meses anteriores --------
  const gastoCatMes = new Map<string, Map<string, number>>()
  for (const [mes, itens] of itensPorMes) {
    const m = new Map<string, number>()
    for (const i of itens) m.set(i.categoria, (m.get(i.categoria) ?? 0) + i.valor)
    gastoCatMes.set(mes, m)
  }
  const itensCatRef = new Map<string, ItemDesvio[]>()
  for (const i of itensDoGrafico) {
    const { categoria, fonte, ...item } = i
    const rotulo = fonte === 'Lançamentos avulsos' || fonte === item.descricao ? item.descricao : `${item.descricao} · ${fonte}`
    itensCatRef.set(categoria, [...(itensCatRef.get(categoria) ?? []), { ...item, descricao: rotulo }])
  }
  const mesesBase = Array.from(gastoCatMes.keys())
    .filter((m) => m < mesParaGrafico)
    .sort()
    .slice(-3)
  const mesesHistorico = [...mesesBase, mesParaGrafico]
  const categoriasDesvio = new Set<string>()
  for (const m of mesesHistorico) for (const c of gastoCatMes.get(m)?.keys() ?? []) categoriasDesvio.add(c)
  const desvios: DesvioCategoria[] =
    mesesBase.length === 0
      ? []
      : Array.from(categoriasDesvio)
          .map((categoria) => {
            const historico = mesesHistorico.map((m) => gastoCatMes.get(m)?.get(categoria) ?? 0)
            const atual = historico[historico.length - 1]
            const media = historico.slice(0, -1).reduce((a, b) => a + b, 0) / mesesBase.length
            const desvio = atual - media
            return {
              categoria,
              atual,
              media,
              desvio,
              percentual: media > 0 ? (desvio / media) * 100 : null,
              historico,
              itens: (itensCatRef.get(categoria) ?? []).sort((a, b) => b.valor - a.valor),
            }
          })
          .filter((d) => Math.abs(d.desvio) >= 1)
          .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
  const maioresGastos: MaiorGasto[] = Array.from(itensCatRef.entries())
    .flatMap(([categoria, itens]) => itens.map((it) => ({ ...it, categoria })))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 40)

  const seisMesesAtras = new Date()
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5)
  const mesesBarras: Barra[] = []
  const cursorBarras = new Date(seisMesesAtras)
  for (let i = 0; i < 6; i++) {
    const chave = chaveMes(inicioDoMes(cursorBarras))
    mesesBarras.push({
      rotulo: cursorBarras.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      valor: totalPorMes.get(chave) ?? 0,
    })
    cursorBarras.setMonth(cursorBarras.getMonth() + 1)
  }

  // Histórico de fluxo (receita/despesa/saldo/poupança por mês) — o que a tela de Fechamento
  // mostrava antes. Aqui é sempre ao vivo, direto das transações, sem precisar de um botão
  // "fechar mês" nem de uma tabela snapshot separada.
  const porMesFluxo = new Map<string, { receitas: number; despesas: number }>()
  for (const t of todasTransacoes) {
    const chave = chaveMes(t.data)
    if (chave > mesAtualChave) continue // ignora parcela futura já projetada na fatura
    const atual = porMesFluxo.get(chave) ?? { receitas: 0, despesas: 0 }
    if (t.natureza === 'receita') atual.receitas += Number(t.valor)
    else atual.despesas += Number(t.valor)
    porMesFluxo.set(chave, atual)
  }
  const historicoFluxo = Array.from(porMesFluxo.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([mes, v]) => ({
      mes,
      receitas: v.receitas,
      despesas: v.despesas,
      saldo: v.receitas - v.despesas,
      poupanca: v.receitas > 0 ? ((v.receitas - v.despesas) / v.receitas) * 100 : null,
    }))

  // Faturas e contas do mês do gráfico: quanto cada fatura de cartão e cada conta pesa no total.
  const porFonteMapa = new Map<string, number>()
  for (const i of itensDoGrafico) porFonteMapa.set(i.fonte, (porFonteMapa.get(i.fonte) ?? 0) + i.valor)
  const empresasDoMes = Array.from(porFonteMapa.entries()).sort((a, b) => b[1] - a[1])

  // -------- Indicadores que antes só existiam em Fechamento --------
  // Conta recorrente paga clona a ocorrência do mês seguinte (ver pagarConta em
  // contas-a-pagar/actions.ts) — sem filtrar por mês, essa soma cresceria pra sempre a
  // cada mês pago, contando o mesmo compromisso várias vezes.
  // Contas anuais entram como 1/12 do valor da ocorrência mais recente — senão o mês do
  // IPVA/IPTU pareceria ter um comprometimento enorme e os outros 11, nenhum.
  const somaMensais = (billsRecorrentes ?? [])
    .filter((b) => b.periodicidade !== 'anual' && chaveMes(b.vencimento) === mesAtualChave)
    .reduce((t, b) => t + Number(b.valor), 0)
  const anualMaisRecente = new Map<string, { vencimento: string; valor: number }>()
  for (const b of billsRecorrentes ?? []) {
    if (b.periodicidade !== 'anual') continue
    const atual = anualMaisRecente.get(b.linhagem_id)
    if (!atual || b.vencimento > atual.vencimento) anualMaisRecente.set(b.linhagem_id, { vencimento: b.vencimento, valor: Number(b.valor) })
  }
  const somaAnuaisMensalizada = Array.from(anualMaisRecente.values()).reduce((t, b) => t + b.valor / 12, 0)
  const somaBillsRecorrentes = somaMensais + somaAnuaisMensalizada
  const comprometimentoRenda = receitas > 0 ? (somaBillsRecorrentes / receitas) * 100 : null

  // período de cada indicador (pra conferir de onde sai cada número)
  const mc = (m: string) => nomeMesCurto(m.slice(0, 7))
  const periodosIndicadores = {
    mes: `mês de ${mc(mesAtualChave)}`,
    fluxo: `mês de ${mc(mesAtualChave)}`,
    parcelas: `faturas a partir de ${mc(mesAtualChave)}`,
    comprometimento: `contas e receita de ${mc(mesAtualChave)}`,
  }

  const hojeIso = new Date().toISOString().slice(0, 10)
  // Na visão de uma pessoa: documentos que ela enviou ou cujos lançamentos são dela.
  const docsDaVisao = new Set(
    (todasTransacoes as (LinhaTransacao & { document_id: string | null })[]).map((t) => t.document_id).filter(Boolean) as string[],
  )
  const documentosResumo: DocumentoResumo[] = (
    (ultimosDocumentos ?? []) as {
      id: string
      nome_arquivo: string
      origem: string
      status: string
      tipo_detectado: string | null
      criado_em: string
      erro: string | null
      enviado_por: string | null
      instituicao: string | null
      valor_total: string | null
      vencimento: string | null
    }[]
  )
    .filter((d) => visao.pessoa === 'todos' || d.enviado_por === visao.pessoa || docsDaVisao.has(d.id))
    .map((d) => ({
      id: d.id,
      titulo: d.instituicao ? `${d.tipo_detectado === 'fatura' ? 'Fatura ' : ''}${d.instituicao}` : d.nome_arquivo,
      tipo: d.tipo_detectado,
      status: d.status,
      origem: d.origem,
      criadoEm: d.criado_em,
      vencimento: d.vencimento,
      valorTotal: d.valor_total !== null && d.valor_total !== '' && !Number.isNaN(Number(d.valor_total)) ? Number(d.valor_total) : null,
      erro: d.erro,
    }))
  const parcelasAbertas = comprasParceladasEmAberto((transacoesParceladas as LinhaParcela[] | null) ?? [], (dono) => visao.mostra(dono))
  // -------- Visão gerencial: séries mensais --------
  const somaPorMes = <T,>(lista: T[] | null, mesDe: (x: T) => string, valorDe: (x: T) => number, filtro: (x: T) => boolean = () => true) => {
    const m = new Map<string, number>()
    for (const x of lista ?? []) if (filtro(x)) m.set(mesDe(x).slice(0, 7), (m.get(mesDe(x).slice(0, 7)) ?? 0) + valorDe(x))
    return m
  }
  const periodoFiltro = resolverPeriodo((await cookies()).get(COOKIE_PERIODO)?.value)

  // Saídas do mês = contas a pagar do mês (inclui o pagamento das faturas de cartão) +
  // lançamentos AVULSOS (que não vieram de fatura de cartão). Os lançamentos das faturas não
  // entram de novo: o valor deles já está dentro da conta "Cartão X" — somar os dois contaria a
  // fatura duas vezes. O detalhe por categoria continua vindo dos lançamentos (pizza).
  const tipoDoc = new Map((tiposDocumento ?? []).map((d) => [d.id, d.tipo_detectado as string | null]))
  const contasVisiveis = (billsJanela ?? []).filter((x) => visao.mostra(donoConta(x)))
  const cartoesPorMes = somaPorMes(contasVisiveis, (x) => x.mes, (x) => Number(x.valor), (x) => ehFaturaDeCartao(x.descricao))
  const outrasPorMes = somaPorMes(contasVisiveis, (x) => x.mes, (x) => Number(x.valor), (x) => !ehFaturaDeCartao(x.descricao))
  const avulsosPorMes = somaPorMes(
    todasTransacoes as (LinhaTransacao & { document_id: string | null })[],
    (t) => t.data,
    (t) => Number(t.valor),
    (t) => t.natureza === 'despesa' && (!t.document_id || tipoDoc.get(t.document_id) !== 'fatura'),
  )
  const contasPorMes = new Map<string, number>()
  for (const [k, v] of [...cartoesPorMes, ...outrasPorMes]) contasPorMes.set(k, (contasPorMes.get(k) ?? 0) + v)
  // meses com acompanhamento de verdade: lançamentos/faturas ou 2+ contas no mês. Histórico antigo
  // de uma conta só (ex.: um seguro anual pago desde muitos anos atrás) não vira ponto solto no gráfico.
  const contasNoMes = new Map<string, number>()
  for (const c of contasVisiveis) contasNoMes.set(c.mes.slice(0, 7), (contasNoMes.get(c.mes.slice(0, 7)) ?? 0) + 1)
  const mesesFluxo = Array.from(new Set([...porMesFluxo.keys(), ...contasPorMes.keys()]))
    .filter((k) => k <= mesAtualChave)
    .filter((k) => porMesFluxo.has(k) || (contasNoMes.get(k.slice(0, 7)) ?? 0) >= 2)
    .sort()
    .slice(-12)
  const resumoGerencial = mesesFluxo.map((k) => {
    const lanc = porMesFluxo.get(k) ?? { receitas: 0, despesas: 0 }
    const gastoCartoes = cartoesPorMes.get(k) ?? 0
    const gastoOutras = outrasPorMes.get(k) ?? 0
    const gastoAvulsos = avulsosPorMes.get(k) ?? 0
    const gasto = gastoCartoes + gastoOutras + gastoAvulsos
    return {
      mes: k,
      emAndamento: k === mesAtualChave,
      receitas: lanc.receitas,
      gastoCartoes,
      gastoOutras,
      gastoAvulsos,
      gasto,
      saldo: lanc.receitas - gasto,
      poupanca: lanc.receitas > 0 ? ((lanc.receitas - gasto) / lanc.receitas) * 100 : null,
    }
  })

  // Próxima renovação anual (seguros, anuidades, assinaturas anuais — inclui as "só lembrete").
  const proximaRenovacao =
    (billsRecorrentesTodas ?? [])
      .filter((b) => b.periodicidade === 'anual' && b.vencimento >= hojeIso && visao.mostra(donoConta(b)))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .map((b) => ({ descricao: b.descricao as string, vencimento: b.vencimento as string, valor: Number(b.valor), lembrete: lembretes.has(b.id) }))[0] ?? null
  const contasMesAtual = contasVisiveis.filter((c) => c.mes.slice(0, 7) === mesAtualChave)
  const faturasMes = contasMesAtual.filter((c) => ehFaturaDeCartao(c.descricao))

  return (
    <main className="w-full px-5 py-8 md:px-8 md:py-8 lg:px-10">
      <AvisoVisao nomePessoa={visao.nomePessoa} />
      <PainelPrincipal
        resumoGerencial={resumoGerencial.filter((r) => noPeriodo(r.mes, periodoFiltro))}
        documentosResumo={documentosResumo}
        parcelas={{ total: parcelasAbertas.totalFaltante, mensal: parcelasAbertas.mensal, qtd: parcelasAbertas.compras.length }}
        desvios={desvios}
        maioresGastos={maioresGastos}
        mesesHistorico={mesesHistorico}
        mesReferenciaChave={mesParaGrafico}
        receitas={receitas}
        // Família: saídas do mês (contas, com as faturas inteiras). Uma pessoa: os gastos dela no mês
        // (itens das faturas dela + contas dela + avulsos) — as contas de cartão ficam como família.
        despesas={
          visao.pessoa === 'todos'
            ? (resumoGerencial.find((r) => r.mes === mesAtualChave)?.gasto ?? totalPorMes.get(mesAtualChave) ?? despesas)
            : (totalPorMes.get(mesAtualChave) ?? despesas)
        }
        semDados={semDados}
        periodosIndicadores={periodosIndicadores}
        mesReferencia={mesReferencia}
        categorias={categorias}
        mesReferenciaGrafico={mesReferenciaGrafico}
        mesAtualIncompleto={mesAtualIncompleto}
        mesesBarras={mesesBarras}
        historicoFluxo={historicoFluxo}
        empresasDoMes={empresasDoMes}
        comprometimentoRenda={comprometimentoRenda}
        faturasCartao={{ total: faturasMes.reduce((t, c) => t + Number(c.valor), 0), qtd: faturasMes.length, pagas: faturasMes.filter((c) => c.pago).length }}
        proximaRenovacao={proximaRenovacao}
        documentosAguardando={documentosAguardando ?? 0}
        aPagar={contasVisiveis
          .filter((c) => !c.pago && (c.mes.slice(0, 7) === mesAtualChave || (c.mes.slice(0, 7) < mesAtualChave && c.vencimento < hojeIso)))
          .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
          .map((c) => ({
            id: c.id,
            descricao: c.descricao,
            valor: Number(c.valor),
            vencimento: c.vencimento,
            atrasada: c.vencimento < hojeIso,
            mesAnterior: c.mes.slice(0, 7) < mesAtualChave,
          }))}
        contasDoMes={{
          total: contasVisiveis.filter((c) => c.mes.slice(0, 7) === mesAtualChave).reduce((t, c) => t + Number(c.valor), 0),
          pago: contasVisiveis.filter((c) => c.mes.slice(0, 7) === mesAtualChave && c.pago).reduce((t, c) => t + Number(c.valor), 0),
          qtd: contasVisiveis.filter((c) => c.mes.slice(0, 7) === mesAtualChave).length,
          qtdPagas: contasVisiveis.filter((c) => c.mes.slice(0, 7) === mesAtualChave && c.pago).length,
        }}
      />
      <div className="mt-8">
        <Insights />
      </div>
    </main>
  )
}
