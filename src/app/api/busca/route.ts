import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obterVisao } from '@/lib/pessoa'

// Busca uma empresa em todas as faturas (lançamentos) e nas contas a pagar.
// Respeita o RLS (só a casa de quem está logado) e a visão por pessoa escolhida no menu.
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const termo = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (termo.length < 2) return NextResponse.json({ lancamentos: [], contas: [] })
  // escapa os curingas do ilike e as vírgulas/parênteses do filtro "or"
  const seguro = termo.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')
  // Faturas abreviam nomes ("Conectc*Fulano" pra ConectCar, "Mp *Lojaexemplo"...): além do termo
  // exato, procura sem espaços e pelo começo (6 letras) de cada palavra digitada.
  const variantes = new Set<string>([seguro, seguro.replace(/\s+/g, '')])
  for (const p of seguro.split(/\s+/)) if (p.length >= 6) variantes.add(p.slice(0, 6))
  const filtroDescricao = Array.from(variantes)
    .filter((v) => v.length >= 2)
    .flatMap((v) => [`descricao.ilike.%${v}%`, `canal.ilike.%${v}%`])
    .join(',')
  const filtroConta = Array.from(variantes)
    .filter((v) => v.length >= 2)
    .map((v) => `descricao.ilike.%${v}%`)
    .join(',')

  const visao = await obterVisao(supabase)
  const [{ data: lancs }, { data: contas }, { data: docs }] = await Promise.all([
    supabase
      .from('transaction')
      .select('id, descricao, canal, valor, data, natureza, parcela_num, parcela_total, document_id, member_id, category:category_id(nome)')
      .or(filtroDescricao)
      .order('data', { ascending: false })
      .limit(500),
    supabase
      .from('bill')
      .select('id, descricao, valor, vencimento, pago, responsavel_id, category:category_id(nome)')
      .or(filtroConta)
      .order('vencimento', { ascending: false })
      .limit(200),
    supabase.from('document').select('id, nome_arquivo, instituicao:extracao->>instituicao, vencimento:extracao->>vencimento'),
  ])
  const doc = new Map((docs ?? []).map((d) => [d.id as string, d as { id: string; nome_arquivo: string; instituicao: string | null; vencimento: string | null }]))
  const nomeCat = (c: unknown) => ((Array.isArray(c) ? c[0] : c) as { nome?: string } | null)?.nome ?? null

  return NextResponse.json({
    lancamentos: (lancs ?? [])
      .filter((t) => visao.mostra(t.member_id))
      .map((t) => {
        const d = t.document_id ? doc.get(t.document_id) : undefined
        return {
          id: t.id,
          descricao: t.descricao,
          canal: t.canal,
          valor: Number(t.valor),
          data: t.data,
          natureza: t.natureza,
          parcela: t.parcela_total ? `${t.parcela_num}/${t.parcela_total}` : null,
          categoria: nomeCat(t.category),
          documentoId: d?.id ?? null,
          fatura: d ? `${d.instituicao ?? d.nome_arquivo}${d.vencimento ? ` · venc. ${d.vencimento.split('-').reverse().join('/')}` : ''}` : 'Lançado à mão',
        }
      }),
    contas: (contas ?? []).map((c) => ({
      id: c.id,
      descricao: c.descricao,
      valor: Number(c.valor),
      vencimento: c.vencimento,
      pago: c.pago,
      categoria: nomeCat(c.category),
    })),
  })
}
