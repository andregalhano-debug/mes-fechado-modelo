import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contasCorrespondentes } from '@/lib/conta-correspondente'
import { categorizarPeloHistorico } from '@/lib/categoria-historico'
import type { LancamentoExtraido } from '@/lib/extracao'

type Params = { params: Promise<{ id: string }> }

// Abre um documento já lido (ex: fatura que chegou por e-mail) pra revisar e confirmar.
// A leitura passa pelo RLS: só devolve documento da família de quem está logado.
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const [{ data: documento }, { data: membros }] = await Promise.all([
    supabase.from('document').select('id, household_id, nome_arquivo, origem, status, extracao, enviado_por, criado_em').eq('id', id).maybeSingle(),
    supabase.from('member').select('id, nome, apelido').order('nome'),
  ])
  const { data: categorias } = await supabase.from('category').select('nome').order('nome')
  if (!documento) return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 })
  const extracaoDoc = documento.extracao as { lancamentos?: LancamentoExtraido[] } | null
  if (documento.status === 'aguardando_confirmacao' && extracaoDoc?.lancamentos?.length) {
    try {
      const { lancamentos } = await categorizarPeloHistorico(supabase, documento.household_id, extracaoDoc.lancamentos)
      documento.extracao = { ...extracaoDoc, lancamentos }
    } catch {}
  }
  const correspondentes = documento.status === 'confirmado' ? [] : await contasCorrespondentes(supabase, documento.extracao, documento.criado_em)
  return NextResponse.json({
    documento,
    membros: membros ?? [],
    correspondentes,
    categorias: Array.from(new Set((categorias ?? []).map((c) => c.nome as string))),
  })
}

// Descarta um documento que ainda não foi lançado (apaga o registro e o arquivo guardado).
// Documento já confirmado nunca é apagado por aqui: os lançamentos dele dependem do registro.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { data: documento } = await supabase.from('document').select('id, status, storage_path').eq('id', id).maybeSingle()
  if (!documento) return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 })
  if (documento.status === 'confirmado') {
    return NextResponse.json({ erro: 'Este documento já foi lançado e não pode ser descartado.' }, { status: 409 })
  }

  const admin = createAdminClient()
  if (documento.storage_path) await admin.storage.from('documentos').remove([documento.storage_path])
  const { error } = await admin.from('document').delete().eq('id', documento.id)
  if (error) return NextResponse.json({ erro: `Não consegui descartar: ${error.message}` }, { status: 500 })
  return NextResponse.json({ ok: true })
}
