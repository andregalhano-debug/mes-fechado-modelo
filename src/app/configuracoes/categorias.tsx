import { BlocoAdicionar } from '@/components/bloco-adicionar'
import { criarCategoria, removerCategoria } from './actions'
import { FormularioQueLimpa } from '@/components/formulario-que-limpa'
import { FormularioComConfirmacao } from '@/components/formulario-com-confirmacao'

type Categoria = { id: string; nome: string; natureza: 'despesa' | 'receita' }

const campo =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-militar-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
const botao =
  'rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-militar-600 dark:hover:bg-militar-500'

export function Categorias({ categorias }: { categorias: Categoria[] }) {
  const despesas = categorias.filter((c) => c.natureza === 'despesa')
  const receitas = categorias.filter((c) => c.natureza === 'receita')

  const escondidas = Math.max(0, despesas.length - VISIVEIS) + Math.max(0, receitas.length - VISIVEIS)

  // Um único "ver todas" no cabeçalho abre/recolhe as duas colunas: checkbox + group-has (sem JS).
  return (
    <div className="group/cat">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Categorias</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Usadas em Contas a pagar e Lançamentos. Adicione ou remova sem precisar pedir ajuste.
          </p>
        </div>
        {escondidas > 0 && (
          <label className="shrink-0 cursor-pointer select-none rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-militar-600/40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
            <input type="checkbox" className="ver-todas sr-only" aria-label="Ver todas as categorias" />
            <span className="group-has-[.ver-todas:checked]/cat:hidden">▾ Ver todas ({despesas.length + receitas.length})</span>
            <span className="hidden group-has-[.ver-todas:checked]/cat:inline">▴ Recolher</span>
          </label>
        )}
      </div>
      <div className="mt-4">
      <BlocoAdicionar titulo="+ Nova categoria" compacto>
      <FormularioQueLimpa action={criarCategoria} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Nome</span>
          <input name="nome" required placeholder="ex: Restaurante" className={`${campo} w-44`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo</span>
          <select name="natureza" defaultValue="despesa" className={campo}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </label>
        <button type="submit" className={botao}>
          Adicionar
        </button>
      </FormularioQueLimpa>
      </BlocoAdicionar>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <ListaCategorias titulo="Despesas" categorias={despesas} />
        <ListaCategorias titulo="Receitas" categorias={receitas} />
      </div>
      </div>
    </div>
  )
}

// Quantas categorias aparecem por coluna antes de "Ver todas".
const VISIVEIS = 5

function ListaCategorias({ titulo, categorias }: { titulo: string; categorias: Categoria[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {titulo} <span className="font-normal normal-case tracking-normal">({categorias.length})</span>
      </h3>
      <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
        {categorias.map((c, i) => (
          <ItemCategoria key={c.id} c={c} oculta={i >= VISIVEIS} />
        ))}
        {categorias.length === 0 && <li className="py-2 text-sm text-neutral-500 dark:text-neutral-400">Nenhuma.</li>}
      </ul>
      {categorias.length > VISIVEIS && (
        <p className="pt-2 text-[11px] text-neutral-400 group-has-[.ver-todas:checked]/cat:hidden">+ {categorias.length - VISIVEIS} recolhidas</p>
      )}
    </div>
  )
}

function ItemCategoria({ c, oculta }: { c: Categoria; oculta?: boolean }) {
  return (
    <li className={`items-center justify-between gap-3 py-2 text-sm ${oculta ? 'hidden group-has-[.ver-todas:checked]/cat:flex' : 'flex'}`}>
      <span className="text-neutral-900 dark:text-neutral-100">{c.nome}</span>
      <FormularioComConfirmacao
        action={removerCategoria}
        mensagem={`Remover a categoria "${c.nome}"? Contas e lançamentos que usam ela ficam sem categoria — não são apagados.`}
      >
        <input type="hidden" name="id" value={c.id} />
        <button type="submit" className="text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
          remover
        </button>
      </FormularioComConfirmacao>
    </li>
  )
}
