'use client'

export default function ErroContasAPagar({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <p className="font-semibold text-red-900 dark:text-red-300">Não consegui salvar</p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  )
}
