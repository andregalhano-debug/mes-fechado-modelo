import type { SupabaseClient } from '@supabase/supabase-js'
import { obterVisao, type Visao } from '@/lib/pessoa'
import { primeiroNome, ROTULO_JUNTOS, ROTULO_COMPARTILHADO } from '@/lib/donos'

// Consultas SOMENTE LEITURA usadas pelo assistente e pelos insights.
// - Sempre com o cliente do usuário logado (RLS: só dados da família dele).
// - Respeitam a visão do menu (a casa toda ou cada pessoa).
// - Devolvem resumos enxutos: nada de ids internos, senhas, chaves ou números de cartão
//   (do cartão, no máximo o apelido e o final de 4 dígitos).

export type Contexto = {
  supabase: SupabaseClient
  visao: Visao
  cartaoPorId: Map<string, { nome: string; tipo: string; final: string | null; titular_id: string | null }>
  hoje: string
}

export async function criarContexto(supabase: SupabaseClient): Promise<Contexto> {
  const visao = await obterVisao(supabase)
  const { data: cartoes } = await supabase.from('cartao').select('id, nome, tipo, final, titular_id')
  return {
    supabase,
    visao,
    cartaoPorId: new Map((cartoes ?? []).map((c) => [c.id, c])),
    hoje: new Date().toISOString().slice(0, 10),
  }
}

const arred = (v: number) => Math.round(v * 100) / 100

export function mesAtual(ctx: Contexto) {
  return ctx.hoje.slice(0, 7)
}

export function deslocarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7)
}

function limitesDoMes(mes: string) {
  return { inicio: `${mes}-01`, fim: `${deslocarMes(mes, 1)}-01` }
}

function nomeCategoria(c: unknown): string {
  const cat = Array.isArray(c) ? c[0] : c
  return (cat as { nome?: string } | null)?.nome ?? 'Sem categoria'
}

function nomeDono(ctx: Contexto, id: string | null) {
  const m = ctx.visao.membros.find((x) => x.id === id)
  return m ? primeiroNome(m.nome) : ROTULO_COMPARTILHADO
}

function donoConta(ctx: Contexto, b: { responsavel_id?: string | null; cartao_id?: string | null }) {
  return b.responsavel_id ?? (b.cartao_id ? (ctx.cartaoPorId.get(b.cartao_id)?.titular_id ?? null) : null)
}

function rotuloCartao(ctx: Contexto, id: string | null) {
  const c = id ? ctx.cartaoPorId.get(id) : null
  return c ? `${c.nome} ${c.tipo === 'virtual' ? 'virtual' : c.tipo === 'debito' ? 'débito em conta' : c.tipo === 'pix' ? 'PIX' : 'físico'}${c.final ? ` final ${c.final}` : ''}` : null
}

export type Lanc = {
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  data: string
  canal: string | null
  member_id: string | null
  parcela_num: number | null
  parcela_total: number | null
  category: unknown
}

type Conta = {
  descricao: string
  valor: number
  vencimento: string
  pago: boolean
  pago_em: string | null
  recorrente: boolean
  periodicidade: string
  debito_automatico: boolean
  responsavel_id: string | null
  cartao_id: string | null
  mes: string
  category: unknown
}

export async function lancamentosEntre(ctx: Contexto, inicio: string, fim: string): Promise<Lanc[]> {
  const { data } = await ctx.supabase
    .from('transaction')
    .select('descricao, valor, natureza, data, canal, member_id, parcela_num, parcela_total, category:category_id(nome)')
    .gte('data', inicio)
    .lt('data', fim)
    .order('data', { ascending: false })
    .limit(2000)
  return ((data ?? []) as Lanc[]).filter((t) => ctx.visao.mostra(t.member_id))
}

async function contasEntre(ctx: Contexto, inicioMes: string, fimMes: string): Promise<Conta[]> {
  const { data } = await ctx.supabase
    .from('bill')
    .select(
      'descricao, valor, vencimento, pago, pago_em, recorrente, periodicidade, debito_automatico, responsavel_id, cartao_id, mes, category:category_id(nome)',
    )
    .gte('mes', inicioMes)
    .lt('mes', fimMes)
    .order('vencimento')
  return ((data ?? []) as Conta[]).filter((b) => ctx.visao.mostra(donoConta(ctx, b)))
}

