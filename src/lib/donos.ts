// Helpers de dono (cada pessoa / a casa) usados tanto no servidor quanto no cliente —
// ficam fora de arquivo 'use client' pra poderem ser chamados direto na página.

// Nome da visão "todos juntos" (troque em NEXT_PUBLIC_ROTULO_CASA, ex.: "Família", "Nós").
export const ROTULO_JUNTOS = process.env.NEXT_PUBLIC_ROTULO_CASA?.trim() || 'Casa'
// Dono de item sem pessoa definida.
export const ROTULO_COMPARTILHADO = 'Casa'

type Membro = { id: string; nome: string; apelido: string | null }

export function corDono(memberId: string | null, membros: Membro[]) {
  const i = membros.findIndex((m) => m.id === memberId)
  if (i === 0) return 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
  if (i === 1) return 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
}

export function primeiroNome(nome: string) {
  return nome.split(' ')[0]
}
