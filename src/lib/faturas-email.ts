import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createAdminClient } from '@/lib/supabase/admin'
import { LIMITE_BYTES, processarArquivo } from '@/lib/documentos'
import { regraDaSenha } from '@/lib/pdf-senha'

// Lê um Gmail EXCLUSIVO de faturas (nunca o e-mail pessoal) por IMAP com uma "senha de app"
// que fica só nas variáveis da Vercel:
//   FATURAS_GMAIL_USUARIO   ex: minhas.faturas@gmail.com
//   FATURAS_GMAIL_SENHA_APP senha de app de 16 letras (revogável no Google)
//   FATURAS_REMETENTES      domínios de banco aceitos, separados por vírgula (opcional)
//   FATURAS_MEMBRO_ID       quem aparece como "enviado por" (opcional; padrão: 1º membro)
//   FATURAS_ENCAMINHADORES  e-mails pessoais aceitos quando a fatura é encaminhada à mão (opcional)
//   FATURAS_DONOS           e-mail pessoal → dono, ex: "pessoa@exemplo.com=Ana" (vários separados
//                           por vírgula). A fatura que chega redirecionada/encaminhada desse e-mail
//                           entra como dela. O e-mail de login de cada membro já vale sem configurar.
// Segurança: só aceita e-mails de domínios de banco da lista, só anexos PDF, e registra cada
// Message-ID processado pra não repetir. A fatura entra como "aguardando confirmação".
// Sem conexão com banco: o sistema só lê o que chega por e-mail (decisão de segurança do método).

const REMETENTES_PADRAO = [
  'bradesco.com.br',
  'nubank.com.br',
  'itau.com.br',
  'itau-unibanco.com.br',
  'itaucard.com.br',
  'santander.com.br',
  'bb.com.br',
  'caixa.gov.br',
  'inter.co',
  'bancointer.com.br',
  'c6bank.com',
  'c6bank.com.br',
  'xpi.com.br',
  'btgpactual.com',
  'mercadopago.com',
  'mercadopago.com.br',
  'porto.com.br',
  'portoseguro.com.br',
  'picpay.com',
  'sicredi.com.br',
  'sicoob.com.br',
]

export type ResumoBusca = {
  emailsLidos: number
  faturasProcessadas: number
  /** parou antes de ler tudo (tempo) — o resto entra na próxima busca */
  incompleto?: boolean
  ignorados: { assunto: string; motivo: string }[]
  erros: string[]
}

type EmailLido = Awaited<ReturnType<typeof simpleParser>>

// Endereços que identificam de quem é a fatura: quem mandou, pra quem foi (no redirecionamento
// do Outlook/Gmail o "Para" continua sendo o e-mail pessoal) e os cabeçalhos de reenvio.
function enderecosDoEmail(email: EmailLido): string[] {
  const lista: string[] = []
  const somar = (campo: unknown) => {
    const grupos = Array.isArray(campo) ? campo : campo ? [campo] : []
    for (const g of grupos as { value?: { address?: string }[] }[]) for (const v of g.value ?? []) if (v.address) lista.push(v.address)
  }
  somar(email.from)
  somar(email.to)
  somar(email.cc)
  for (const nome of ['resent-from', 'resent-to', 'x-forwarded-for', 'x-forwarded-to', 'x-original-to']) {
    const valor = email.headers.get(nome)
    const texto = typeof valor === 'string' ? valor : valor ? JSON.stringify(valor) : ''
    for (const m of texto.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) lista.push(m[0])
  }
  return Array.from(new Set(lista.map((e) => e.toLowerCase())))
}

function dominioPermitido(endereco: string, permitidos: string[]) {
  const dominio = endereco.toLowerCase().split('@')[1] ?? ''
  return permitidos.some((p) => dominio === p || dominio.endsWith(`.${p}`))
}

