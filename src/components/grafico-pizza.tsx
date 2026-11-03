'use client'

import { useState } from 'react'

type ItemDetalhe = { rotulo: string; valor: number; detalhe?: ItemDetalhe[] }

export type FatiaPizza = {
  rotulo: string
  valor: number
  cor: string
  // Categorias/empresas agrupadas dentro dessa fatia — quando presente, a fatia vira
  // clicável e mostra o detalhamento por baixo. Um item do detalhe pode ter o seu próprio
  // detalhe (ex: dentro de "Outras categorias", a categoria "Assinaturas" abre de novo pra
  // mostrar Netflix/Spotify/Google) — daí o segundo nível de expandir abaixo.
  detalhe?: ItemDetalhe[]
}

export function GraficoPizza({
  dados,
  formatarValor,
  legendaCompleta = false,
  semRolagem = false,
}: {
  dados: FatiaPizza[]
  formatarValor?: (valor: number) => string
  /** rosca em cima e legenda inteira embaixo, sem rolagem e sem cortar nomes (cards estreitos) */
  legendaCompleta?: boolean
  /** legenda ao lado da rosca sem altura máxima; rola só com um detalhe aberto e muito longo */
  semRolagem?: boolean
}) {
  const [expandido, setExpandido] = useState<number | null>(null)
  const [subExpandido, setSubExpandido] = useState<string | null>(null)
  const total = dados.reduce((t, d) => t + d.valor, 0)

  if (total <= 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem gastos categorizados ainda.</p>
  }

  const raio = 60
  const espessura = 26
  const circunferencia = 2 * Math.PI * raio
  let acumulado = 0

  return (
    // Empilhado no mobile (nunca lado a lado, nunca estoura a tela) — só vira lado a lado
    // a partir de sm:. Legenda com altura máxima + scroll interno pra bater com a altura
    // do card de barras ao lado, mesmo com muitas categorias.
    <div className={legendaCompleta ? 'flex flex-col items-center gap-5' : 'flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6'}>
      {/* Total no centro da rosca (fora do SVG, que é girado -90° pra fatia começar no topo) */}
      <div className="relative shrink-0">
      <svg width={legendaCompleta ? 176 : 144} height={legendaCompleta ? 176 : 144} viewBox="0 0 160 160" className="-rotate-90">
        <circle
          cx="80"
          cy="80"
          r={raio}
          fill="none"
          strokeWidth={espessura}
          className="stroke-neutral-100 dark:stroke-neutral-800"
        />
        {dados.map((d, i) => {
          const fracao = d.valor / total
          const comprimento = fracao * circunferencia
          const offset = -acumulado * circunferencia
          acumulado += fracao
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={raio}
              fill="none"
              stroke={d.cor}
              strokeWidth={espessura}
              strokeDasharray={`${comprimento} ${circunferencia - comprimento}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Total</span>
          <span
            className={`font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 ${
              (formatarValor ? formatarValor(total) : String(total)).length > 11 ? 'text-xs' : 'text-sm'
            }`}
          >
            {formatarValor ? formatarValor(total) : total.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
      <ul
        className={`flex w-full min-w-0 flex-col gap-1 text-sm ${
          legendaCompleta
            ? ''
            : semRolagem
              ? `sm:min-w-[180px] ${expandido !== null ? 'max-h-[26rem] overflow-y-auto pr-1' : ''}`
              : 'max-h-44 overflow-y-auto sm:min-w-[180px]'
        }`}
      >
        {dados.map((d, i) => {
          const temDetalhe = !!d.detalhe && d.detalhe.length > 0
          const aberto = expandido === i
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => temDetalhe && setExpandido(aberto ? null : i)}
                disabled={!temDetalhe}
                className={`flex w-full items-center gap-2 rounded py-0.5 text-left ${
                  temDetalhe ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60' : ''
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
                <span title={d.rotulo} className={`min-w-0 flex-1 text-neutral-700 dark:text-neutral-300 ${legendaCompleta ? 'break-words' : 'truncate'}`}>{d.rotulo}</span>
                <span className="shrink-0 whitespace-nowrap text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatarValor ? `${formatarValor(d.valor)} · ` : ''}
                  {Math.round((d.valor / total) * 100)}%
                </span>
                {/* Espaço reservado sempre do mesmo tamanho, com ou sem seta — sem isso, a
                    coluna de % ficava desalinhada entre linha com detalhe e linha sem. */}
                <span className="flex w-3 shrink-0 justify-center">
                  {temDetalhe && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className={`shrink-0 text-neutral-400 transition-transform ${aberto ? 'rotate-90' : ''}`}
                    >
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
              {temDetalhe && aberto && (
                <ul className="ml-4 mt-1 flex flex-col gap-1 border-l border-neutral-200 py-0.5 pl-3 dark:border-neutral-800">
                  {d.detalhe!.map((sub, j) => {
                    const chaveSub = `${i}-${j}`
                    const temSubDetalhe = !!sub.detalhe && sub.detalhe.length > 0
                    const subAberto = subExpandido === chaveSub
                    return (
                      <li key={j}>
                        <button
                          type="button"
                          onClick={() => temSubDetalhe && setSubExpandido(subAberto ? null : chaveSub)}
                          disabled={!temSubDetalhe}
                          className={`flex w-full items-center gap-2 rounded py-0.5 text-left text-xs text-neutral-500 dark:text-neutral-400 ${
                            temSubDetalhe ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60' : ''
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{sub.rotulo}</span>
                          <span className="shrink-0 whitespace-nowrap text-right tabular-nums">
                            {formatarValor ? `${formatarValor(sub.valor)} · ` : ''}
                            {Math.round((sub.valor / total) * 100)}%
                          </span>
                          <span className="flex w-3 shrink-0 justify-center">
                            {temSubDetalhe && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                                className={`shrink-0 text-neutral-400 transition-transform ${subAberto ? 'rotate-90' : ''}`}
                              >
                                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                        </button>
                        {temSubDetalhe && subAberto && (
                          <ul className="ml-4 mt-1 flex flex-col gap-1 border-l border-neutral-200 py-0.5 pl-3 dark:border-neutral-800">
                            {sub.detalhe!.map((subsub, k) => (
                              <li key={k} className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                                <span className="min-w-0 flex-1 truncate">{subsub.rotulo}</span>
                                <span className="shrink-0 whitespace-nowrap text-right tabular-nums">
                                  {formatarValor ? `${formatarValor(subsub.valor)} · ` : ''}
                                  {Math.round((subsub.valor / total) * 100)}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
