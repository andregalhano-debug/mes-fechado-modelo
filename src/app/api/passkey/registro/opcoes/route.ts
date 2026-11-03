import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { rpInfo, CHALLENGE_COOKIE } from '@/lib/webauthn'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const { data: membro } = await supabase
    .from('member')
    .select('nome')
    .eq('id', user.id)
    .single()

  const { data: existentes } = await supabase
    .from('passkey')
    .select('credential_id, transports')
    .eq('member_id', user.id)

  const { rpID, rpName } = rpInfo(request)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email ?? membro?.nome ?? 'usuário',
    userDisplayName: membro?.nome ?? user.email ?? 'usuário',
    attestationType: 'none',
    excludeCredentials: (existentes ?? []).map((p) => ({
      id: p.credential_id,
      transports: (p.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      // biometria do próprio aparelho, não chave USB externa
      authenticatorAttachment: 'platform',
    },
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
