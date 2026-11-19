import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { codigoDeProgresso } from '@/lib/instalacao/progresso'
import { MARCA } from '@/lib/marca'
import { NOME_PADRAO } from '@/lib/meu-sistema'

// Marcos da trilha em sim/não, para a Lia conferir sem print. Nenhum valor, nome ou e-mail sai daqui.
// Precisa do código da casa (Configurações → Progresso na trilha): /api/progresso?c=CODIGO
export async function GET(req: NextRequest) {
  const codigo = codigoDeProgresso()
  const recebido = req.nextUrl.searchParams.get('c') ?? ''
  const igual =
    !!codigo && recebido.length === codigo.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(codigo))
  if (!igual) return NextResponse.json({ erro: 'Código inválido.' }, { status: 401 })

  const { data, error } = await createAdminClient().rpc('progresso_da_casa')
  const banco = error ? { banco_instalado: false } : (data as Record<string, unknown>)
  return NextResponse.json(
    {
      sistema: 'mes-fechado-modelo',
      ...banco,
      sistema_personalizado: MARCA.nome !== NOME_PADRAO,
      chave_ia: !!process.env.ANTHROPIC_API_KEY,
      alertas_email_configurado: !!process.env.RESEND_API_KEY,
      faturas_email_configurado: !!(process.env.FATURAS_GMAIL_USUARIO && process.env.FATURAS_GMAIL_SENHA_APP),
      rotinas_protegidas: !!process.env.CRON_SECRET,
    },
    { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } },
  )
}