/** Texto do e-mail (corpo em texto + HTML sem tags): a regra da senha do PDF costuma vir aqui. */
function textoDoEmail(email: EmailLido) {
  return [email.text, typeof email.html === 'string' ? email.html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') : '']
    .join('\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function pdfsDe(email: EmailLido) {
  return (email.attachments ?? []).filter(
    (a) => (a.contentType === 'application/pdf' || a.filename?.toLowerCase().endsWith('.pdf')) && a.size <= LIMITE_BYTES,
  )
}

export function emailConfigurado() {
  return !!(process.env.FATURAS_GMAIL_USUARIO && process.env.FATURAS_GMAIL_SENHA_APP)
}

export async function buscarFaturasPorEmail({ dias = 10 }: { dias?: number } = {}): Promise<ResumoBusca> {
  const usuario = process.env.FATURAS_GMAIL_USUARIO
  const senha = process.env.FATURAS_GMAIL_SENHA_APP
  if (!usuario || !senha) throw new Error('Gmail de faturas ainda não configurado na Vercel.')

  const permitidos = (process.env.FATURAS_REMETENTES ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  const remetentes = permitidos.length ? permitidos : REMETENTES_PADRAO
  const encaminhadores = (process.env.FATURAS_ENCAMINHADORES ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const admin = createAdminClient()
  const membroConfigurado = process.env.FATURAS_MEMBRO_ID
  const { data: membro } = membroConfigurado
    ? await admin.from('member').select('id, household_id').eq('id', membroConfigurado).single()
    : await admin.from('member').select('id, household_id').order('nome').limit(1).single()
  if (!membro) throw new Error('Nenhuma pessoa da casa encontrada.')

  // E-mail pessoal → pessoa: login de cada pessoa + o mapa FATURAS_DONOS (por nome/apelido).
  const { data: membros } = await admin.from('member').select('id, nome, apelido').eq('household_id', membro.household_id)
  const donoPorEmail = new Map<string, string>()
  for (const m of membros ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.id)
    if (data?.user?.email) donoPorEmail.set(data.user.email.toLowerCase(), m.id)
  }
  const meuEmail = usuario.toLowerCase()
  for (const par of (process.env.FATURAS_DONOS ?? '').split(',')) {
    const [email, nome] = par.split('=').map((x) => x?.trim().toLowerCase())
    if (!email || !nome) continue
    const alvo = (membros ?? []).find(
      (m) => m.nome.toLowerCase() === nome || m.nome.toLowerCase().split(' ')[0] === nome || m.apelido?.toLowerCase() === nome,
    )
    if (alvo) donoPorEmail.set(email, alvo.id)
  }

  const resumo: ResumoBusca = { emailsLidos: 0, faturasProcessadas: 0, ignorados: [], erros: [] }

  /** Lê os PDFs de um e-mail como faturas. Devolve quantos documentos entraram. */
  async function processarPdfs(email: EmailLido, assunto: string, dono: string) {
    let documentos = 0
    let erro: string | null = null
    const regra = regraDaSenha(textoDoEmail(email))
    for (const anexo of pdfsDe(email)) {
      const r = await processarArquivo({
        supabase: admin,
        householdId: membro!.household_id,
        enviadoPor: dono,
        nome: anexo.filename || `fatura-${new Date().toISOString().slice(0, 10)}.pdf`,
        mime: 'application/pdf',
        bytes: anexo.content,
        origem: 'email',
        regraSenha: regra,
      })
      if (r.ok) {
        documentos++
        resumo.faturasProcessadas++
      } else {
        resumo.erros.push(`${assunto}: ${r.erro}`)
        erro = r.erro
      }
    }
    return { documentos, erro }
  }

  // a função tem 300s: para com folga e deixa o resto pra próxima (o que já foi lido não repete)
  const inicio = Date.now()
  const cliente = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: usuario, pass: senha.replace(/\s+/g, '') },
    logger: false,
  })

  await cliente.connect()
  const trava = await cliente.getMailboxLock('INBOX')
  try {
    const desde = new Date(Date.now() - dias * 86_400_000)
    const uids = (await cliente.search({ since: desde }, { uid: true })) || []
    for (const uid of uids) {
      if (Date.now() - inicio > 230_000) {
        resumo.incompleto = true
        break
      }
      const mensagem = await cliente.fetchOne(String(uid), { source: true }, { uid: true })
      if (!mensagem || !mensagem.source) continue
      const email = await simpleParser(mensagem.source)
      const messageId = email.messageId ?? `uid-${uid}-${email.date?.toISOString()}`
      const assunto = email.subject ?? '(sem assunto)'
      const remetente = email.from?.value?.[0]?.address ?? ''
      resumo.emailsLidos++

      const { data: jaVisto } = await admin.from('email_processado').select('message_id').eq('message_id', messageId).maybeSingle()
      if (jaVisto) continue

      const encaminhadorConhecido = encaminhadores.includes(remetente.toLowerCase()) || donoPorEmail.has(remetente.toLowerCase())
      const anexosEml = (email.attachments ?? []).filter((a) => a.contentType === 'message/rfc822' || a.filename?.toLowerCase().endsWith('.eml'))
      const enderecos = enderecosDoEmail(email).filter((e) => e !== meuEmail)
      const dono = enderecos.map((e) => donoPorEmail.get(e)).find(Boolean) ?? membro.id

      let observacao: string | null = null
      let documentos = 0
      if (encaminhadorConhecido && anexosEml.length > 0) {
        // Lote: vários e-mails de fatura anexados (.eml / "encaminhar como anexo") — cada um é lido
        // como um e-mail próprio, e só os de banco da lista entram.
        let lidos = 0
        for (const anexo of anexosEml) {
          const interno = await simpleParser(anexo.content)
          const remInterno = interno.from?.value?.[0]?.address ?? ''
          if (!dominioPermitido(remInterno, remetentes)) continue
          const r = await processarPdfs(interno, interno.subject ?? assunto, dono)
          documentos += r.documentos
          lidos++
        }
        observacao = `lote: ${lidos} e-mails de banco, ${documentos} faturas`
      } else if (!dominioPermitido(remetente, remetentes) && !encaminhadorConhecido) {
        observacao = `remetente fora da lista (${remetente})`
        resumo.ignorados.push({ assunto, motivo: observacao })
      } else if (pdfsDe(email).length === 0) {
        observacao = 'sem PDF anexo'
        resumo.ignorados.push({ assunto, motivo: observacao })
      } else {
        const r = await processarPdfs(email, assunto, dono)
        documentos = r.documentos
        observacao = r.erro
      }

      await admin.from('email_processado').upsert({
        message_id: messageId,
        household_id: membro.household_id,
        remetente,
        assunto: assunto.slice(0, 300),
        recebido_em: email.date?.toISOString() ?? null,
        documentos,
        observacao,
      })
    }
  } finally {
    trava.release()
    // logout educado com prazo curto; se o Gmail demorar a responder, fecha a conexão na marra
    // (senão a requisição fica pendurada até estourar o tempo e o botão não termina).
    await Promise.race([cliente.logout().catch(() => {}), new Promise((r) => setTimeout(r, 3000))])
    try {
      cliente.close()
    } catch {}
  }
  return resumo
}
