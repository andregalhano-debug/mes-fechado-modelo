export type Cartao = {
  id: string
  nome: string
  bandeira: string | null
  final: string | null
  banco?: string | null
  tipo: 'fisico' | 'virtual' | 'debito' | 'pix'
  titular_id: string | null
  ativo: boolean
  observacao: string | null
}

export const ROTULO_TIPO_CARTAO: Record<string, string> = { fisico: 'físico', virtual: 'virtual', debito: 'débito em conta', pix: 'PIX' }

// "Nubank · virtual ••1234" — como o cartão aparece em listas e seletores.
export function rotuloCartao(c: Pick<Cartao, 'nome' | 'tipo' | 'final'>): string {
  if (c.tipo === 'pix') return c.nome.toUpperCase() === 'PIX' ? 'PIX' : `${c.nome} · PIX`
  return `${c.nome} · ${ROTULO_TIPO_CARTAO[c.tipo] ?? 'físico'}${c.final ? ` ••${c.final}` : ''}`
}
