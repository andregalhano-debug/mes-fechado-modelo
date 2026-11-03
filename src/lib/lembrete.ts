import type { SupabaseClient } from '@supabase/supabase-js'

// "Só lembrete": conta marcada pela família como lembrete de renovação (ex.: seguro do carro,
// Claude, AdaptaOrg cobrados no cartão — o dinheiro já sai pela fatura, que também é conta).
// Aparece nas listas e nas renovações, mas não soma nos totais. A marcação é explícita por conta
// (coluna bill.so_lembrete): ter cartão ou ser anual NÃO basta — um seguro de vida, por exemplo, pode ter
// cartão mas não aparece em fatura nenhuma, então precisa somar.
export const ehLembrete = (b: { so_lembrete?: boolean | null }) => b.so_lembrete === true

/** Ids das contas "só lembrete". Tolerante: se a coluna ainda não existir, volta vazio (nada é lembrete). */
export async function idsLembrete(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('bill').select('id').eq('so_lembrete', true)
  return error ? new Set() : new Set((data ?? []).map((b) => b.id as string))
}
