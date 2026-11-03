import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { rpInfo, CHALLENGE_COOKIE } from '@/lib/webauthn'

// Sem usuário logado ainda — fluxo "usernameless": o próprio
// aparelho decide qual credencial oferecer (residentKey required
// no registro garante isso).
export async function POST(request: Request) {
  const { rpID } = rpInfo(request)

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
  })

  const resposta = NextResponse.json(options)
  resposta.cookies.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })
  return resposta
}