// ---------------------------------------------------------------- ferramentas

/** Totais mês a mês: receitas e despesas dos lançamentos + contas a pagar, com as 3 maiores categorias. */
export async function resumoMeses(ctx: Contexto, meses = 6) {
  const n = Math.min(Math.max(meses, 1), 12)
  const fim = deslocarMes(mesAtual(ctx), 1)
  const inicio = deslocarMes(mesAtual(ctx), -(n - 1))
  const [lancs, contas] = await Promise.all([
    lancamentosEntre(ctx, `${inicio}-01`, `${fim}-01`),
    contasEntre(ctx, `${inicio}-01`, `${fim}-01`),
  ])
  const linhas = []
  for (let i = 0; i < n; i++) {
    const mes = deslocarMes(inicio, i)
    const doMes = lancs.filter((t) => t.data.startsWith(mes))
    const contasMes = contas.filter((b) => b.mes.startsWith(mes))
    const receitas = doMes.filter((t) => t.natureza === 'receita').reduce((s, t) => s + Number(t.valor), 0)
    const despesasLanc = doMes.filter((t) => t.natureza === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
    const totalContas = contasMes.reduce((s, b) => s + Number(b.valor), 0)
    const porCat = new Map<string, number>()
    for (const t of doMes.filter((x) => x.natureza === 'despesa'))
      porCat.set(nomeCategoria(t.category), (porCat.get(nomeCategoria(t.category)) ?? 0) + Number(t.valor))
    for (const b of contasMes) porCat.set(nomeCategoria(b.category), (porCat.get(nomeCategoria(b.category)) ?? 0) + Number(b.valor))
    linhas.push({
      mes,
      mes_em_andamento: mes === mesAtual(ctx),
      receitas_lancadas: arred(receitas),
      despesas_lancamentos: arred(despesasLanc),
      contas_a_pagar_do_mes: arred(totalContas),
      gasto_total: arred(despesasLanc + totalContas),
      maiores_categorias: Array.from(porCat.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([categoria, total]) => ({ categoria, total: arred(total) })),
    })
  }
  return { visao: ctx.visao.nomePessoa ?? ROTULO_JUNTOS, meses: linhas }
}

/** Gastos de um mês por categoria (lançamentos + contas a pagar), com os maiores itens de cada uma. */
export async function gastosDoMes(ctx: Contexto, mes: string) {
  const { inicio, fim } = limitesDoMes(mes)
  const [lancs, contas] = await Promise.all([lancamentosEntre(ctx, inicio, fim), contasEntre(ctx, inicio, fim)])
  const itens = [
    ...lancs
      .filter((t) => t.natureza === 'despesa')
      .map((t) => ({ categoria: nomeCategoria(t.category), descricao: t.canal || t.descricao, valor: Number(t.valor) })),
    ...contas.map((b) => ({ categoria: nomeCategoria(b.category), descricao: b.descricao, valor: Number(b.valor) })),
  ]
  const total = itens.reduce((s, i) => s + i.valor, 0)
  const porCat = new Map<string, { total: number; itens: { descricao: string; valor: number }[] }>()
  for (const i of itens) {
    const c = porCat.get(i.categoria) ?? { total: 0, itens: [] }
    c.total += i.valor
    c.itens.push({ descricao: i.descricao, valor: i.valor })
    porCat.set(i.categoria, c)
  }
  return {
    mes,
    visao: ctx.visao.nomePessoa ?? ROTULO_JUNTOS,
    total: arred(total),
    categorias: Array.from(porCat.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([categoria, c]) => ({
        categoria,
        total: arred(c.total),
        percentual: total > 0 ? Math.round((c.total / total) * 100) : 0,
        maiores_itens: c.itens
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 5)
          .map((x) => ({ descricao: x.descricao, valor: arred(x.valor) })),
      })),
  }
}

