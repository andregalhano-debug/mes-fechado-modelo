import Link from 'next/link'
import { ProtecaoValores } from '@/components/protecao-valores'
import { createClient } from '@/lib/supabase/server'
import {
  criarConta,
  desativarConta,
  atualizarSaldoConta,
  criarInvestimento,
  atualizarInvestimento,
  removerInvestimento,
  criarBem,
  atualizarBem,
  removerBem,
  criarRetido,
  removerRetido,
  atualizarRetido,
  iniciarProximoMes,
  voltarMesAnterior,
} from './actions'
import { FormularioComConfirmacao } from '@/components/formulario-com-confirmacao'
import { FormularioQueLimpa } from '@/components/formulario-que-limpa'
import { CampoMoeda } from '@/components/campo-moeda'
import { HistoricoPatrimonio } from './historico-patrimonio'
import { BlocosPatrimonio, type Bloco } from './blocos-patrimonio'
import { BotaoEnviar } from '@/components/botao-enviar'
import { cookies } from 'next/headers'
import { FiltroPessoa } from '@/components/filtro-pessoa'
import { DonoInline } from '@/components/dono-inline'
import { corDono, primeiroNome, ROTULO_COMPARTILHADO, ROTULO_JUNTOS } from '@/lib/donos'

const inputClasse =
  'w-32 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-right tabular-nums text-neutral-900 outline-none focus:border-militar-600 focus:ring-2 focus:ring-militar-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const botaoSalvar =
  'rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500'
// Salvar de cada linha: discreto até algum valor mudar (aí o BotaoEnviar destaca sozinho).
const botaoSalvarLinha =
  'min-w-[86px] rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
const botaoRemover = 'text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400'
const cartao =
  'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'
const linha =
  'flex flex-wrap items-center justify-between gap-3 py-3 border-b border-neutral-100 last:border-0 dark:border-neutral-800'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const rotuloClasse: Record<string, string> = {
  renda_fixa: 'Renda fixa',
  renda_variavel: 'Renda variável',
  internacional: 'Internacional',
  cripto: 'Cripto',
  fundo: 'Fundo',
  outro: 'Outro',
}
const rotuloTipoBem: Record<string, string> = {
  veiculo: 'Veículo',
  imovel: 'Imóvel',
  outro: 'Outro',
}
const rotuloTipoRetido: Record<string, string> = {
  fgts: 'FGTS',
  precatorio: 'Precatório',
  outro: 'Outro',
}
const rotuloTipoConta: Record<string, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  cartao: 'Cartão',
  corretora: 'Corretora',
  exchange: 'Exchange',
  especie: 'Espécie',
}

