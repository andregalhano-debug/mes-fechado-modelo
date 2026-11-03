import { NextResponse } from 'next/server'
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server'
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

  const desafio = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${CHALLENGE_COOKIE}=`))
    ?.split('=')[1]

  if (!desafio) {
    return NextResponse.json(
      { erro: 'O código de verificação expirou. Tente de novo.' },
      { status: 400 },
    )
  }

  const corpo = (await request.json()) as {
    resposta: RegistrationResponseJSON
    apelido?: string
  }

  const { rpID, origin } = rpInfo(request)

  let verificacao
  try {
    verificacao = await verifyRegistrationResponse({
      response: corpo.resposta,
      expectedChallenge: desafio,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha ao verificar a biometria.'
    return NextResponse.json({ erro: mensagem }, { status: 400 })
  }

  if (!verificacao.verified || !verificacao.registrationInfo) {
    return NextResponse.json({ erro: 'Não foi possível confirmar a biometria.' }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verificacao.registrationInfo

  const { error } = await supabase.from('passkey').insert({
    member_id: user.id,
    credential_id: credential.id,
    chave_publica: Buffer.from(credential.publicKey).toString('base64url'),
    contador: credential.counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: credential.transports ?? null,
    apelido: corpo.apelido ?? null,
  })

  const resposta = NextResponse.json({ ok: !error, erro: error?.message })
  resposta.cookies.delete(CHALLENGE_COOKIE)
  return resposta
}
