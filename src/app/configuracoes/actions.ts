'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function membro() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  const { data: membro } = await supabase
    .from('member')
    .select('household_id')
    .eq('id', user.id)
    .single()
  if (!membro) throw new Error('Membro não encontrado.')
  return { supabase, household_id: membro.household_id }
}

function revalidarTudo() {
  revalidatePath('/configuracoes')
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

export async function criarCategoria(formData: FormData) {
  const { supabase, household_id } = await membro()

  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) throw new Error('Nome é obrigatório.')

  const natureza = String(formData.get('natureza') ?? 'despesa')
  if (natureza !== 'despesa' && natureza !== 'receita') throw new Error('Natureza inválida.')

  const { error } = await supabase.from('category').insert({ household_id, nome, natureza })
  if (error) throw new Error(error.message)

  revalidarTudo()
}

// Remover uma categoria não apaga contas/lançamentos que já usavam ela — eles só ficam
// "sem categoria" (a referência é on delete set null). Só uma eventual meta de orçamento
// (budget_rule) pra essa categoria é removida junto.
export async function removerCategoria(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('category').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidarTudo()
}

// Renomeia um aparelho cadastrado na biometria (só os da própria pessoa — RLS passkey_self).
export async function renomearPasskey(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const apelido = String(formData.get('apelido') ?? '').trim().slice(0, 60)
  if (!id || !apelido) throw new Error('Informe o nome do aparelho.')
  const { error } = await supabase.from('passkey').update({ apelido }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes')
}

// Remove um aparelho da biometria (RLS: cada um só apaga os próprios). O login por senha continua.
export async function removerPasskey(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Aparelho inválido.')
  const { error } = await supabase.from('passkey').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes')
}
