'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moverContaDeMes } from '@/app/contas-a-pagar/actions'

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const somar = (ym: string, n: number) => {
  const [a, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const rotulo = (ym: string) => `${NOMES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`

// "Mover de mês": leva a conta para outro mês sem redigitar. O atalho principal é o mês
// seguinte; o menu traz os meses ao redor e um campo para qualquer outro.
export function MoverContaMes({ id, vencimento, discreto }: { id: string; vencimento: string; discreto?: boolean }) {
  const router = useRouter()
  const atual = vencimento.slice(0, 7)
  const proximo = somar(atual, 1)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent | TouchEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('touchstart', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('touchstart', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  function mover(mes: string) {
    if (!mes || mes === atual) return setAberto(false)
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const f = new FormData()
      f.set('id', id)
      f.set('mes', mes)
      const r = await moverContaDeMes(f)
      if (r.erro) return setErro(r.erro)
      setAviso(r.aviso ?? null)
      setAberto(false)
      router.refresh()
    })
  }

  const opcoes = [-1, 2, 3, 4, 5, 6].map((n) => somar(atual, n))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={pendente}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Mover esta conta para outro mês"
        className={
          discreto
            ? 'text-[11px] text-neutral-400 hover:text-neutral-700 disabled:opacity-60 dark:hover:text-neutral-200'
            : 'rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
        }
      >
        {pendente ? 'Movendo…' : discreto ? 'mover de mês' : '📅 Mover'}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            role="menuitem"
            onClick={() => mover(proximo)}
            className="flex w-full items-center justify-between rounded-lg bg-militar-600 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-militar-500"
          >
            Próximo mês <span className="font-normal opacity-90">{rotulo(proximo)}</span>
          </button>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {opcoes.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitem"
                onClick={() => mover(m)}
                className="rounded-lg px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {rotulo(m)}
              </button>
            ))}
          </div>
          <label className="mt-1.5 flex items-center gap-2 border-t border-neutral-100 px-1 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800">
            Outro:
            <input
              type="month"
              defaultValue={proximo}
              onChange={(e) => e.target.value && mover(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <p className="px-1 pt-1.5 text-[10px] text-neutral-400">Mantém o dia do vencimento ({vencimento.slice(8, 10)}).</p>
          {erro && <p className="px-1 pt-1 text-xs text-red-600">{erro}</p>}
        </div>
      )}
      {!aberto && aviso && <p className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md bg-white/95 p-1 text-right text-[11px] text-militar-700 shadow dark:bg-neutral-900 dark:text-militar-400">{aviso}</p>}
      {!aberto && erro && <p className="absolute right-0 top-full mt-1 w-48 text-right text-[11px] text-red-600">{erro}</p>}
    </div>
  )
}
