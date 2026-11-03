import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rpInfo, CHALLENGE_COOKIE } from '@/lib/webauthn'

export async function POST(request: Request) {
  const desafio = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${CHALLENGE_COOKIE}=`))
    ?.split('=')[1]

  if (!desafio) {
    return NextResponse.json(
      { erro: 'O código de verificação expirou. Toque em entrar de novo.' },
      { status: 400 },
    )
  }

  const resposta = (await request.json()) as AuthenticationResponseJSON
  const admin = createAdminClient()

  const { data: credencial } = await admin
    .from('passkey')
    .select('member_id, credential_id, chave_publica, contador, transports')
    .eq('credential_id', resposta.id)
    .single()

  if (!credencial) {
    return NextResponse.json({ erro: 'Biometria não reconhecida neste app.' }, { status: 401 })
  }

  const { rpID, origin } = rpInfo(request)

  let verificacao
  try {
    verificacao = await verifyAuthenticationResponse({
      response: resposta,
      expectedChallenge: desafio,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credencial.credential_id,
        publicKey: Buffer.from(credencial.chave_publica, 'base64url'),
        counter: Number(credencial.contador),
        transports: (credencial.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      },
    })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha ao verificar a biometria.'
    return NextResponse.json({ erro: mensagem }, { status: 400 })
  }

  if (!verificacao.verified) {
    return NextResponse.json({ erro: 'Biometria não confirmada.' }, { status: 401 })
  }

  await admin
    .from('passkey')
    .update({ contador: verificacao.authenticationInfo.newCounter, ultimo_uso: new Date().toISOString() })
    .eq('credential_id', credencial.credential_id)

  const { data: usuarioAuth, error: erroBusca } = await admin.auth.admin.getUserById(
    credencial.member_id,
  )
  if (erroBusca || !usuarioAuth.user?.email) {
    return NextResponse.json({ erro: 'Não localizei a conta associada a essa biometria.' }, { status: 500 })
  }

  // Troca a verificação de biometria por uma sessão real do Supabase,
  // sem pedir senha: gera um magic link e resolve ele no servidor.
  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: usuarioAuth.user.email,
  })
  if (erroLink || !link.properties?.hashed_token) {
    return NextResponse.json({ erro: 'Não consegui abrir a sessão.' }, { status: 500 })
  }

  const supabase = await createClient()
  const { error: erroSessao } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })

  if (erroSessao) {
    return NextResponse.json({ erro: erroSessao.message }, { status: 500 })
  }

  const saida = NextResponse.json({ ok: true })
  saida.cookies.delete(CHALLENGE_COOKIE)
  return saida
}
