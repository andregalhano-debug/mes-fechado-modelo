'use client'

import { useEffect, useState } from 'react'

export function LinkProgresso({ codigo }: { codigo: string }) {
  const [url, setUrl] = useState('')
  const [copiado, setCopiado] = useState(false)
  useEffect(() => setUrl(`${window.location.origin}/api/progresso?c=${codigo}`), [codigo])

  if (!codigo) return <p className="text-sm text-neutral-500">Disponível quando o banco estiver ligado.</p>
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
        {url}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopiado(true)
          } catch {}
        }}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
      >
        {copiado ? 'Copiado ✓' : 'Copiar link'}
      </button>
    </div>
  )
}