function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function nomeMesCurto(mesIso: string) {
  const [ano, mes] = mesIso.slice(0, 7).split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default async function Patrimonio({
  searchParams,
}: {
  searchParams: Promise<{ quem?: string | string[] }>
}) {
  const supabase = await createClient()

  const { data: periodo } = await supabase.from('patrimonio_periodo').select('mes').single()
  const mesAberto = periodo?.mes ?? new Date().toISOString().slice(0, 8) + '01'

  const [contas, investimentos, bens, retidos, cotacoes, histContas, histInvest, histBens, histRetidos, membrosData] =
    await Promise.all([
      supabase.from('account').select('*').eq('mes', mesAberto).eq('ativo', true).order('nome'),
      supabase.from('investment_position').select('*').eq('mes', mesAberto).order('descricao'),
      supabase.from('physical_asset').select('*').eq('mes', mesAberto).order('descricao'),
      supabase.from('retained_resource').select('*').eq('mes', mesAberto).order('descricao'),
      supabase.from('fx_rate').select('moeda, taxa_brl, data').order('data', { ascending: false }),
      supabase.from('account').select('linhagem_id, mes, nome, instituicao, saldo_atual, member_id'),
      supabase.from('investment_position').select('linhagem_id, mes, descricao, valor_mercado, member_id'),
      supabase.from('physical_asset').select('linhagem_id, mes, descricao, valor_estimado'),
      supabase.from('retained_resource').select('linhagem_id, mes, descricao, saldo, member_id'),
      supabase.from('member').select('id, nome, apelido').order('nome'),
    ])

  // -------- De quem é cada item: a casa toda ou cada pessoa --------
  const membros = (membrosData.data ?? []) as { id: string; nome: string; apelido: string | null }[]
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const parametros = await searchParams
  const jarCookies = await cookies()
  const quemCookie = jarCookies.get('visao_pessoa')?.value ?? jarCookies.get('patrimonio_quem')?.value ?? null
  const quemParam = typeof parametros?.quem === 'string' ? parametros.quem : null
  const quemValido = (v: string | null): v is string => v === 'todos' || membros.some((m) => m.id === v)
  // A visão vem do cookie global (seletor do menu); ?quem= antigo é ignorado pra não divergir do menu.
  void quemParam
  const pessoa = quemValido(quemCookie) ? quemCookie : 'todos'
  const pessoaMembro = membros.find((m) => m.id === pessoa) ?? null
  const nomePessoa = pessoaMembro ? primeiroNome(pessoaMembro.nome) : null
  const donoPadrao = pessoaMembro?.id ?? (membros.some((m) => m.id === user?.id) ? user!.id : '')

  // Abertura do mês aberto (carimbo da cópia do mês anterior), calculada com TODOS os itens —
  // antes de filtrar por pessoa — pra saber o que cada um ainda precisa atualizar.
  const temMesAnterior = [
    ...(histContas.data ?? []),
    ...(histInvest.data ?? []),
    ...(histBens.data ?? []),
    ...(histRetidos.data ?? []),
  ].some((x) => x.mes < mesAberto)
  const todosCarimbos = [
    ...(contas.data ?? []).map((c) => c.saldo_atualizado_em as string | null),
    ...(investimentos.data ?? []).map((i) => i.atualizado_em as string),
    ...(bens.data ?? []).map((b) => b.atualizado_em as string),
    ...(retidos.data ?? []).map((r) => r.atualizado_em as string),
  ].filter((c): c is string => !!c)
  // Hora em que o mês foi aberto = criação das contas copiadas do mês anterior (criado_em não
  // muda ao salvar). Antes usava o carimbo mais antigo, mas depois de tudo revisado o primeiro
  // item salvo virava a "abertura" e voltava a aparecer como pendente.
  const criacoesContas = (contas.data ?? [])
    .map((c) => (c.criado_em ? new Date(c.criado_em as string).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
  const abertura0 = !temMesAnterior
    ? null
    : criacoesContas.length
      ? Math.min(...criacoesContas)
      : todosCarimbos.length
        ? Math.min(...todosCarimbos.map((c) => new Date(c).getTime()))
        : null
  const naoRevisado = (c: string | null | undefined) =>
    abertura0 !== null && !(c && new Date(c).getTime() > abertura0 + 60_000)
  const itensComDono = [
    ...(contas.data ?? []).map((c) => ({ dono: c.member_id as string | null, carimbo: c.saldo_atualizado_em as string | null })),
    ...(investimentos.data ?? []).map((i) => ({ dono: i.member_id as string | null, carimbo: i.atualizado_em as string })),
    ...(retidos.data ?? []).map((r) => ({ dono: r.member_id as string | null, carimbo: r.atualizado_em as string })),
    ...(bens.data ?? []).map((b) => ({ dono: null, carimbo: b.atualizado_em as string })),
  ]
  const opcoesPessoa = [
    { valor: 'todos', rotulo: ROTULO_JUNTOS, pendentes: itensComDono.filter((x) => naoRevisado(x.carimbo)).length },
    ...membros.map((m) => ({
      valor: m.id,
      rotulo: primeiroNome(m.nome),
      pendentes: itensComDono.filter((x) => x.dono === m.id && naoRevisado(x.carimbo)).length,
    })),
  ]

  // Na visão de uma pessoa, a tela inteira (totais, deltas, histórico) passa a considerar só
  // os itens dela. Bens não têm dono no banco: ficam como "Família", só no Consolidado.
  if (pessoa !== 'todos') {
    const daPessoa = <T extends { member_id?: string | null }>(lista: T[] | null) =>
      (lista ?? []).filter((x) => x.member_id === pessoa)
    contas.data = daPessoa(contas.data)
    investimentos.data = daPessoa(investimentos.data)
    retidos.data = daPessoa(retidos.data)
    bens.data = []
    histContas.data = daPessoa(histContas.data)
    histInvest.data = daPessoa(histInvest.data)
    histRetidos.data = daPessoa(histRetidos.data)
    histBens.data = []
  }

  // Totais por dono no cabeçalho de cada bloco (só no Consolidado).
  function divisao(lista: { member_id?: string | null }[] | null, campo: string) {
    if (pessoa !== 'todos' || !lista || lista.length === 0) return null
    const totais = new Map<string, number>()
    for (const x of lista) {
      const chave = x.member_id ?? 'familia'
      totais.set(chave, (totais.get(chave) ?? 0) + Number((x as Record<string, unknown>)[campo] ?? 0))
    }
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from(totais.entries()).map(([chave, valor]) => {
          const m = membros.find((x) => x.id === chave)
          return (
            <span key={chave} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${corDono(m?.id ?? null, membros)}`}>
              {m ? primeiroNome(m.nome) : ROTULO_COMPARTILHADO} {brl.format(valor)}
            </span>
          )
        })}
      </div>
    )
  }

  function seletorDono() {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">De quem</span>
        <select
          name="member_id"
          defaultValue={donoPadrao}
          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {primeiroNome(m.nome)}
            </option>
          ))}
          <option value="">{ROTULO_COMPARTILHADO} (conjunto)</option>
        </select>
      </label>
    )
  }

  // A query já vem ordenada por data desc — a primeira ocorrência de cada moeda é a mais recente.
  const taxaPorMoeda = new Map<string, number>()
  for (const c of cotacoes.data ?? []) {
    if (!taxaPorMoeda.has(c.moeda)) taxaPorMoeda.set(c.moeda, c.taxa_brl)
  }

  function valorEmBrl(valor: number, moeda: string) {
    if (moeda === 'BRL') return null
    const taxa = taxaPorMoeda.get(moeda)
    return taxa ? brl.format(valor * taxa) : null
  }

  // Junta as 4 tabelas num histórico único (por linhagem_id, item que atravessa os meses)
  // pra tela de deltas — inclui todos os meses, não só o mês aberto.
  const itensHistorico = [
    ...(histContas.data ?? []).map((c) => ({
      tipo: 'conta' as const,
      linhagemId: c.linhagem_id,
      rotulo: c.instituicao ?? c.nome,
      mes: c.mes,
      valor: Number(c.saldo_atual),
    })),
    ...(histInvest.data ?? []).map((i) => ({
      tipo: 'investimento' as const,
      linhagemId: i.linhagem_id,
      rotulo: i.descricao,
      mes: i.mes,
      valor: Number(i.valor_mercado),
    })),
    ...(histBens.data ?? []).map((b) => ({
      tipo: 'bem' as const,
      linhagemId: b.linhagem_id,
      rotulo: b.descricao,
      mes: b.mes,
      valor: Number(b.valor_estimado),
    })),
    ...(histRetidos.data ?? []).map((r) => ({
      tipo: 'retido' as const,
      linhagemId: r.linhagem_id,
      rotulo: r.descricao,
      mes: r.mes,
      valor: Number(r.saldo),
    })),
  ]

  // -------- Indicadores do topo: total de cada bloco + delta vs mês anterior --------
  const somaContas = (contas.data ?? []).reduce((t, c) => t + Number(c.saldo_atual), 0)
  const somaInvest = (investimentos.data ?? []).reduce((t, i) => t + Number(i.valor_mercado), 0)
  const somaBens = (bens.data ?? []).reduce((t, b) => t + Number(b.valor_estimado), 0)
  const somaRetidos = (retidos.data ?? []).reduce((t, r) => t + Number(r.saldo), 0)
  const totalGeral = somaContas + somaInvest + somaBens + somaRetidos

  const mesesDisponiveis = Array.from(new Set(itensHistorico.map((i) => i.mes))).sort()
  const mesAnterior = mesesDisponiveis.filter((m) => m < mesAberto).pop() ?? null
  const mesSeguinte = (() => {
    const [ano, mes] = mesAberto.slice(0, 7).split('-').map(Number)
    return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10)
  })()
  const mesCalendario = new Date().toISOString().slice(0, 8) + '01'
  const abrirAntecipado = mesSeguinte > mesCalendario

  // -------- O que já foi revisado no mês aberto --------
  // Ao abrir o mês, tudo é copiado do anterior com o mesmo carimbo de hora; cada "Salvar"
  // atualiza o carimbo daquela linha. Então: carimbo depois da abertura = revisado neste mês.
  const carimbos = [
    ...(contas.data ?? []).map((c) => c.saldo_atualizado_em as string | null),
    ...(investimentos.data ?? []).map((i) => i.atualizado_em as string),
    ...(bens.data ?? []).map((b) => b.atualizado_em as string),
    ...(retidos.data ?? []).map((r) => r.atualizado_em as string),
  ].filter((c): c is string => !!c)
  const aberturaMes = abertura0
  function revisado(carimbo: string | null | undefined) {
    if (aberturaMes === null) return true
    return !!carimbo && new Date(carimbo).getTime() > aberturaMes + 60_000
  }
  const totalItens = carimbos.length + (contas.data ?? []).filter((c) => !c.saldo_atualizado_em).length
  const itensRevisados = [
    ...(contas.data ?? []).map((c) => c.saldo_atualizado_em),
    ...(investimentos.data ?? []).map((i) => i.atualizado_em),
    ...(bens.data ?? []).map((b) => b.atualizado_em),
    ...(retidos.data ?? []).map((r) => r.atualizado_em),
  ].filter((c) => revisado(c)).length
  const faltamRevisar = totalItens - itensRevisados
  const percentualRevisado = totalItens > 0 ? Math.round((itensRevisados / totalItens) * 100) : 100

  if (pessoa !== 'todos') {
    const pendentePrimeiro = (a: { saldo_atualizado_em?: string; atualizado_em?: string }, b: { saldo_atualizado_em?: string; atualizado_em?: string }) =>
      Number(revisado(a.saldo_atualizado_em ?? a.atualizado_em)) - Number(revisado(b.saldo_atualizado_em ?? b.atualizado_em))
    contas.data?.sort(pendentePrimeiro)
    investimentos.data?.sort(pendentePrimeiro)
    retidos.data?.sort(pendentePrimeiro)
  }

  function seloRevisao(carimbo: string | null | undefined) {
    if (aberturaMes === null) return null
    return revisado(carimbo) ? (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        ✓ atualizado
      </span>
    ) : (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        valor de {nomeMesCurto(mesAnterior!)} · revisar
      </span>
    )
  }

  function totalDoTipo(tipo: (typeof itensHistorico)[number]['tipo'] | null, mes: string) {
    return itensHistorico
      .filter((i) => i.mes === mes && (tipo === null || i.tipo === tipo))
      .reduce((t, i) => t + i.valor, 0)
  }

  function calcularDelta(atual: number, anterior: number | null) {
    if (anterior === null) return null
    const diferenca = atual - anterior
    const percentual = anterior !== 0 ? (diferenca / Math.abs(anterior)) * 100 : null
    return { diferenca, percentual }
  }

  const indicadores = (
    [
      { rotulo: nomePessoa ? `Patrimônio de ${nomePessoa}` : 'Patrimônio total', tipo: null, valor: totalGeral, ancora: 'historico' },
      { rotulo: 'Contas', tipo: 'conta' as const, valor: somaContas, ancora: 'contas' },
      { rotulo: 'Investimentos', tipo: 'investimento' as const, valor: somaInvest, ancora: 'investimentos' },
      { rotulo: 'Bens', tipo: 'bem' as const, valor: somaBens, ancora: 'bens' },
      { rotulo: 'Retidos', tipo: 'retido' as const, valor: somaRetidos, ancora: 'retidos' },
    ] satisfies { rotulo: string; tipo: (typeof itensHistorico)[number]['tipo'] | null; valor: number; ancora: string }[]
  ).filter((item) => pessoa === 'todos' || item.tipo !== 'bem').map((item) => ({
    ...item,
    share: item.tipo !== null && totalGeral > 0 ? (item.valor / totalGeral) * 100 : null,
    delta: mesAnterior ? calcularDelta(item.valor, totalDoTipo(item.tipo, mesAnterior)) : null,
  }))

  // Série mês a mês de cada bloco, pro gráfico de linhas (null = sem itens daquele tipo no mês).
  const mesesGrafico = mesesDisponiveis.filter((m) => m <= mesAberto)
  const blocosGrafico: Bloco[] = indicadores.map((ind) => ({
    id: ind.tipo ?? 'total',
    rotulo: ind.rotulo,
    valor: ind.valor,
    share: ind.share,
    delta: ind.delta,
    serie: mesesGrafico.map((m) =>
      itensHistorico.some((i) => i.mes === m && (ind.tipo === null || i.tipo === ind.tipo)) ? totalDoTipo(ind.tipo, m) : null,
    ),
  }))

  return (
    <main className="w-full flex-1 px-5 py-8 md:px-8 lg:px-10">
      <ProtecaoValores />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Patrimônio</h1>
        <span className="rounded-full bg-militar-600 px-3 py-0.5 text-sm font-semibold text-white">
          Preenchendo {nomeMes(mesAberto)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FiltroPessoa opcoes={opcoesPessoa} atual={pessoa} />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {pessoa === 'todos'
            ? `Tudo da casa somado. O número ao lado de cada nome é o que falta atualizar.`
            : `Só o que é de ${nomePessoa}. Bens e itens da casa aparecem em ${ROTULO_JUNTOS}.`}
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Atualize os saldos de {nomeMes(mesAberto)} — cada linha salva na hora. Os números abaixo são deste mês.
      </p>

      {/* Faixa fixa: deixa sempre visível qual mês está sendo preenchido e quanto falta */}
      <div className="sticky top-[calc(var(--altura-topo,3.5rem)+var(--altura-faixa,0px))] z-[6] -mx-5 mt-4 border-y border-militar-200 bg-militar-50/95 px-5 py-2.5 backdrop-blur md:top-[var(--altura-faixa,0px)] md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 dark:border-militar-900 dark:bg-neutral-950/95">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <p className="text-sm font-semibold text-militar-800 dark:text-militar-400">
            {nomePessoa ? `${nomePessoa} · ` : ''}Mês em preenchimento: {maiuscula(nomeMes(mesAberto))}
          </p>
          {aberturaMes !== null && (
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-militar-100 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-militar-600 transition-all" style={{ width: `${percentualRevisado}%` }} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-militar-800 dark:text-militar-400">
                {itensRevisados} de {totalItens} atualizados
              </span>
            </div>
          )}
        </div>
      </div>

      <BlocosPatrimonio
        blocos={blocosGrafico}
        meses={mesesGrafico}
        nomeMesAnterior={mesAnterior ? nomeMesCurto(mesAnterior) : null}
      />

      <section className={`${cartao} mt-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {aberturaMes === null || faltamRevisar === 0
                ? `${maiuscula(nomeMes(mesAberto))} está em dia`
                : `${nomePessoa ? `${nomePessoa}, faltam` : 'Faltam'} ${faltamRevisar} ${faltamRevisar === 1 ? 'valor' : 'valores'} pra atualizar em ${nomeMes(mesAberto)}`}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {aberturaMes === null || faltamRevisar === 0
                ? `Quando ${nomeMesCurto(mesAberto)} terminar, feche o mês: os valores viram histórico e ${nomeMes(mesSeguinte)} abre com eles como ponto de partida.`
                : `As linhas marcadas "revisar" ainda estão com o valor de ${nomeMesCurto(mesAnterior!)}. Ajuste o saldo e toque em Salvar em cada uma.`}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <FormularioComConfirmacao
              action={iniciarProximoMes}
              mensagem={
                (faltamRevisar > 0
                  ? `Ainda há ${faltamRevisar} ${faltamRevisar === 1 ? 'valor' : 'valores'} sem atualizar em ${nomeMes(mesAberto)}. `
                  : '') +
                (abrirAntecipado ? `${maiuscula(nomeMes(mesSeguinte))} ainda não começou. ` : '') +
                `Fechar ${nomeMes(mesAberto)} e começar a preencher ${nomeMes(mesSeguinte)}?`
              }
            >
              <BotaoEnviar
                enviando="Abrindo…"
                sucesso={false}
                className={
                  faltamRevisar === 0 && !abrirAntecipado
                    ? 'rounded-lg bg-militar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-militar-500'
                    : 'rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }
              >
                Fechar {nomeMesCurto(mesAberto)} e abrir {nomeMesCurto(mesSeguinte)} →
              </BotaoEnviar>
            </FormularioComConfirmacao>
            {abrirAntecipado && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-right">
                {maiuscula(nomeMes(mesSeguinte))} ainda não começou — o ideal é fechar no início do mês que vem.
              </p>
            )}
            {mesAnterior && (
              <FormularioComConfirmacao
                action={voltarMesAnterior}
                mensagem={
                  `Desfazer a abertura de ${nomeMes(mesAberto)}? Os valores deste mês são apagados` +
                  (itensRevisados > 0 && aberturaMes !== null ? ` (inclusive ${itensRevisados} já atualizados)` : '') +
                  ` e ${nomeMes(mesAnterior)} volta a ficar aberto pra edição.`
                }
              >
                <button
                  type="submit"
                  className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-red-600 hover:underline dark:text-neutral-400 dark:hover:text-red-400"
                >
                  Abri por engano · voltar pra {nomeMesCurto(mesAnterior)}
                </button>
              </FormularioComConfirmacao>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-stretch">
      {/* Contas */}
      <section id="contas" className={`${cartao} scroll-mt-20 flex flex-col`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Contas</h2>
          <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
            {brl.format(somaContas)}
          </span>
        </div>
        {divisao(contas.data, 'saldo_atual')}
        <div className="mt-3">
          {(contas.data ?? []).map((c) => (
            <div key={c.id} className={linha}>
              <form action={atualizarSaldoConta} className="flex flex-1 items-center justify-between gap-3">
                <input type="hidden" name="id" value={c.id} />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {c.nome}
                    {pessoa === 'todos' && <DonoInline tabela="account" id={c.id} memberId={c.member_id} membros={membros} />}
                    {seloRevisao(c.saldo_atualizado_em)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {c.instituicao ?? (rotuloTipoConta[c.tipo] ?? c.tipo)} · {c.moeda}
                    {valorEmBrl(c.saldo_atual, c.moeda) && ` · ≈ ${valorEmBrl(c.saldo_atual, c.moeda)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CampoMoeda name="saldo" defaultValue={c.saldo_atual} className={inputClasse} />
                  <BotaoEnviar className={botaoSalvarLinha} destacarAlteracao>
                    Salvar
                  </BotaoEnviar>
                </div>
              </form>
              <FormularioComConfirmacao action={desativarConta} mensagem={`Desativar a conta "${c.nome}"?`}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className={botaoRemover}>
                  desativar
                </button>
              </FormularioComConfirmacao>
            </div>
          ))}
          {(contas.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma conta cadastrada.</p>
          )}
        </div>

        <div className="min-h-4 flex-1" aria-hidden="true" />
        <details
          open={pessoa === 'todos' ? undefined : false}
          className="group mt-auto rounded-xl border border-dashed border-militar-400 bg-militar-50/60 px-4 py-2.5 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30"
        >
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 text-sm font-semibold text-militar-900 dark:text-militar-200">
            + Adicionar conta
            <span aria-hidden="true" className="text-militar-700 transition group-open:rotate-90 dark:text-militar-400">
              →
            </span>
          </summary>
        <FormularioQueLimpa action={criarConta} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Nome</span>
            <input
              name="nome"
              required
              placeholder="ex: Nubank"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Instituição</span>
            <input
              name="instituicao"
              placeholder="ex: Nubank"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
            <select
              name="tipo"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="cartao">Cartão</option>
              <option value="corretora">Corretora</option>
              <option value="exchange">Exchange</option>
              <option value="especie">Espécie</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Moeda</span>
            <select
              name="moeda"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Saldo inicial</span>
            <CampoMoeda name="saldo_atual" placeholder="0" className={inputClasse} />
          </label>
          {seletorDono()}
          <BotaoEnviar className={botaoSalvar} enviando="Adicionando…" sucesso="Adicionado">
            Adicionar
          </BotaoEnviar>
        </FormularioQueLimpa>
        </details>
      </section>

      {/* Investimentos */}
      <section id="investimentos" className={`${cartao} scroll-mt-20 flex flex-col`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Investimentos</h2>
          <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
            {brl.format(somaInvest)}
          </span>
        </div>
        {divisao(investimentos.data, 'valor_mercado')}
        <div className="mt-3">
          {(investimentos.data ?? []).map((i) => (
            <div key={i.id} className={linha}>
              <form action={atualizarInvestimento} className="flex flex-1 items-center justify-between gap-3">
                <input type="hidden" name="id" value={i.id} />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {i.descricao}
                    {pessoa === 'todos' && (
                      <DonoInline tabela="investment_position" id={i.id} memberId={i.member_id} membros={membros} />
                    )}
                    {seloRevisao(i.atualizado_em)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {rotuloClasse[i.classe] ?? i.classe}
                    {valorEmBrl(i.valor_mercado, i.moeda) && ` · ≈ ${valorEmBrl(i.valor_mercado, i.moeda)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CampoMoeda name="valor_mercado" defaultValue={i.valor_mercado} className={inputClasse} />
                  <BotaoEnviar className={botaoSalvarLinha} destacarAlteracao>
                    Salvar
                  </BotaoEnviar>
                </div>
              </form>
              <FormularioComConfirmacao
                action={removerInvestimento}
                mensagem={`Remover o investimento "${i.descricao}"?`}
              >
                <input type="hidden" name="id" value={i.id} />
                <button type="submit" className={botaoRemover}>
                  remover
                </button>
              </FormularioComConfirmacao>
            </div>
          ))}
          {(investimentos.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum investimento ainda.</p>
          )}
        </div>

        <div className="min-h-4 flex-1" aria-hidden="true" />
        <details
          open={pessoa === 'todos' ? undefined : false}
          className="group mt-auto rounded-xl border border-dashed border-militar-400 bg-militar-50/60 px-4 py-2.5 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30"
        >
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 text-sm font-semibold text-militar-900 dark:text-militar-200">
            + Adicionar investimento
            <span aria-hidden="true" className="text-militar-700 transition group-open:rotate-90 dark:text-militar-400">
              →
            </span>
          </summary>
        <FormularioQueLimpa action={criarInvestimento} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
            <input
              name="descricao"
              required
              placeholder="ex: Tesouro Selic"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Classe</span>
            <select
              name="classe"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="renda_fixa">Renda fixa</option>
              <option value="renda_variavel">Renda variável</option>
              <option value="internacional">Internacional</option>
              <option value="cripto">Cripto</option>
              <option value="fundo">Fundo</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
            <CampoMoeda name="valor_mercado" placeholder="0" className={inputClasse} />
          </label>
          {seletorDono()}
          <BotaoEnviar className={botaoSalvar} enviando="Adicionando…" sucesso="Adicionado">
            Adicionar
          </BotaoEnviar>
        </FormularioQueLimpa>
        </details>
      </section>

      {/* Bens */}
      {pessoa === 'todos' && (
      <section id="bens" className={`${cartao} scroll-mt-20 flex flex-col`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Bens</h2>
          <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
            {brl.format(somaBens)}
          </span>
        </div>
        {divisao(bens.data, 'valor_estimado')}
        <div className="mt-3">
          {(bens.data ?? []).map((b) => (
            <div key={b.id} className={linha}>
              <form action={atualizarBem} className="flex flex-1 items-center justify-between gap-3">
                <input type="hidden" name="id" value={b.id} />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {b.descricao}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${corDono(null, membros)}`}>{ROTULO_COMPARTILHADO}</span>
                    {seloRevisao(b.atualizado_em)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{rotuloTipoBem[b.tipo] ?? b.tipo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CampoMoeda name="valor_estimado" defaultValue={b.valor_estimado} className={inputClasse} />
                  <BotaoEnviar className={botaoSalvarLinha} destacarAlteracao>
                    Salvar
                  </BotaoEnviar>
                </div>
              </form>
              <FormularioComConfirmacao action={removerBem} mensagem={`Remover o bem "${b.descricao}"?`}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className={botaoRemover}>
                  remover
                </button>
              </FormularioComConfirmacao>
            </div>
          ))}
          {(bens.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum bem cadastrado.</p>
          )}
        </div>

        <div className="min-h-4 flex-1" aria-hidden="true" />
        <details
          open={pessoa === 'todos' ? undefined : false}
          className="group mt-auto rounded-xl border border-dashed border-militar-400 bg-militar-50/60 px-4 py-2.5 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30"
        >
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 text-sm font-semibold text-militar-900 dark:text-militar-200">
            + Adicionar bem
            <span aria-hidden="true" className="text-militar-700 transition group-open:rotate-90 dark:text-militar-400">
              →
            </span>
          </summary>
        <FormularioQueLimpa action={criarBem} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
            <input
              name="descricao"
              required
              placeholder="ex: Carro, apartamento"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
            <select
              name="tipo"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="veiculo">Veículo</option>
              <option value="imovel">Imóvel</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
            <CampoMoeda name="valor_estimado" placeholder="0" className={inputClasse} />
          </label>
          <BotaoEnviar className={botaoSalvar} enviando="Adicionando…" sucesso="Adicionado">
            Adicionar
          </BotaoEnviar>
        </FormularioQueLimpa>
        </details>
      </section>
      )}

      {/* Retidos (FGTS etc.) */}
      <section id="retidos" className={`${cartao} scroll-mt-20 flex flex-col`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">FGTS e outros retidos</h2>
          <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
            {brl.format(somaRetidos)}
          </span>
        </div>
        {divisao(retidos.data, 'saldo')}
        <div className="mt-3">
          {(retidos.data ?? []).map((r) => (
            <div key={r.id} className={linha}>
              <form action={atualizarRetido} className="flex flex-1 items-center justify-between gap-3">
                <input type="hidden" name="id" value={r.id} />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {r.descricao}
                    {pessoa === 'todos' && <DonoInline tabela="retained_resource" id={r.id} memberId={r.member_id} membros={membros} />}
                    {seloRevisao(r.atualizado_em)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{rotuloTipoRetido[r.tipo] ?? r.tipo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CampoMoeda name="saldo" defaultValue={r.saldo} className={inputClasse} />
                  <BotaoEnviar className={botaoSalvarLinha} destacarAlteracao>
                    Salvar
                  </BotaoEnviar>
                </div>
              </form>
              <FormularioComConfirmacao action={removerRetido} mensagem={`Remover "${r.descricao}"?`}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className={botaoRemover}>
                  remover
                </button>
              </FormularioComConfirmacao>
            </div>
          ))}
          {(retidos.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nada cadastrado.</p>
          )}
        </div>

        <div className="min-h-4 flex-1" aria-hidden="true" />
        <details
          open={pessoa === 'todos' ? undefined : false}
          className="group mt-auto rounded-xl border border-dashed border-militar-400 bg-militar-50/60 px-4 py-2.5 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30"
        >
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 text-sm font-semibold text-militar-900 dark:text-militar-200">
            + Adicionar FGTS ou outro retido
            <span aria-hidden="true" className="text-militar-700 transition group-open:rotate-90 dark:text-militar-400">
              →
            </span>
          </summary>
        <FormularioQueLimpa action={criarRetido} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
            <input
              name="descricao"
              required
              placeholder="ex: FGTS — Ana"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
            <select
              name="tipo"
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="fgts">FGTS</option>
              <option value="precatorio">Precatório</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Saldo</span>
            <CampoMoeda name="saldo" placeholder="0" className={inputClasse} />
          </label>
          {seletorDono()}
          <BotaoEnviar className={botaoSalvar} enviando="Adicionando…" sucesso="Adicionado">
            Adicionar
          </BotaoEnviar>
        </FormularioQueLimpa>
        </details>
      </section>
      </div>

      <div id="historico" className="scroll-mt-20">
        <HistoricoPatrimonio itens={itensHistorico} />
      </div>
    </main>
  )
}
