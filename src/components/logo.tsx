import { MARCA } from '@/lib/marca'

// Marca do sistema: um selo com a inicial do nome + o nome (definido em src/lib/marca.ts).
export function Simbolo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" className="fill-militar-700" />
      <text x="32" y="43" textAnchor="middle" fontSize="34" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {MARCA.inicial}
      </text>
      <circle cx="50" cy="14" r="4" className="fill-militar-300" />
    </svg>
  )
}

export function Logo({ compacto = false, className = '' }: { compacto?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Simbolo className={compacto ? 'h-8 w-8' : 'h-9 w-9'} />
      {!compacto && (
        <span className="leading-none">
          <span className="block text-[17px] font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">{MARCA.nome}</span>
          <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-[0.34em] text-militar-700 dark:text-militar-400">{MARCA.assinatura}</span>
        </span>
      )}
    </span>
  )
}
