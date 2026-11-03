'use client'

import { useState } from 'react'
import { atualizarConta } from '@/app/contas-a-pagar/actions'
import { CampoMoeda } from './campo-moeda'
import { BotaoEnviar } from './botao-enviar'
import { rotuloCartao, type Cartao } from '@/lib/cartao'
import { ROTULO_COMPARTILHADO } from '@/lib/donos'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

// Valor de uma conta em aberto, clicável: abre a edição de descrição, valor e vencimento
// direto na lista — pra ajustar o mês já replicado (ex: luz, cartão) antes de marcar paga.
export function EditarContaInline({
  id,
  descricao,
  valor,
  vencimento,
  repeticao,
  cartaoId,
  cartoes,
  responsavelId,
  membros,
  soLembrete,
}: {
  id: string
  descricao: string
  valor: number
  vencimento: string
  repeticao: 'nao' | 'mensal' | 'anual'
  cartaoId: string | null
  cartoes: Cartao[]
  responsavelId: string | null
  membros: { id: string; nome: string }[]
  soLembrete?: boolean
}) {
  const [editando, setEditando] = useState(false)

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Clique pra editar valor, vencimento, descrição ou repetição"
        className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-semibold tabular-nums text-neutral-900 transition hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        {brl.format(valor)}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-3.5 w-3.5 fill-none stroke-neutral-400 stroke-2 group-hover:stroke-militar-600"
        >
          <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Editar</span>
      </button>
    )
  }

  return (
    <form
      action={async (formData) => {
        await atualizarConta(formData)
        setEditando(false)
      }}
      className="edicao-conta flex w-full basis-full flex-wrap items-end gap-2 rounded-xl border border-militar-300 bg-militar-50/50 p-3 dark:border-militar-700 dark:bg-militar-950/30"
    >
      <input type="hidden" name="id" value={id} />
      <label className="flex min-w-[160px] flex-1 flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Descrição</span>
        <input name="descricao" defaultValue={descricao} required className={campo} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Valor</span>
        <CampoMoeda
          name="valor"
          defaultValue={valor}
          required
          autoFocus
          className={`${campo} w-32 text-right tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Vencimento</span>
        <input type="date" name="vencimento" defaultValue={vencimento} required className={campo} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Repete</span>
        <select name="repeticao" defaultValue={repeticao} className={campo}>
          <option value="nao">Não repete</option>
          <option value="mensal">Todo mês</option>
          <option value="anual">Todo ano</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">De quem</span>
        <select name="responsavel_id" defaultValue={responsavelId ?? ''} className={campo}>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome.split(' ')[0]}
            </option>
          ))}
          <option value="">{ROTULO_COMPARTILHADO} (compartilhada)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Cartão</span>
        <select name="cartao_id" defaultValue={cartaoId ?? ''} className={campo}>
          <option value="">Não é cartão / não sei</option>
          {cartoes
            .filter((c) => c.ativo || c.id === cartaoId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {rotuloCartao(c)}
                {c.ativo ? '' : ' (cancelado)'}
              </option>
            ))}
        </select>
      </label>
      <label
        title="Para renovação cobrada no cartão: o valor já entra pela fatura. A conta aparece na lista e nas renovações, mas não soma nos totais."
        className="flex items-center gap-2 self-center text-xs text-neutral-600 dark:text-neutral-300"
      >
        <input type="hidden" name="so_lembrete_campo" value="1" />
        <input type="checkbox" name="so_lembrete" defaultChecked={!!soLembrete} />
        Só lembrete (cobrado no cartão, não soma)
      </label>
      <div className="flex gap-2">
        <BotaoEnviar
          enviando="Salvando…"
          className="rounded-lg bg-militar-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-militar-500"
        >
          Salvar
        </BotaoEnviar>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
