import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA } from './chaves'

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_CHAVE_PUBLICA,
  )
}