/** Busca lançamentos por mês, categoria e/ou texto na descrição. */
export async function buscarLancamentos(
  ctx: Contexto,
  filtro: { mes?: string; categoria?: string; texto?: string; natureza?: 'despesa' | 'receita'; limite?: number },
) {
  const mes = filtro.mes && /^\d{4}-\d{2}$/.test(filtro.mes) ? filtro.mes : null
  const inicio = mes ? `${mes}-01` : `${deslocarMes(mesAtual(ctx), -11)}-01`
  const fim = mes ? `${deslocarMes(mes, 1)}-01` : `${deslocarMes(mesAtual(ctx), 1)}-01`
  const texto = filtro.texto?.toLowerCase().trim()
  const cat = filtro.categoria?.toLowerCase().trim()
  const lista = (await lancamentosEntre(ctx, inicio, fim)).filter(
    (t) =>
      (!filtro.natureza || t.natureza === filtro.natureza) &&
      (!cat || nomeCategoria(t.category).toLowerCase().includes(cat)) &&
      (!texto || t.descricao.toLowerCase().includes(texto) || (t.canal ?? '').toLowerCase().includes(texto)),
  )
  const limite = Math.min(Math.max(filtro.limite ?? 25, 1), 50)
  return {
    encontrados: lista.length,
    soma: arred(lista.reduce((s, t) => s + Number(t.valor), 0)),
    lancamentos: lista.slice(0, limite).map((t) => ({
      data: t.data,
      descricao: t.descricao,
      valor: arred(Number(t.valor)),
      tipo: t.natureza,
      categoria: nomeCategoria(t.category),
      parcela: t.parcela_total && t.parcela_total > 1 ? `${t.parcela_num}/${t.parcela_total}` : null,
      de: nomeDono(ctx, t.member_id),
    })),
  }
}

/** Contas a pagar de um mês: o que está em aberto, pago, atrasado, em qual cartão e de quem. */
export async function contasAPagar(ctx: Contexto, mes: string) {
  const { inicio, fim } = limitesDoMes(mes)
  const contas = await contasEntre(ctx, inicio, fim)
  const lista = contas.map((b) => ({
    descricao: b.descricao,
    valor: arred(Number(b.valor)),
    vencimento: b.vencimento,
    situacao: b.pago ? 'paga' : b.vencimento < ctx.hoje ? 'atrasada' : 'em aberto',
    pago_em: b.pago_em,
    repete: !b.recorrente ? 'não' : b.periodicidade === 'anual' ? 'anual' : 'mensal',
    debito_automatico: b.debito_automatico,
    cartao: rotuloCartao(ctx, b.cartao_id),
    categoria: nomeCategoria(b.category),
    de: nomeDono(ctx, donoConta(ctx, b)),
  }))
  const aberto = lista.filter((c) => c.situacao !== 'paga')
  return {
    mes,
    hoje: ctx.hoje,
    total: arred(lista.reduce((s, c) => s + c.valor, 0)),
    em_aberto: arred(aberto.reduce((s, c) => s + c.valor, 0)),
    pago: arred(lista.filter((c) => c.situacao === 'paga').reduce((s, c) => s + c.valor, 0)),
    contas: lista,
  }
}

