import type { SupabaseClient } from '@supabase/supabase-js'
import type { LancamentoExtraido } from '@/lib/extracao'

// Categoriza as próximas faturas pelo padrão que a família já usou. Para cada empresa vale a
// ÚLTIMA categoria escolhida (a correção mais recente na conferência manda — o histórico antigo
// pode ter a sugestão da IA que foi corrigida depois). Ordem de busca: nome da empresa (3 e 2
// palavras) → canal → marca (1ª palavra, se consistente) → tipo de estabelecimento (farmácia,
// restaurante). A IA só decide quando nada disso encontra.

const IGNORAR = new Set([
  'pag', 'pagto', 'pagamento', 'compra', 'compras', 'parc', 'parcela', 'parcelado', 'loja', 'ltda', 'com', 'www', 'br',
  'dos', 'das', 'para', 'por', 'debito', 'credito', 'cartao', 'online', 'brasil', 'sao', 'paulo', 'eireli', 'epp',
])

/** Marca = 1ª palavra (com números colados, ex.: "99food", "ifd" não conta — é o app de entrega). */
function marcaDe(descricao: string) {
  const w = normalizar(descricao).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  const m = w[0] === 'ifd' || w[0] === 'mp' || w[0] === 'pag' ? '' : (w[0] ?? '')
  return m.length >= 3 ? m : ''
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Palavras que identificam a empresa: sem números (parcela, data, código), sem termos genéricos. */
function palavras(descricao: string) {
  return normalizar(descricao)
    .replace(/\d+\s*\/\s*\d+/g, ' ')
    .replace(/[^a-z ]+/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !IGNORAR.has(p))
}

/** Por chave: a categoria mais recente e a contagem de todas (o histórico vem do mais novo ao mais antigo). */
type Registro = { ultima: string; contagem: Map<string, number>; total: number }
const somar = (mapa: Map<string, Registro>, chave: string, categoria: string) => {
  if (!chave) return
  const r = mapa.get(chave) ?? { ultima: categoria, contagem: new Map<string, number>(), total: 0 }
  r.contagem.set(categoria, (r.contagem.get(categoria) ?? 0) + 1)
  r.total++
  mapa.set(chave, r)
}

/** Nome/canal da empresa: vale a última escolha. */
const ultima = (r: Registro | undefined) => r?.ultima ?? null

/** Marca (1ª palavra): só quando é consistente — 3+ vezes e ≥ 70% numa categoria (ex.: 99Food → Restaurante). */
function marcaConsistente(r: Registro | undefined): string | null {
  if (!r || r.total < 3) return null
  const [cat, n] = Array.from(r.contagem.entries()).sort((a, b) => b[1] - a[1])[0]
  return n / r.total >= 0.7 ? cat : null
}

// Tipo de estabelecimento pelo nome, quando a empresa nunca apareceu (padrão da família).
const TIPOS: { re: RegExp; categoria: string }[] = [
  { re: /\b(drogaria|drogari|droga|farma|farmacia|raia|drogasil|pacheco|panvel)\b/, categoria: 'Saúde' },
  { re: /\b(restaurante|restaura|restaur|rest|bar|pizza|pizzaria|steakhouse|outback|espeto|espetinho|burger|hamburgueria|sushi|lanchonete|churrascaria|cantina|bistro)\b/, categoria: 'Restaurante' },
]

export type Aprendizado = {
  sugerir: (l: Pick<LancamentoExtraido, 'descricao' | 'canal' | 'natureza'>) => string | null
}

export async function aprenderCategorias(supabase: SupabaseClient, householdId: string): Promise<Aprendizado> {
  // Mais novo primeiro (pela inclusão no app, não pela data da compra — parcelas têm data antiga).
  // O banco devolve no máximo 1.000 linhas por consulta: lê em páginas.
  const data: unknown[] = []
  for (let de = 0; de < 20000; de += 1000) {
    const { data: pagina } = await supabase
      .from('transaction')
      .select('descricao, canal, natureza, valor, data, document_id, category:category_id(nome)')
      .eq('household_id', householdId)
      .not('category_id', 'is', null)
      .order('criado_em', { ascending: false })
      .order('data', { ascending: false })
      .range(de, de + 999)
    data.push(...(pagina ?? []))
    if (!pagina || pagina.length < 1000) break
  }

  // Correção manual = a categoria do lançamento é diferente da que a leitura sugeriu para ele
  // no documento. É o sinal mais forte: foi a família que decidiu.
  const idsDocs = Array.from(new Set((data as { document_id: string | null }[]).map((t) => t.document_id).filter(Boolean))) as string[]
  const sugeridaNaLeitura = new Map<string, string | null>()
  for (let i = 0; i < idsDocs.length; i += 100) {
    const { data: docs } = await supabase.from('document').select('id, extracao').in('id', idsDocs.slice(i, i + 100))
    for (const d of (docs ?? []) as { id: string; extracao: { lancamentos?: LancamentoExtraido[] } | null }[]) {
      for (const l of d.extracao?.lancamentos ?? []) sugeridaNaLeitura.set(`${d.id}|${l.descricao}|${Number(l.valor)}|${l.data}`, l.categoria_sugerida ?? null)
    }
  }

  const nomesCategoria = new Set<string>()
  const nova = () => ({ tres: new Map<string, Registro>(), duas: new Map<string, Registro>(), canal: new Map<string, Registro>(), marca: new Map<string, Registro>() })
  // Uma tabela por natureza (Salário nunca vira categoria de despesa e vice-versa); "manual" só com correções.
  const porNatureza = { despesa: { geral: nova(), manual: nova() }, receita: { geral: nova(), manual: nova() } }
  for (const t of (data ?? []) as {
    descricao: string
    canal: string | null
    natureza: 'despesa' | 'receita'
    valor: number | string
    data: string
    document_id: string | null
    category: { nome: string } | { nome: string }[] | null
  }[]) {
    const cat = (Array.isArray(t.category) ? t.category[0] : t.category)?.nome
    if (!cat) continue
    nomesCategoria.add(cat)
    const chaveLeitura = `${t.document_id}|${t.descricao}|${Number(t.valor)}|${t.data}`
    const manual = !t.document_id || (sugeridaNaLeitura.has(chaveLeitura) && sugeridaNaLeitura.get(chaveLeitura) !== cat)
    const tabs = porNatureza[t.natureza === 'receita' ? 'receita' : 'despesa']
    const p = palavras(t.descricao)
    for (const tab of manual ? [tabs.geral, tabs.manual] : [tabs.geral]) {
      // a lista vem do mais novo pro mais antigo: a 1ª vez de cada chave é a "última" escolha
      somar(tab.tres, p.slice(0, 3).join(' '), cat)
      somar(tab.duas, p.slice(0, 2).join(' '), cat)
      if (t.canal) somar(tab.canal, normalizar(t.canal).trim(), cat)
      somar(tab.marca, marcaDe(t.descricao), cat)
    }
  }

  const dominante = (r: Registro | undefined) => {
    if (!r) return null
    const [cat, n] = Array.from(r.contagem.entries()).sort((a, b) => b[1] - a[1])[0]
    return n / r.total >= 0.6 ? cat : null
  }

  return {
    sugerir(l) {
      const tabs = porNatureza[l.natureza === 'receita' ? 'receita' : 'despesa']
      const p = palavras(l.descricao)
      const k3 = p.slice(0, 3).join(' ')
      const k2 = p.length >= 2 ? p.slice(0, 2).join(' ') : ''
      const kc = l.canal ? normalizar(l.canal).trim() : ''
      const km = marcaDe(l.descricao)
      // 1) correção feita pela família (a mais recente) para a empresa ou a marca
      const corrigida =
        ultima(tabs.manual.tres.get(k3)) ??
        (k2 ? ultima(tabs.manual.duas.get(k2)) : null) ??
        (kc ? marcaConsistente(tabs.manual.canal.get(kc)) ?? ultima(tabs.manual.canal.get(kc)) : null) ??
        (km ? marcaConsistente(tabs.manual.marca.get(km)) : null)
      if (corrigida) return corrigida
      // 2) tipo de estabelecimento explícito no nome (farmácia, restaurante, bar...)
      if (l.natureza !== 'receita') {
        const nome = normalizar(l.descricao).replace(/[^a-z ]+/g, ' ')
        const tipo = TIPOS.find((t) => t.re.test(nome))
        if (tipo && nomesCategoria.has(tipo.categoria)) return tipo.categoria
      }
      // 3) padrão do histórico (dominante) para a empresa, o canal ou a marca
      return (
        // histórico empatado para a mesma empresa: vale a escolha mais recente
        (dominante(tabs.geral.tres.get(k3)) ?? ultima(tabs.geral.tres.get(k3))) ??
        (k2 ? dominante(tabs.geral.duas.get(k2)) : null) ??
        (kc ? marcaConsistente(tabs.geral.canal.get(kc)) : null) ??
        (km ? marcaConsistente(tabs.geral.marca.get(km)) : null)
      )
    },
  }
}

/** Aplica o histórico aos lançamentos lidos pela IA. Marca quais vieram do histórico. */
export async function categorizarPeloHistorico<T extends LancamentoExtraido>(
  supabase: SupabaseClient,
  householdId: string,
  lancamentos: T[],
): Promise<{ lancamentos: (T & { categoria_pelo_historico?: boolean })[]; aplicados: number }> {
  if (lancamentos.length === 0) return { lancamentos, aplicados: 0 }
  const aprendizado = await aprenderCategorias(supabase, householdId)
  let aplicados = 0
  const saida = lancamentos.map((l) => {
    const sugestao = aprendizado.sugerir(l)
    if (!sugestao) return l
    aplicados++
    return { ...l, categoria_sugerida: sugestao, categoria_pelo_historico: true }
  })
  return { lancamentos: saida, aplicados }
}
