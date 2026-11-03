import { BotaoVoltar } from '@/components/botao-voltar'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatarData } from '@/lib/data'
import { ConferirDocumento } from './conferir'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Linha = {
  id: string
  data: string
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  canal: string | null
  parcela_num: number | null
  parcela_total: number | null
  category: { nome: string } | { nome: string }[] | null
}

// Conferência de uma fatura/documento: pizza dos principais gastos e categorias abertas para corrigir.
// Documento ainda não confirmado vai pra revisão (Enviar), onde dá pra confirmar.
export default async function ConferirFatura({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: documento } = await supabase
    .from('document')
    .select('id, nome_arquivo, origem, status, extracao, criado_em')
    .eq('id', id)
    .maybeSingle()
  if (!documento) notFound()
  if (documento.status === 'aguardando_confirmacao') redirect(`/enviar?documento=${id}&de=documentos`)

  const [{ data: lancamentos }, { data: categorias }] = await Promise.all([
    supabase
      .from('transaction')
      .select('id, data, descricao, valor, natureza, canal, parcela_num, parcela_total, category:category_id(nome)')
      .eq('document_id', id)
      .order('data'),
    supabase.from('category').select('id, nome').order('nome'),
  ])

  const extracao = (documento.extracao ?? {}) as { instituicao?: string | null; valor_total?: number | null; vencimento?: string | null }
  const itens = ((lancamentos as Linha[] | null) ?? []).map((t) => {
    const cat = Array.isArray(t.category) ? t.category[0] : t.category
    const extra = [t.parcela_total ? `${t.parcela_num}/${t.parcela_total}` : null, t.canal].filter(Boolean).join(' · ')
    return {
      chave: t.id,
      data: t.data,
      descricao: t.descricao,
      valor: Number(t.valor),
      natureza: t.natureza,
      categoria: cat?.nome ?? null,
      extra: extra || null,
    }
  })

  return (
    <main className="w-full px-5 py-8 md:px-8 lg:px-10">
      <BotaoVoltar reserva="/contas-a-pagar?aba=documentos" rotulo="Voltar para Documentos" />
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Conferir {extracao.instituicao ? `fatura ${extracao.instituicao}` : 'documento'}
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {documento.nome_arquivo} · enviado {formatarData(documento.criado_em)}
        {documento.origem === 'email' ? ' · chegou por e-mail' : ''}
        {extracao.vencimento ? ` · vence ${formatarData(extracao.vencimento)}` : ''}
        {extracao.valor_total ? ` · total ${brl.format(extracao.valor_total)}` : ''}
      </p>

      {itens.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {documento.status === 'confirmado'
            ? 'Este documento não gerou lançamentos (por exemplo, atualizou uma conta a pagar).'
            : 'Este documento ainda não tem lançamentos.'}
        </p>
      ) : (
        <ConferirDocumento itens={itens} categorias={(categorias ?? []) as { id: string; nome: string }[]} />
      )}
    </main>
  )
}
