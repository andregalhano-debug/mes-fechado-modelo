import { extrairCredito } from '@/lib/credito-cartao'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extrairDocumento } from '@/lib/extracao'
import { desbloquearPdf, descreverRegra, type RegraSenha } from '@/lib/pdf-senha'
import { categorizarPeloHistorico } from '@/lib/categoria-historico'

// Lê com a IA e, em seguida, aplica o padrão de categorias que a família já usa.
async function lerComHistorico(supabase: SupabaseClient, householdId: string, bytes: Buffer, mime: string) {
  const extracao = await extrairDocumento({ base64: bytes.toString('base64'), mimeType: mime })
  try {
    const { lancamentos } = await categorizarPeloHistorico(supabase, householdId, extracao.lancamentos)
    return { ...extracao, lancamentos }
  } catch {
    return extracao
  }
}

// Guarda o arquivo, registra o documento e manda a IA ler — mesmo fluxo para o envio pelo
// app e para as faturas que chegam por e-mail. A fatura sempre fica aguardando confirmação.

export const LIMITE_BYTES = 20 * 1024 * 1024
export const TIPOS_ACEITOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Nomes gerados por celular/scanner às vezes vêm com data por extenso
// (ex.: "...Tue Aug 11 2026 23:37:51 GMT-0300 (Horário Padrão de Brasília).pdf"),
// e o Supabase Storage rejeita ":" e "(" ")" na chave do objeto.
export function sanitizarNomeArquivo(nome: string): string {
  const pontoFinal = nome.lastIndexOf('.')
  const base = pontoFinal > 0 ? nome.slice(0, pontoFinal) : nome
  const extensao = pontoFinal > 0 ? nome.slice(pontoFinal + 1) : ''

  const baseLimpa = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  const extensaoLimpa = extensao.replace(/[^a-zA-Z0-9]/g, '')

  return extensaoLimpa ? `${baseLimpa || 'documento'}.${extensaoLimpa}` : baseLimpa || 'documento'
}

// PDF protegido por senha: a IA não consegue abrir — melhor avisar do que gastar crédito.
export function pdfProtegido(bytes: Buffer) {
  return bytes.subarray(0, Math.min(bytes.length, 4_000_000)).includes('/Encrypt')
}

export type ResultadoProcessamento =
  | { ok: true; documentoId: string; extracao: Awaited<ReturnType<typeof extrairDocumento>> }
  | { ok: false; documentoId?: string; erro: string; status: number }

export async function processarArquivo(params: {
  supabase: SupabaseClient
  householdId: string
  enviadoPor: string | null
  nome: string
  mime: string
  bytes: Buffer
  origem: 'app' | 'telegram' | 'email'
  /** Regra da senha lida no texto do e-mail (testada primeiro). */
  regraSenha?: RegraSenha | null
}): Promise<ResultadoProcessamento> {
  const { supabase, householdId, enviadoPor, nome, mime, origem } = params
  let bytes = params.bytes
  let protegido = mime === 'application/pdf' && pdfProtegido(bytes)
  // PDF com senha do CPF: tenta abrir com as senhas configuradas na Vercel antes de tudo,
  // pra guardar e mandar pra IA a versão já desbloqueada.
  if (protegido) {
    const aberto = await desbloquearPdf(bytes, { regra: params.regraSenha }).catch((e) => {
      console.error('desbloquearPdf', e)
      return null
    })
    if (aberto) {
      bytes = aberto
      protegido = false
    }
  }
  const caminho = `${householdId}/${crypto.randomUUID()}-${sanitizarNomeArquivo(nome)}`

  const { error: erroUpload } = await supabase.storage.from('documentos').upload(caminho, bytes, { contentType: mime })
  if (erroUpload) return { ok: false, erro: `Não consegui guardar o arquivo: ${erroUpload.message}`, status: 500 }

  const { data: documento, error: erroDoc } = await supabase
    .from('document')
    .insert({
      household_id: householdId,
      enviado_por: enviadoPor,
      storage_path: caminho,
      nome_arquivo: nome,
      mime_type: mime,
      origem,
      status: 'processando',
    })
    .select('id')
    .single()
  if (erroDoc || !documento) return { ok: false, erro: `Não consegui registrar o documento: ${erroDoc?.message}`, status: 500 }

  if (protegido) {
    const erro =
      (params.regraSenha
        ? `PDF protegido por senha (o e-mail diz: ${descreverRegra(params.regraSenha)}) e nenhuma senha configurada abriu. Confira o CPF/data na Vercel ou envie a fatura desbloqueada.`
        : 'PDF protegido por senha e nenhuma das senhas configuradas abriu. Baixe a fatura desbloqueada e envie pelo app.')
    await supabase.from('document').update({ status: 'erro', erro, processado_em: new Date().toISOString() }).eq('id', documento.id)
    return { ok: false, documentoId: documento.id, erro, status: 422 }
  }

  try {
    const extracao = await lerComHistorico(supabase, householdId, bytes, mime)
    // fatura de cartão: guarda também limite, fechamento, juros e encargos (cards de Cartões)
    if (extracao.tipo_documento === 'fatura' && mime === 'application/pdf') {
      const credito = await extrairCredito(bytes).catch(() => null)
      if (credito) (extracao as typeof extracao & { credito?: unknown }).credito = credito
    }
    await supabase
      .from('document')
      .update({
        status: 'aguardando_confirmacao',
        tipo_detectado: extracao.tipo_documento,
        confianca: extracao.confianca,
        extracao,
        processado_em: new Date().toISOString(),
      })
      .eq('id', documento.id)
    return { ok: true, documentoId: documento.id, extracao }
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao ler o documento.'
    await supabase.from('document').update({ status: 'erro', erro, processado_em: new Date().toISOString() }).eq('id', documento.id)
    return { ok: false, documentoId: documento.id, erro, status: 502 }
  }
}

