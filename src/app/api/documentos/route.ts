import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extrairDocumento } from '@/lib/extracao'

// Faturas maiores/multi-página podem levar mais que o padrão da plataforma
// pra IA processar — sem isso, a função é encerrada no meio e o cliente só
// vê uma falha de conexão genérica, sem nenhum log de erro do nosso lado.
export const maxDuration = 60

const LIMITE_BYTES = 20 * 1024 * 1024
const TIPOS_ACEITOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]

// Nomes gerados por celular/scanner às vezes vêm com data por extenso
// (ex.: "...Tue Aug 11 2026 23:37:51 GMT-0300 (Horário Padrão de Brasília).pdf"),
// e o Supabase Storage rejeita ":" e "(" ")" na chave do objeto.
function sanitizarNomeArquivo(nome: string): string {
  const pontoFinal = nome.lastIndexOf('.')
  const base = pontoFinal > 0 ? nome.slice(0, pontoFinal) : nome
  const extensao = pontoFinal > 0 ? nome.slice(pontoFinal + 1) : ''

  const baseLimpa = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  const extensaoLimpa = extensao.replace(/[^a-zA-Z0-9]/g, '')

  return extensaoLimpa ? `${baseLimpa || 'documento'}.${extensaoLimpa}` : baseLimpa || 'documento'
}

// Documentos lidos que ainda esperam revisão (inclui os que chegaram por e-mail).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  const { data } = await supabase
    .from('document')
    .select('id, nome_arquivo, origem, criado_em, extracao')
    .eq('status', 'aguardando_confirmacao')
    .order('criado_em', { ascending: false })
  return NextResponse.json({
    pendentes: (data ?? []).map((d) => {
      const x = (d.extracao ?? {}) as { instituicao?: string | null; valor_total?: number | null; lancamentos?: unknown[] }
      return {
        id: d.id,
        nome: d.nome_arquivo,
        origem: d.origem,
        criadoEm: d.criado_em,
        instituicao: x.instituicao ?? null,
        valorTotal: x.valor_total ?? null,
        qtd: Array.isArray(x.lancamentos) ? x.lancamentos.length : 0,
      }
    }),
  })
}

export async function POST(request: Request) {
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
    return NextResponse.json(
      { erro: 'Seu usuário ainda não está vinculado a uma família.' },
      { status: 403 },
    )
  }

  const form = await request.formData()
  const arquivo = form.get('arquivo')

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Envie um arquivo.' }, { status: 400 })
  }

  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: 'Arquivo maior que 20 MB. Envie um menor.' },
      { status: 400 },
    )
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: 'Aceito PDF de fatura, ou foto/print em PNG, JPG ou WEBP.' },
      { status: 400 },
    )
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer())
  const caminho = `${membro.household_id}/${crypto.randomUUID()}-${sanitizarNomeArquivo(arquivo.name)}`

  const { error: erroUpload } = await supabase.storage
    .from('documentos')
    .upload(caminho, bytes, { contentType: arquivo.type })

  if (erroUpload) {
    return NextResponse.json(
      { erro: `Não consegui guardar o arquivo: ${erroUpload.message}` },
      { status: 500 },
    )
  }

  const { data: documento, error: erroDoc } = await supabase
    .from('document')
    .insert({
      household_id: membro.household_id,
      enviado_por: user.id,
      storage_path: caminho,
      nome_arquivo: arquivo.name,
      mime_type: arquivo.type,
      origem: 'app',
      status: 'processando',
    })
    .select('id')
    .single()

  if (erroDoc || !documento) {
    return NextResponse.json(
      { erro: `Não consegui registrar o documento: ${erroDoc?.message}` },
      { status: 500 },
    )
  }

  try {
    const extracao = await extrairDocumento({
      base64: bytes.toString('base64'),
      mimeType: arquivo.type,
    })

    // Confiança baixa não vira lançamento sozinha — vai para confirmação.
    const status = extracao.confianca >= 0.8 ? 'aguardando_confirmacao' : 'aguardando_confirmacao'

    await supabase
      .from('document')
      .update({
        status,
        tipo_detectado: extracao.tipo_documento,
        confianca: extracao.confianca,
        extracao,
        processado_em: new Date().toISOString(),
      })
      .eq('id', documento.id)

    return NextResponse.json({ documento_id: documento.id, extracao })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha ao ler o documento.'

    await supabase
      .from('document')
      .update({ status: 'erro', erro: mensagem, processado_em: new Date().toISOString() })
      .eq('id', documento.id)

    return NextResponse.json({ erro: mensagem }, { status: 502 })
  }
}
