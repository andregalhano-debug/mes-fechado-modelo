import { detectarAnomalias } from './anomalias'
import { contasAPagar, deslocarMes, gastosDoMes, mesAtual, parcelasEmAberto, type Contexto } from './dados'

// Fatos objetivos calculados por CÓDIGO (não pela IA) a partir dos dados do app.
// São a base dos insights: a IA, quando acionada, só prioriza e sugere a ação — os números
// vêm sempre daqui, então nunca são inventados.
export type Fato = {
  id: string
  titulo: string
  detalhe: string
  link: string
  /** quanto maior, mais relevante (ordena o card) */
  peso: number
  tom: 'alerta' | 'atencao' | 'info' | 'bom'
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const nomeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

export async function gerarFatos(ctx: Contexto): Promise<Fato[]> {
  const mes = mesAtual(ctx)
  const ultimoFechado = deslocarMes(mes, -1)
  const [contasMes, gastosFechado, g2, g3, g4, parcelas, anomalias] = await Promise.all([
    contasAPagar(ctx, mes),
    gastosDoMes(ctx, ultimoFechado),
    gastosDoMes(ctx, deslocarMes(mes, -2)),
    gastosDoMes(ctx, deslocarMes(mes, -3)),
    gastosDoMes(ctx, deslocarMes(mes, -4)),
    parcelasEmAberto(ctx),
    detectarAnomalias(ctx),
  ])
  const fatos: Fato[] = [...anomalias]

  // 1. Contas atrasadas e a vencer nos próximos 7 dias
  const em7 = new Date(ctx.hoje)
  em7.setDate(em7.getDate() + 7)
  const limite7 = em7.toISOString().slice(0, 10)
  const atrasadas = contasMes.contas.filter((c) => c.situacao === 'atrasada')
  const aVencer = contasMes.contas.filter((c) => c.situacao === 'em aberto' && c.vencimento <= limite7)
  if (atrasadas.length > 0) {
    fatos.push({
      id: `atrasadas-${mes}`,
      titulo: `${atrasadas.length} conta${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''}: ${brl(atrasadas.reduce((s, c) => s + c.valor, 0))}`,
      detalhe: atrasadas.slice(0, 3).map((c) => c.descricao).join(', ') + (atrasadas.length > 3 ? '…' : ''),
      link: '/contas-a-pagar?aba=contas',
      peso: 100,
      tom: 'alerta',
    })
  }
  if (aVencer.length > 0) {
    fatos.push({
      id: `vencer7-${ctx.hoje}`,
      titulo: `${aVencer.length} conta${aVencer.length > 1 ? 's vencem' : ' vence'} em até 7 dias: ${brl(aVencer.reduce((s, c) => s + c.valor, 0))}`,
      detalhe: aVencer
        .slice(0, 3)
        .map((c) => `${c.descricao} (${c.vencimento.slice(8, 10)}/${c.vencimento.slice(5, 7)})`)
        .join(', '),
      link: '/contas-a-pagar?aba=contas',
      peso: 80,
      tom: 'atencao',
    })
  }

  // 2. Categoria do último mês fechado bem acima da média dos 3 meses anteriores
  const media = (cat: string) => {
    const vals = [g2, g3, g4].map((g) => g.categorias.find((c) => c.categoria === cat)?.total ?? 0)
    const comDado = vals.filter((v) => v > 0)
    return comDado.length >= 2 ? comDado.reduce((a, b) => a + b, 0) / comDado.length : null
  }
  const altas = gastosFechado.categorias
    .map((c) => ({ ...c, media: media(c.categoria) }))
    .filter((c) => c.media !== null && c.total - c.media! >= 300 && c.total >= c.media! * 1.25)
    .sort((a, b) => b.total - b.media! - (a.total - a.media!))
  if (altas[0]) {
    const a = altas[0]
    fatos.push({
      id: `alta-${ultimoFechado}-${a.categoria}`,
      titulo: `${a.categoria} em ${nomeMes(ultimoFechado)}: ${brl(a.total)}, ${Math.round((a.total / a.media! - 1) * 100)}% acima da média`,
      detalhe: `Média dos 3 meses anteriores: ${brl(a.media!)}. Maiores itens: ${a.maiores_itens
        .slice(0, 2)
        .map((i) => `${i.descricao} ${brl(i.valor)}`)
        .join(', ')}.`,
      link: '/',
      peso: 70,
      tom: 'atencao',
    })
  }

  // 3. Assinaturas recorrentes
  const assinaturas = gastosFechado.categorias.find((c) => c.categoria.toLowerCase().startsWith('assinatura'))
  if (assinaturas && assinaturas.total > 0) {
    fatos.push({
      id: `assinaturas-${ultimoFechado}`,
      titulo: `Assinaturas: ${brl(assinaturas.total)}/mês (${brl(assinaturas.total * 12)}/ano)`,
      detalhe: assinaturas.maiores_itens.map((i) => `${i.descricao} ${brl(i.valor)}`).join(', '),
      link: '/contas-a-pagar?aba=lancamentos',
      peso: 40,
      tom: 'info',
    })
  }

  // 4. Parcelas comprometidas nos próximos meses
  if (parcelas.compras_em_aberto > 0) {
    const prox = parcelas.proximos_meses[0]
    fatos.push({
      id: `parcelas-${mes}`,
      titulo: `${brl(prox.valor)} em parcelas já comprometidas em ${nomeMes(prox.mes)}`,
      detalhe: `${parcelas.compras_em_aberto} compras parceladas em aberto, ${brl(parcelas.total_restante)} no total até quitar.`,
      link: '/contas-a-pagar?aba=parcelas',
      peso: 50,
      tom: 'info',
    })
  }

  // Patrimônio não entra nos insights: aparece na Visão geral e em sugestões, e só deve ser
  // visto na tela Patrimônio (protegida).

  return fatos.sort((a, b) => b.peso - a.peso)
}
