// Filtro de período global (o "filtro mãe" do topo). Fica no cookie `periodo` — vale pra todas as
// telas e pra todos os aparelhos que abrirem com a mesma escolha. Formatos do cookie:
//   preset ("12m", "ano", "empresa", ...) ou "custom:AAAA-MM:AAAA-MM".

export const COOKIE_PERIODO = 'periodo'

export type PresetPeriodo = 'mes' | 'mes_passado' | '3m' | '6m' | '12m' | 'ano' | 'ano_passado' | 'empresa' | 'tudo' | 'custom'

export const PRESETS: { id: Exclude<PresetPeriodo, 'custom'>; rotulo: string }[] = [
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes_passado', rotulo: 'Mês passado' },
  { id: '3m', rotulo: 'Últimos 3 meses' },
  { id: '6m', rotulo: 'Últimos 6 meses' },
  { id: '12m', rotulo: 'Últimos 12 meses' },
  { id: 'ano', rotulo: 'Este ano' },
  { id: 'ano_passado', rotulo: 'Ano passado' },
  { id: 'empresa', rotulo: 'Fase empresa (desde fev/26)' },
  { id: 'tudo', rotulo: 'Todo o período' },
]

export type Periodo = { preset: PresetPeriodo; de: string | null; ate: string | null; rotulo: string; intervalo: string }

const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
function somar(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  return chave(new Date(a, m - 1 + n, 1))
}
export function nomeMesCurto(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

export function resolverPeriodo(valor: string | undefined | null, hoje = new Date()): Periodo {
  const atual = chave(hoje)
  let preset: PresetPeriodo = 'tudo'
  let de: string | null = null
  let ate: string | null = null
  const v = valor ?? 'tudo'
  if (v.startsWith('custom:')) {
    const [, a, b] = v.split(':')
    if (/^\d{4}-\d{2}$/.test(a ?? '') && /^\d{4}-\d{2}$/.test(b ?? '')) {
      preset = 'custom'
      ;[de, ate] = a <= b ? [a, b] : [b, a]
    }
  } else if (PRESETS.some((p) => p.id === v)) preset = v as PresetPeriodo

  const ano = hoje.getFullYear()
  switch (preset) {
    case 'mes': de = ate = atual; break
    case 'mes_passado': de = ate = somar(atual, -1); break
    case '3m': de = somar(atual, -2); ate = atual; break
    case '6m': de = somar(atual, -5); ate = atual; break
    case '12m': de = somar(atual, -11); ate = atual; break
    case 'ano': de = `${ano}-01`; ate = atual; break
    case 'ano_passado': de = `${ano - 1}-01`; ate = `${ano - 1}-12`; break
    case 'empresa': de = '2026-02'; ate = atual; break
  }
  const rotulo = preset === 'custom' ? 'Personalizado' : PRESETS.find((p) => p.id === preset)!.rotulo
  const intervalo = de && ate ? (de === ate ? nomeMesCurto(de) : `${nomeMesCurto(de)} – ${nomeMesCurto(ate)}`) : 'desde o início'
  return { preset, de, ate, rotulo, intervalo }
}

/** O mês (AAAA-MM) está dentro do período? */
export function noPeriodo(mes: string, p: Pick<Periodo, 'de' | 'ate'>) {
  const m = mes.slice(0, 7)
  return (!p.de || m >= p.de) && (!p.ate || m <= p.ate)
}
