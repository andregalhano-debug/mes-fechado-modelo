import Anthropic from '@anthropic-ai/sdk'

// Dados de crédito impressos na fatura (limite, fechamento, juros, encargos) — cada banco usa um
// layout, então a leitura é feita pela IA sobre o texto do PDF. Fica guardado em
// document.extracao.credito e alimenta os cards de Contas a pagar → Cartões.

export type CreditoFatura = {
  /** finais de 4 dígitos que aparecem na fatura; o 1º é o do titular */
  finais: string[]
  final_titular: string | null
  limite_total: number | null
  limite_disponivel: number | null
  limite_utilizado: number | null
  fechamento: string | null
  proximo_fechamento: string | null
  vencimento: string | null
  total_fatura: number | null
  pagamento_minimo: number | null
  juros_rotativo_am: number | null
  juros_rotativo_aa: number | null
  cet_rotativo_aa: number | null
  juros_parcelamento_am: number | null
  cet_parcelamento_aa: number | null
  juros_atraso_am: number | null
  multa_atraso_pct: number | null
  encargos: { juros: number; multa: number; iof: number; anuidade: number; outros: number }
  /** o que já está comprometido em parcelas das próximas faturas */
  parcelas_futuras: number | null
  /** simulação do parcelamento da fatura impressa pelo banco */
  parcelamento_qtd: number | null
  parcelamento_total_a_pagar: number | null
  /** total que o banco projeta se pagar só o mínimo (quando a fatura informa) */
  minimo_total_a_pagar: number | null
  compras_internacionais: number | null
  cotacao_dolar: number | null
}

// A saída estruturada aceita poucos campos anuláveis: "não informado" vira -1 (número) ou ""
// (texto) e é convertido para null depois da leitura.
const n = { type: 'number', description: '-1 se não estiver na fatura' }
const d = { type: 'string', description: 'AAAA-MM-DD; "" se não estiver na fatura' }
const schema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'finais', 'final_titular', 'limite_total', 'limite_disponivel', 'limite_utilizado', 'fechamento', 'proximo_fechamento', 'vencimento',
    'total_fatura', 'pagamento_minimo', 'juros_rotativo_am', 'juros_rotativo_aa', 'cet_rotativo_aa', 'juros_parcelamento_am', 'cet_parcelamento_aa',
    'juros_atraso_am', 'multa_atraso_pct', 'encargos', 'parcelas_futuras', 'parcelamento_qtd', 'parcelamento_total_a_pagar',
    'minimo_total_a_pagar', 'compras_internacionais', 'cotacao_dolar',
  ],
  properties: {
    finais: { type: 'array', items: { type: 'string' }, description: 'Últimos 4 dígitos de cada cartão listado na fatura (titular primeiro).' },
    final_titular: { type: 'string', description: '"" se não houver' },
    limite_total: { ...n, description: 'Limite total de crédito (compras), em R$.' },
    limite_disponivel: n,
    limite_utilizado: n,
    fechamento: { ...d, description: 'Data de fechamento DESTA fatura (Itaú: "Emissão"; Nubank: fim do "Período vigente"; Bradesco: se não houver, null).' },
    proximo_fechamento: { ...d, description: 'Data prevista do próximo fechamento.' },
    vencimento: d,
    total_fatura: n,
    pagamento_minimo: n,
    juros_rotativo_am: { ...n, description: '% ao mês do crédito rotativo (ex.: 12,50 → 12.5). Use o vigente para o próximo período quando houver.' },
    juros_rotativo_aa: n,
    cet_rotativo_aa: n,
    juros_parcelamento_am: { ...n, description: '% ao mês do parcelamento da fatura.' },
    cet_parcelamento_aa: n,
    juros_atraso_am: { ...n, description: 'Juros de mora/atraso % ao mês.' },
    multa_atraso_pct: n,
    encargos: {
      type: 'object',
      additionalProperties: false,
      required: ['juros', 'multa', 'iof', 'anuidade', 'outros'],
      description: 'Valores em R$ EFETIVAMENTE COBRADOS nesta fatura (0 quando não houve). IOF inclui o repasse de IOF de compras internacionais.',
      properties: { juros: { type: 'number' }, multa: { type: 'number' }, iof: { type: 'number' }, anuidade: { type: 'number' }, outros: { type: 'number' } },
    },
    parcelas_futuras: { ...n, description: 'Total já comprometido nas próximas faturas (parcelas a vencer): "Total para as próximas faturas", "Saldo em aberto total" menos a fatura atual, "Compras parceladas - próximas faturas".' },
    parcelamento_qtd: { ...n, description: 'Nº de parcelas da principal simulação de parcelamento da fatura (ex.: entrada + 10x = 11).' },
    parcelamento_total_a_pagar: { ...n, description: '"Total a pagar"/"Valor total a pagar" da simulação de PARCELAMENTO da fatura.' },
    minimo_total_a_pagar: { ...n, description: '"Total a pagar"/"Valor total a pagar" da simulação de pagar só o MÍNIMO (rotativo), se houver.' },
    compras_internacionais: { ...n, description: 'Total das compras internacionais em R$ (antes do IOF).' },
    cotacao_dolar: { ...n, description: 'Cotação do dólar usada pelo banco na conversão (ex.: 5,46).' },
  },
}

let cliente: Anthropic | null = null

export async function textoDoPdf(bytes: Buffer): Promise<string | null> {
  try {
    const mupdf = await import('mupdf')
    const doc = mupdf.Document.openDocument(bytes, 'application/pdf')
    if (doc.needsPassword()) return null
    let t = ''
    for (let i = 0; i < doc.countPages(); i++) t += doc.loadPage(i).toStructuredText('preserve-whitespace').asText()
    // sem dados pessoais (a fatura traz CPF/endereço; não precisam ir para a leitura)
    return t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]')
  } catch {
    return null
  }
}

