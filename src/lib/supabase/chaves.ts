// Endereço e chaves do Supabase, aceitando os dois jeitos de ligar o banco:
// - pela Vercel (botão "Deploy" / Marketplace) ou pela integração do Supabase com a Vercel:
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY (chaves novas);
// - colando à mão do painel do Supabase: NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.
// As variáveis NEXT_PUBLIC_ precisam ser lidas assim, por extenso, para irem para o navegador.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''

export const SUPABASE_CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Só no servidor. Nunca importar num Client Component. */
export function chaveSecreta() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

/** O banco está ligado? (sem isso, o site mostra a página /instalar) */
export const SUPABASE_LIGADO = !!(SUPABASE_URL && SUPABASE_CHAVE_PUBLICA)
