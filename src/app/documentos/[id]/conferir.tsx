'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConferenciaCategorias, type ItemConferencia } from '@/components/conferencia-categorias'
import { atualizarCategoriaLancamento } from '@/app/contas-a-pagar/actions'

// Conferência de uma fatura já lançada: cada troca de categoria grava na hora no lançamento.
export function ConferirDocumento({
  itens: iniciais,
  categorias,
}: {
  itens: ItemConferencia[]
  categorias: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [itens, setItens] = useState(iniciais)
  const [salvando, setSalvando] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const idPorNome = new Map(categorias.map((c) => [c.nome, c.id]))

  async function mudar(chave: string, categoria: string | null) {
    const anterior = itens.find((i) => i.chave === chave)?.categoria ?? null
    setErro(null)
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, categoria } : i)))
    setSalvando((s) => new Set(s).add(chave))
    try {
      const dados = new FormData()
      dados.set('id', chave)
      dados.set('category_id', categoria ? (idPorNome.get(categoria) ?? '') : '')
      await atualizarCategoriaLancamento(dados)
      router.refresh()
    } catch {
      setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, categoria: anterior } : i)))
      setErro('Não consegui salvar a categoria. Tente de novo.')
    } finally {
      setSalvando((s) => {
        const n = new Set(s)
        n.delete(chave)
        return n
      })
    }
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      <ConferenciaCategorias itens={itens} categorias={categorias.map((c) => c.nome)} onMudarCategoria={mudar} salvando={salvando} />
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">Cada mudança de categoria é salva na hora.</p>
    </>
  )
}
