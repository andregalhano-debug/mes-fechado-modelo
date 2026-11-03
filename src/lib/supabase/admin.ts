import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente com service_role — só usar em rotas de servidor que
// precisam ignorar RLS (verificação de passkey antes do login,
// geração de sessão sem senha). Nunca importar num Client Component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
