'use server'

import { createClient } from '@/lib/supabase/server'

// Histórico das conversas com o assistente: cada pessoa só enxerga as próprias (RLS por user_id).
export type Msg = { role: 'user' | 'assistant'; content: string }
export type ResumoConversa = { id: string; titulo: string; atualizadoEm: string; perguntas: string[] }

export async function listarConversas(): Promise<ResumoConversa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('assistente_conversa')
    .select('id, titulo, atualizado_em, mensagens')
    .order('atualizado_em', { ascending: false })
    .limit(100)
  return ((data ?? []) as { id: string; titulo: string; atualizado_em: string; mensagens: Msg[] }[]).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    atualizadoEm: c.atualizado_em,
    perguntas: (c.mensagens ?? []).filter((m) => m.role === 'user').map((m) => m.content),
  }))
}

export async function abrirConversa(id: string): Promise<Msg[] | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('assistente_conversa').select('mensagens').eq('id', id).maybeSingle()
  return (data?.mensagens as Msg[] | undefined) ?? null
}

/** Cria (sem id) ou atualiza a conversa; devolve o id. */
export async function salvarConversa(id: string | null, mensagens: Msg[]): Promise<string | null> {
  const limpas = mensagens.filter((m) => m.content.trim()).slice(-60)
  if (!limpas.some((m) => m.role === 'user')) return id
  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from('assistente_conversa').update({ mensagens: limpas, atualizado_em: new Date().toISOString() }).eq('id', id)
    return error ? null : id
  }
  const primeira = limpas.find((m) => m.role === 'user')!.content.trim().replace(/\s+/g, ' ')
  const titulo = primeira.length > 80 ? `${primeira.slice(0, 77)}…` : primeira
  const { data, error } = await supabase.from('assistente_conversa').insert({ titulo, mensagens: limpas }).select('id').single()
  return error ? null : (data.id as string)
}

export async function apagarConversa(id: string) {
  const supabase = await createClient()
  await supabase.from('assistente_conversa').delete().eq('id', id)
}
