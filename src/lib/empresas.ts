// Lista de empresas/assinaturas/pagamentos da família — uma linha por empresa — montada a partir
// dos lançamentos das faturas (últimos 12 meses) e das contas a pagar. Base da relação
// "em qual cartão cada empresa está cadastrada" (aba Cartões).

const IGNORAR = new Set([
  'pag', 'pagto', 'pagamento', 'compra', 'compras', 'parc', 'parcela', 'loja', 'ltda', 'com', 'www', 'br', 'dos', 'das',
  'para', 'por', 'debito', 'credito', 'cartao', 'online', 'brasil', 'sao', 'paulo', 'eireli', 'epp', 'the',
])

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Palavras que identificam a empresa: mantém números grudados em letras (99food, 99app) e descarta
// números soltos (parcela, data, código) e termos genéricos.
function palavras(texto: string) {
  return normalizar(texto)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && /[a-z]/.test(p) && !IGNORAR.has(p))
}

function canalNormalizado(canal: string) {
  return normalizar(canal).replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Chave da empresa: o canal detectado (iFood, 99, Netflix...) ou as 2 primeiras palavras relevantes. */
export function chaveEmpresa(descricao: string, canal: string | null): string {
  if (canal && canalNormalizado(canal)) return canalNormalizado(canal)
  return palavras(descricao).slice(0, 2).join(' ') || normalizar(descricao).trim()
}

function nomeBonito(descricao: string, canal: string | null) {
  if (canal) {
    // "Google One" (canal Google): usa a 2ª palavra quando ela é um nome de produto (só letras)
    const p = descricao.replace(/[*_]+/g, ' ').split(/\s+/).filter(Boolean)
    if (p.length >= 2 && normalizar(p[0]) === normalizar(canal.trim()) && /^[A-Za-zÀ-ÿ]{2,}$/.test(p[1]))
      return `${canal.trim()} ${p[1][0].toUpperCase()}${p[1].slice(1).toLowerCase()}`
    return canal.trim()
  }
  const partes = descricao
    .replace(/[*_]+/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !/\d/.test(p))
    .slice(0, 3)
    .join(' ')
  const base = partes || descricao
  return base
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
    .trim()
}

export type TipoEmpresa = 'assinatura' | 'recorrente' | 'conta' | 'avulsa'

// Recorrente = cobrança parecida todo mês: 3+ meses com valores estáveis (variação ≤ 35%), ou os
// 2 últimos meses seguidos com valor quase igual (±10%). Posto, restaurante e compras de valor
// variável ficam como avulsas — a família pode mudar a tag na tela.
function ehRecorrente(porMes: Map<string, number>) {
  const meses = Array.from(porMes.keys()).sort()
  const valores = meses.map((m) => porMes.get(m) ?? 0)
  if (valores.length >= 3) {
    const media = valores.reduce((x, y) => x + y, 0) / valores.length
    const desvio = Math.sqrt(valores.reduce((x, v) => x + (v - media) ** 2, 0) / valores.length)
    if (media > 0 && desvio / media <= 0.35) return true
  }
  if (valores.length >= 2) {
    const [m1, m2] = meses.slice(-2)
    const [a1, b1] = m1.split('-').map(Number)
    const [a2, b2] = m2.split('-').map(Number)
    const seguidos = a2 * 12 + b2 - (a1 * 12 + b1) === 1
    const [v1, v2] = valores.slice(-2)
    if (seguidos && Math.max(v1, v2) > 0 && Math.abs(v1 - v2) / Math.max(v1, v2) <= 0.1) return true
  }
  return false
}

export type EmpresaLinha = {
  chave: string
  nome: string
  tipo: TipoEmpresa
  categoria: string | null
  meses: number
  mediaMensal: number
  ultimaData: string
  ultimoValor: number
  /** faturas (banco/cartão) em que a cobrança apareceu */
  vistoEm: string[]
  cartaoId: string | null
  /** conta a pagar: o vínculo fica na própria conta (bill.cartao_id), pela linhagem */
  linhagemId: string | null
  /** o tipo foi escolhido pela família (não pela detecção automática) */
  tipoManual: boolean
  /** adicionada à mão (ainda sem cobrança nas faturas) — pode ser removida */
  adicionadaManual?: boolean
  /** onde o cartão/tag desta linha é gravado (empresa digitada que se juntou a uma cobrança abreviada) */
  chaveVinculo?: string
  /** a média vem do valor informado à mão (não de cobranças nas faturas) */
  valorInformado?: boolean
  /** cobrança anual (ex.: anuidade de um app): mediaMensal = valor ÷ 12 */
  periodicidade?: 'mensal' | 'anual'
  /** valor de cada cobrança anual */
  valorAnual?: number
}

type Transacao = {
  descricao: string
  canal: string | null
  valor: number | string
  data: string
  document_id: string | null
  category: { nome: string } | { nome: string }[] | null
}

type Conta = {
  linhagem_id: string
  descricao: string
  valor: number | string
  vencimento: string
  cartao_id: string | null
  recorrente: boolean | null
  periodicidade?: string | null
  category: { nome: string } | { nome: string }[] | null
}

export function montarEmpresas(params: {
  transacoes: Transacao[]
  contas: Conta[]
  instituicaoPorDocumento: Map<string, string>
  vinculos: Map<string, string | null>
  /** tipo escolhido pela família, por chave (sobrepõe a detecção) */
  tiposManuais?: Map<string, TipoEmpresa>
  /** empresas cadastradas à mão (chave → nome) */
  manuais?: Map<string, string>
  /** valor mensal informado à mão (chave → R$), usado quando não há cobrança nas faturas */
  valoresManuais?: Map<string, number>
  /** data da última cobrança informada à mão (chave → YYYY-MM-DD) */
  datasManuais?: Map<string, string>
  /** chaves das empresas cobradas uma vez por ano */
  anuais?: Set<string>
}): EmpresaLinha[] {
  const nomeCat = (c: Transacao['category']) => (Array.isArray(c) ? c[0] : c)?.nome ?? null

  // ---- empresas das faturas ----
  type Acum = {
    nome: string
    ultimaData: string
    ultimoValor: number
    total: number
    meses: Set<string>
    porMes: Map<string, number>
    categorias: Map<string, number>
    vistoEm: Set<string>
    nomes: Map<string, number>
  }
  const porChave = new Map<string, Acum>()
  for (const t of params.transacoes) {
    const chave = chaveEmpresa(t.descricao, t.canal)
    if (!chave) continue
    const valor = Number(t.valor)
    const a =
      porChave.get(chave) ??
      ({ nome: nomeBonito(t.descricao, t.canal), ultimaData: '', ultimoValor: 0, total: 0, meses: new Set(), porMes: new Map(), categorias: new Map(), vistoEm: new Set(), nomes: new Map() } as Acum)
    a.total += valor
    a.meses.add(t.data.slice(0, 7))
    a.porMes.set(t.data.slice(0, 7), (a.porMes.get(t.data.slice(0, 7)) ?? 0) + valor)
    if (t.data > a.ultimaData) {
      a.ultimaData = t.data
      a.ultimoValor = valor
    }
    // nome mais frequente nas faturas ("Google One" ganha de um "Google G1sk003m" isolado)
    const nomeAqui = nomeBonito(t.descricao, t.canal)
    a.nomes.set(nomeAqui, (a.nomes.get(nomeAqui) ?? 0) + 1)
    a.nome = Array.from(a.nomes.entries()).sort((x, y) => y[1] - x[1])[0][0]
    const cat = nomeCat(t.category)
    if (cat) a.categorias.set(cat, (a.categorias.get(cat) ?? 0) + 1)
    const inst = t.document_id ? params.instituicaoPorDocumento.get(t.document_id) : undefined
    if (inst) a.vistoEm.add(inst)
    porChave.set(chave, a)
  }

  const linhas: EmpresaLinha[] = []
  for (const [chave, a] of porChave) {
    const categoria = Array.from(a.categorias.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    const ehAssinatura = !!categoria && normalizar(categoria).includes('assinatura')
    const automatico: TipoEmpresa = ehAssinatura ? 'assinatura' : ehRecorrente(a.porMes) ? 'recorrente' : 'avulsa'
    const manual = params.tiposManuais?.get(chave)
    const tipo: TipoEmpresa = manual ?? automatico
    linhas.push({
      chave,
      nome: a.nome,
      tipo,
      categoria,
      meses: a.meses.size,
      mediaMensal: a.total / Math.max(1, a.meses.size),
      ultimaData: a.ultimaData,
      ultimoValor: a.ultimoValor,
      vistoEm: Array.from(a.vistoEm),
      cartaoId: params.vinculos.get(chave) ?? null,
      linhagemId: null,
      tipoManual: !!manual,
    })
  }

  // ---- contas a pagar (uma por linhagem, a ocorrência mais recente) ----
  const ultimaPorLinhagem = new Map<string, Conta>()
  for (const c of params.contas) {
    const atual = ultimaPorLinhagem.get(c.linhagem_id)
    if (!atual || c.vencimento > atual.vencimento) ultimaPorLinhagem.set(c.linhagem_id, c)
  }
  for (const c of ultimaPorLinhagem.values()) {
    const d = normalizar(c.descricao)
    if (d.includes('cartao') || d.includes('fatura')) continue // pagamento da fatura do cartão, não é empresa
    linhas.push({
      chave: `conta:${c.linhagem_id}`,
      nome: c.descricao,
      tipo: 'conta',
      categoria: nomeCat(c.category),
      meses: 0,
      // conta anual (ex.: seguro de vida): o "por mês" é o valor ÷ 12
      mediaMensal: c.periodicidade === 'anual' ? Number(c.valor) / 12 : Number(c.valor),
      periodicidade: c.periodicidade === 'anual' ? 'anual' : 'mensal',
      valorAnual: c.periodicidade === 'anual' ? Number(c.valor) : undefined,
      ultimaData: c.vencimento,
      ultimoValor: Number(c.valor),
      vistoEm: [],
      cartaoId: c.cartao_id,
      linhagemId: c.linhagem_id,
      tipoManual: false,
    })
  }
  // ---- adicionadas à mão que ainda não apareceram em nenhuma fatura/conta ----
  const jaListadas = new Set(linhas.map((l) => l.chave))
  for (const [chave, nome] of params.manuais ?? []) {
    if (jaListadas.has(chave)) continue
    // Fatura costuma abreviar o nome ("Conectc*Fulano" pra ConectCar): se a 1ª palavra da
    // cobrança (5+ letras) é o começo do nome digitado, é a mesma empresa — junta numa linha só,
    // com o nome, a tag e o cartão escolhidos à mão (o vínculo próprio da cobrança, se houver, vale mais).
    const digitado = chave.replace(/\s+/g, '')
    const palavrasDigitadas = chave.split(' ')
    const mesma = linhas.find((l) => {
      if (l.linhagemId) return false
      const primeira = l.chave.split(' ')[0]
      // Só junta abreviação ("conectc" de ConectCar). Palavra inteira que o nome digitado detalha
      // ("google" x "Google Workspace") é outra cobrança da mesma marca — fica separada (e agrupada).
      if (palavrasDigitadas.includes(primeira) && l.chave !== chave) return false
      return primeira.length >= 5 && digitado.length >= 5 && (digitado.startsWith(primeira) || primeira.startsWith(digitado))
    })
    if (mesma) {
      mesma.nome = nome
      mesma.chaveVinculo = chave
      // a escolha feita ao adicionar a empresa vale mais que um vínculo antigo da cobrança
      mesma.cartaoId = params.vinculos.get(chave) ?? mesma.cartaoId
      const tipoDigitado = params.tiposManuais?.get(chave)
      if (tipoDigitado) {
        mesma.tipo = tipoDigitado
        mesma.tipoManual = true
      }
      continue
    }
    linhas.push({
      chave,
      nome,
      tipo: params.tiposManuais?.get(chave) ?? 'recorrente',
      categoria: null,
      meses: 0,
      mediaMensal: params.valoresManuais?.get(chave) ?? 0,
      valorInformado: params.valoresManuais?.has(chave) ?? false,
      ultimaData: params.datasManuais?.get(chave) ?? '',
      ultimoValor: params.valoresManuais?.get(chave) ?? 0,
      vistoEm: [],
      cartaoId: params.vinculos.get(chave) ?? null,
      linhagemId: null,
      tipoManual: true,
      adicionadaManual: true,
    })
  }
  // cobrança anual: o "por mês" vira o valor ÷ 12 (senão parece que cobra todo mês)
  for (const l of linhas) {
    const k = l.chaveVinculo ?? l.chave
    if (!params.anuais?.has(k) && !params.anuais?.has(l.chave)) continue
    const valor = params.valoresManuais?.get(k) ?? params.valoresManuais?.get(l.chave) ?? (l.ultimoValor || l.mediaMensal)
    l.periodicidade = 'anual'
    l.valorAnual = valor
    l.mediaMensal = valor / 12
    if (!l.ultimaData) l.ultimaData = params.datasManuais?.get(k) ?? ''
  }
  return linhas
}
