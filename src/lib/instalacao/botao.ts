// Botão "Publicar na Vercel": cria o repositório do aluno no GitHub dele, publica na Vercel e cria
// o Supabase pela Vercel (as chaves entram sozinhas). O banco se instala no primeiro build.
export const REPOSITORIO_MODELO = 'https://github.com/andregalhano-debug/mes-fechado-modelo'

export function urlDoBotao() {
  const p = new URLSearchParams({
    'repository-url': REPOSITORIO_MODELO,
    'project-name': 'meu-mes-fechado',
    'repository-name': 'meu-mes-fechado',
    env: 'CRON_SECRET',
    envDescription: 'Invente uma frase longa, sem espaços (ex.: minha-casa-azul-2026-segura). Protege as rotinas diárias.',
    stores: JSON.stringify([
      { type: 'integration', integrationSlug: 'supabase', productSlug: 'supabase', protocol: 'storage' },
    ]),
  })
  return `https://vercel.com/new/clone?${p.toString()}`
}
