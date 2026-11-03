// Compras parceladas em aberto — uma linha por compra, só as que ainda têm parcela por vir. Usado
// pela aba Parcelas e pelo indicador da Visão geral, pra os dois mostrarem sempre o mesmo total.
//
// Dois cuidados (validados em 2026-10-16, quando o total aparecia inflado):
// 1) A MESMA compra vem com descrições diferentes de uma fatura para outra ("SEGURO AUTO 04D11",
//    "SEGURO AUTO", "PARQUE AQUATICO"/"PARQUE AQUATIC", "Parcela 2/4"…). Agrupa pelo primeiro nome
//    da loja + número de parcelas + valor da parcela (arredondado), ficando com a parcela mais adiantada.
// 2) A última parcela vista pode ser de uma fatura antiga. Conta como pagas as faturas que já venceram
//    desde então (uma parcela por mês), usando o VENCIMENTO DA FATURA — a data da linha costuma ser a
//    data da compra original, não a do mês da parcela.

export type LinhaParcela = {
  descricao: string
  valor: number | string
  data: string
  parcela_num: number | null
  parcela_total: number | null
  account_id: string | null
  member_id: string | null
  account: { nome: string } | { nome: string }[] | null
  document?: { vencimento: string | null; instituicao?: string | null } | { vencimento: string | null; instituicao?: string | null }[] | null
}

export type CompraParcelada = {
  descricao: string
  contaNome: string
  valor: number
  /** parcela em que a compra está HOJE (a última vista + as faturas vencidas desde então) */
  parcela_num: number
  parcela_total: number
  data: string
  /** banco da fatura em que a parcela apareceu (Itaú, Nubank, Bradesco…) */
  banco: string | null
}

export function descricaoBase(descricao: string, parcelaNum: number, parcelaTotal: number) {
  const sufixo = ` ${String(parcelaNum).padStart(2, '0')}/${String(parcelaTotal).padStart(2, '0')}`
  return descricao.endsWith(sufixo) ? descricao.slice(0, -sufixo.length).trim() : descricao
}

const norm = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/parcela\s*\d+\s*\/?\s*\d*|\d+d\d+|\d+\/\d+|[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const primeiroNome = (t: string) => norm(t).split(' ').find((p) => p.length > 2) ?? norm(t)
const dataValida = (d: string | null | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)

/** Faturas vencidas entre a de referência e hoje (cada uma quitou mais uma parcela). */
function faturasVencidasDesde(ref: string, hoje: string) {
  const [ra, rm, rd] = ref.split('-').map(Number)
  const [ha, hm, hd] = hoje.split('-').map(Number)
  let m = (ha - ra) * 12 + (hm - rm)
  if (hd < rd) m -= 1
  return Math.max(0, m)
}

export function comprasParceladasEmAberto(linhas: LinhaParcela[], mostra: (dono: string | null) => boolean, hoje = new Date().toISOString().slice(0, 10)) {
  const grupos = new Map<string, CompraParcelada & { ref: string }>()
  for (const t of linhas) {
    if (!mostra(t.member_id)) continue
    if (!t.parcela_total || t.parcela_total <= 1 || !t.parcela_num) continue
    const contaNome = (Array.isArray(t.account) ? t.account[0]?.nome : t.account?.nome) ?? 'Sem conta'
    const doc = Array.isArray(t.document) ? t.document[0] : t.document
    const ref = dataValida(doc?.vencimento) ? doc!.vencimento! : t.data
    const descricao = descricaoBase(t.descricao, t.parcela_num, t.parcela_total)
    const valor = Number(t.valor)
    const chave = `${primeiroNome(descricao)}·${t.parcela_total}·${Math.round(valor)}`
    const atual = grupos.get(chave)
    if (!atual || t.parcela_num > atual.parcela_num || (t.parcela_num === atual.parcela_num && ref > atual.ref)) {
      grupos.set(chave, { descricao, contaNome, valor, parcela_num: t.parcela_num, parcela_total: t.parcela_total, data: t.data, ref, banco: doc?.instituicao ?? null })
    }
  }
  const compras: CompraParcelada[] = Array.from(grupos.values())
    .map(({ ref, ...g }) => ({ ...g, parcela_num: Math.min(g.parcela_total, g.parcela_num + faturasVencidasDesde(ref, hoje)) }))
    .filter((g) => g.parcela_num < g.parcela_total)
  const totalFaltante = compras.reduce((t, c) => t + c.valor * (c.parcela_total - c.parcela_num), 0)
  const mensal = compras.reduce((t, c) => t + c.valor, 0)
  return { compras, totalFaltante, mensal }
}
