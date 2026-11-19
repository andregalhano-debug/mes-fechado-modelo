import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, chaveSecreta } from './chaves'

// Cliente com service_role — só usar em rotas de servidor que
// precisam ignorar RLS (verificação de passkey antes do login,
// geração de sessão sem senha). Nunca importar num Client Component.
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    chaveSecreta(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
