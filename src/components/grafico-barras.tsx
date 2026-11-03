export type Barra = { rotulo: string; valor: number }

export function GraficoBarras({
  dados,
  formatarValor,
  ocultarValores = false,
  preencher = false,
}: {
  dados: Barra[]
  formatarValor: (valor: number) => string
  ocultarValores?: boolean
  /** ocupa toda a altura disponível (pra ficar simétrico com o quadro ao lado) */
  preencher?: boolean
}) {
  const max = Math.max(...dados.map((d) => d.valor), 1)
  const semDados = dados.every((d) => d.valor === 0)

  if (semDados) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem despesas nesse período ainda.</p>
  }

  return (
    // Barras laterais: cada item cresce pra baixo (mais uma linha), nunca pro lado — não
    // tem como estourar a largura da tela, mesmo com rótulos longos ou muitos itens.
    <div className={preencher ? 'flex h-full min-h-[11rem] flex-col justify-around gap-2.5' : 'flex max-h-64 flex-col gap-2.5 overflow-y-auto'}>
      {dados.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs capitalize text-neutral-500 dark:text-neutral-400 sm:w-28">
            {d.rotulo}
          </span>
          <div className={`${preencher ? 'h-4' : 'h-3'} min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800`}>
            <div
              className="h-full rounded-full bg-militar-500 dark:bg-militar-600"
              style={{ width: d.valor > 0 ? `${Math.max((d.valor / max) * 100, 3)}%` : '0%' }}
            />
          </div>
          <span className="w-20 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {ocultarValores ? '•••' : formatarValor(d.valor)}
          </span>
        </div>
      ))}
    </div>
  )
}
