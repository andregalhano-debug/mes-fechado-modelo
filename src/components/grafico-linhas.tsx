'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SerieLinha = {
  id: string
  rotulo: string
  /** cor CSS, ex: var(--serie-1) — segue a entidade, nunca a posição */
  cor: string
  /** um valor por mês de `meses`; null = sem dado no mês */
  valores: (number | null)[]
  /** linha tracejada (ex: mês em andamento / meta) */
  tracejada?: boolean
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCurto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(v)}`
}
const mesCurto = (m: string) => {
  const [a, mm] = m.split('-').map(Number)
  return new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}
const mesLongo = (m: string) => {
  const [a, mm] = m.split('-').map(Number)
  return new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function escalaBonita(min: number, max: number) {
  const span = Math.max(max - min, Math.abs(max) * 0.02, 1)
  const bruto = span / 4
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot
  return { base: Math.floor(min / passo) * passo, topo: Math.ceil(max / passo) * passo, passo }
}

// Gráfico de linhas reutilizável (Patrimônio, Visão geral). Um único eixo em R$.
// - `visiveis` + `alternar` vindos de fora (ex: blocos clicáveis) ou chips próprios (`chips`).
// - crosshair com tooltip listando todas as séries visíveis no mês; rótulo no fim de cada linha.
// - `ocultar` esconde valores (modo "ocultar valores" da Visão geral).
export function GraficoLinhas({
  meses,
  series,
  visiveis: visiveisExternos,
  chips = false,
  ocultar = false,
  comecarDoZero = true,
  altura = 260,
  separarAnos = false,
}: {
  meses: string[]
  series: SerieLinha[]
  visiveis?: string[]
  chips?: boolean
  ocultar?: boolean
  comecarDoZero?: boolean
  altura?: number
  /** faixas alternadas e o ano escrito em cada trecho (séries longas, de vários anos) */
  separarAnos?: boolean
}) {
  const [visiveisInternos, setVisiveisInternos] = useState<string[]>(() => series.map((s) => s.id))
  const visiveis = visiveisExternos ?? visiveisInternos
  const [hover, setHover] = useState<number | null>(null)
  const caixaRef = useRef<HTMLDivElement>(null)
  // Começa pequeno e mede o quadro: começar largo (720) fazia o quadro crescer junto e nunca encolher no celular.
  const [largura, setLargura] = useState(320)

  useEffect(() => {
    const el = caixaRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (w > 0) setLargura(Math.max(220, w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const mostradas = series.filter((s) => visiveis.includes(s.id))
  const estreito = largura < 520
  const margem = { topo: separarAnos ? 30 : 16, dir: estreito ? 12 : 120, base: 28, esq: 64 }
  const w = largura - margem.esq - margem.dir
  const h = altura - margem.topo - margem.base
  const todos = mostradas.flatMap((s) => s.valores.filter((v): v is number => v !== null))
  const minimo = comecarDoZero ? Math.min(0, ...todos) : Math.min(...todos)
  const { base, topo, passo } = escalaBonita(todos.length ? minimo : 0, todos.length ? Math.max(...todos) : 1)
  const x = (i: number) => margem.esq + (meses.length <= 1 ? w / 2 : (i / (meses.length - 1)) * w)
  const y = (v: number) => margem.topo + h - ((v - base) / (topo - base || 1)) * h
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let v = base; v <= topo + passo / 1000; v += passo) out.push(v)
    return out
  }, [base, topo, passo])

  const rotulosFinais = estreito
    ? []
    : mostradas
        .map((s) => {
          const i = s.valores.map((v, k) => (v === null ? -1 : k)).filter((k) => k >= 0).pop()
          return i === undefined ? null : { id: s.id, rotulo: s.rotulo, yy: y(s.valores[i]!), xx: x(i) }
        })
        .filter((r): r is { id: string; rotulo: string; yy: number; xx: number } => !!r)
        .sort((a, b) => a.yy - b.yy)
  for (let k = 1; k < rotulosFinais.length; k++)
    if (rotulosFinais[k].yy - rotulosFinais[k - 1].yy < 14) rotulosFinais[k].yy = rotulosFinais[k - 1].yy + 14

  function aoMover(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * w
    const i = meses.length <= 1 ? 0 : Math.round((px / w) * (meses.length - 1))
    setHover(Math.max(0, Math.min(meses.length - 1, i)))
  }

  function alternarInterno(id: string) {
    setVisiveisInternos((v) => (v.includes(id) ? (v.length > 1 ? v.filter((x) => x !== id) : v) : [...v, id]))
  }

  return (
    <div>
      {chips && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Séries do gráfico">
          {series.map((s) => {
            const ativo = visiveis.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => alternarInterno(s.id)}
                aria-pressed={ativo}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  ativo
                    ? 'border-neutral-300 bg-white text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100'
                    : 'border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-500'
                }`}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ativo ? s.cor : 'transparent', border: `2px solid ${s.cor}` }} />
                {s.rotulo}
              </button>
            )
          })}
        </div>
      )}

      {meses.length < 2 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">O gráfico aparece a partir do segundo mês com valores.</p>
      ) : (
        <div ref={caixaRef} className="relative w-full min-w-0 overflow-hidden">
          <svg width={largura} height={altura} className="block max-w-full" role="img" aria-label={`Evolução de ${mostradas.map((s) => s.rotulo).join(', ')} por mês`}>
            {separarAnos &&
              (() => {
                // trechos de cada ano: da metade entre dez e jan até a próxima virada
                const trechos: { ano: string; de: number; ate: number }[] = []
                meses.forEach((m, i) => {
                  const ano = m.slice(0, 4)
                  const ult = trechos[trechos.length - 1]
                  const borda = i === 0 ? margem.esq : (x(i - 1) + x(i)) / 2
                  if (!ult || ult.ano !== ano) {
                    if (ult) ult.ate = borda
                    trechos.push({ ano, de: borda, ate: margem.esq + w })
                  }
                })
                return trechos.map((t, k) => (
                  <g key={t.ano}>
                    {k % 2 === 1 && <rect x={t.de} y={margem.topo} width={Math.max(0, t.ate - t.de)} height={h} className="fill-neutral-100 dark:fill-neutral-800/40" />}
                    {k > 0 && <line x1={t.de} x2={t.de} y1={margem.topo - 18} y2={margem.topo + h} className="stroke-neutral-300 dark:stroke-neutral-600" strokeDasharray="3 3" />}
                    {t.ate - t.de > 26 && (
                      <text x={(t.de + t.ate) / 2} y={margem.topo - 10} textAnchor="middle" className="fill-neutral-600 text-[11px] font-semibold dark:fill-neutral-300">
                        {t.ano}
                      </text>
                    )}
                  </g>
                ))
              })()}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margem.esq} x2={margem.esq + w} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-neutral-300 dark:stroke-neutral-700' : 'stroke-neutral-200 dark:stroke-neutral-800'} strokeWidth={1} />
                <text x={margem.esq - 8} y={y(t) + 4} textAnchor="end" className="fill-neutral-500 text-[11px] dark:fill-neutral-400">
                  {ocultar ? '•••' : brlCurto(t)}
                </text>
              </g>
            ))}
            {meses.map((m, i) =>
              estreito && meses.length > 6 && i % 2 === 1 ? null : (
                <text key={m} x={x(i)} y={altura - 8} textAnchor="middle" className="fill-neutral-500 text-[11px] dark:fill-neutral-400">
                  {mesCurto(m)}
                </text>
              ),
            )}
            {mostradas.map((s) => {
              const pts = s.valores.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean)
              return (
                <g key={s.id}>
                  <polyline
                    points={pts.join(' ')}
                    fill="none"
                    stroke={s.cor}
                    strokeWidth={2}
                    strokeDasharray={s.tracejada ? '5 4' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {s.valores.map((v, i) =>
                    v === null ? null : (
                      <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill={s.cor} className="stroke-white dark:stroke-neutral-900" strokeWidth={2} />
                    ),
                  )}
                </g>
              )
            })}
            {rotulosFinais.map((r) => (
              <text key={r.id} x={r.xx + 10} y={r.yy + 4} className="fill-neutral-700 text-[11px] font-medium dark:fill-neutral-300">
                {r.rotulo}
              </text>
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={margem.topo} y2={margem.topo + h} className="stroke-neutral-400 dark:stroke-neutral-500" strokeWidth={1} />
            )}
            <rect
              x={margem.esq}
              y={margem.topo}
              width={w}
              height={h}
              fill="transparent"
              onPointerMove={aoMover}
              onPointerDown={aoMover}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-[190px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
              style={x(hover) > largura / 2 ? { right: largura - x(hover) + 12 } : { left: x(hover) + 12 }}
            >
              <p className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">{mesLongo(meses[hover])}</p>
              {mostradas.map((s) => (
                <p key={s.id} className="flex items-center justify-between gap-4 text-neutral-600 dark:text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.cor }} />
                    {s.rotulo}
                  </span>
                  <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.valores[hover] === null ? '—' : ocultar ? '•••' : brl.format(s.valores[hover]!)}
                  </strong>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
