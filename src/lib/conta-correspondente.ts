import type { SupabaseClient } from '@supabase/supabase-js'

// Fatura de empresa que JÁ é conta a pagar (Claro, ENEL, aluguel...) não pode virar lançamento:
// o valor dela já entra nas saídas pela conta do mês, e lançar os itens contaria duas vezes.
// Aqui achamos a conta a pagar que corresponde ao documento, pra atualizar ela em vez de lançar.
// Fatura de cartão continua virando lançamentos (a conta "Cartão X" é só o pagamento dela).

export type ContaCorrespondente = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  mes: string
  pago: boolean
}

type Extracao = {
  tipo_documento?: string
  instituicao?: string | null
  vencimento?: string | null
  valor_total?: number | null
}

const IGNORAR = new Set([
  'sa', 'ltda', 'banco', 'do', 'da', 'de', 'dos', 'das', 'brasil', 'servicos', 'me', 'eireli', 'cia', 'companhia',
  'distribuicao', 'distribuidora', 'telecom', 'comunicacao', 'comunicacoes', 'energia', 'sao', 'paulo', 'rio', 'janeiro',
  'conta', 'fatura', 'sua', 'unibanco', 'participacoes',
])

export function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palavrasChave(texto: string) {
  return normalizarTexto(texto)
    .split(' ')
    .filter((p) => p.length >= 3 && !IGNORAR.has(p))
}

function mesDe(data: string) {
  return data.slice(0, 7)
}

function mesSeguinte(chave: string) {
  const [a, m] = chave.split('-').map(Number)
  const d = new Date(Date.UTC(a, m, 1))
  return d.toISOString().slice(0, 7)
}

/** Contas a pagar que batem com o documento (mais provável primeiro). Vazio = não é conta já cadastrada. */
export async function contasCorrespondentes(
  supabase: SupabaseClient,
  extracao: Extracao | null,
  criadoEm: string,
): Promise<ContaCorrespondente[]> {
  if (!extracao) return []
  if (extracao.tipo_documento === 'extrato' || extracao.tipo_documento === 'saldo') return []
  const chaves = extracao.instituicao ? palavrasChave(extracao.instituicao) : []
  const total = extracao.valor_total ?? null
  // Boleto (condomínio, escola...) costuma vir no nome do banco/administradora: aí o que
  // identifica a conta é o mesmo valor no mesmo mês.
  if (chaves.length === 0 && total === null) return []

  // Mês da conta: o do vencimento lido; sem vencimento, o mês em que chegou e o seguinte.
  const meses = extracao.vencimento ? [mesDe(extracao.vencimento)] : [mesDe(criadoEm), mesSeguinte(mesDe(criadoEm))]
  const { data } = await supabase
    .from('bill')
    .select('id, descricao, valor, vencimento, mes, pago')
    .gte('mes', `${meses[0]}-01`)
    .lte('mes', `${meses[meses.length - 1]}-01`)

  return ((data ?? []) as ContaCorrespondente[])
    .filter((b) => {
      const desc = normalizarTexto(b.descricao)
      if (desc.includes('cartao')) return false // pagamento de fatura de cartão: segue virando lançamentos
      const palavrasConta = desc.split(' ')
      const mesmoNome = chaves.some((c) => palavrasConta.includes(c)) || palavrasChave(b.descricao).some((p) => chaves.includes(p))
      const mesmoValor = total !== null && total > 0 && Math.abs(Number(b.valor) - total) <= 1
      return mesmoNome || mesmoValor
    })
    .map((b) => ({ ...b, valor: Number(b.valor) }))
    .sort((a, b) => (total === null ? 0 : Math.abs(a.valor - total) - Math.abs(b.valor - total)))
    .slice(0, 5)
}
