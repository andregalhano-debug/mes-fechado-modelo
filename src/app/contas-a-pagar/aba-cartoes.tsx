import { criarCartao, alternarCartaoAtivo, moverContasDeCartao, removerCartao, definirBancoCartao } from './actions'
import { EmpresasCartoes } from './empresas-cartoes'
import type { EmpresaLinha } from '@/lib/empresas'
import { BotaoEnviar } from '@/components/botao-enviar'
import { FormularioComConfirmacao } from '@/components/formulario-com-confirmacao'
import { formatarData } from '@/lib/data'
import { rotuloCartao, type Cartao } from '@/lib/cartao'
import { PainelCreditoCartao, RaioXCredito, ResumoCredito, contasDeCredito, type FaturaCredito } from './credito-cartoes'
import { AlternarResumo } from '@/components/alternar-resumo'

// Banco "canônico" (Itaú/Itau, NuBank/Nubank…) para agrupar os cartões.
function chaveBanco(c: Pick<Cartao, 'banco' | 'tipo'>) {
  const b = (c.banco ?? '').toLowerCase()
  if (b.includes('itaú') || b.includes('itau')) return 'Itaú'
  if (b.includes('nubank') || b === 'nu') return 'Nubank'
  if (b.includes('bradesco')) return 'Bradesco'
  if (b.includes('santander')) return 'Santander'
  if (b.includes('inter')) return 'Inter'
  if (b.includes('c6')) return 'C6'
  if (c.tipo === 'pix') return 'PIX'
  return c.banco?.trim() || 'Outros'
}

/** Variante do cartão pelo nome: Black, Signature/Azul, Ultravioleta… */
function varianteCartao(c: Pick<Cartao, 'nome'>) {
  const n = c.nome.toLowerCase()
  if (n.includes('black')) return 'Black'
  if (n.includes('signature') || n.includes('azul')) return 'Signature'
  if (n.includes('ultravioleta')) return 'Ultravioleta'
  if (n.includes('platinum')) return 'Platinum'
  if (n.includes('infinite')) return 'Infinite'
  return null
}

// Cor do cabeçalho: a do banco (Itaú laranja, Nubank roxo, Bradesco vermelho); Black é preto com
// o detalhe do banco; Signature/Azul do Itaú é azul. Cartão cancelado fica cinza.
const ACENTO: Record<string, string> = { Itaú: 'border-orange-500', Bradesco: 'border-red-600', Nubank: 'border-violet-500' }
function corCartao(c: Pick<Cartao, 'banco' | 'tipo' | 'nome' | 'ativo'>) {
  if (!c.ativo) return 'bg-gradient-to-br from-neutral-400 to-neutral-500 text-white'
  const banco = chaveBanco(c)
  const v = varianteCartao(c)
  if (v === 'Black') return `bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-700 text-white border-t-4 ${ACENTO[banco] ?? 'border-neutral-500'}`
  if (banco === 'Itaú' && v === 'Signature') return 'bg-gradient-to-br from-blue-900 via-blue-700 to-sky-600 text-white'
  if (banco === 'Itaú') return 'bg-gradient-to-br from-orange-600 to-orange-500 text-white'
  if (banco === 'Nubank' && v === 'Ultravioleta') return 'bg-gradient-to-br from-purple-950 via-violet-900 to-purple-700 text-white'
  if (banco === 'Nubank') return 'bg-gradient-to-br from-violet-700 to-purple-600 text-white'
  if (banco === 'Bradesco') return 'bg-gradient-to-br from-red-700 to-rose-600 text-white'
  if (banco === 'Santander') return 'bg-gradient-to-br from-red-600 to-red-500 text-white'
  if (banco === 'Inter') return 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
  if (banco === 'PIX') return 'bg-gradient-to-br from-teal-600 to-cyan-500 text-white'
  return 'bg-gradient-to-br from-militar-700 to-militar-600 text-white'
}
const COR_GRUPO: Record<string, string> = {
  Itaú: 'bg-orange-500',
  Nubank: 'bg-violet-600',
  Bradesco: 'bg-red-600',
  Santander: 'bg-red-500',
  Inter: 'bg-amber-500',
  PIX: 'bg-teal-500',
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const cartaoCss = 'rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900'

export type ContaNoCartao = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  pago: boolean
  recorrente: boolean
  periodicidade: 'mensal' | 'anual'
  debito_automatico: boolean
  linhagem_id: string
  cartao_id: string
}

