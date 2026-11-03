'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function paraNumero(valor: FormDataEntryValue | null): number {
  const texto = String(valor ?? '0').replace(/\./g, '').replace(',', '.')
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : 0
}

// Todo o patrimônio agora vive dentro do "mês aberto" (patrimonio_periodo) — as ações de
// criar/editar/remover só valem pra esse mês. Meses anteriores viram histórico, só leitura.
async function contexto() {
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

  const { data: periodo } = await supabase
    .from('patrimonio_periodo')
    .select('mes')
    .eq('household_id', membro.household_id)
    .single()

  const mesAberto = periodo?.mes ?? new Date().toISOString().slice(0, 8) + '01'
  return { supabase, household_id: membro.household_id, mesAberto }
}

export async function criarConta(formData: FormData) {
  const { supabase, household_id, mesAberto } = await contexto()

  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) throw new Error('Nome é obrigatório.')

  const { data, error } = await supabase
    .from('account')
    .insert({
      household_id,
      mes: mesAberto,
      member_id: String(formData.get('member_id') ?? '') || null,
      nome,
      instituicao: String(formData.get('instituicao') ?? '').trim() || null,
      tipo: String(formData.get('tipo') ?? 'corrente'),
      moeda: String(formData.get('moeda') ?? 'BRL'),
      saldo_atual: paraNumero(formData.get('saldo_atual')),
      saldo_atualizado_em: new Date().toISOString(),
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Não consegui adicionar a conta.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function desativarConta(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('account').update({ ativo: false }).eq('id', id).eq('mes', mesAberto)
  if (error) throw new Error(error.message)
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function atualizarSaldoConta(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const saldo_atual = paraNumero(formData.get('saldo'))

  const { data, error } = await supabase
    .from('account')
    .update({ saldo_atual, saldo_atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('mes', mesAberto)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Conta não encontrada no mês aberto.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function criarInvestimento(formData: FormData) {
  const { supabase, household_id, mesAberto } = await contexto()

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')

  const { data, error } = await supabase
    .from('investment_position')
    .insert({
      household_id,
      mes: mesAberto,
      member_id: String(formData.get('member_id') ?? '') || null,
      descricao,
      classe: String(formData.get('classe') ?? 'outro'),
      valor_mercado: paraNumero(formData.get('valor_mercado')),
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Não consegui adicionar o investimento.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function atualizarInvestimento(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const valor_mercado = paraNumero(formData.get('valor_mercado'))

  const { data, error } = await supabase
    .from('investment_position')
    .update({ valor_mercado, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('mes', mesAberto)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Investimento não encontrado no mês aberto.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function removerInvestimento(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('investment_position').delete().eq('id', id).eq('mes', mesAberto)
  if (error) throw new Error(error.message)
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function criarBem(formData: FormData) {
  const { supabase, household_id, mesAberto } = await contexto()

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')

  const { data, error } = await supabase
    .from('physical_asset')
    .insert({
      household_id,
      mes: mesAberto,
      descricao,
      tipo: String(formData.get('tipo') ?? 'outro'),
      valor_estimado: paraNumero(formData.get('valor_estimado')),
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Não consegui adicionar o bem.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function atualizarBem(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const valor_estimado = paraNumero(formData.get('valor_estimado'))

  const { data, error } = await supabase
    .from('physical_asset')
    .update({ valor_estimado, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('mes', mesAberto)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Bem não encontrado no mês aberto.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function removerBem(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('physical_asset').delete().eq('id', id).eq('mes', mesAberto)
  if (error) throw new Error(error.message)
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function criarRetido(formData: FormData) {
  const { supabase, household_id, mesAberto } = await contexto()

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')

  const { data, error } = await supabase
    .from('retained_resource')
    .insert({
      household_id,
      mes: mesAberto,
      member_id: String(formData.get('member_id') ?? '') || null,
      descricao,
      tipo: String(formData.get('tipo') ?? 'outro'),
      saldo: paraNumero(formData.get('saldo')),
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Não consegui adicionar.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function removerRetido(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('retained_resource').delete().eq('id', id).eq('mes', mesAberto)
  if (error) throw new Error(error.message)
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

export async function atualizarRetido(formData: FormData) {
  const { supabase, mesAberto } = await contexto()
  const id = String(formData.get('id'))
  const saldo = paraNumero(formData.get('saldo'))

  const { data, error } = await supabase
    .from('retained_resource')
    .update({ saldo, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('mes', mesAberto)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Registro não encontrado no mês aberto.')
  revalidatePath('/patrimonio')
  revalidatePath('/')
}

function proximoMesIso(mes: string): string {
  const [ano, m] = mes.slice(0, 7).split('-').map(Number)
  return new Date(ano, m, 1).toISOString().slice(0, 10)
}

function mesAnteriorIso(mes: string): string {
  const [ano, m] = mes.slice(0, 7).split('-').map(Number)
  return new Date(ano, m - 2, 1).toISOString().slice(0, 10)
}

// Clona o mês aberto pro mês seguinte (mesma linhagem_id em cada item, pra casar o
// histórico) e avança o ponteiro — o mês que era aberto vira histórico (só leitura).
export async function iniciarProximoMes() {
  const { supabase, household_id, mesAberto } = await contexto()
  const proximoMes = proximoMesIso(mesAberto)

  const [contas, investimentos, bens, retidos] = await Promise.all([
    supabase.from('account').select('*').eq('household_id', household_id).eq('mes', mesAberto).eq('ativo', true),
    supabase.from('investment_position').select('*').eq('household_id', household_id).eq('mes', mesAberto),
    supabase.from('physical_asset').select('*').eq('household_id', household_id).eq('mes', mesAberto),
    supabase.from('retained_resource').select('*').eq('household_id', household_id).eq('mes', mesAberto),
  ])

  const agora = new Date().toISOString()

  const novasContas = (contas.data ?? []).map(({ id, criado_em, ...resto }) => ({
    ...resto,
    mes: proximoMes,
    saldo_atualizado_em: agora,
  }))
  const novosInvestimentos = (investimentos.data ?? []).map(({ id, ...resto }) => ({
    ...resto,
    mes: proximoMes,
    atualizado_em: agora,
  }))
  const novosBens = (bens.data ?? []).map(({ id, ...resto }) => ({
    ...resto,
    mes: proximoMes,
    atualizado_em: agora,
  }))
  const novosRetidos = (retidos.data ?? []).map(({ id, ...resto }) => ({
    ...resto,
    mes: proximoMes,
    atualizado_em: agora,
  }))

  await Promise.all([
    novasContas.length ? supabase.from('account').insert(novasContas) : Promise.resolve(),
    novosInvestimentos.length ? supabase.from('investment_position').insert(novosInvestimentos) : Promise.resolve(),
    novosBens.length ? supabase.from('physical_asset').insert(novosBens) : Promise.resolve(),
    novosRetidos.length ? supabase.from('retained_resource').insert(novosRetidos) : Promise.resolve(),
  ])

  const { error } = await supabase
    .from('patrimonio_periodo')
    .update({ mes: proximoMes })
    .eq('household_id', household_id)
  if (error) throw new Error(error.message)

  revalidatePath('/patrimonio')
  revalidatePath('/')
}

// Desfaz um "Iniciar mês seguinte" clicado sem querer (ou clicado duas vezes): apaga os
// registros do mês aberto atual — que são só o clone automático, sem edição real ainda —
// e devolve o ponteiro pro mês anterior, que continua intacto pra editar normalmente.
export async function voltarMesAnterior() {
  const { supabase, household_id, mesAberto } = await contexto()
  const mesAnterior = mesAnteriorIso(mesAberto)

  await Promise.all([
    supabase.from('account').delete().eq('household_id', household_id).eq('mes', mesAberto),
    supabase.from('investment_position').delete().eq('household_id', household_id).eq('mes', mesAberto),
    supabase.from('physical_asset').delete().eq('household_id', household_id).eq('mes', mesAberto),
    supabase.from('retained_resource').delete().eq('household_id', household_id).eq('mes', mesAberto),
  ])

  const { error } = await supabase
    .from('patrimonio_periodo')
    .update({ mes: mesAnterior })
    .eq('household_id', household_id)
  if (error) throw new Error(error.message)

  revalidatePath('/patrimonio')
  revalidatePath('/')
}

// Dono (uma pessoa ou a casa) de um item do patrimônio. Vale pra linhagem inteira, então o
// histórico e os totais por pessoa ficam coerentes em todos os meses daquele item.
export async function definirDono(formData: FormData) {
  const { supabase, household_id } = await contexto()
  const tabela = String(formData.get('tabela') ?? '')
  if (!['account', 'investment_position', 'retained_resource'].includes(tabela)) throw new Error('Tipo de item inválido.')
  const id = String(formData.get('id') ?? '')
  const memberId = String(formData.get('member_id') ?? '') || null

  const { data: item } = await supabase.from(tabela).select('linhagem_id').eq('id', id).single()
  if (!item) throw new Error('Item não encontrado.')

  const { error } = await supabase
    .from(tabela)
    .update({ member_id: memberId })
    .eq('household_id', household_id)
    .eq('linhagem_id', item.linhagem_id)
  if (error) throw new Error(error.message)
  revalidatePath('/patrimonio')
  revalidatePath('/')
}
