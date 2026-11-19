'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type Resultado = { ok: true } | { ok: false; erro: string }

// Primeiro acesso: cria o dono do sistema SEM e-mail de confirmação e sem painel do Supabase.
// Só funciona enquanto ninguém é dono; depois disso, novas pessoas só entram com convite.
export async function criarDono(formData: FormData): Promise<Resultado> {
  const nome = String(formData.get('nome') ?? '').trim().slice(0, 60)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  if (!nome) return { ok: false, erro: 'Escreva o seu nome.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' }
  if (senha.length < 8) return { ok: false, erro: 'A senha precisa ter pelo menos 8 caracteres.' }

  const admin = createAdminClient()
  const { data: situacao, error: erroSituacao } = await admin.rpc('situacao_instalacao')
  if (erroSituacao) return { ok: false, erro: 'O banco ainda não está instalado. Veja a página /instalar.' }
  if ((situacao as { tem_dono?: boolean } | null)?.tem_dono) {
    return { ok: false, erro: 'Este sistema já tem dono. Entre com o seu e-mail e senha.' }
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error) {
    return {
      ok: false,
      erro: /already|registered|exists/i.test(error.message)
        ? 'Esse e-mail já tem conta neste Supabase. Entre pela tela de login.'
        : error.message,
    }
  }
  return { ok: true }
}