// Tenta de novo um documento que deu erro: com as senhas configuradas (ex: depois de ajustar o
// CPF na Vercel), com uma senha digitada na hora (não é guardada) ou com um arquivo novo
// (a fatura já desbloqueada). Dando certo, o documento vai para "aguardando confirmação".
export async function reprocessarDocumento(params: {
  supabase: SupabaseClient
  admin: SupabaseClient
  documentoId: string
  senha?: string | null
  arquivo?: { nome: string; mime: string; bytes: Buffer } | null
}): Promise<ResultadoProcessamento> {
  const { supabase, admin, documentoId } = params
  const { data: doc } = await supabase
    .from('document')
    .select('id, household_id, storage_path, nome_arquivo, mime_type, status')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc) return { ok: false, erro: 'Documento não encontrado.', status: 404 }
  if (doc.status === 'confirmado') return { ok: false, documentoId, erro: 'Este documento já foi lançado.', status: 409 }

  let bytes: Buffer
  let nome = doc.nome_arquivo as string
  let mime = doc.mime_type as string
  if (params.arquivo) {
    ;({ bytes, nome, mime } = params.arquivo)
  } else {
    const { data: blob, error } = await admin.storage.from('documentos').download(doc.storage_path)
    if (error || !blob) return { ok: false, documentoId, erro: 'Não encontrei o arquivo guardado. Envie o arquivo de novo.', status: 404 }
    bytes = Buffer.from(await blob.arrayBuffer())
  }

  if (mime === 'application/pdf' && pdfProtegido(bytes)) {
    const aberto = await desbloquearPdf(bytes, { senhaInformada: params.senha ?? null }).catch(() => null)
    if (!aberto) {
      const erro = params.senha
        ? 'A senha informada não abriu o PDF. Confira e tente de novo, ou envie o arquivo desbloqueado.'
        : 'PDF protegido por senha e nenhuma das senhas configuradas abriu. Informe a senha ou envie o arquivo desbloqueado.'
      await supabase.from('document').update({ status: 'erro', erro, processado_em: new Date().toISOString() }).eq('id', documentoId)
      return { ok: false, documentoId, erro, status: 422 }
    }
    bytes = aberto
  }

  // Guarda a versão nova (desbloqueada ou enviada) no lugar da antiga.
  const caminho = `${doc.household_id}/${crypto.randomUUID()}-${sanitizarNomeArquivo(nome)}`
  const { error: erroUpload } = await admin.storage.from('documentos').upload(caminho, bytes, { contentType: mime })
  if (erroUpload) return { ok: false, documentoId, erro: `Não consegui guardar o arquivo: ${erroUpload.message}`, status: 500 }
  if (doc.storage_path && doc.storage_path !== caminho) await admin.storage.from('documentos').remove([doc.storage_path])
  await supabase
    .from('document')
    .update({ storage_path: caminho, nome_arquivo: nome, mime_type: mime, status: 'processando', erro: null })
    .eq('id', documentoId)

  try {
    const extracao = await lerComHistorico(supabase, doc.household_id as string, bytes, mime)
    await supabase
      .from('document')
      .update({
        status: 'aguardando_confirmacao',
        tipo_detectado: extracao.tipo_documento,
        confianca: extracao.confianca,
        extracao,
        erro: null,
        processado_em: new Date().toISOString(),
      })
      .eq('id', documentoId)
    return { ok: true, documentoId, extracao }
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao ler o documento.'
    await supabase.from('document').update({ status: 'erro', erro, processado_em: new Date().toISOString() }).eq('id', documentoId)
    return { ok: false, documentoId, erro, status: 502 }
  }
}
