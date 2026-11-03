import { NextResponse } from 'next/server'
import { buscarFaturasPorEmail, emailConfigurado } from '@/lib/faturas-email'

// Disparado pela Vercel 1x por dia (vercel.json). Só roda com o CRON_SECRET da Vercel.
export const maxDuration = 300

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }
  if (!emailConfigurado()) return NextResponse.json({ ok: true, aviso: 'Gmail de faturas não configurado.' })
  try {
    const resumo = await buscarFaturasPorEmail()
    return NextResponse.json({ ok: true, ...resumo })
  } catch (e) {
    console.error('cron/faturas-email', e)
    return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : 'Falha' }, { status: 500 })
  }
}
