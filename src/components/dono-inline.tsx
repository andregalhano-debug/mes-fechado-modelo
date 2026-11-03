'use client'

import { useState, useTransition } from 'react'
import { definirDono } from '@/app/patrimonio/actions'
import { corDono, primeiroNome } from '@/lib/donos'
import { ROTULO_COMPARTILHADO } from '@/lib/donos'

type Membro = { id: string; nome: string; apelido: string | null }

// Selo de dono (uma pessoa ou a casa) de um item do patrimônio; clique pra trocar.
// Não usa <form> próprio porque fica dentro do formulário de saldo da linha — chama a
// ação direto. A troca vale pra linhagem inteira (todos os meses daquele item).
export function DonoInline({
  tabela,
  id,
  memberId,
  membros,
}: {
  tabela: 'account' | 'investment_position' | 'retained_resource'
  id: string
  memberId: string | null
  membros: Membro[]
}) {
  const [editando, setEditando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const atual = membros.find((m) => m.id === memberId)

  if (editando) {
    return (
      <select
        defaultValue={memberId ?? ''}
        autoFocus
        disabled={pendente}
        aria-label="Dono do item"
        onBlur={() => !pendente && setEditando(false)}
        onChange={(e) => {
          const fd = new FormData()
          fd.set('tabela', tabela)
          fd.set('id', id)
          fd.set('member_id', e.target.value)
          iniciar(async () => {
            await definirDono(fd)
            setEditando(false)
          })
        }}
        className="rounded border border-militar-400 bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 outline-none dark:border-militar-600 dark:bg-neutral-950 dark:text-neutral-300"
      >
        {membros.map((m) => (
          <option key={m.id} value={m.id}>
            {primeiroNome(m.nome)}
          </option>
        ))}
        <option value="">{ROTULO_COMPARTILHADO} (conjunto)</option>
      </select>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title="De quem é este item? Clique pra trocar"
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-80 ${corDono(memberId, membros)}`}
    >
      {atual ? primeiroNome(atual.nome) : ROTULO_COMPARTILHADO}
    </button>
  )
}
