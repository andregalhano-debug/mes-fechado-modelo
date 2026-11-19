'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ResultadoAcao = { ok: true; mensagem?: string } | { ok: false; erro: string }

function revalidarTudo() {
  revalidatePath('/configuracoes')
  revalidatePath('/contas-a-pagar')
  revalidatePath('/')
}

// ---------- Pessoas da casa (sem SQL Editor, sem e-mail) ----------
export async function adicionarPessoa(formData: FormData): Promise<ResultadoAcao> {
  const nome = String(formData.get('nome') ?? '').trim().slice(0, 60)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  if (!nome) return { ok: false, erro: 'Escreva o nome da pessoa.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' }
  if (senha.length < 8) return { ok: false, erro: 'A senha provisória precisa ter pelo menos 8 caracteres.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }
  const { data: eu } = await supabase.from('member').select('papel').eq('id', user.id).single()
  if (eu?.papel !== 'admin') return { ok: false, erro: 'Só o dono do sistema adiciona pessoas.' }

  // 1) convite (o RLS só deixa o admin da casa criar)  2) conta já confirmada: o banco liga a pessoa à casa
  const { error: erroConvite } = await supabase.from('convite').upsert({ email, nome })
  if (erroConvite) return { ok: false, erro: erroConvite.message }
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error) {
    await supabase.from('convite').delete().eq('email', email)
    return {
      ok: false,
      erro: /already|registered|exists/i.test(error.message) ? 'Esse e-mail já tem conta neste sistema.' : error.message,
    }
  }
  revalidarTudo()
  return {
    ok: true,
    mensagem: `${nome} já pode entrar com ${email} e a senha provisória. Peça para trocar a senha em Configurações.`,
  }
}

// ---------- Dados de exemplo (botões) ----------
export async function dadosDeExemplo(acao: 'carregar' | 'apagar'): Promise<ResultadoAcao> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(acao === 'carregar' ? 'carregar_dados_exemplo' : 'apagar_dados_exemplo')
  if (error) return { ok: false, erro: error.message }
  revalidarTudo()
  return { ok: true }
}