// Aba "Cartões": quais cartões a família tem (físico e virtuais) e o que está cadastrado
// em cada um — pra organizar os pagamentos e, se um cartão for perdido ou cancelado,
// saber exatamente quais cobranças precisam ir pra outro cartão.
export function AbaCartoes({
  cartoes,
  contas,
  membros,
  empresas,
  faturasCredito = [],
}: {
  cartoes: Cartao[]
  contas: ContaNoCartao[]
  membros: { id: string; nome: string; apelido: string | null }[]
  /** empresas/assinaturas/contas, uma por empresa, com o cartão vinculado */
  empresas: EmpresaLinha[]
  /** dados de crédito lidos das faturas (limite, ciclo, juros, encargos) */
  faturasCredito?: FaturaCredito[]
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const creditoDoFinal = contasDeCredito(faturasCredito).doFinal
  // Uma linha por cobrança (linhagem): a ocorrência mais recente de cada conta.
  const maisRecente = new Map<string, ContaNoCartao>()
  for (const c of contas) {
    const atual = maisRecente.get(c.linhagem_id)
    if (!atual || c.vencimento > atual.vencimento) maisRecente.set(c.linhagem_id, c)
  }
  const porCartao = new Map<string, ContaNoCartao[]>()
  for (const c of maisRecente.values()) {
    const lista = porCartao.get(c.cartao_id) ?? []
    lista.push(c)
    porCartao.set(c.cartao_id, lista)
  }
  const emAbertoPorCartao = new Map<string, number>()
  for (const c of contas) if (!c.pago) emAbertoPorCartao.set(c.cartao_id, (emAbertoPorCartao.get(c.cartao_id) ?? 0) + 1)

  const nomeMembro = (id: string | null) => {
    const m = membros.find((x) => x.id === id)
    return m ? m.apelido || m.nome : null
  }
  const ativos = cartoes.filter((c) => c.ativo)
  const cancelados = cartoes.length - ativos.length
  const porBancoResumo = new Map<string, number>()
  for (const c of ativos) porBancoResumo.set(c.banco || 'Sem banco', (porBancoResumo.get(c.banco || 'Sem banco') ?? 0) + 1)
  const ordenados = [...cartoes].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
  // Cartões do mesmo banco juntos; dentro do banco: crédito antes de débito/PIX, ativos antes dos cancelados.
  const ordemTipo: Record<string, number> = { fisico: 0, virtual: 1, debito: 2, pix: 3 }
  const gruposBanco = Array.from(
    ordenados.reduce((m, c) => m.set(chaveBanco(c), [...(m.get(chaveBanco(c)) ?? []), c]), new Map<string, Cartao[]>()),
  )
    .map(([banco, lista]) => ({
      banco,
      cartoes: lista.sort((a, b) => Number(b.ativo) - Number(a.ativo) || (ordemTipo[a.tipo] ?? 9) - (ordemTipo[b.tipo] ?? 9) || a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => (a.banco === 'PIX' ? 1 : b.banco === 'PIX' ? -1 : b.cartoes.length - a.cartoes.length))
  // limite somado por banco (uma vez por conta de crédito, pela última fatura de cada titular)
  const limitePorBanco = new Map<string, { total: number; livre: number }>()
  for (const [final, f] of contasDeCredito(faturasCredito).porTitular) {
    const c = cartoes.find((x) => x.final === final)
    if (c && !c.ativo) continue
    const banco = c ? chaveBanco(c) : (f.instituicao ?? 'Outros')
    const a = limitePorBanco.get(banco) ?? { total: 0, livre: 0 }
    a.total += f.credito.limite_total ?? 0
    a.livre += f.credito.limite_disponivel ?? 0
    limitePorBanco.set(banco, a)
  }
  // cartão novo sem fatura ainda: herda a última fatura do cartão cancelado do mesmo banco (substituição)
  const herdado = (cartao: Cartao) => {
    if (!cartao.ativo || (cartao.tipo !== 'fisico' && cartao.tipo !== 'virtual')) return null
    if (cartao.final && creditoDoFinal.get(cartao.final)) return null
    const antigo = cartoes.find((x) => !x.ativo && x.final && chaveBanco(x) === chaveBanco(cartao) && creditoDoFinal.get(x.final))
    return antigo ? { final: antigo.final!, dados: creditoDoFinal.get(antigo.final!)! } : null
  }

  return (
    <div className="flex flex-col gap-6">
      <EmpresasCartoes empresas={empresas} cartoes={cartoes} />

      {ordenados.length === 0 && (
        <section className={cartaoCss}>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Nenhum cartão cadastrado ainda. Cadastre abaixo o cartão físico e os virtuais de cada um — depois, em cada
            conta a pagar, escolha em qual cartão a cobrança está.
          </p>
        </section>
      )}

      <RaioXCredito faturas={faturasCredito} cartoes={cartoes} hoje={hoje} />

      {ordenados.length > 0 && (
      <details open className="group rounded-2xl border border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/60">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-6 py-4">
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
              <span className="text-neutral-400 transition group-open:rotate-90">▸</span>
              Seus cartões
              <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                {ativos.length} ativo{ativos.length === 1 ? '' : 's'}
                {cancelados > 0 ? ` · ${cancelados} cancelado${cancelados === 1 ? '' : 's'}` : ''}
              </span>
            </span>
            <span className="ml-5 mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
              {Array.from(porBancoResumo.entries())
                .map(([banco, n]) => `${banco} ${n}`)
                .join(' · ')}
            </span>
          </span>
          <span className="text-xs font-medium text-militar-700 dark:text-militar-500">
            <span className="group-open:hidden">ver cartões</span>
            <span className="hidden group-open:inline">ocultar</span>
          </span>
        </summary>
      <AlternarResumo chave="cartoes">
      {gruposBanco.map((g) => {
        const lim = limitePorBanco.get(g.banco)
        const ativosG = g.cartoes.filter((c) => c.ativo).length
        return (
      <div key={g.banco} className="border-t border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-neutral-900 dark:text-neutral-100">
            <span className={`h-6 w-1.5 rounded-full ${COR_GRUPO[g.banco] ?? 'bg-militar-600'}`} aria-hidden="true" />
            {g.banco}
            <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
              {ativosG} {ativosG === 1 ? 'cartão ativo' : 'cartões ativos'}
              {g.cartoes.length > ativosG ? ` · ${g.cartoes.length - ativosG} cancelado${g.cartoes.length - ativosG === 1 ? '' : 's'}` : ''}
            </span>
          </h3>
          {lim && lim.total > 0 && (
            <div className="flex min-w-[14rem] flex-1 items-center gap-3 sm:max-w-sm">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <span className={`absolute inset-y-0 left-0 rounded-full ${COR_GRUPO[g.banco] ?? 'bg-militar-600'}`} style={{ width: `${Math.min(100, ((lim.total - lim.livre) / lim.total) * 100)}%` }} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold">{brl.format(lim.livre).replace(/,\d{2}$/, '')}</span> livres de {brl.format(lim.total).replace(/,\d{2}$/, '')}
              </span>
            </div>
          )}
        </div>
      <div className="grid auto-rows-fr gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {g.cartoes.map((cartao) => {
          const lista = (porCartao.get(cartao.id) ?? []).sort((a, b) => a.descricao.localeCompare(b.descricao))
          const mensal = lista.reduce(
            (t, c) => t + (!c.recorrente ? 0 : c.periodicidade === 'anual' ? c.valor / 12 : c.valor),
            0,
          )
          const pendentes = emAbertoPorCartao.get(cartao.id) ?? 0
          const titular = nomeMembro(cartao.titular_id)
          const empresasDoCartao = empresas.filter((e) => e.cartaoId === cartao.id)
          // no card: assinaturas/recorrentes (compra avulsa não é cobrança do cartão — vira nota)
          const empresasNoCartao = empresasDoCartao.filter((e) => e.tipo !== 'avulsa' && e.tipo !== 'conta')
          const avulsasNoCartao = empresasDoCartao.filter((e) => e.tipo === 'avulsa').length
          const mensalCartao = mensal + empresasNoCartao.reduce((t, e) => t + e.mediaMensal, 0)
          const qtdCartao = lista.length + empresasNoCartao.length
          return (
            <section
              key={cartao.id}
              className={`card-cartao ${cartaoCss} flex h-full flex-col shadow-sm ${cartao.ativo ? '' : 'border-red-200 dark:border-red-900'}`}
            >
              {/* Cabeçalho padronizado: banco + número do cartão em destaque */}
              <div className={`card-cabecalho -mx-5 -mt-5 mb-4 rounded-t-2xl px-5 pb-4 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 ${corCartao(cartao)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">{cartao.banco ?? (cartao.tipo === 'pix' ? 'PIX' : 'Sem banco')}</p>
                    <h2 className="truncate text-sm font-semibold">{cartao.nome}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{brl.format(mensalCartao)}/mês</p>
                    <p className="text-[11px] opacity-80">
                      {qtdCartao} cobrança{qtdCartao === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold tracking-[0.2em]">
                  {cartao.tipo === 'pix' ? 'PIX' : cartao.final ? `•••• ${cartao.final}` : '•••• ····'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-white/20 px-2 py-0.5">
                    {cartao.tipo === 'virtual' ? 'Virtual' : cartao.tipo === 'debito' ? 'Débito em conta' : cartao.tipo === 'pix' ? 'PIX' : 'Físico'}
                  </span>
                  {varianteCartao(cartao) && <span className="rounded-full bg-white/25 px-2 py-0.5 uppercase tracking-wide">{varianteCartao(cartao)}</span>}
                  {cartao.bandeira && <span className="rounded-full bg-white/20 px-2 py-0.5">{cartao.bandeira}</span>}
                  {titular && <span className="rounded-full bg-white/20 px-2 py-0.5">{titular}</span>}
                  {!cartao.ativo && <span className="rounded-full bg-white px-2 py-0.5 text-red-700">Cancelado / perdido</span>}
                </div>
              </div>

              <div className="card-corpo flex flex-1 flex-col">
              {!cartao.ativo && pendentes > 0 && (
                <form
                  action={moverContasDeCartao}
                  className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-red-200 bg-white p-3 dark:border-red-900 dark:bg-neutral-950"
                >
                  <input type="hidden" name="de" value={cartao.id} />
                  <p className="w-full text-sm font-medium text-red-800 dark:text-red-300">
                    {pendentes} conta{pendentes === 1 ? '' : 's'} em aberto ainda {pendentes === 1 ? 'está' : 'estão'} neste
                    cartão. Atualize o cadastro nas empresas e mova aqui:
                  </p>
                  <select name="para" required defaultValue="" className={campo}>
                    <option value="" disabled>
                      Mover para…
                    </option>
                    {ativos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {rotuloCartao(c)}
                      </option>
                    ))}
                  </select>
                  <BotaoEnviar
                    enviando="Movendo…"
                    className="rounded-lg bg-red-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    Mover cobranças
                  </BotaoEnviar>
                </form>
              )}

              <section className="rounded-xl border border-neutral-200 dark:border-neutral-800" aria-label="Assinaturas e empresas neste cartão">
                <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-xs dark:border-neutral-800">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">Neste cartão ({qtdCartao})</span>
                  <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{brl.format(mensalCartao)}/mês</span>
                </div>
              <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-3 dark:divide-neutral-800 dark:border-neutral-800">
                {empresasNoCartao.map((e) => (
                  <div key={'e-' + e.chave} className="flex items-center justify-between gap-3 py-2">
                    <p className="min-w-0 truncate text-xs text-neutral-800 dark:text-neutral-200">{e.nome}</p>
                    <span className="shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {e.periodicidade === 'anual' ? (
                        <>
                          <span className="mr-1 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">ANUAL</span>
                          {brl.format(e.valorAnual ?? 0)}/ano
                          {e.ultimaData && <span className="block text-[10px]">próx. {e.ultimaData.slice(8, 10)}/{e.ultimaData.slice(5, 7)}/{Number(e.ultimaData.slice(0, 4)) + 1}</span>}
                        </>
                      ) : e.mediaMensal ? (
                        brl.format(e.mediaMensal) + '/mês'
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                ))}
                {lista.map((c) => (
                  <div key={c.linhagem_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.descricao}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {!c.recorrente ? 'única' : c.periodicidade === 'anual' ? 'anual' : 'todo mês'}
                        {c.debito_automatico ? ' · débito automático' : ''}
                        {' · '}
                        {c.pago ? 'última paga ' : 'próxima '}
                        {formatarData(c.vencimento)}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
                      {c.periodicidade === 'anual' && c.recorrente ? (
                        <>
                          <span className="mr-1 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">ANUAL</span>
                          {brl.format(c.valor)}/ano
                          <span className="block text-[10px] text-neutral-500">≈ {brl.format(c.valor / 12)}/mês</span>
                        </>
                      ) : (
                        brl.format(c.valor)
                      )}
                    </span>
                  </div>
                ))}
                {avulsasNoCartao > 0 && (
                  <p className="py-2 text-[11px] text-neutral-400">
                    + {avulsasNoCartao} compra{avulsasNoCartao === 1 ? '' : 's'} avulsa{avulsasNoCartao === 1 ? '' : 's'} neste cartão (não recorrente)
                  </p>
                )}
                {lista.length === 0 && empresasNoCartao.length === 0 && avulsasNoCartao === 0 && (
                  <p className="py-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Nada cadastrado neste cartão. Defina o cartão das empresas na lista acima ou ao criar uma conta.
                  </p>
                )}
              </div>
              </section>

              {cartao.tipo === 'fisico' || cartao.tipo === 'virtual' ? (
                <details className="group/cred mt-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-xs">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      <span className="mr-1 inline-block text-neutral-400 transition group-open/cred:rotate-90">▸</span>
                      Crédito, prazos e juros
                    </span>
                    <ResumoCredito
                      fatura={cartao.final ? (creditoDoFinal.get(cartao.final)?.fatura ?? herdado(cartao)?.dados.fatura ?? null) : (herdado(cartao)?.dados.fatura ?? null)}
                      hoje={hoje}
                    />
                  </summary>
                  <div className="border-t border-neutral-100 p-3 dark:border-neutral-800">
                <PainelCreditoCartao
                  fatura={cartao.final ? (creditoDoFinal.get(cartao.final)?.fatura ?? herdado(cartao)?.dados.fatura ?? null) : (herdado(cartao)?.dados.fatura ?? null)}
                  titular={cartao.final ? (creditoDoFinal.get(cartao.final)?.titular ?? null) : null}
                  final={cartao.final}
                  hoje={hoje}
                  herdadoDe={herdado(cartao)?.final ?? null}
                />
                  </div>
                </details>
              ) : (
                <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-3 text-xs text-neutral-500 dark:bg-neutral-800/50 dark:text-neutral-400">
                  {cartao.tipo === 'pix' ? 'Pagamentos por PIX — sem limite nem fatura.' : 'Débito direto na conta — sem limite nem fatura.'}
                  {cartao.observacao ? ` ${cartao.observacao}` : ''}
                </p>
              )}


              <div className="min-h-3 flex-1" aria-hidden="true" />
              <div className="mt-3 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                <details className="mb-2">
                  <summary className="cursor-pointer list-none text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">✎ editar banco do cartão</summary>
                  <form action={definirBancoCartao} className="mt-2 flex items-center gap-1.5">
                    <input type="hidden" name="id" value={cartao.id} />
                    <input
                      name="banco"
                      defaultValue={cartao.banco ?? ''}
                      placeholder="Banco (ex: Itaú)"
                      aria-label={`Banco do cartão ${cartao.nome}`}
                      className="w-36 rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-militar-600 dark:border-neutral-700"
                    />
                    <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-militar-700 hover:bg-militar-50 dark:text-militar-500 dark:hover:bg-militar-950/40">
                      salvar
                    </button>
                  </form>
                </details>
                {cartao.ativo ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <FormularioComConfirmacao
                      action={alternarCartaoAtivo}
                      mensagem={`Marcar "${rotuloCartao(cartao)}" como perdido/cancelado?\n\nEle sai das opções de cartão. As contas e empresas cadastradas nele ficam sinalizadas para você trocar.`}
                    >
                      <input type="hidden" name="id" value={cartao.id} />
                      <input type="hidden" name="ativo" value="0" />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        Cartão perdido ou cancelado
                      </button>
                    </FormularioComConfirmacao>
                    {lista.length === 0 && empresasDoCartao.length === 0 && (
                      <FormularioComConfirmacao action={removerCartao} mensagem={`Remover o cartão "${rotuloCartao(cartao)}" do cadastro?`}>
                        <input type="hidden" name="id" value={cartao.id} />
                        <button type="submit" className="py-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
                          remover do cadastro
                        </button>
                      </FormularioComConfirmacao>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="rounded-lg bg-red-100/70 px-3 py-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
                      <strong>Cartão desativado.</strong> Ele não aparece mais nas opções de cartão.
                      {empresasDoCartao.length > 0 ? (
                        <>
                          {' '}
                          {empresasDoCartao.length} {empresasDoCartao.length === 1 ? 'empresa ainda está cadastrada' : 'empresas ainda estão cadastradas'} nele
                          {': '}
                          <span className="font-medium">
                            {empresasDoCartao
                              .slice(0, 5)
                              .map((e) => e.nome)
                              .join(', ')}
                            {empresasDoCartao.length > 5 ? ` e mais ${empresasDoCartao.length - 5}` : ''}
                          </span>
                          . Troque o cartão delas na lista de empresas acima.
                        </>
                      ) : (
                        ' Nenhuma empresa cadastrada nele.'
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                      <FormularioComConfirmacao
                        action={alternarCartaoAtivo}
                        mensagem={`Reativar "${rotuloCartao(cartao)}"? Use só se marcou como cancelado por engano.`}
                      >
                        <input type="hidden" name="id" value={cartao.id} />
                        <input type="hidden" name="ativo" value="1" />
                        <button type="submit" className="py-1 text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200">
                          Foi engano? Reativar cartão
                        </button>
                      </FormularioComConfirmacao>
                      {lista.length === 0 && empresasDoCartao.length === 0 && (
                        <FormularioComConfirmacao action={removerCartao} mensagem={`Remover o cartão "${rotuloCartao(cartao)}" do cadastro?`}>
                          <input type="hidden" name="id" value={cartao.id} />
                          <button type="submit" className="py-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
                            remover do cadastro
                          </button>
                        </FormularioComConfirmacao>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </section>
          )
        })}
      </div>
      </div>
        )
      })}
      </AlternarResumo>
      </details>
      )}

      {/* Cadastrar: bloco de ação destacado (mesmo padrão do "Enviar fatura ou saldo"), recolhido */}
      <details
        open={cartoes.length === 0}
        className="group rounded-2xl border border-dashed border-militar-400 bg-militar-50 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <span>
            <span className="block font-semibold text-militar-900 dark:text-militar-200">+ Cadastrar cartão, débito em conta ou PIX</span>
            <span className="mt-0.5 block text-sm text-militar-800 dark:text-militar-300">
              Físico, virtual ou débito em conta — guarde só os 4 últimos dígitos.
            </span>
          </span>
          <span className="shrink-0 text-militar-700 transition group-open:rotate-90 dark:text-militar-400" aria-hidden="true">
            →
          </span>
        </summary>
        <div className="border-t border-militar-200 bg-white px-5 pb-5 pt-3 dark:border-militar-900 dark:bg-neutral-900">
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Guarde só os 4 últimos dígitos — nunca o número completo, a validade ou o código de segurança. Cadastre o
          físico e cada virtual separado, dando um nome para cada virtual (o banco agrupa os virtuais do mesmo banco). Para o que é debitado direto da conta, cadastre o tipo "Débito em conta" com o nome da conta (ex: Conta Itaú) — o final é opcional.
        </p>
        <form action={criarCartao} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Nome do cartão</span>
            <input name="nome" required placeholder="ex: Itaú Signature, Itaú virtual streaming" className={campo} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Banco</span>
            <input name="banco" placeholder="ex: Itaú" className={`${campo} w-32`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
            <select name="tipo" defaultValue="fisico" className={campo}>
              <option value="fisico">Físico</option>
              <option value="virtual">Virtual</option>
              <option value="debito">Débito em conta</option>
              <option value="pix">PIX</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Final</span>
            <input
              name="final"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="1234"
              title="Só os 4 últimos dígitos"
              className={`${campo} w-20 tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Bandeira</span>
            <select name="bandeira" defaultValue="" className={campo}>
              <option value="">—</option>
              <option>Mastercard</option>
              <option>Visa</option>
              <option>Elo</option>
              <option>Amex</option>
              <option>Hipercard</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Titular</span>
            <select name="titular_id" defaultValue="" className={campo}>
              <option value="">—</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.apelido || m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Observação</span>
            <input name="observacao" placeholder="ex: virtual só pra assinaturas" className={campo} />
          </label>
          <BotaoEnviar
            enviando="Cadastrando…"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500"
          >
            Cadastrar
          </BotaoEnviar>
        </form>
        </div>
      </details>
    </div>
  )
}
