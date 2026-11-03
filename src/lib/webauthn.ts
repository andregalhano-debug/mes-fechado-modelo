import { MARCA } from '@/lib/marca'
// Deriva rpID/origin da própria requisição, para funcionar em
// localhost no dev e no domínio real em produção sem configurar nada.
export function rpInfo(request: Request) {
  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const rpID = new URL(origin).hostname
  const rpName = MARCA.titulo
  return { rpID, rpName, origin }
}

export const CHALLENGE_COOKIE = 'webauthn_challenge'
