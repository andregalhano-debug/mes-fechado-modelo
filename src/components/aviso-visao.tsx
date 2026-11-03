import { ROTULO_JUNTOS } from '@/lib/donos'

// Faixa discreta no topo das telas lembrando de quem é a visão atual (definida no menu).
// No Consolidado não aparece nada; `naoSepara` avisa telas que são sempre da família.
export function AvisoVisao({ nomePessoa, naoSepara }: { nomePessoa: string | null; naoSepara?: string }) {
  // a faixa fixa do topo já mostra a visão atual; aqui só fica o aviso de telas com regra própria
  if (!nomePessoa || !naoSepara) return null
  return (
    <p className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
      <span className="font-semibold">Vendo só {nomePessoa}</span>
      <span className="text-rose-800/80 dark:text-rose-300/80">
        {naoSepara ?? `Itens da casa aparecem em ${ROTULO_JUNTOS}. Troque no menu.`}
      </span>
    </p>
  )
}
