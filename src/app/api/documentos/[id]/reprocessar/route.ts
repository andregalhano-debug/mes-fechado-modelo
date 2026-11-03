import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LIMITE_BYTES, TIPOS_ACEITOS, reprocessarDocumento } from '@/lib/documentos'

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// Documento com erro: tenta de novo (senhas configuradas), com a senha digitada (campo "senha",
// usada só nesta tentativa e nunca guardada) ou com um arquivo novo (campo "arquivo").
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const form = await request.formData()
  const senha = String(form.get('senha') ?? '').trim() || null
  const entrada = form.get('arquivo')
  let arquivo: { nome: string; mime: string; bytes: Buffer } | null = null
  if (entrada instanceof File && entrada.size > 0) {
    if (entrada.size > LIMITE_BYTES) return NextResponse.json({ erro: 'Arquivo grande demais (máx. 20 MB).' }, { status: 413 })
    if (!TIPOS_ACEITOS.includes(entrada.type)) return NextResponse.json({ erro: 'Envie PDF ou imagem.' }, { status: 415 })
    arquivo = { nome: entrada.name, mime: entrada.type, bytes: Buffer.from(await entrada.arrayBuffer()) }
  }

  const r = await reprocessarDocumento({ supabase, admin: createAdminClient(), documentoId: id, senha, arquivo })
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status })
  return NextResponse.json({ ok: true, documento_id: r.documentoId })
}