/** Patrimônio do mês em preenchimento, por bloco e por pessoa, comparado ao mês anterior. */
export async function situacaoPatrimonio(ctx: Contexto) {
  const { data: periodo } = await ctx.supabase.from('patrimonio_periodo').select('mes').single()
  const mes = (periodo?.mes as string | undefined) ?? `${mesAtual(ctx)}-01`
  const anterior = `${deslocarMes(mes.slice(0, 7), -1)}-01`
  const consulta = (m: string) =>
    Promise.all([
      ctx.supabase.from('account').select('nome, saldo_atual, moeda, member_id').eq('mes', m).eq('ativo', true),
      ctx.supabase.from('investment_position').select('descricao, valor_mercado, member_id').eq('mes', m),
      ctx.supabase.from('physical_asset').select('descricao, valor_estimado').eq('mes', m),
      ctx.supabase.from('retained_resource').select('descricao, saldo, member_id').eq('mes', m),
    ])
  const resumir = async (m: string) => {
    const [c, i, b, r] = await consulta(m)
    const contas = (c.data ?? []).filter((x) => ctx.visao.mostra(x.member_id))
    const inv = (i.data ?? []).filter((x) => ctx.visao.mostra(x.member_id))
    const bens = ctx.visao.pessoa === 'todos' ? (b.data ?? []) : []
    const ret = (r.data ?? []).filter((x) => ctx.visao.mostra(x.member_id))
    const soma = (l: Record<string, unknown>[], k: string) => arred(l.reduce((s, x) => s + Number(x[k] ?? 0), 0))
    return {
      contas: soma(contas, 'saldo_atual'),
      investimentos: soma(inv, 'valor_mercado'),
      bens: soma(bens, 'valor_estimado'),
      retidos_fgts: soma(ret, 'saldo'),
      itens: [
        ...contas.map((x) => ({ item: x.nome, tipo: 'conta', valor: arred(Number(x.saldo_atual)), moeda: x.moeda, de: nomeDono(ctx, x.member_id) })),
        ...inv.map((x) => ({ item: x.descricao, tipo: 'investimento', valor: arred(Number(x.valor_mercado)), de: nomeDono(ctx, x.member_id) })),
        ...bens.map((x) => ({ item: x.descricao, tipo: 'bem', valor: arred(Number(x.valor_estimado)), de: ROTULO_COMPARTILHADO })),
        ...ret.map((x) => ({ item: x.descricao, tipo: 'retido', valor: arred(Number(x.saldo)), de: nomeDono(ctx, x.member_id) })),
      ],
    }
  }
  const [atual, ant] = await Promise.all([resumir(mes), resumir(anterior)])
  const total = (x: typeof atual) => arred(x.contas + x.investimentos + x.bens + x.retidos_fgts)
  return {
    visao: ctx.visao.nomePessoa ?? ROTULO_JUNTOS,
    mes_em_preenchimento: mes.slice(0, 7),
    total: total(atual),
    total_mes_anterior: total(ant),
    variacao: arred(total(atual) - total(ant)),
    por_bloco: { contas: atual.contas, investimentos: atual.investimentos, bens: atual.bens, retidos_fgts: atual.retidos_fgts },
    itens: atual.itens,
    observacao: 'Valores do mês em preenchimento podem ainda estar com o saldo copiado do mês anterior.',
  }
}

/** Compras parceladas ainda em aberto e quanto pesam nos próximos meses. */
export async function parcelasEmAberto(ctx: Contexto) {
  const lancs = await lancamentosEntre(ctx, `${deslocarMes(mesAtual(ctx), -18)}-01`, `${deslocarMes(mesAtual(ctx), 1)}-01`)
  const grupos = new Map<string, { descricao: string; valor: number; num: number; total: number; data: string }>()
  for (const t of lancs) {
    if (t.natureza !== 'despesa' || !t.parcela_total || t.parcela_total <= 1 || !t.parcela_num) continue
    const base = t.descricao.replace(/\s*\d{2}\/\d{2}$/, '').trim()
    const chave = `${base}·${t.parcela_total}`
    const atual = grupos.get(chave)
    if (!atual || t.parcela_num > atual.num)
      grupos.set(chave, { descricao: base, valor: Number(t.valor), num: t.parcela_num, total: t.parcela_total, data: t.data })
  }
  const abertas = Array.from(grupos.values()).filter((g) => g.num < g.total)
  const proximos = [0, 1, 2].map((i) => {
    const mes = deslocarMes(mesAtual(ctx), i + 1)
    const valor = abertas.reduce((s, g) => {
      const mesesRestantes = g.total - g.num
      const mesesAteAlvo = (Number(mes.slice(0, 4)) - Number(g.data.slice(0, 4))) * 12 + (Number(mes.slice(5, 7)) - Number(g.data.slice(5, 7)))
      return mesesAteAlvo >= 1 && mesesAteAlvo <= mesesRestantes ? s + g.valor : s
    }, 0)
    return { mes, valor: arred(valor) }
  })
  return {
    compras_em_aberto: abertas.length,
    total_restante: arred(abertas.reduce((s, g) => s + g.valor * (g.total - g.num), 0)),
    proximos_meses: proximos,
    maiores: abertas
      .sort((a, b) => b.valor * (b.total - b.num) - a.valor * (a.total - a.num))
      .slice(0, 8)
      .map((g) => ({ descricao: g.descricao, parcela: `${g.num}/${g.total}`, valor_mensal: arred(g.valor), restante: arred(g.valor * (g.total - g.num)) })),
  }
}
