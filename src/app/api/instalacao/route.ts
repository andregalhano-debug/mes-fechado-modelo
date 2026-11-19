import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Público, sem login: diz só se o banco está instalado e se o sistema já tem dono (sim/não).
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('situacao_instalacao')
  const corpo = error
    ? { banco: false, tem_dono: false }
    : { banco: true, tem_dono: !!(data as { tem_dono?: boolean } | null)?.tem_dono }
  return NextResponse.json(corpo, { headers: { 'Cache-Control': 'no-store' } })
}
