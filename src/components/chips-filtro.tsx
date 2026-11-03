import Link from 'next/link'

type Opcao = { rotulo: string; href: string; ativo: boolean; nota?: string }

// Linha de filtros (chips): cada opção é um link; a ativa fica destacada e a contagem vem num selo.
// Mesmo visual dos filtros de Contas a pagar.
export function ChipsFiltro({ titulo, opcoes }: { titulo: string; opcoes: Opcao[] }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-20 shrink-0 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{titulo}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {opcoes.map((o) => (
          <Link
            key={o.rotulo}
            href={o.href}
            scroll={false}
            aria-current={o.ativo ? 'true' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${o.ativo ? 'border-militar-600 bg-militar-600 text-white shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
          >
            {o.rotulo}
            {o.nota && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${o.ativo ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{o.nota}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
