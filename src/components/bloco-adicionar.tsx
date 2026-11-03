import type { ReactNode } from 'react'

// Padrão do app para formulários de cadastro (novo lançamento, nova conta, nova meta...): bloco
// destacado (tracejado verde, mesmo visual do "Enviar fatura ou saldo"), recolhido até ser tocado.
export function BlocoAdicionar({
  titulo,
  descricao,
  abertoInicial = false,
  compacto = false,
  children,
}: {
  titulo: string
  descricao?: string
  /** já abre expandido (ex: nada cadastrado ainda) */
  abertoInicial?: boolean
  /** versão menor, para usar dentro de um quadro (ex: seções do Patrimônio) */
  compacto?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={abertoInicial || undefined}
      className={`group rounded-2xl border border-dashed border-militar-400 bg-militar-50 transition hover:border-militar-500 dark:border-militar-700 dark:bg-militar-950/30 ${compacto ? 'rounded-xl' : ''}`}
    >
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 ${compacto ? 'px-4 py-2.5' : 'px-5 py-4'}`}>
        <span className="min-w-0">
          <span className={`block font-semibold text-militar-900 dark:text-militar-200 ${compacto ? 'text-sm' : ''}`}>{titulo}</span>
          {descricao && !compacto && <span className="mt-0.5 block text-sm text-militar-800 dark:text-militar-300">{descricao}</span>}
        </span>
        <span className="shrink-0 text-militar-700 transition group-open:rotate-90 dark:text-militar-400" aria-hidden="true">
          →
        </span>
      </summary>
      <div className={`border-t border-militar-200 bg-white dark:border-militar-900 dark:bg-neutral-900 ${compacto ? 'rounded-b-xl px-4 pb-4 pt-3' : 'rounded-b-2xl px-5 pb-5 pt-4'}`}>
        {children}
      </div>
    </details>
  )
}
