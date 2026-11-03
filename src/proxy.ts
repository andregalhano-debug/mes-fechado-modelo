import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { INICIO } from '@/lib/marca'

// Robôs de busca, de IA, ferramentas de raspagem e prévias de link: o app é privado, ninguém
// automatizado deve ler nada (mesmo a tela de login). Navegador comum passa normalmente.
const BOTS =
  /bot\b|bot\/|crawl|spider|slurp|scrap|headless|phantom|puppeteer|playwright|selenium|lighthouse|gptbot|chatgpt|oai-search|claude|anthropic|ccbot|perplexity|bytespider|amazonbot|applebot|google-extended|googleother|diffbot|cohere|meta-externalagent|facebookexternalhit|facebookbot|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baidu|duckduck|bingbot|googlebot|python|curl\/|wget|scrapy|httpclient|go-http-client|node-fetch|axios|okhttp|java\/|libwww|httpie/i

// Next 16: este arquivo se chamava `middleware`. Renomeado para `proxy`.
// Renova a sessão do Supabase e protege as rotas do painel.
export async function proxy(request: NextRequest) {
  const { pathname: caminho } = request.nextUrl
  // Rotas de serviço (rotinas da Vercel) se protegem por segredo próprio (CRON_SECRET).
  const rotaDeServico = caminho.startsWith('/api/cron') || caminho.startsWith('/api/cambio')
  const ua = request.headers.get('user-agent') ?? ''
  if (!rotaDeServico && caminho !== '/robots.txt' && (!ua.trim() || BOTS.test(ua))) {
    return new NextResponse('Acesso restrito.', {
      status: 403,
      headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex', 'Cache-Control': 'no-store' },
    })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const paginaVerificarMfa = pathname === '/entrar/verificar-mfa'
  const rotaPublica =
    (pathname.startsWith('/entrar') && !paginaVerificarMfa) ||
    pathname.startsWith('/auth') ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/api/passkey/login') ||
    // Chamadas sem sessão de usuário: rotinas da Vercel, protegidas por CRON_SECRET.
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cambio')

  if (!user) {
    if (rotaPublica) return response
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    return NextResponse.redirect(url)
  }

  // 2FA (TOTP): sessão existe mas ainda não alcançou o segundo fator exigido.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const precisaSegundoFator = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel

  if (precisaSegundoFator && !paginaVerificarMfa) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar/verificar-mfa'
    return NextResponse.redirect(url)
  }

  if (!precisaSegundoFator && (pathname === '/entrar' || paginaVerificarMfa)) {
    const url = request.nextUrl.clone()
    url.pathname = INICIO
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
