'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatarData } from '@/lib/data'
import { rotuloCartao, type Cartao } from '@/lib/cartao'
import type { EmpresaLinha, TipoEmpresa } from '@/lib/empresas'
import { TabelaOrdenavel, type LinhaTabela } from '@/components/tabela-ordenavel'
import { BarraShare } from '@/components/lista-recolhivel'
import {
  adicionarEmpresa,
  definirCartaoConta,
  definirCartaoEmpresa,
  definirTipoEmpresa,
  definirPeriodicidadeEmpresa,
  garantirDebitoEmConta,
  garantirPix,
  removerEmpresaManual,
  definirValorEmpresa,
  definirDataEmpresa,
} from './actions'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const cartaoCss = 'rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'
const SEM = '__sem__'
// colunas da concentração: banco/cartão | tipo | final | empresas | por mês | share
const GRADE_CONC =
  'grid grid-cols-[minmax(0,1fr)_4rem_5.5rem_5.5rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_7.5rem_4.5rem_4.5rem_7rem_8rem] sm:gap-x-3'
const COR_TIPO: Record<string, { rotulo: string; barra: string; selo: string }> = {
  fisico: { rotulo: 'Físico', barra: 'bg-militar-600', selo: 'bg-militar-50 text-militar-800 dark:bg-militar-950/40 dark:text-militar-300' },
  virtual: { rotulo: 'Virtual', barra: 'bg-violet-500', selo: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  debito: { rotulo: 'Débito conta', barra: 'bg-teal-500', selo: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' },
  pix: { rotulo: 'PIX', barra: 'bg-cyan-400', selo: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
}

function BarraConc({ pct, cor, forte = false }: { pct: number; cor: string; forte?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`relative flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 ${forte ? 'h-2.5' : 'h-1.5'}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${cor}`} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
      </span>
      <span className={`w-9 text-right text-xs tabular-nums ${forte ? 'font-semibold text-neutral-800 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {Math.round(pct)}%
      </span>
    </span>
  )
}

const TIPO: Record<TipoEmpresa, { rotulo: string; classe: string }> = {
  assinatura: { rotulo: 'Assinatura', classe: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  recorrente: { rotulo: 'Recorrente', classe: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  conta: { rotulo: 'Conta a pagar', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  avulsa: { rotulo: 'Compra avulsa', classe: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' },
}

// Relação de empresas/assinaturas/contas (uma linha por empresa) com o cartão em que cada uma
// está cadastrada, mais a concentração por cartão e por banco — pra saber o que está salvo em
// cada cartão e trocar com facilidade quando um cartão muda.
export function EmpresasCartoes({ empresas, cartoes }: { empresas: EmpresaLinha[]; cartoes: Cartao[] }) {
  const [vinculos, setVinculos] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(empresas.map((e) => [e.chave, e.cartaoId])),
  )
  const [tipos, setTipos] = useState<Record<string, TipoEmpresa>>(() => Object.fromEntries(empresas.map((e) => [e.chave, e.tipo])))
  // Dados novos do servidor (empresa adicionada, débito/PIX criado, outra aba) substituem o estado
  // local — senão a empresa recém-adicionada aparecia sem o cartão escolhido.
  useEffect(() => {
    setVinculos(Object.fromEntries(empresas.map((e) => [e.chave, e.cartaoId])))
    setTipos(Object.fromEntries(empresas.map((e) => [e.chave, e.tipo])))
  }, [empresas])
  const [filtro, setFiltro] = useState<'principais' | 'semCartao' | 'cancelado' | 'todas'>('principais')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'assinatura' | 'recorrente' | 'conta'>('todos')
  const [busca, setBusca] = useState('')
  const [salvando, iniciar] = useTransition()
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [salvandoNova, setSalvandoNova] = useState(false)
  const [erroNova, setErroNova] = useState<string | null>(null)
  const router = useRouter()

  const ativos = cartoes.filter((c) => c.ativo)
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]))
  const tipoDe = (e: EmpresaLinha) => tipos[e.chave] ?? e.tipo
  const principais = empresas.filter((e) => tipoDe(e) !== 'avulsa')

  // ---- concentração (assinaturas, recorrentes e contas: o que fica "salvo" no cartão) ----
  const concentracao = useMemo(() => {
    const porCartao = new Map<string, { qtd: number; mensal: number }>()
    const sem = { qtd: 0, mensal: 0 }
    let totalMensal = 0
    for (const e of principais) {
      totalMensal += e.mediaMensal
      const id = vinculos[e.chave]
      if (!id || !cartaoPorId.has(id)) {
        sem.qtd++
        sem.mensal += e.mediaMensal
        continue
      }
      const c = porCartao.get(id) ?? { qtd: 0, mensal: 0 }
      c.qtd++
      c.mensal += e.mediaMensal
      porCartao.set(id, c)
    }
    const bancoDe = (id: string) => {
      const c = cartaoPorId.get(id)!
      return c.banco || (c.tipo === 'pix' ? 'PIX' : c.nome)
    }
    const porBanco = new Map<string, { banco: string; qtd: number; mensal: number; cartoes: { id: string; qtd: number; mensal: number }[] }>()
    for (const [id, v] of porCartao) {
      const banco = bancoDe(id)
      const g = porBanco.get(banco) ?? { banco, qtd: 0, mensal: 0, cartoes: [] }
      g.qtd += v.qtd
      g.mensal += v.mensal
      g.cartoes.push({ id, ...v })
      porBanco.set(banco, g)
    }
    const grupos = Array.from(porBanco.values()).sort((x, y) => y.mensal - x.mensal)
    for (const g of grupos) g.cartoes.sort((x, y) => y.mensal - x.mensal)
    return { totalMensal, grupos, sem }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinculos, tipos, empresas, cartoes])

  const comCartao = principais.filter((e) => vinculos[e.chave]).length
  const cancelados = cartoes.filter((c) => !c.ativo)
  const emCancelado = (e: EmpresaLinha) => {
    const id = vinculos[e.chave]
    return !!id && cartaoPorId.get(id)?.ativo === false
  }
  const qtdEmCancelado = empresas.filter(emCancelado).length

  const visiveis = empresas.filter((e) => {
    if (filtro === 'principais' && tipoDe(e) === 'avulsa') return false
    if (filtro === 'semCartao' && (tipoDe(e) === 'avulsa' || vinculos[e.chave])) return false
    if (filtro === 'cancelado' && !emCancelado(e)) return false
    if (filtroTipo !== 'todos' && tipoDe(e) !== filtroTipo) return false
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  function trocarPeriodicidade(e: EmpresaLinha, periodicidade: 'mensal' | 'anual') {
    setErro(null)
    iniciar(async () => {
      try {
        const dados = new FormData()
        dados.set('chave', e.chaveVinculo ?? e.chave)
        dados.set('nome', e.nome)
        dados.set('periodicidade', periodicidade)
        await definirPeriodicidadeEmpresa(dados)
        router.refresh()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Não consegui salvar.')
      }
    })
  }

  function trocarTipo(e: EmpresaLinha, tipo: TipoEmpresa) {
    const anterior = tipoDe(e)
    setErro(null)
    setTipos((t) => ({ ...t, [e.chave]: tipo }))
    iniciar(async () => {
      try {
        const dados = new FormData()
        dados.set('chave', e.chaveVinculo ?? e.chave)
        dados.set('nome', e.nome)
        dados.set('tipo', tipo)
        await definirTipoEmpresa(dados)
      } catch (err) {
        setTipos((t) => ({ ...t, [e.chave]: anterior }))
        setErro(err instanceof Error ? err.message : 'Não consegui trocar a tag.')
      }
    })
  }

  function trocar(e: EmpresaLinha, cartaoId: string) {
    const anterior = vinculos[e.chave] ?? null
    // "novo-debito:{banco}" = débito em conta de um banco ainda sem conta de débito cadastrada
    const criarDebito = cartaoId.startsWith('novo-debito:') ? cartaoId.slice('novo-debito:'.length) : null
    const criarPix = cartaoId === 'novo-pix'
    const novo = criarDebito !== null || criarPix ? null : cartaoId || null
    setErro(null)
    if (criarDebito === null && !criarPix) setVinculos((v) => ({ ...v, [e.chave]: novo }))
    setSalvandoChave(e.chave)
    iniciar(async () => {
      try {
        const idFinal = criarPix ? await garantirPix() : criarDebito !== null ? await garantirDebitoEmConta(criarDebito) : novo
        if (criarDebito !== null || criarPix) setVinculos((v) => ({ ...v, [e.chave]: idFinal }))
        const dados = new FormData()
        dados.set('cartao_id', idFinal ?? '')
        if (e.linhagemId) {
          dados.set('linhagem_id', e.linhagemId)
          await definirCartaoConta(dados)
        } else {
          dados.set('chave', e.chaveVinculo ?? e.chave)
          dados.set('nome', e.nome)
          await definirCartaoEmpresa(dados)
        }
        if (criarDebito !== null || criarPix) router.refresh()
      } catch (err) {
        setVinculos((v) => ({ ...v, [e.chave]: anterior }))
        setErro(err instanceof Error ? err.message : 'Não consegui salvar o cartão.')
      } finally {
        setSalvandoChave(null)
      }
    })
  }

  const fisicos = ativos.filter((c) => c.tipo === 'fisico')
  const virtuais = ativos.filter((c) => c.tipo === 'virtual')
  const debitos = ativos.filter((c) => c.tipo === 'debito')
  const pixes = ativos.filter((c) => c.tipo === 'pix')
  // Bancos dos cartões que ainda não têm "débito em conta" cadastrado: viram opção direta no seletor.
  const bancosSemDebito = Array.from(new Set(ativos.filter((c) => c.tipo !== 'debito' && c.banco).map((c) => c.banco as string))).filter(
    (b) => !debitos.some((d) => (d.banco ?? '').toLowerCase() === b.toLowerCase()),
  )
  function opcoesCartao() {
    return (
      <>
        <option value="">— definir depois —</option>
        {fisicos.length > 0 && (
          <optgroup label="Físicos">
            {fisicos.map((c) => (
              <option key={c.id} value={c.id}>
                {rotulo(c)}
              </option>
            ))}
          </optgroup>
        )}
        {virtuais.length > 0 && (
          <optgroup label="Virtuais">
            {virtuais.map((c) => (
              <option key={c.id} value={c.id}>
                {rotulo(c)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Débito em conta">
          {debitos.map((c) => (
            <option key={c.id} value={c.id}>
              {rotulo(c)}
            </option>
          ))}
          {bancosSemDebito.map((b) => (
            <option key={`novo-${b}`} value={`novo-debito:${b}`}>
              Débito em conta · {b}
            </option>
          ))}
        </optgroup>
        <optgroup label="PIX">
          {pixes.map((c) => (
            <option key={c.id} value={c.id}>
              {rotulo(c)}
            </option>
          ))}
          {pixes.length === 0 && <option value="novo-pix">PIX</option>}
        </optgroup>
      </>
    )
  }

  const rotulo = (c: Cartao) => `${rotuloCartao(c)}${c.banco ? ` (${c.banco})` : ''}${c.ativo ? '' : ' · cancelado'}`

  return (
    <>
      {/* Concentração: um bloco por banco (subtotal) com os cartões dele em colunas alinhadas */}
      <section className={cartaoCss}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Concentração por banco e cartão</h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            assinaturas, cobranças recorrentes e contas · média {brl.format(concentracao.totalMensal)}/mês
          </span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-xs text-neutral-600 dark:text-neutral-300">
            <span>
              {comCartao} de {principais.length} com cartão definido
            </span>
            <span className="tabular-nums">{principais.length > 0 ? Math.round((comCartao / principais.length) * 100) : 0}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-militar-600" style={{ width: `${principais.length > 0 ? (comCartao / principais.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div>
            {/* cabeçalho das colunas */}
            <div className={`${GRADE_CONC} border-b border-neutral-200 pb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400`}>
              <span>Banco / cartão</span>
              <span className="max-sm:hidden">Tipo</span>
              <span className="text-right">Final</span>
              <span className="text-right max-sm:hidden">Empresas</span>
              <span className="text-right">Por mês</span>
              <span>Share</span>
            </div>

            {concentracao.grupos.map((g) => {
              const pctBanco = concentracao.totalMensal > 0 ? (g.mensal / concentracao.totalMensal) * 100 : 0
              return (
                <div key={g.banco} className="border-b border-neutral-100 py-1.5 dark:border-neutral-800">
                  {/* subtotal do banco */}
                  <div className={`${GRADE_CONC} py-1.5`}>
                    <span className="truncate font-semibold text-neutral-900 dark:text-neutral-100">{g.banco}</span>
                    <span className="text-xs text-neutral-400 max-sm:hidden">{g.cartoes.length} {g.cartoes.length === 1 ? 'cartão' : 'cartões'}</span>
                    <span />
                    <span className="text-right text-sm font-semibold tabular-nums text-neutral-900 max-sm:hidden dark:text-neutral-100">{g.qtd}</span>
                    <span className="text-right text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(g.mensal)}</span>
                    <BarraConc pct={pctBanco} cor="bg-neutral-700 dark:bg-neutral-300" forte />
                  </div>
                  {/* cartões do banco */}
                  {g.cartoes.map((k) => {
                    const c = cartaoPorId.get(k.id)
                    if (!c) return null
                    const pct = concentracao.totalMensal > 0 ? (k.mensal / concentracao.totalMensal) * 100 : 0
                    return (
                      <div key={k.id} className={`${GRADE_CONC} py-1 text-sm`}>
                        <span className={`truncate pl-3 ${c.ativo ? 'text-neutral-700 dark:text-neutral-300' : 'text-red-700 line-through decoration-red-300 dark:text-red-400'}`} title={c.nome}>
                          {c.nome}
                          {!c.ativo && <span className="ml-1 text-[11px] no-underline">cancelado</span>}
                        </span>
                        <span className="text-xs max-sm:hidden">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px font-medium ${COR_TIPO[c.tipo].selo}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${COR_TIPO[c.tipo].barra}`} />
                            {COR_TIPO[c.tipo].rotulo}
                          </span>
                        </span>
                        <span className="text-right font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                          {c.final ? `••${c.final}` : '——'}
                        </span>
                        <span className="text-right tabular-nums text-neutral-700 max-sm:hidden dark:text-neutral-300">{k.qtd}</span>
                        <span className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">{brl.format(k.mensal)}</span>
                        <BarraConc pct={pct} cor={c.ativo ? COR_TIPO[c.tipo].barra : 'bg-red-400'} />
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {concentracao.sem.qtd > 0 && (
              <div className={`${GRADE_CONC} py-2.5`}>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Sem cartão definido</span>
                <span className="max-sm:hidden" />
                <span />
                <span className="text-right text-sm font-semibold tabular-nums text-amber-700 max-sm:hidden dark:text-amber-400">{concentracao.sem.qtd}</span>
                <span className="text-right text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">{brl.format(concentracao.sem.mensal)}</span>
                <BarraConc pct={concentracao.totalMensal > 0 ? (concentracao.sem.mensal / concentracao.totalMensal) * 100 : 0} cor="bg-amber-400" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Relação das empresas */}
      <section className={cartaoCss}>
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Empresas, assinaturas e pagamentos</h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Cada empresa aparece uma vez. Escolha em qual cartão ela está cadastrada — para saber o que está salvo em cada um e
          o que precisa trocar quando um cartão mudar.
        </p>
        {ativos.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Cadastre seus cartões (físico e virtuais) no fim desta página para poder vincular as empresas.
          </p>
        )}
        {/* Filtro por tipo (combina com os filtros abaixo e com a busca) */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo">
          <span className="mr-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">Tipo:</span>
          {(
            [
              ['todos', 'Todos', null],
              ['assinatura', 'Assinaturas', TIPO.assinatura.classe],
              ['recorrente', 'Recorrentes', TIPO.recorrente.classe],
              ['conta', 'Contas a pagar', TIPO.conta.classe],
            ] as const
          ).map(([id, texto, cor]) => {
            const qtd = id === 'todos' ? principais.length : principais.filter((e) => tipoDe(e) === id).length
            const ativo = filtroTipo === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFiltroTipo(id)}
                aria-pressed={ativo}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  ativo
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : `${cor ?? 'border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'} hover:opacity-80`
                }`}
              >
                {texto} <span className="tabular-nums opacity-70">{qtd}</span>
              </button>
            )
          })}
        </div>
        <div className="mb-3 mt-2 flex flex-wrap items-center gap-2">
          {(
            [
              ['principais', `Assinaturas, recorrentes e contas (${principais.length})`],
              ['semCartao', `Sem cartão (${principais.length - comCartao})`],
              ...(cancelados.length > 0 ? ([['cancelado', `Em cartão cancelado (${qtdEmCancelado})`]] as const) : []),
              ['todas', `Todas (${empresas.length})`],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              aria-pressed={filtro === id}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filtro === id ? 'bg-militar-600 text-white' : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {texto}
            </button>
          ))}
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa"
            className="ml-auto w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-militar-600 sm:w-56 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        {adicionando ? (
          <form
            onSubmit={async (ev) => {
              ev.preventDefault()
              const dados = new FormData(ev.currentTarget)
              setErroNova(null)
              setSalvandoNova(true)
              try {
                const escolha = String(dados.get('cartao_id') ?? '')
                if (escolha === 'novo-pix') dados.set('cartao_id', await garantirPix())
                else if (escolha.startsWith('novo-debito:')) dados.set('cartao_id', await garantirDebitoEmConta(escolha.slice('novo-debito:'.length)))
                await adicionarEmpresa(dados)
                setAdicionando(false)
                setFiltro('principais')
                router.refresh()
              } catch (err) {
                setErroNova(err instanceof Error ? err.message : 'Não consegui adicionar.')
              } finally {
                setSalvandoNova(false)
              }
            }}
            className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-militar-300 bg-militar-50/50 p-3 dark:border-militar-800 dark:bg-militar-950/20"
          >
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Empresa</span>
              <input name="nome" required autoFocus placeholder="ex: 99, Uber, Amazon Prime" className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
              <select name="tipo" defaultValue="recorrente" className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950">
                <option value="recorrente">Pagamento / recorrente</option>
                <option value="assinatura">Assinatura</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Última cobrança</span>
              <input
                type="date"
                name="ultima_cobranca"
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor por mês</span>
              <input
                name="valor_mensal"
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="w-28 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Cartão / forma de pagamento</span>
              <select name="cartao_id" defaultValue="" className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950">
                {opcoesCartao()}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={salvandoNova} className="rounded-lg bg-militar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-militar-500 disabled:opacity-60">
                {salvandoNova ? 'Adicionando…' : 'Adicionar'}
              </button>
              <button type="button" onClick={() => setAdicionando(false)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                Cancelar
              </button>
            </div>
            {erroNova && <p role="alert" className="w-full text-xs font-medium text-red-600 dark:text-red-400">{erroNova}</p>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="mb-3 rounded-lg border border-dashed border-militar-400 px-3 py-2 text-sm font-semibold text-militar-700 transition hover:bg-militar-50 dark:border-militar-700 dark:text-militar-400 dark:hover:bg-militar-950/30"
          >
            + Adicionar empresa que não está na lista
          </button>
        )}
        {erro && (
          <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
        <TabelaOrdenavel
          rotulo="empresas"
          limite={10}
          vazio="Nenhuma empresa com esse filtro."
          ordemInicial={{ chave: 'media', direcao: 'desc' }}
          colunas={[
            { chave: 'empresa', rotulo: 'Empresa' },
            { chave: 'media', soma: 'brl', rotulo: 'Média/mês', alinhar: 'dir' },
            { chave: 'ultima', rotulo: 'Última cobrança', alinhar: 'dir', ocultarNoCelular: true },
            { chave: 'visto', rotulo: 'Apareceu na fatura', ocultarNoCelular: true },
            { chave: 'cartao', rotulo: 'Cartão cadastrado' },
          ]}
          linhas={agruparPorMarca(visiveis, visiveis.map((e) => {
            const cartaoAtual = vinculos[e.chave] ? cartaoPorId.get(vinculos[e.chave]!) : null
            return {
              id: e.chave,
              valores: {
                empresa: e.nome,
                media: e.mediaMensal,
                ultima: e.ultimaData,
                visto: e.vistoEm.join(', ') || null,
                cartao: cartaoAtual ? rotulo(cartaoAtual) : null,
              },
              celulas: {
                empresa: (
                  <span className="block min-w-0">
                    <span className="block max-w-[14rem] truncate font-medium text-neutral-900 sm:max-w-[18rem] dark:text-neutral-100">{e.nome}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                      {e.tipo === 'conta' ? (
                        <span className={`rounded px-1.5 py-px font-semibold ${TIPO.conta.classe}`}>{TIPO.conta.rotulo}</span>
                      ) : (
                        <select
                          value={tipoDe(e)}
                          onChange={(ev) => trocarTipo(e, ev.target.value as TipoEmpresa)}
                          aria-label={`Tag de ${e.nome}`}
                          title="Trocar a tag"
                          className={`cursor-pointer rounded border-0 px-1 py-px text-[11px] font-semibold outline-none ring-1 ring-transparent hover:ring-neutral-300 dark:hover:ring-neutral-600 ${TIPO[tipoDe(e)].classe}`}
                        >
                          <option value="assinatura">Assinatura</option>
                          <option value="recorrente">Recorrente</option>
                          <option value="avulsa">Compra avulsa</option>
                        </select>
                      )}
                      {e.tipo !== 'conta' && tipoDe(e) !== 'avulsa' && (
                        <button
                          type="button"
                          onClick={() => trocarTipo(e, 'avulsa')}
                          title="Não é recorrente: tirar da lista principal"
                          className="rounded px-1 py-px text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                        >
                          ✕ tirar da lista
                        </button>
                      )}
                      {e.tipo !== 'conta' && (
                        <select
                          value={e.periodicidade ?? 'mensal'}
                          onChange={(ev) => trocarPeriodicidade(e, ev.target.value as 'mensal' | 'anual')}
                          aria-label={`Frequência de ${e.nome}`}
                          title="Frequência da cobrança"
                          className={`cursor-pointer rounded border-0 px-1 py-px text-[11px] font-semibold outline-none ring-1 ring-transparent hover:ring-neutral-300 dark:hover:ring-neutral-600 ${
                            e.periodicidade === 'anual' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}
                        >
                          <option value="mensal">Mensal</option>
                          <option value="anual">Anual</option>
                        </select>
                      )}
                      {e.categoria && <span className="text-neutral-500 dark:text-neutral-400">{e.categoria}</span>}
                      {e.adicionadaManual && (
                        <>
                          <span className="text-neutral-400">· adicionada por você</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Remover "${e.nome}" da lista?`)) return
                              const dados = new FormData()
                              dados.set('chave', e.chave)
                              iniciar(async () => {
                                try {
                                  await removerEmpresaManual(dados)
                                  router.refresh()
                                } catch (err) {
                                  setErro(err instanceof Error ? err.message : 'Não consegui remover.')
                                }
                              })
                            }}
                            className="rounded px-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            remover
                          </button>
                        </>
                      )}
                      {e.meses > 1 && <span className="text-neutral-400">· {e.meses} meses</span>}
                    </span>
                  </span>
                ),
                media: e.adicionadaManual ? (
                  <ValorManual
                    valor={e.valorInformado ? e.mediaMensal : null}
                    onSalvar={async (texto) => {
                      const dados = new FormData()
                      dados.set('chave', e.chaveVinculo ?? e.chave)
                      dados.set('valor_mensal', texto)
                      await definirValorEmpresa(dados)
                      router.refresh()
                    }}
                  />
                ) : e.periodicidade === 'anual' ? (
                  <span className="block text-right tabular-nums">
                    <span className="text-neutral-900 dark:text-neutral-100">{brl.format(e.valorAnual ?? 0)}/ano</span>
                    <span className="block text-[10px] text-neutral-500">≈ {brl.format(e.mediaMensal)}/mês</span>
                  </span>
                ) : (
                  <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(e.mediaMensal)}</span>
                ),
                ultima: e.adicionadaManual ? (
                  <DataManual
                    data={e.ultimaData || null}
                    onSalvar={async (data) => {
                      const dados = new FormData()
                      dados.set('chave', e.chaveVinculo ?? e.chave)
                      dados.set('ultima_cobranca', data)
                      await definirDataEmpresa(dados)
                      router.refresh()
                    }}
                  />
                ) : e.ultimaData ? (
                  <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {formatarData(e.ultimaData)} · {brl.format(e.ultimoValor)}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">sem cobrança ainda</span>
                ),
                visto: (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {e.vistoEm.join(', ') ||
                      (e.tipo === 'conta'
                        ? 'conta a pagar'
                        : cartaoAtual
                          ? `pago via ${cartaoAtual.banco || (cartaoAtual.tipo === 'pix' ? 'PIX' : cartaoAtual.nome)}`
                          : '—')}
                  </span>
                ),
                cartao: (
                  <select
                    value={vinculos[e.chave] ?? ''}
                    onChange={(ev) => trocar(e, ev.target.value)}
                    disabled={ativos.length === 0}
                    aria-label={`Cartão de ${e.nome}`}
                    className={`w-full max-w-[15rem] rounded-lg border bg-white px-2 py-1.5 text-xs outline-none focus:border-militar-600 dark:bg-neutral-950 ${
                      cartaoAtual && !cartaoAtual.ativo ? 'border-red-400 text-red-700 dark:border-red-700 dark:text-red-300' : vinculos[e.chave] ? 'border-neutral-300 text-neutral-800 dark:border-neutral-700 dark:text-neutral-200' : 'border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300'
                    } ${salvando && salvandoChave === e.chave ? 'opacity-60' : ''}`}
                  >
                    <option value="">— definir cartão —</option>
                    {fisicos.length > 0 && (
                      <optgroup label="Físicos">
                        {fisicos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {rotulo(c)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {virtuais.length > 0 && (
                      <optgroup label="Virtuais">
                        {virtuais.map((c) => (
                          <option key={c.id} value={c.id}>
                            {rotulo(c)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Débito em conta">
                      {debitos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {rotulo(c)}
                        </option>
                      ))}
                      {bancosSemDebito.map((b) => (
                        <option key={`novo-${b}`} value={`novo-debito:${b}`}>
                          Débito em conta · {b}
                        </option>
                      ))}
                      {debitos.length === 0 && bancosSemDebito.length === 0 && <option value="novo-debito:Conta corrente">Débito em conta</option>}
                    </optgroup>
                    <optgroup label="PIX">
                      {pixes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {rotulo(c)}
                        </option>
                      ))}
                      {pixes.length === 0 && <option value="novo-pix">PIX</option>}
                    </optgroup>
                    {cancelados.length > 0 && (
                      <optgroup label="Cancelados · trocar por um válido">
                        {cancelados.map((c) => (
                          <option key={c.id} value={c.id}>
                            {rotulo(c)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                ),
              },
            }
          }))}
        />
      </section>
    </>
  )

  // Cobranças diferentes da mesma marca (Google One x Google Workspace) viram uma linha "Google" com
  // o total, que abre as cobranças — cada uma com o próprio cartão.
  function agruparPorMarca(lista: EmpresaLinha[], linhas: LinhaTabela[]): LinhaTabela[] {
    const marca = (e: EmpresaLinha) => {
      const p = e.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)[0]
      return p && p.length >= 4 && e.tipo !== 'conta' ? p : null
    }
    const porMarca = new Map<string, number[]>()
    lista.forEach((e, i) => {
      const m = marca(e)
      if (m) porMarca.set(m, [...(porMarca.get(m) ?? []), i])
    })
    const usados = new Set<number>()
    const saida: LinhaTabela[] = []
    lista.forEach((e, i) => {
      if (usados.has(i)) return
      const m = marca(e)
      const membros = m ? (porMarca.get(m) ?? []) : []
      if (membros.length < 2) {
        saida.push(linhas[i])
        return
      }
      membros.forEach((j) => usados.add(j))
      const es = membros.map((j) => lista[j])
      const total = es.reduce((t, x) => t + x.mediaMensal, 0)
      const ultima = es.map((x) => x.ultimaData).filter(Boolean).sort().pop() ?? ''
      const idsCartao = Array.from(new Set(es.map((x) => vinculos[x.chave] ?? null)))
      const nomeMarca = es[0].nome.split(/\s+/)[0]
      const cartaoUnico = idsCartao.length === 1 && idsCartao[0] ? cartaoPorId.get(idsCartao[0]) : null
      saida.push({
        id: `marca:${m}`,
        valores: { empresa: nomeMarca, media: total, ultima, visto: es.flatMap((x) => x.vistoEm).join(', ') || null, cartao: cartaoUnico ? rotulo(cartaoUnico) : null },
        celulas: {
          empresa: (
            <span className="block min-w-0">
              <span className="block font-semibold text-neutral-900 dark:text-neutral-100">{nomeMarca}</span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {es.length} cobranças: {es.map((x) => x.nome).join(', ')}
              </span>
            </span>
          ),
          media: <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{brl.format(total)}</span>,
          ultima: ultima ? <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{formatarData(ultima)}</span> : <span className="text-xs text-neutral-400">—</span>,
          visto: <span className="text-xs text-neutral-500 dark:text-neutral-400">{Array.from(new Set(es.flatMap((x) => x.vistoEm))).join(', ') || '—'}</span>,
          cartao: (
            <span className="text-xs text-neutral-600 dark:text-neutral-300">
              {cartaoUnico ? rotulo(cartaoUnico) : idsCartao.filter(Boolean).length > 1 ? `${idsCartao.filter(Boolean).length} cartões · abra para ver` : 'abra para definir'}
            </span>
          ),
        },
        filhos: membros.map((j) => linhas[j]),
      })
    })
    return saida
  }
}

// Valor por mês de uma empresa adicionada à mão: mostra o valor (ou "informar valor") e vira um
// campo ao tocar; Enter ou sair do campo salva.
function ValorManual({ valor, onSalvar }: { valor: number | null; onSalvar: (texto: string) => Promise<void> }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor !== null ? valor.toFixed(2).replace('.', ',') : '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(false)
  async function salvar() {
    setSalvando(true)
    setErro(false)
    try {
      await onSalvar(texto)
      setEditando(false)
    } catch {
      setErro(true)
    } finally {
      setSalvando(false)
    }
  }
  if (!editando)
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Valor por mês informado por você"
        className={`rounded px-1.5 py-0.5 tabular-nums transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${valor !== null ? 'text-neutral-900 dark:text-neutral-100' : 'text-xs font-medium text-amber-700 dark:text-amber-400'}`}
      >
        {valor !== null ? brl.format(valor) : '+ informar valor'}
      </button>
    )
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <input
        autoFocus
        inputMode="decimal"
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') salvar()
          if (ev.key === 'Escape') setEditando(false)
        }}
        onBlur={salvar}
        placeholder="0,00"
        aria-label="Valor por mês"
        className={`w-24 rounded-md border px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-militar-600 dark:bg-neutral-950 ${erro ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-700'} ${salvando ? 'opacity-60' : ''}`}
      />
    </span>
  )
}

// Data da última cobrança de uma empresa adicionada à mão: mostra a data (ou "informar data") e
// abre um seletor de data ao tocar; salva ao escolher.
function DataManual({ data, onSalvar }: { data: string | null; onSalvar: (data: string) => Promise<void> }) {
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  if (!editando)
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Data da última cobrança informada por você"
        className={`rounded px-1.5 py-0.5 text-xs tabular-nums transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${data ? 'text-neutral-600 dark:text-neutral-300' : 'font-medium text-amber-700 dark:text-amber-400'}`}
      >
        {data ? formatarData(data) : '+ informar data'}
      </button>
    )
  return (
    <input
      type="date"
      autoFocus
      defaultValue={data ?? ''}
      disabled={salvando}
      aria-label="Data da última cobrança"
      onChange={async (ev) => {
        if (!ev.target.value) return
        setSalvando(true)
        try {
          await onSalvar(ev.target.value)
          setEditando(false)
        } finally {
          setSalvando(false)
        }
      }}
      onBlur={() => !salvando && setEditando(false)}
      onKeyDown={(ev) => ev.key === 'Escape' && setEditando(false)}
      className="rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950"
    />
  )
}