export async function extrairCredito(bytes: Buffer): Promise<CreditoFatura | null> {
  const texto = await textoDoPdf(bytes)
  if (!texto || texto.length < 200) return null
  cliente ??= new Anthropic()
  const r = await cliente.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system:
      [
        'Você lê o texto de uma fatura de cartão de crédito brasileira e devolve os dados de crédito. Percentuais como número (12,92% → 12.92). Valores em reais com ponto decimal. Datas AAAA-MM-DD. Não invente: null quando não estiver no texto.',
        'ENCARGOS = só o que foi EFETIVAMENTE COBRADO nesta fatura (linhas de lançamento ou o quadro "Encargos cobrados nesta fatura": juros do rotativo, juros de mora, multa, repasse de IOF, IOF de financiamento, anuidade). NUNCA use os valores das simulações ("Parcelas fixas", "Pagamento mínimo", "Total a pagar", "Valor total financiado").',
        'Taxas: juros_rotativo = taxa do crédito rotativo/pagamento mínimo; juros_parcelamento = taxa do parcelamento da fatura ("Parcelas fixas"/"Parcelamento de Fatura"), não o "Juros Máximos" (teto legal). No Itaú, o bloco "Parcelas fixas" traz "Juros: X %am - Y%aa" e "CET: …" do parcelamento; o rotativo é o "Juros do rotativo". CET ao ano quando houver.',
        'Fechamento: Itaú = data de "Emissão"; Nubank = último dia do "Período vigente"; Bradesco = se não houver, null (há a "previsão de fechamento da próxima fatura").',
      ].join(' '),
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: `Texto da fatura:\n${texto.slice(0, 60000)}` }],
  })
  const bloco = r.content.find((b) => b.type === 'text')
  if (!bloco || bloco.type !== 'text') return null
  const bruto = JSON.parse(bloco.text) as Record<string, unknown>
  // -1 / "" → null (campos não informados na fatura)
  for (const [k, v] of Object.entries(bruto)) if (v === -1 || v === '') bruto[k] = null
  const c = bruto as unknown as CreditoFatura
  const data = (x: string | null) => {
    if (!x) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x
    const m = x.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null
  }
  c.fechamento = data(c.fechamento)
  c.proximo_fechamento = data(c.proximo_fechamento)
  c.vencimento = data(c.vencimento)
  c.finais = (c.finais ?? []).map((f) => f.replace(/\D/g, '').slice(-4)).filter((f) => f.length === 4)
  if (c.final_titular) c.final_titular = c.final_titular.replace(/\D/g, '').slice(-4) || null
  return c
}

// ---------- cálculos de prazo ----------
const dia = (s: string) => new Date(`${s}T12:00:00`)
const iso = (x: Date) => x.toISOString().slice(0, 10)
const maisMes = (s: string, k = 1) => {
  const x = dia(s)
  x.setMonth(x.getMonth() + k)
  return iso(x)
}
const diasEntre = (a: string, b: string) => Math.round((dia(b).getTime() - dia(a).getTime()) / 86_400_000)

/** Melhor dia de compra, prazo máximo e quantos dias até pagar uma compra feita hoje. */
export function prazos(c: Pick<CreditoFatura, 'fechamento' | 'proximo_fechamento' | 'vencimento'>, hoje: string) {
  if (!c.vencimento || (!c.fechamento && !c.proximo_fechamento)) return null
  const proxFech = c.proximo_fechamento ?? maisMes(c.fechamento!)
  const fech = c.fechamento ?? maisMes(proxFech, -1)
  const diasFechVenc = diasEntre(fech, c.vencimento)
  const melhorDia = Number(fech.slice(8, 10)) + 1
  // compra no dia seguinte ao fechamento só é paga no vencimento da fatura seguinte
  const prazoMaximo = diasEntre(iso(new Date(dia(fech).getTime() + 86_400_000)), maisMes(c.vencimento))
  // compra feita hoje: cai na fatura que fecha no próximo fechamento ainda por vir
  let f = proxFech
  let v = maisMes(c.vencimento)
  while (f < hoje) {
    f = maisMes(f)
    v = maisMes(v)
  }
  return { melhorDia: melhorDia > 31 ? 1 : melhorDia, diaFechamento: Number(fech.slice(8, 10)), diaVencimento: Number(c.vencimento.slice(8, 10)), diasFechVenc, prazoMaximo, compraHoje: { fecha: f, vence: v, dias: diasEntre(hoje, v) } }
}

/**
 * Quanto a mais custa pagar só o mínimo, em 1 mês. Os bancos imprimem o "total a pagar" do
 * rotativo de jeitos diferentes (Itaú inclui o mínimo já pago; Nubank não): fica com a leitura
 * mais próxima da conta saldo × juros do rotativo.
 */
export function custoDoMinimo(c: Pick<CreditoFatura, 'total_fatura' | 'pagamento_minimo' | 'minimo_total_a_pagar' | 'juros_rotativo_am'>): number | null {
  if (!c.total_fatura || !c.minimo_total_a_pagar) return null
  const saldo = c.total_fatura - (c.pagamento_minimo ?? 0)
  const estimativa = saldo * ((c.juros_rotativo_am ?? 12) / 100)
  const candidatos = [c.minimo_total_a_pagar - c.total_fatura, c.pagamento_minimo ? c.minimo_total_a_pagar - saldo : NaN].filter((v) => Number.isFinite(v) && v > 0)
  if (!candidatos.length) return null
  return candidatos.sort((a, b) => Math.abs(a - estimativa) - Math.abs(b - estimativa))[0]
}
