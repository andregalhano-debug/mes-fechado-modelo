import { createHash } from 'node:crypto'
import { chaveSecreta } from '@/lib/supabase/chaves'

/** Código curto da casa para a Lia ler o progresso. Muda só se a chave secreta do Supabase mudar. */
export function codigoDeProgresso() {
  const segredo = chaveSecreta()
  if (!segredo) return ''
  return createHash('sha256').update(`progresso:${segredo}`).digest('base64url').slice(0, 12)
}
