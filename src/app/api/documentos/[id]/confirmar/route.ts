import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LancamentoExtraido } from '@/lib/extracao'
import { contasCorrespondentes } from '@/lib/conta-correspondente'

type Params = { params: Promise<{ id: string }> }

function chaveDedupe(l: LancamentoExtraido) {
  const base = `${l.data}|${l.descricao}|${l.valor}`
  return l.parcela_num ? `${base}|p${l.parcela_num}/${l.parcela_total ?? ''}` : base
}

// Next 16: params é assíncrono.
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const { data: membro } = await supabase
    .from('member')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!membro) {
    return NextResponse.json({ erro: 'Usuário sem família vinculada.' }, { status: 403 })
  }

  const { data: documento } = await supabase
    .from('document')
    .select('id, status, extracao, enviado_por, criado_em')
    .eq('id', id)
    .single()

  if (!documento) {
    return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 })
  }

  if (documento.status === 'confirmado') {
    return NextResponse.json(
      { erro: 'Este documento já foi lançado.' },
      { status: 409 },
    )
  }

  const corpo = (await request.json()) as {
    account_id?: string
    /** dono escolhido na revisão ('' = família); ausente = quem enviou */
    member_id?: string
    /** 'conta' = a fatura é de uma conta a pagar já cadastrada: atualiza a conta, não lança itens */
    modo?: 'conta' | 'lancamentos'
    bill_id?: string
    /** lançar os itens mesmo havendo conta a pagar correspondente (o usuário escolheu) */
    forcar?: boolean
    lancamentos: LancamentoExtraido[]
  }

  const extracaoDoc = (documento.extracao ?? null) as { tipo_documento?: string; instituicao?: string | null; vencimento?: string | null; valor_total?: number | null } | null

  if (corpo.modo === 'conta') {
    if (!corpo.bill_id) return NextResponse.json({ erro: 'Escolha a conta a pagar.' }, { status: 400 })
    const { data: conta } = await supabase.from('bill').select('id, mes, pago, valor').eq('id', corpo.bill_id).maybeSingle()
    if (!conta) return NextResponse.json({ erro: 'Conta a pagar não encontrada.' }, { status: 404 })
    // Conta ainda em aberto: assume o valor (e o vencimento, se for do mesmo mês) que veio na fatura.
    if (!conta.pago) {
      const mudancas: { valor?: number; vencimento?: string } = {}
      if (extracaoDoc?.valor_total && extracaoDoc.valor_total > 0) mudancas.valor = extracaoDoc.valor_total
      if (extracaoDoc?.vencimento && extracaoDoc.vencimento.slice(0, 7) === String(conta.mes).slice(0, 7)) mudancas.vencimento = extracaoDoc.vencimento
      if (Object.keys(mudancas).length > 0) {
        const { error } = await supabase.from('bill').update(mudancas).eq('id', conta.id)
        if (error) return NextResponse.json({ erro: `Não consegui atualizar a conta: ${error.message}` }, { status: 500 })
      }
    }
    await supabase.from('document').update({ status: 'confirmado' }).eq('id', documento.id)
    return NextResponse.json({ ok: true, modo: 'conta', atualizada: !conta.pago })
  }

  if (!Array.isArray(corpo.lancamentos)) {
    return NextResponse.json({ erro: 'Envie a lista de lançamentos.' }, { status: 400 })
  }

  // Trava contra duplicidade: fatura de conta a pagar já cadastrada só vira lançamento se o
  // usuário escolher isso explicitamente na revisão.
  if (!corpo.forcar) {
    const correspondentes = await contasCorrespondentes(supabase, extracaoDoc, documento.criado_em)
    if (correspondentes.length > 0) {
      return NextResponse.json(
        {
          erro: `Esta fatura já está em Contas a pagar (${correspondentes[0].descricao}). Atualize a conta em vez de lançar os itens, para não contar duas vezes.`,
        },
        { status: 409 },
      )
    }
  }

  const [{ data: categorias }, { data: perfis }] = await Promise.all([
    supabase.from('category').select('id, nome').eq('household_id', membro.household_id),
    supabase.from('cost_profile').select('id, nome').eq('household_id', membro.household_id),
  ])

  let dono: string | null = documento.enviado_por ?? null
  if (corpo.member_id !== undefined) {
    dono = corpo.member_id || null
    if (dono) {
      const { data: valido } = await supabase.from('member').select('id').eq('id', dono).eq('household_id', membro.household_id).maybeSingle()
      if (!valido) return NextResponse.json({ erro: 'Dono inválido.' }, { status: 400 })
    }
  }

  const idPorCategoria = new Map((categorias ?? []).map((c) => [c.nome, c.id]))
  const idPorPerfil = new Map((perfis ?? []).map((p) => [p.nome, p.id]))

  // Duas compras iguais no mesmo dia (mesmo lugar e valor) são duas compras: a 2ª ganha "#2" na chave.
  const vistas = new Map<string, number>()
  const chaveUnica = (l: LancamentoExtraido) => {
    const k = chaveDedupe(l)
    const n = (vistas.get(k) ?? 0) + 1
    vistas.set(k, n)
    return n > 1 ? `${k}#${n}` : k
  }

  const linhas = corpo.lancamentos.map((l) => ({
    household_id: membro.household_id,
    account_id: corpo.account_id ?? null,
    category_id: l.categoria_sugerida ? (idPorCategoria.get(l.categoria_sugerida) ?? null) : null,
    cost_profile_id: l.perfil_sugerido ? (idPorPerfil.get(l.perfil_sugerido) ?? null) : null,
    document_id: documento.id,
    member_id: dono,
    descricao: l.descricao,
    valor: l.valor,
    moeda: 'BRL',
    valor_brl: l.valor,
    data: l.data,
    natureza: l.natureza,
    canal: l.canal,
    parcela_num: l.parcela_num,
    parcela_total: l.parcela_total,
    // Impede lançar a mesma fatura duas vezes. A parcela entra na chave: a mesma compra
    // parcelada aparece em toda fatura com a mesma data/descrição/valor (só muda o "10/12").
    hash_dedupe: chaveUnica(l),
  }))

  const { error: erroInsert, count } = await supabase
    .from('transaction')
    .upsert(linhas, {
      onConflict: 'household_id,hash_dedupe',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (erroInsert) {
    return NextResponse.json(
      { erro: `Não consegui lançar: ${erroInsert.message}` },
      { status: 500 },
    )
  }

  await supabase.from('document').update({ status: 'confirmado' }).eq('id', documento.id)

  return NextResponse.json({
    lancados: count ?? linhas.length,
    ignorados_por_duplicidade: linhas.length - (count ?? linhas.length),
  })
}
