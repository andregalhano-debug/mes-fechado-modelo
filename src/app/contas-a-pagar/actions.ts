'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { chaveEmpresa } from '@/lib/empresas'
import { buscarFaturasPorEmail } from '@/lib/faturas-email'

function paraNumero(valor: FormDataEntryValue | null): number {
  const texto = String(valor ?? '0').replace(/\./g, '').replace(',', '.')
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : 0
}

// "mes" de uma conta é o mês do próprio vencimento (YYYY-MM-01) — só serve pra
// categorização no histórico/balanço, nunca trava edição (ver 0010_bill_mensal.sql).
function mesDeData(data: string): string {
  return data.slice(0, 8) + '01'
}

// Categoria de receita (Salário...) só vale em receita, e de despesa só em despesa.
async function validarCategoria(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoriaId: string | null,
  natureza: string,
) {
  if (!categoriaId) return
  const { data: cat } = await supabase.from('category').select('nome, natureza').eq('id', categoriaId).maybeSingle()
  if (!cat) throw new Error('Categoria não encontrada.')
  if (cat.natureza !== natureza) {
    throw new Error(
      `"${cat.nome}" é categoria de ${cat.natureza === 'receita' ? 'receita' : 'despesa'}. Marque ${cat.natureza === 'receita' ? 'Receita' : 'Despesa'} ou escolha outra categoria.`,
    )
  }
}

async function membro() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  const { data: membro } = await supabase
    .from('member')
    .select('id, household_id')
    .eq('id', user.id)
    .single()
  if (!membro) throw new Error('Membro não encontrado.')
  return { supabase, ...membro }
}

