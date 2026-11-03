import { deslocarMes, lancamentosEntre, mesAtual, type Contexto, type Lanc } from './dados'
import type { Fato } from './fatos'

// Alertas de cobrança estranha, calculados por CÓDIGO comparando os meses (sem IA, sem custo).
// Olha só lançamentos com data até hoje — parcelas futuras projetadas nas faturas ficam de fora.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
const nomeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

// "Zig *Casa de Taipa" / "ZIG*CASA DE TAIPA 02/10" → "casa de taipa": chave estável da empresa.
export function chaveEmpresa(t: Pick<Lanc, 'descricao' | 'canal'>): string {
  if (t.canal) return t.canal.toLowerCase()
  return t.descricao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\d{2}\/\d{2}\s*$/, '')
    .replace(/^[a-z]{1,4}\s*\*\s*/, '')
    .replace(/[*\d.\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

const TARIFA = /(anuidade|juros|iof|multa|tarifa|encargo|mora|rotativo|seguro fatura|avaliacao emergencial)/i
const parcelado = (t: Lanc) => !!t.parcela_total && t.parcela_total > 1

function mediana(v: number[]) {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function detectarAnomalias(ctx: Contexto): Promise<Fato[]> {
  const mes = mesAtual(ctx)
  const inicio = `${deslocarMes(mes, -6)}-01`
  const todos = (await lancamentosEntre(ctx, inicio, `${deslocarMes(mes, 1)}-01`)).filter(
    (t) => t.natureza === 'despesa' && t.data <= ctx.hoje,
  )
  // Mês analisado: o último com lançamentos (normalmente o da fatura mais recente).
  // (ignora parcelas: as faturas projetam parcelas em meses que ainda não tiveram compras)
  const mesesComDado = Array.from(new Set(todos.filter((t) => !parcelado(t)).map((t) => t.data.slice(0, 7)))).sort()
  const alvo = mesesComDado[mesesComDado.length - 1]
  if (!alvo) return []
  const doAlvo = todos.filter((t) => t.data.startsWith(alvo))
  // Tarifas e duplicidades olham os dois últimos meses com fatura (um encargo de atraso do mês
  // passado ainda merece alerta).
  const mesesRecentes = mesesComDado.slice(-2)
  const recentes = todos.filter((t) => mesesRecentes.includes(t.data.slice(0, 7)))
  const periodo = mesesRecentes.length > 1 ? `${nomeMes(mesesRecentes[0])} e ${nomeMes(mesesRecentes[1])}` : nomeMes(alvo)
  const anteriores = todos.filter((t) => t.data.slice(0, 7) < alvo)
  const fatos: Fato[] = []

  // Soma por empresa e mês (fora parcelas, que têm regra própria)
  const porEmpresaMes = new Map<string, Map<string, number>>()
  for (const t of todos.filter((x) => !parcelado(x))) {
    const k = chaveEmpresa(t)
    const m = porEmpresaMes.get(k) ?? new Map<string, number>()
    m.set(t.data.slice(0, 7), (m.get(t.data.slice(0, 7)) ?? 0) + Number(t.valor))
    porEmpresaMes.set(k, m)
  }

  // 1. Valor bem acima do normal numa empresa recorrente (assinaturas, contas, serviços)
  const subiu: { empresa: string; atual: number; normal: number }[] = []
  const tresAntes = [1, 2, 3].map((i) => deslocarMes(alvo, -i))
  for (const [empresa, meses] of porEmpresaMes) {
    const atual = meses.get(alvo)
    const historico = tresAntes.map((m) => meses.get(m)).filter((v): v is number => v !== undefined)
    if (!atual || historico.length < 2) continue
    const normal = mediana(historico)
    if (atual >= normal * 1.3 && atual - normal >= 30) subiu.push({ empresa, atual, normal })
  }
  subiu.sort((a, b) => b.atual - b.normal - (a.atual - a.normal))
  if (subiu.length) {
    fatos.push({
      id: `anom-subiu-${alvo}-${subiu.map((s) => s.empresa).join('|')}`,
      titulo: `Cobrança acima do normal em ${nomeMes(alvo)}: ${subiu[0].empresa} ${brl(subiu[0].atual)} (costuma ${brl(subiu[0].normal)})`,
      detalhe:
        subiu.length > 1
          ? `Também: ${subiu
              .slice(1, 4)
              .map((s) => `${s.empresa} ${brl(s.atual)} (costuma ${brl(s.normal)})`)
              .join('; ')}.`
          : 'Confira se houve reajuste, upgrade de plano ou cobrança indevida.',
      link: '/contas-a-pagar?aba=lancamentos',
      peso: 90,
      tom: 'alerta',
    })
  }

  // 2. Possível cobrança duplicada: mesma empresa, mesmo valor, no mesmo dia ou no dia seguinte
  const duplicadas: string[] = []
  const vistos = new Map<string, string>()
  for (const t of [...recentes].filter((x) => !parcelado(x)).sort((a, b) => a.data.localeCompare(b.data))) {
    const k = `${chaveEmpresa(t)}·${Number(t.valor).toFixed(2)}`
    const anterior = vistos.get(k)
    if (anterior && (new Date(t.data).getTime() - new Date(anterior).getTime()) / 86_400_000 <= 1 && Number(t.valor) >= 20)
      duplicadas.push(`${t.descricao} ${brl(Number(t.valor))} (${t.data.slice(8, 10)}/${t.data.slice(5, 7)})`)
    vistos.set(k, t.data)
  }
  if (duplicadas.length) {
    fatos.push({
      id: `anom-dup-${mesesRecentes.join('|')}-${duplicadas.length}`,
      titulo: `${duplicadas.length} possível${duplicadas.length > 1 ? 'eis' : ''} cobrança${duplicadas.length > 1 ? 's' : ''} duplicada${duplicadas.length > 1 ? 's' : ''} em ${periodo}`,
      detalhe: `${duplicadas.slice(0, 3).join('; ')}. Mesmo valor e empresa em até 1 dia: confira na fatura.`,
      link: '/contas-a-pagar?aba=lancamentos',
      peso: 85,
      tom: 'alerta',
    })
  }

  // 3. Parcela repetida: o mesmo número de parcela cobrado em meses diferentes
  const parcelas = new Map<string, Set<string>>()
  const repetidas: string[] = []
  for (const t of todos.filter(parcelado)) {
    const base = t.descricao.replace(/\s*\d{2}\/\d{2}\s*$/, '').trim().toLowerCase()
    const k = `${base}·${t.parcela_num}/${t.parcela_total}`
    const meses = parcelas.get(k) ?? new Set<string>()
    meses.add(t.data.slice(0, 7))
    parcelas.set(k, meses)
  }
  for (const [k, meses] of parcelas) if (meses.size > 1) repetidas.push(k.split('·').join(' parcela '))
  if (repetidas.length) {
    fatos.push({
      id: `anom-parc-${repetidas.join('|')}`,
      titulo: `Parcela cobrada em mais de um mês: ${repetidas[0]}`,
      detalhe: repetidas.length > 1 ? `Mais ${repetidas.length - 1} caso(s). Confira nas faturas.` : 'Confira nas faturas se não foi cobrada duas vezes.',
      link: '/contas-a-pagar?aba=parcelas',
      peso: 80,
      tom: 'alerta',
    })
  }

  // 4. Tarifas, juros, IOF, multa ou anuidade
  const tarifas = recentes.filter((t) => TARIFA.test(t.descricao)).sort((a, b) => Number(b.valor) - Number(a.valor))
  const totalTarifas = tarifas.reduce((s, t) => s + Number(t.valor), 0)
  const graves = tarifas.filter((t) => /(juros|multa|mora|rotativo|anuidade|encargo)/i.test(t.descricao))
  if (graves.length || totalTarifas >= 10) {
    fatos.push({
      id: `anom-tarifa-${mesesRecentes.join('|')}-${Math.round(totalTarifas)}`,
      titulo: graves.length
        ? `${brl(totalTarifas)} em juros, encargos e IOF em ${periodo}`
        : `${brl(totalTarifas)} em tarifas/IOF em ${periodo}`,
      detalhe: tarifas
        .slice(0, 4)
        .map((t) => `${t.descricao} ${brl(Number(t.valor))} (${t.data.slice(8, 10)}/${t.data.slice(5, 7)})`)
        .join('; ') + (graves.length ? '. Encargo de atraso costuma vir de fatura paga depois do vencimento.' : ''),
      link: '/contas-a-pagar?aba=lancamentos',
      peso: graves.length ? 82 : 45,
      tom: graves.length ? 'alerta' : 'info',
    })
  }

  // 5. Cobranças novas e altas (empresa nunca vista nos 6 meses anteriores)
  const empresasAntes = new Set(anteriores.map(chaveEmpresa))
  const novas = new Map<string, number>()
  for (const t of doAlvo.filter((x) => !parcelado(x) && !TARIFA.test(x.descricao))) {
    const k = chaveEmpresa(t)
    if (!empresasAntes.has(k)) novas.set(k, (novas.get(k) ?? 0) + Number(t.valor))
  }
  const novasAltas = Array.from(novas.entries())
    .filter(([, v]) => v >= 300)
    .sort((a, b) => b[1] - a[1])
  if (novasAltas.length && anteriores.length > 0) {
    fatos.push({
      id: `anom-nova-${alvo}-${novasAltas.map(([k]) => k).join('|')}`,
      titulo: `${novasAltas.length} cobrança${novasAltas.length > 1 ? 's' : ''} nova${novasAltas.length > 1 ? 's' : ''} acima de R$ 300 em ${nomeMes(alvo)}`,
      detalhe: `${novasAltas
        .slice(0, 3)
        .map(([k, v]) => `${k} ${brl(v)}`)
        .join('; ')}. Empresas que não apareciam nos meses anteriores.`,
      link: '/contas-a-pagar?aba=lancamentos',
      peso: 60,
      tom: 'atencao',
    })
  }

  return fatos
}
