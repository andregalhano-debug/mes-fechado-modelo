import { createClient } from '@/lib/supabase/server'
import { criarContexto } from '@/lib/assistente/dados'
import { gerarFatos } from '@/lib/assistente/fatos'
import { ROTULO_JUNTOS } from '@/lib/donos'

// Insights objetivos calculados por código (sem IA, sem custo). O card da Visão geral busca
// daqui depois de carregar, pra não atrasar a página.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado.' }, { status: 401 })

  const ctx = await criarContexto(supabase)
  const fatos = await gerarFatos(ctx)
  return Response.json(
    { visao: ctx.visao.nomePessoa ?? ROTULO_JUNTOS, pessoa: ctx.visao.pessoa, fatos },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
