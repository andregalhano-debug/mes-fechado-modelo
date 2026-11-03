'use client'

import { useState } from 'react'
import { atualizarCategoriaConta } from '@/app/contas-a-pagar/actions'

type Categoria = { id: string; nome: string }

export function CategoriaContaInline({
  id,
  categoriaId,
  categoriaNome,
  categorias,
}: {
  id: string
  categoriaId: string | null
  categoriaNome: string | null
  categorias: Categoria[]
}) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <form
        action={atualizarCategoriaConta}
        onChange={(e) => e.currentTarget.requestSubmit()}
        className="inline-flex"
      >
        <input type="hidden" name="id" value={id} />
        <select
          name="category_id"
          defaultValue={categoriaId ?? ''}
          autoFocus
          onBlur={() => setEditando(false)}
          className="rounded border border-militar-400 bg-white px-1.5 py-0.5 text-xs text-neutral-700 outline-none dark:border-militar-600 dark:bg-neutral-950 dark:text-neutral-300"
        >
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title="Clique pra mudar a categoria"
      className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
    >
      {categoriaNome ?? 'Sem categoria'}
    </button>
  )
}
