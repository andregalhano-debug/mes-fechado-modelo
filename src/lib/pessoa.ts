import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { primeiroNome } from './donos'

// Visão escolhida no app inteiro: a casa toda ou só uma pessoa.
// Fica num cookie, então a escolha vale em todas as telas e em cada aparelho.
export const COOKIE_PESSOA = 'visao_pessoa'

export type Membro = { id: string; nome: string; apelido: string | null }

export type Visao = {
  membros: Membro[]
  /** 'todos' ou o id do membro */
  pessoa: string
  membro: Membro | null
  nomePessoa: string | null
  /** O item (pelo id do dono) aparece na visão atual? Sem dono = da família → só no Consolidado. */
  mostra: (donoId: string | null | undefined) => boolean
  /** id do login atual */
  eu: string | null
}

/** Pessoas que podem ser escolhidas como dono num formulário (todas as pessoas da casa). */
export function donosEscolhiveis<T extends { id: string }>(membros: T[], eu: string | null): T[] {
  return membros
}

export async function obterVisao(supabase: SupabaseClient): Promise<Visao> {
  const [{ data }, { data: auth }] = await Promise.all([supabase.from('member').select('id, nome, apelido').order('nome'), supabase.auth.getUser()])
  const membros = (data ?? []) as Membro[]
  const jar = await cookies()
  const salvo = jar.get(COOKIE_PESSOA)?.value ?? jar.get('patrimonio_quem')?.value ?? null
  const pessoa = salvo && membros.some((m) => m.id === salvo) ? salvo : 'todos'
  const membro = membros.find((m) => m.id === pessoa) ?? null
  return {
    membros,
    pessoa,
    membro,
    nomePessoa: membro ? primeiroNome(membro.nome) : null,
    mostra: (donoId) => pessoa === 'todos' || donoId === pessoa,
    eu: auth.user?.id ?? null,
  }
}