export async function criarConta(formData: FormData) {
  const { supabase, household_id } = await membro()

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')

  const vencimento = String(formData.get('vencimento') ?? '')
  if (!vencimento) throw new Error('Vencimento é obrigatório.')

  const categoriaId = String(formData.get('category_id') ?? '')
  // "repeticao": nao | mensal | anual (o formulário antigo mandava só o checkbox "recorrente").
  const repeticao = String(formData.get('repeticao') ?? (formData.get('recorrente') === 'on' ? 'mensal' : 'nao'))

  const { data, error } = await supabase
    .from('bill')
    .insert({
      household_id,
      descricao,
      valor: paraNumero(formData.get('valor')),
      vencimento,
      mes: mesDeData(vencimento),
      recorrente: repeticao !== 'nao',
      periodicidade: repeticao === 'anual' ? 'anual' : 'mensal',
      debito_automatico: formData.get('debito_automatico') === 'on',
      category_id: categoriaId || null,
      cartao_id: String(formData.get('cartao_id') ?? '') || null,
      responsavel_id: String(formData.get('responsavel_id') ?? '') || null,
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Não consegui criar a conta.')
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

export async function pagarConta(formData: FormData) {
  const { supabase, id: idLogado, household_id } = await membro()
  const id = String(formData.get('id'))
  const responsavelEscolhido = String(formData.get('pago_por') ?? '')
  const pago_por = responsavelEscolhido || idLogado

  const { data: contaOriginal } = await supabase
    .from('bill')
    .select(
      'descricao, valor, vencimento, recorrente, periodicidade, debito_automatico, account_id, responsavel_id, category_id, linhagem_id, cartao_id, so_lembrete, detalhe',
    )
    .eq('id', id)
    .single()

  // Só marca se ainda estiver em aberto: um segundo clique (ou envio repetido) numa conta
  // que já foi paga não faz nada — antes, cada clique clonava de novo a ocorrência do mês
  // seguinte de uma conta recorrente.
  const { data, error } = await supabase
    .from('bill')
    .update({ pago: true, pago_em: new Date().toISOString().slice(0, 10), pago_por })
    .eq('id', id)
    .eq('pago', false)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    revalidatePath('/contas-a-pagar')
    return
  }

  // Conta recorrente: já abre a próxima ocorrência com os mesmos dados — no mês seguinte
  // (mensal) ou 12 meses depois (anual) — a menos que essa linhagem já tenha conta lá.
  if (contaOriginal?.recorrente) {
    const anual = contaOriginal.periodicidade === 'anual'
    const [ano, mes, dia] = contaOriginal.vencimento.split('-').map(Number)
    const proximoVencimento = (anual ? new Date(ano + 1, mes - 1, dia) : new Date(ano, mes, dia))
      .toISOString()
      .slice(0, 10)
    const { data: jaExiste } = await supabase
      .from('bill')
      .select('id')
      .eq('linhagem_id', contaOriginal.linhagem_id)
      .eq('mes', mesDeData(proximoVencimento))
      .limit(1)
    if (jaExiste && jaExiste.length > 0) {
      revalidatePath('/contas-a-pagar')
      revalidatePath('/')
      return
    }

    await supabase.from('bill').insert({
      household_id,
      descricao: contaOriginal.descricao,
      valor: contaOriginal.valor,
      vencimento: proximoVencimento,
      mes: mesDeData(proximoVencimento),
      linhagem_id: contaOriginal.linhagem_id,
      recorrente: true,
      periodicidade: anual ? 'anual' : 'mensal',
      debito_automatico: contaOriginal.debito_automatico,
      account_id: contaOriginal.account_id,
      responsavel_id: contaOriginal.responsavel_id,
      category_id: contaOriginal.category_id,
      cartao_id: contaOriginal.cartao_id,
      so_lembrete: contaOriginal.so_lembrete ?? false,
      // mantém o vínculo com a empresa da assinatura (senão a sincronização criaria outra conta)
      detalhe: (contaOriginal as { detalhe?: unknown }).detalhe ?? null,
    })
  }

  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Replica em lote as contas em aberto pro mês seguinte (mesmo dia), com o valor e o
// vencimento de cada uma já ajustáveis na tela antes de confirmar — diferente do
// auto-lançamento de uma conta "recorrente" ao pagar (que não passa por revisão).
export async function replicarContas(formData: FormData) {
  const { supabase, household_id } = await membro()

  const ids = formData.getAll('ids').map(String)
  const linhas = ids
    .filter((id) => formData.get(`incluir_${id}`) === 'on')
    .map((id) => {
      const vencimento = String(formData.get(`vencimento_${id}`) ?? '')
      return {
        household_id,
        descricao: String(formData.get(`descricao_${id}`) ?? '').trim(),
        valor: paraNumero(formData.get(`valor_${id}`)),
        vencimento,
        mes: mesDeData(vencimento),
        linhagem_id: String(formData.get(`linhagem_id_${id}`) ?? '') || undefined,
        recorrente: formData.get(`recorrente_${id}`) === '1',
        debito_automatico: formData.get(`debito_automatico_${id}`) === '1',
        account_id: String(formData.get(`account_id_${id}`) ?? '') || null,
        category_id: String(formData.get(`category_id_${id}`) ?? '') || null,
        cartao_id: String(formData.get(`cartao_id_${id}`) ?? '') || null,
        responsavel_id: String(formData.get(`responsavel_id_${id}`) ?? '') || null,
      }
    })
    .filter((l) => l.descricao && l.vencimento)

  // Não duplica: ignora a conta se a mesma linhagem já existir no mês de destino (ex: o
  // formulário enviado duas vezes, ou a conta recorrente já clonada ao pagar).
  const meses = Array.from(new Set(linhas.map((l) => l.mes)))
  const { data: existentes } = await supabase.from('bill').select('linhagem_id, mes').in('mes', meses)
  const ocupadas = new Set((existentes ?? []).map((e) => `${e.linhagem_id}·${e.mes}`))
  const novas = linhas.filter((l) => {
    if (!l.linhagem_id) return true
    const chave = `${l.linhagem_id}·${l.mes}`
    if (ocupadas.has(chave)) return false
    ocupadas.add(chave)
    return true
  })

  if (novas.length === 0) return

  const { error } = await supabase.from('bill').insert(novas)
  if (error) throw new Error(error.message)

  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Edita descrição, valor, vencimento, repetição e cartão de uma conta ainda em aberto (ex: ajustar o valor
// de luz/cartão depois de replicar o mês). Conta já paga não muda por aqui. Se o
// vencimento mudar de mês, a conta passa a pertencer ao novo mês.
export async function atualizarConta(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const descricao = String(formData.get('descricao') ?? '').trim()
  const vencimento = String(formData.get('vencimento') ?? '')
  if (!descricao) throw new Error('Descrição é obrigatória.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw new Error('Vencimento inválido.')

  const repeticao = String(formData.get('repeticao') ?? '')
  const extra: Record<string, unknown> =
    repeticao === 'nao' || repeticao === 'mensal' || repeticao === 'anual'
      ? { recorrente: repeticao !== 'nao', periodicidade: repeticao === 'anual' ? 'anual' : 'mensal' }
      : {}
  if (formData.has('cartao_id')) extra.cartao_id = String(formData.get('cartao_id') ?? '') || null
  if (formData.has('responsavel_id')) extra.responsavel_id = String(formData.get('responsavel_id') ?? '') || null
  if (formData.has('so_lembrete_campo')) extra.so_lembrete = formData.get('so_lembrete') === 'on'

  const { data, error } = await supabase
    .from('bill')
    .update({ descricao, valor: paraNumero(formData.get('valor')), vencimento, mes: mesDeData(vencimento), ...extra })
    .eq('id', id)
    .eq('pago', false)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Conta não encontrada ou já paga.')
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Dono de uma fatura/extrato inteiro: aplica a todos os lançamentos vindos daquele documento.
export async function definirDonoDocumento(formData: FormData) {
  const { supabase } = await membro()
  const documentoId = String(formData.get('document_id') ?? '')
  if (!documentoId) throw new Error('Documento inválido.')
  const memberId = String(formData.get('member_id') ?? '') || null
  const { error } = await supabase.from('transaction').update({ member_id: memberId }).eq('document_id', documentoId)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// -------- Cartões (aba Cartões) --------
// Só apelido, bandeira e os 4 últimos dígitos: nunca o número completo, validade ou CVV.
export async function criarCartao(formData: FormData) {
  const { supabase, household_id } = await membro()
  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) throw new Error('Dê um apelido pro cartão.')
  const final = String(formData.get('final') ?? '').replace(/\D/g, '')
  if (final && final.length !== 4) throw new Error('Informe só os 4 últimos dígitos do cartão.')
  const tipoInformado = String(formData.get('tipo') ?? '')
  const tipo = ['virtual', 'debito', 'pix'].includes(tipoInformado) ? tipoInformado : 'fisico'

  const { error } = await supabase.from('cartao').insert({
    household_id,
    nome,
    tipo,
    final: final || null,
    bandeira: String(formData.get('bandeira') ?? '').trim() || null,
    banco: String(formData.get('banco') ?? '').trim() || null,
    titular_id: String(formData.get('titular_id') ?? '') || null,
    observacao: String(formData.get('observacao') ?? '').trim() || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Banco do cartão (agrupa os vários virtuais de cada banco).
export async function definirBancoCartao(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id') ?? '')
  const banco = String(formData.get('banco') ?? '').trim() || null
  const { error } = await supabase.from('cartao').update({ banco }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Em qual cartão uma empresa/assinatura está cadastrada (uma linha por empresa).
export async function definirCartaoEmpresa(formData: FormData) {
  const { supabase, household_id } = await membro()
  const chave = String(formData.get('chave') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  if (!chave || !nome) throw new Error('Empresa inválida.')
  const cartaoId = String(formData.get('cartao_id') ?? '') || null
  const { error } = await supabase
    .from('empresa_cartao')
    .upsert({ household_id, chave, nome, cartao_id: cartaoId, atualizado_em: new Date().toISOString() }, { onConflict: 'household_id,chave' })
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// "Débito em conta" de um banco: usa a já cadastrada ou cria (nome "Conta {banco}") — assim dá pra
// escolher débito em conta direto no seletor das empresas, sem cadastrar antes.
export async function garantirDebitoEmConta(banco: string): Promise<string> {
  const { supabase, household_id } = await membro()
  const nomeBanco = banco.trim() || 'Banco'
  const { data: existentes } = await supabase.from('cartao').select('id, banco, ativo').eq('tipo', 'debito')
  const achado = (existentes ?? []).find((c) => (c.banco ?? '').toLowerCase() === nomeBanco.toLowerCase() && c.ativo)
  if (achado) return achado.id as string
  const { data, error } = await supabase
    .from('cartao')
    .insert({ household_id, nome: `Conta ${nomeBanco}`, banco: nomeBanco, tipo: 'debito' })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não consegui criar o débito em conta.')
  revalidatePath('/contas-a-pagar')
  return data.id as string
}

// "PIX" como forma de pagamento: usa o já cadastrado ou cria um ("PIX").
export async function garantirPix(): Promise<string> {
  const { supabase, household_id } = await membro()
  const { data: existentes } = await supabase.from('cartao').select('id, ativo').eq('tipo', 'pix')
  const achado = (existentes ?? []).find((c) => c.ativo)
  if (achado) return achado.id as string
  const { data, error } = await supabase.from('cartao').insert({ household_id, nome: 'PIX', tipo: 'pix' }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Não consegui criar o PIX.')
  revalidatePath('/contas-a-pagar')
  return data.id as string
}

// Empresa/assinatura/pagamento adicionada à mão (ex: 99, com cartão salvo, sem compra recente).
// A chave é a mesma usada pras faturas: quando aparecer uma cobrança dela, junta na mesma linha.
export async function adicionarEmpresa(formData: FormData) {
  const { supabase, household_id } = await membro()
  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) throw new Error('Informe o nome da empresa.')
  const tipo = String(formData.get('tipo') ?? 'recorrente')
  if (!['assinatura', 'recorrente'].includes(tipo)) throw new Error('Tipo inválido.')
  const cartaoId = String(formData.get('cartao_id') ?? '') || null
  const chave = chaveEmpresa(nome, null)
  const valorTexto = String(formData.get('valor_mensal') ?? '').trim()
  const valorMensal = valorTexto ? paraNumero(valorTexto.replace(/[^\d.,]/g, '')) : null
  const dataTexto = String(formData.get('ultima_cobranca') ?? '').trim()
  const ultimaCobranca = /^\d{4}-\d{2}-\d{2}$/.test(dataTexto) ? dataTexto : null
  const { error } = await supabase
    .from('empresa_cartao')
    .upsert(
      { household_id, chave, nome, tipo, cartao_id: cartaoId, ...(valorMensal !== null ? { valor_mensal: valorMensal } : {}), ...(ultimaCobranca ? { ultima_cobranca: ultimaCobranca } : {}), atualizado_em: new Date().toISOString() },
      { onConflict: 'household_id,chave' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Valor mensal de uma empresa adicionada à mão (cobrança que não aparece nas faturas importadas).
export async function definirValorEmpresa(formData: FormData) {
  const { supabase } = await membro()
  const chave = String(formData.get('chave') ?? '')
  const texto = String(formData.get('valor_mensal') ?? '').trim()
  const valor = texto ? paraNumero(texto.replace(/[^\d.,]/g, '')) : null
  if (valor !== null && (Number.isNaN(valor) || valor < 0)) throw new Error('Valor inválido.')
  const { error } = await supabase.from('empresa_cartao').update({ valor_mensal: valor, atualizado_em: new Date().toISOString() }).eq('chave', chave)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Data da última cobrança de uma empresa adicionada à mão.
export async function definirDataEmpresa(formData: FormData) {
  const { supabase } = await membro()
  const chave = String(formData.get('chave') ?? '')
  const data = String(formData.get('ultima_cobranca') ?? '').trim()
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.')
  const { error } = await supabase.from('empresa_cartao').update({ ultima_cobranca: data || null, atualizado_em: new Date().toISOString() }).eq('chave', chave)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Remove uma empresa adicionada à mão (só o cadastro; não mexe em lançamentos).
export async function removerEmpresaManual(formData: FormData) {
  const { supabase } = await membro()
  const chave = String(formData.get('chave') ?? '')
  const { error } = await supabase.from('empresa_cartao').delete().eq('chave', chave)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Cobrança mensal ou anual (ex.: anuidade de um app) — muda o "por mês" (anual = valor ÷ 12).
export async function definirPeriodicidadeEmpresa(formData: FormData) {
  const { supabase, household_id } = await membro()
  const chave = String(formData.get('chave') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const periodicidade = String(formData.get('periodicidade') ?? '')
  if (!chave || !nome || !['mensal', 'anual'].includes(periodicidade)) throw new Error('Dados inválidos.')
  const { data: atual } = await supabase.from('empresa_cartao').select('id').eq('chave', chave).maybeSingle()
  const { error } = atual
    ? await supabase.from('empresa_cartao').update({ periodicidade, atualizado_em: new Date().toISOString() }).eq('id', atual.id)
    : await supabase.from('empresa_cartao').insert({ household_id, chave, nome, periodicidade })
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Tag da empresa escolhida pela família (assinatura / recorrente / avulsa) — avulsa tira da lista principal.
export async function definirTipoEmpresa(formData: FormData) {
  const { supabase, household_id } = await membro()
  const chave = String(formData.get('chave') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const tipo = String(formData.get('tipo') ?? '')
  if (!chave || !nome) throw new Error('Empresa inválida.')
  if (!['assinatura', 'recorrente', 'avulsa'].includes(tipo)) throw new Error('Tipo inválido.')
  const { data: atual } = await supabase.from('empresa_cartao').select('id').eq('chave', chave).maybeSingle()
  const { error } = atual
    ? await supabase.from('empresa_cartao').update({ tipo, atualizado_em: new Date().toISOString() }).eq('id', atual.id)
    : await supabase.from('empresa_cartao').insert({ household_id, chave, nome, tipo })
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Conta a pagar: o cartão fica na própria conta — vale pras ocorrências em aberto e pra mais recente
// (as próximas herdam ao serem geradas).
export async function definirCartaoConta(formData: FormData) {
  const { supabase } = await membro()
  const linhagem = String(formData.get('linhagem_id') ?? '')
  if (!linhagem) throw new Error('Conta inválida.')
  const cartaoId = String(formData.get('cartao_id') ?? '') || null
  const { error } = await supabase.from('bill').update({ cartao_id: cartaoId }).eq('linhagem_id', linhagem).eq('pago', false)
  if (error) throw new Error(error.message)
  const { data: ultima } = await supabase.from('bill').select('id').eq('linhagem_id', linhagem).order('vencimento', { ascending: false }).limit(1)
  if (ultima?.[0]) await supabase.from('bill').update({ cartao_id: cartaoId }).eq('id', ultima[0].id)
  revalidatePath('/contas-a-pagar')
}

export async function alternarCartaoAtivo(formData: FormData) {
  const { supabase } = await membro()
  const { error } = await supabase
    .from('cartao')
    .update({ ativo: formData.get('ativo') === '1' })
    .eq('id', String(formData.get('id')))
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

// Cartão perdido/cancelado: leva todas as contas ainda em aberto pra outro cartão de uma vez.
// Contas já pagas ficam como estão (histórico de onde foram cobradas).
export async function moverContasDeCartao(formData: FormData) {
  const { supabase } = await membro()
  const de = String(formData.get('de') ?? '')
  const para = String(formData.get('para') ?? '')
  if (!de || !para || de === para) throw new Error('Escolha o cartão de destino.')
  const { error } = await supabase.from('bill').update({ cartao_id: para }).eq('cartao_id', de).eq('pago', false)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

export async function removerCartao(formData: FormData) {
  const { supabase } = await membro()
  const { error } = await supabase.from('cartao').delete().eq('id', String(formData.get('id')))
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
}

export async function atualizarCategoriaConta(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const categoryId = String(formData.get('category_id') ?? '')

  const { error } = await supabase
    .from('bill')
    .update({ category_id: categoryId || null })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

export async function removerConta(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('bill').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// -------- Lançamentos (aba Lançamentos, movida da Visão geral pra cá) --------

export async function criarLancamento(formData: FormData) {
  const { supabase, household_id } = await membro()

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')

  const data = String(formData.get('data') ?? '')
  if (!data) throw new Error('Data é obrigatória.')

  const natureza = String(formData.get('natureza') ?? 'despesa')
  const categoriaId = String(formData.get('category_id') ?? '')
  await validarCategoria(supabase, categoriaId || null, natureza)
  // "repeticao": nao | mensal | anual (o formulário antigo mandava só o checkbox "recorrente").
  const repeticao = String(formData.get('repeticao') ?? (formData.get('recorrente') === 'on' ? 'mensal' : 'nao'))
  const contaId = String(formData.get('account_id') ?? '')
  // Dono do lançamento (uma pessoa da casa); vazio = da casa.
  let memberId: string | null = String(formData.get('member_id') ?? '') || null
  if (memberId) {
    const { data: valido } = await supabase.from('member').select('id').eq('id', memberId).eq('household_id', household_id).maybeSingle()
    if (!valido) memberId = null
  }

  const { data: linhas, error } = await supabase
    .from('transaction')
    .insert({
      household_id,
      member_id: memberId,
      descricao,
      valor: paraNumero(formData.get('valor')),
      data,
      natureza,
      category_id: categoriaId || null,
      account_id: contaId || null,
      hash_dedupe: `manual|${data}|${descricao}|${paraNumero(formData.get('valor'))}|${Date.now()}`,
    })
    .select('id')

  if (error) throw new Error(error.message)
  if (!linhas || linhas.length === 0) throw new Error('Não consegui lançar.')
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

export async function atualizarCategoriaLancamento(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const categoryId = String(formData.get('category_id') ?? '')
  if (categoryId) {
    const { data: lanc } = await supabase.from('transaction').select('natureza').eq('id', id).maybeSingle()
    if (lanc) await validarCategoria(supabase, categoryId, lanc.natureza)
  }

  const { error } = await supabase
    .from('transaction')
    .update({ category_id: categoryId || null })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Edição completa de um lançamento feito à mão (os de fatura se ajustam pela conferência da fatura).
export async function editarLancamento(formData: FormData) {
  const { supabase, household_id } = await membro()
  const id = String(formData.get('id') ?? '')
  const { data: atual } = await supabase.from('transaction').select('id, document_id').eq('id', id).maybeSingle()
  if (!atual) throw new Error('Lançamento não encontrado.')
  if (atual.document_id) throw new Error('Lançamento de fatura: ajuste pela conferência da fatura, na aba Documentos.')

  const descricao = String(formData.get('descricao') ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')
  const data = String(formData.get('data') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.')
  const valor = paraNumero(formData.get('valor'))
  if (!(valor > 0)) throw new Error('Informe um valor maior que zero.')
  const natureza = String(formData.get('natureza') ?? 'despesa') === 'receita' ? 'receita' : 'despesa'
  const categoriaId = String(formData.get('category_id') ?? '') || null
  await validarCategoria(supabase, categoriaId, natureza)
  let memberId: string | null = String(formData.get('member_id') ?? '') || null
  if (memberId) {
    const { data: valido } = await supabase.from('member').select('id').eq('id', memberId).eq('household_id', household_id).maybeSingle()
    if (!valido) memberId = null
  }
  const contaId = String(formData.get('account_id') ?? '') || null

  const { error } = await supabase
    .from('transaction')
    .update({ descricao, data, valor, valor_brl: valor, natureza, category_id: categoriaId, member_id: memberId, account_id: contaId })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

export async function removerLancamento(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id'))
  const { error } = await supabase.from('transaction').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Botão "Buscar faturas no e-mail agora" (aba Documentos): mesma rotina do cron diário.
export async function buscarFaturasAgora(): Promise<{ mensagem: string }> {
  await membro()
  try {
    const r = await buscarFaturasPorEmail({ dias: 30 })
    revalidatePath('/contas-a-pagar')
    const partes = [`${r.faturasProcessadas} fatura${r.faturasProcessadas === 1 ? '' : 's'} nova${r.faturasProcessadas === 1 ? '' : 's'}`]
    if (r.incompleto) partes.push('ainda há e-mails — clique de novo para continuar')
    if (r.ignorados.length) partes.push(`${r.ignorados.length} e-mail${r.ignorados.length === 1 ? '' : 's'} ignorado${r.ignorados.length === 1 ? '' : 's'}`)
    if (r.erros.length) partes.push(`${r.erros.length} com problema: ${r.erros[0]}`)
    return { mensagem: partes.join(' · ') }
  } catch (e) {
    return { mensagem: e instanceof Error ? e.message : 'Não consegui ler o e-mail de faturas.' }
  }
}

// Leva uma conta (em aberto ou já paga) para outro mês sem redigitar: mantém o dia do vencimento
// (ajusta para o último dia quando o mês destino é mais curto). Conta paga mantém a data do pagamento.
// Se a mesma conta (linhagem) já estiver em aberto no mês destino — a cópia que o app cria ao pagar —
// essa cópia anda um período para frente (mês seguinte, ou ano seguinte se anual), sem duplicar.
export async function moverContaDeMes(formData: FormData): Promise<{ erro?: string; aviso?: string }> {
  const { supabase } = await membro()
  const id = String(formData.get('id') ?? '')
  const destino = String(formData.get('mes') ?? '')
  if (!id || !/^\d{4}-\d{2}$/.test(destino)) return { erro: 'Mês inválido.' }

  const { data: conta } = await supabase.from('bill').select('vencimento, linhagem_id, pago, periodicidade').eq('id', id).maybeSingle()
  if (!conta) return { erro: 'Conta não encontrada.' }

  const naData = (ym: string, diaOriginal: number) => {
    const [a, m] = ym.split('-').map(Number)
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
    return `${ym}-${String(Math.min(diaOriginal || 1, ultimo)).padStart(2, '0')}`
  }
  const somarMesesYm = (ym: string, n: number) => {
    const [a, m] = ym.split('-').map(Number)
    const d = new Date(Date.UTC(a, m - 1 + n, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const vencimento = naData(destino, Number(String(conta.vencimento).slice(8, 10)))
  let aviso: string | undefined

  if (conta.linhagem_id) {
    const { data: noDestino } = await supabase
      .from('bill')
      .select('id, vencimento, pago')
      .eq('linhagem_id', conta.linhagem_id)
      .eq('mes', mesDeData(vencimento))
      .neq('id', id)
    const ja = noDestino ?? []
    if (ja.some((b) => b.pago) || (ja.length && !conta.pago)) return { erro: 'Essa conta já existe no mês escolhido.' }
    if (ja.length) {
      // conta paga indo para o mês onde está a próxima cópia em aberto: a cópia anda um período
      const copia = ja[0]
      const passo = conta.periodicidade === 'anual' ? 12 : 1
      const novoVenc = naData(somarMesesYm(String(copia.vencimento).slice(0, 7), passo), Number(String(copia.vencimento).slice(8, 10)))
      const { data: ocupado } = await supabase.from('bill').select('id').eq('linhagem_id', conta.linhagem_id).eq('mes', mesDeData(novoVenc)).limit(1)
      if (ocupado?.length) return { erro: 'A próxima cópia dessa conta também já existe — ajuste manualmente.' }
      const { error: e1 } = await supabase.from('bill').update({ vencimento: novoVenc, mes: mesDeData(novoVenc) }).eq('id', copia.id).eq('pago', false)
      if (e1) return { erro: e1.message }
      aviso = `A cópia em aberto foi para ${novoVenc.slice(8, 10)}/${novoVenc.slice(5, 7)}/${novoVenc.slice(0, 4)}.`
    }
  }

  const { error } = await supabase.from('bill').update({ vencimento, mes: mesDeData(vencimento) }).eq('id', id)
  if (error) return { erro: error.message }
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
  return { aviso }
}

// Próxima renovação de uma conta anual (seguro do carro, residencial, vida…): troca a data da
// próxima cobrança em aberto — a conta passa para o mês da nova data.
export async function definirRenovacao(formData: FormData) {
  const { supabase } = await membro()
  const id = String(formData.get('id') ?? '')
  const data = String(formData.get('data') ?? '')
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.')
  const { error } = await supabase.from('bill').update({ vencimento: data, mes: mesDeData(data) }).eq('id', id).eq('pago', false)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// Opcional: assinaturas e cobranças recorrentes viram contas a pagar (lembrete, porque são cobradas
// no cartão — o valor entra pela fatura). Idempotente: só cria se a empresa não tiver conta em aberto.
export async function criarContasDeAssinaturas(
  itens: { chave: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'anual'; cartaoId: string | null }[],
): Promise<number> {
  const { supabase, household_id } = await membro()
  if (!itens.length) return 0
  const { data: abertas } = await supabase.from('bill').select('detalhe').eq('pago', false).not('detalhe', 'is', null)
  const ja = new Set((abertas ?? []).map((b) => (b.detalhe as { empresa_chave?: string } | null)?.empresa_chave).filter(Boolean))
  const { data: cat } = await supabase.from('category').select('id').eq('natureza', 'despesa').ilike('nome', 'Software%').limit(1).maybeSingle()
  const novas = itens
    .filter((i) => !ja.has(i.chave) && i.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.vencimento))
    .map((i) => ({
      household_id,
      descricao: i.nome,
      valor: Math.round(i.valor * 100) / 100,
      vencimento: i.vencimento,
      mes: mesDeData(i.vencimento),
      recorrente: true,
      periodicidade: i.periodicidade,
      cartao_id: i.cartaoId,
      category_id: cat?.id ?? null,
      so_lembrete: true,
      detalhe: { empresa_chave: i.chave, origem: 'assinatura' },
    }))
  if (!novas.length) return 0
  const { error } = await supabase.from('bill').insert(novas)
  if (error) throw new Error(error.message)
  revalidatePath('/contas-a-pagar')
  return novas.length
}
