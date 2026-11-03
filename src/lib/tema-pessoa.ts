// Cor de cada visão (cada pessoa ou a casa toda): usada na faixa fixa do topo, no seletor de
// pessoa e no item ativo do menu — pra ficar claro, em qualquer tela, de quem são os dados.
// As classes ficam escritas por extenso (o Tailwind só gera classes que aparecem no código).

export type TemaPessoa = {
  chave: 'azul' | 'rosa' | 'ambar' | 'verde' | 'todos'
  faixa: string
  avatar: string
  chipAtivo: string
  chip: string
  botaoAtivo: string
  itemAtivo: string
  subAtivo: string
}

const TEMAS: Record<TemaPessoa['chave'], TemaPessoa> = {
  azul: {
    chave: 'azul',
    faixa: 'bg-gradient-to-r from-sky-800 via-sky-700 to-sky-600 text-white',
    avatar: 'bg-white text-sky-800',
    chipAtivo: 'bg-white text-sky-800 shadow-sm',
    chip: 'text-white/85 hover:bg-white/15',
    botaoAtivo: 'bg-sky-600 text-white shadow-sm',
    itemAtivo: 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-300',
    subAtivo: 'bg-sky-50 font-semibold text-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  },
  rosa: {
    chave: 'rosa',
    faixa: 'bg-gradient-to-r from-rose-800 via-rose-700 to-pink-600 text-white',
    avatar: 'bg-white text-rose-800',
    chipAtivo: 'bg-white text-rose-800 shadow-sm',
    chip: 'text-white/85 hover:bg-white/15',
    botaoAtivo: 'bg-rose-600 text-white shadow-sm',
    itemAtivo: 'bg-rose-100 font-semibold text-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
    subAtivo: 'bg-rose-50 font-semibold text-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  },
  ambar: {
    chave: 'ambar',
    faixa: 'bg-gradient-to-r from-amber-800 via-amber-700 to-amber-600 text-white',
    avatar: 'bg-white text-amber-800',
    chipAtivo: 'bg-white text-amber-800 shadow-sm',
    chip: 'text-white/85 hover:bg-white/15',
    botaoAtivo: 'bg-amber-600 text-white shadow-sm',
    itemAtivo: 'bg-amber-100 font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
    subAtivo: 'bg-amber-50 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  verde: {
    chave: 'verde',
    faixa: 'bg-gradient-to-r from-teal-800 via-teal-700 to-teal-600 text-white',
    avatar: 'bg-white text-teal-800',
    chipAtivo: 'bg-white text-teal-800 shadow-sm',
    chip: 'text-white/85 hover:bg-white/15',
    botaoAtivo: 'bg-teal-600 text-white shadow-sm',
    itemAtivo: 'bg-teal-100 font-semibold text-teal-900 dark:bg-teal-950/60 dark:text-teal-300',
    subAtivo: 'bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-300',
  },
  todos: {
    chave: 'todos',
    faixa: 'bg-gradient-to-r from-militar-900 via-militar-800 to-militar-600 text-white',
    avatar: 'bg-white text-militar-800',
    chipAtivo: 'bg-white text-militar-800 shadow-sm',
    chip: 'text-white/85 hover:bg-white/15',
    botaoAtivo: 'bg-militar-600 text-white shadow-sm',
    itemAtivo: 'bg-militar-100 font-semibold text-militar-900 dark:bg-militar-950/60 dark:text-militar-400',
    subAtivo: 'bg-militar-50 font-semibold text-militar-900 dark:bg-militar-950/40 dark:text-militar-400',
  },
}

const PESSOAS: TemaPessoa['chave'][] = ['azul', 'rosa', 'ambar', 'verde']

/** Tema pela visão escolhida: 'todos' (a casa toda) ou uma cor fixa calculada pelo nome da pessoa. */
export function temaDaVisao(valor: string, rotulo: string | null | undefined): TemaPessoa {
  if (valor === 'todos') return TEMAS.todos
  const n = (rotulo ?? valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  let soma = 0
  for (const ch of n) soma = (soma * 31 + ch.charCodeAt(0)) >>> 0
  return TEMAS[PESSOAS[soma % PESSOAS.length]]
}
