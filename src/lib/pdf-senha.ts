// Abre faturas em PDF protegidas por senha derivada do CPF (ex.: os 5 primeiros dígitos).
// Os CPFs NUNCA ficam no código: vêm da variável FATURAS_PDF_CPFS na Vercel (só dígitos,
// vários separados por vírgula — ex. o seu e o de outra pessoa da casa). Opcionais:
//   FATURAS_PDF_SENHAS       senhas prontas (vírgula)
//   FATURAS_PDF_NASCIMENTOS  datas de nascimento DDMMAAAA (vírgula), pra regras com data
// Tudo acontece no servidor; o PDF desbloqueado substitui o original só para a leitura e o
// arquivo guardado no app.

export type RegraSenha =
  | { tipo: 'primeiros'; n: number }
  | { tipo: 'ultimos'; n: number }
  | { tipo: 'completo' }
  | { tipo: 'nascimento'; formato: 'ddmmaaaa' | 'ddmmaa' | 'ddmm' }

const NUMEROS: Record<string, number> = {
  tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11,
}

function semAcento(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Lê no texto do e-mail a regra da senha do PDF, como "a senha são os cinco primeiros
 * dígitos do seu CPF" ou "os 4 últimos números do CPF" ou "sua data de nascimento".
 */
export function regraDaSenha(textoEmail: string | null | undefined): RegraSenha | null {
  if (!textoEmail) return null
  const t = semAcento(textoEmail)
  if (!/senha|protegid|abrir|acessar/.test(t)) return null
  const num = '(tres|quatro|cinco|seis|sete|oito|nove|dez|onze|\\d{1,2})'
  const prim = t.match(new RegExp(`${num} primeiros (?:digitos|numeros|caracteres)[^.]{0,40}?cpf`))
  if (prim) return { tipo: 'primeiros', n: NUMEROS[prim[1]] }
  const ult = t.match(new RegExp(`${num} ultimos (?:digitos|numeros|caracteres)[^.]{0,40}?cpf`))
  if (ult) return { tipo: 'ultimos', n: NUMEROS[ult[1]] }
  if (/(cpf completo|todos os (?:digitos|numeros) do (?:seu )?cpf|numero do (?:seu )?cpf|seu cpf\b(?! ?\())/.test(t) && /senha[^.]{0,60}cpf/.test(t))
    return { tipo: 'completo' }
  if (/data de nascimento/.test(t)) {
    if (/ddmmaaaa|dd\/mm\/aaaa|8 digitos/.test(t)) return { tipo: 'nascimento', formato: 'ddmmaaaa' }
    if (/ddmmaa|dd\/mm\/aa/.test(t)) return { tipo: 'nascimento', formato: 'ddmmaa' }
    if (/ddmm|dia e mes/.test(t)) return { tipo: 'nascimento', formato: 'ddmm' }
    return { tipo: 'nascimento', formato: 'ddmmaaaa' }
  }
  return null
}

export function descreverRegra(r: RegraSenha) {
  if (r.tipo === 'primeiros') return `${r.n} primeiros dígitos do CPF`
  if (r.tipo === 'ultimos') return `${r.n} últimos dígitos do CPF`
  if (r.tipo === 'completo') return 'CPF completo'
  return `data de nascimento (${r.formato})`
}

const lista = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

function cpfs() {
  return lista(process.env.FATURAS_PDF_CPFS)
    .map((c) => c.replace(/\D/g, ''))
    .filter((c) => c.length >= 5)
}

function senhasDaRegra(r: RegraSenha): string[] {
  if (r.tipo === 'primeiros') return cpfs().map((c) => c.slice(0, r.n))
  if (r.tipo === 'ultimos') return cpfs().map((c) => c.slice(-r.n))
  if (r.tipo === 'completo') return cpfs()
  const datas = lista(process.env.FATURAS_PDF_NASCIMENTOS).map((d) => d.replace(/\D/g, '')).filter((d) => d.length === 8)
  return datas.map((d) => (r.formato === 'ddmmaaaa' ? d : r.formato === 'ddmmaa' ? d.slice(0, 4) + d.slice(6) : d.slice(0, 4)))
}

function candidatas(regra: RegraSenha | null): string[] {
  const out: string[] = []
  // 1º a regra que o próprio e-mail informou; depois senhas prontas; depois as variações comuns.
  if (regra) out.push(...senhasDaRegra(regra))
  out.push(...lista(process.env.FATURAS_PDF_SENHAS))
  for (const c of cpfs()) out.push(c.slice(0, 5), c.slice(0, 4), c.slice(0, 6), c.slice(0, 3), c, c.slice(-5), c.slice(-4), c.slice(-6))
  for (const d of lista(process.env.FATURAS_PDF_NASCIMENTOS).map((x) => x.replace(/\D/g, '')).filter((x) => x.length === 8))
    out.push(d, d.slice(0, 4) + d.slice(6), d.slice(0, 4))
  return Array.from(new Set(out.filter(Boolean)))
}

export function temSenhasConfiguradas() {
  return candidatas(null).length > 0
}

/** Devolve o PDF sem senha, ou null se nenhuma senha (da regra do e-mail ou configurada) abrir. */
export async function desbloquearPdf(
  bytes: Buffer,
  opcoes: { regra?: RegraSenha | null; /** senha digitada pela pessoa (testada primeiro, nunca guardada) */ senhaInformada?: string | null } = {},
): Promise<Buffer | null> {
  const senhas = [...(opcoes.senhaInformada ? [opcoes.senhaInformada] : []), ...candidatas(opcoes.regra ?? null)]
  const mupdf = await import('mupdf')
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf')
  try {
    // Muito boleto vem "protegido" só contra cópia/impressão, sem senha pra abrir: aí basta
    // salvar sem a criptografia, nenhuma senha é necessária.
    if (!doc.needsPassword()) {
      const pdf = doc.asPDF()
      return pdf ? Buffer.from(pdf.saveToBuffer('encrypt=none').asUint8Array()) : null
    }
    if (senhas.length === 0) return null
    for (const senha of senhas) {
      if (doc.authenticatePassword(senha) > 0) {
        const pdf = doc.asPDF()
        if (!pdf) return null
        return Buffer.from(pdf.saveToBuffer('encrypt=none').asUint8Array())
      }
    }
    return null
  } finally {
    doc.destroy?.()
  }
}
