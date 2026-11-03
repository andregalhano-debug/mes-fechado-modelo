import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// AwesomeAPI: cotação pública, sem chave, mantida por um provedor brasileiro.
const MOEDAS = ['USD', 'EUR']

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const par = MOEDAS.map((m) => `${m}-BRL`).join(',')
  const resposta = await fetch(`https://economia.awesomeapi.com.br/last/${par}`, {
    cache: 'no-store',
  })
  if (!resposta.ok) {
    return NextResponse.json({ erro: 'Não consegui buscar a cotação.' }, { status: 502 })
  }

  const dados = (await resposta.json()) as Record<string, { code: string; bid: string }>
  const hoje = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()

  const linhas = MOEDAS.map((moeda) => {
    const chave = `${moeda}BRL`
    const taxa = Number(dados[chave]?.bid)
    return Number.isFinite(taxa) ? { data: hoje, moeda, taxa_brl: taxa } : null
  }).filter((l): l is { data: string; moeda: string; taxa_brl: number } => l !== null)

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Resposta da API sem cotações válidas.' }, { status: 502 })
  }

  const { error } = await admin.from('fx_rate').upsert(linhas, { onConflict: 'data,moeda' })
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, atualizado: linhas })
}
