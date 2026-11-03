import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export type LancamentoExtraido = {
  data: string
  descricao: string
  valor: number
  natureza: 'despesa' | 'receita'
  categoria_sugerida: string | null
  canal: string | null
  parcela_num: number | null
  parcela_total: number | null
  perfil_sugerido: string | null
  /** categoria veio do histórico da família (não da IA) */
  categoria_pelo_historico?: boolean
}

export type ResultadoExtracao = {
  tipo_documento: 'fatura' | 'extrato' | 'saldo' | 'nota' | 'desconhecido'
  instituicao: string | null
  confianca: number
  observacao: string | null
  saldo: number | null
  saldo_moeda: string | null
  vencimento: string | null
  valor_total: number | null
  lancamentos: LancamentoExtraido[]
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tipo_documento',
    'instituicao',
    'confianca',
    'observacao',
    'saldo',
    'saldo_moeda',
    'vencimento',
    'valor_total',
    'lancamentos',
  ],
  properties: {
    tipo_documento: {
      type: 'string',
      enum: ['fatura', 'extrato', 'saldo', 'nota', 'desconhecido'],
    },
    instituicao: { type: ['string', 'null'] },
    confianca: {
      type: 'number',
      description: 'De 0 a 1. Abaixo de 0.8 o sistema pede confirmação humana.',
    },
    observacao: {
      type: ['string', 'null'],
      description: 'O que ficou ambíguo, se algo ficou.',
    },
    saldo: {
      type: ['number', 'null'],
      description: 'Preencher só quando o documento é um print/extrato de saldo.',
    },
    saldo_moeda: { type: ['string', 'null'] },
    vencimento: {
      type: ['string', 'null'],
      description: 'Vencimento da fatura, AAAA-MM-DD.',
    },
    valor_total: {
      type: ['number', 'null'],
      description:
        'Valor total impresso na fatura/nota (ex: "total desta fatura", "valor total a pagar"). Serve pra conferir se a soma dos lançamentos bate com o que o documento declara. Null se o documento não mostrar um total.',
    },
    lancamentos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'data',
          'descricao',
          'valor',
          'natureza',
          'categoria_sugerida',
          'canal',
          'parcela_num',
          'parcela_total',
          'perfil_sugerido',
        ],
        properties: {
          data: { type: 'string', description: 'AAAA-MM-DD' },
          descricao: { type: 'string' },
          valor: { type: 'number', description: 'Sempre positivo.' },
          natureza: { type: 'string', enum: ['despesa', 'receita'] },
          categoria_sugerida: {
            // Só "enum" aqui (sem "type" em array) — a Anthropic rejeita
            // `type: ['string','null']` combinado com "enum" com erro
            // "Enum value '...' does not match declared type".
            enum: [
              'Moradia',
              'Mercado',
              'Transporte',
              'Saúde',
              'Educação',
              'Pet',
              'Lazer & viagens',
              'Compras',
              'Assinaturas',
              'IA',
              'Celular',
              'Juros',
              'Presentes',
              'Outros',
              'Salário',
              'Bônus & 13º',
              'Rendimentos',
              'Outras receitas',
              null,
            ],
          },
          canal: {
            type: ['string', 'null'],
            description:
              'Marketplace ou app que originou a compra: iFood, Mercado Livre, 99, Keeta, Uber, Amazon. Null se não for identificável.',
          },
          parcela_num: { type: ['integer', 'null'] },
          parcela_total: { type: ['integer', 'null'] },
          perfil_sugerido: {
            type: ['string', 'null'],
            description:
              'Nome de um perfil de custo da casa (ex.: um filho ou um pet) quando o gasto é claramente dele: escola, pediatra, atividade infantil para filho; ração, veterinário, banho e tosa para pet. Use exatamente o nome do perfil informado. Null caso contrário.',
          },
        },
      },
    },
  },
} as const

const SISTEMA = `Você extrai lançamentos financeiros de documentos brasileiros para um painel de finanças de uma família.

Regras:
- Valores sempre positivos; a direção vai em "natureza".
- Formato brasileiro: "1.234,56" é mil duzentos e trinta e quatro reais e cinquenta e seis centavos.
- Datas em AAAA-MM-DD. O documento normalmente só traz dia/mês pra cada lançamento (coluna de data, geralmente no início da linha) — não confunda com a contagem de parcela ("03/10" ou "PARC 3/10" no meio da descrição), que é um campo totalmente separado e vai em parcela_num/parcela_total, nunca na data.
- Pra descobrir o ano da data de cada lançamento: cartão de crédito nunca lista compra futura, então o ano é o mesmo da competência/vencimento da fatura SE o mês do lançamento for igual ou anterior ao mês de fechamento; se o mês do lançamento vier DEPOIS do mês de fechamento (ex: fatura fecha em agosto e a linha mostra dia/mês de dezembro ou outubro), use o ano ANTERIOR ao da fatura.
- Compra parcelada ("03/10", "PARC 3/10") preenche parcela_num e parcela_total.
- Quando a linha vem de um app (IFOOD, MERCADOLIVRE, 99APP, KEETA, UBER), preencha "canal".
- Assinaturas e serviços recorrentes de streaming/software (NETFLIX, SPOTIFY, GOOGLE ONE, YOUTUBE PREMIUM, AMAZON PRIME, DISNEY+, HBO MAX, APPLE): categoria "Assinaturas" e preencha "canal" com o nome do serviço (ex: "Netflix", "Spotify", "Google"), pra dar pra ver depois quais assinaturas existem, quanto custam e o peso de cada uma. Exceção: assinatura de IA (ANTHROPIC, CLAUDE, OPENAI, CHATGPT) vai na categoria "IA", não em "Assinaturas".
- Se a nota detalha item a item e os itens pertencem a categorias diferentes, devolva um lançamento por item.
- Print de saldo: preencha "saldo" e deixe "lancamentos" vazio.
- Fatura ou nota com um total impresso (ex: "Total desta fatura", "Valor total"): preencha "valor_total" com esse número, pra dar pra conferir contra a soma dos lançamentos lançados.
- Fatura de cartão de crédito costuma trazer uma linha de crédito referente ao PAGAMENTO da fatura do mês anterior (ex: "PAG BOLETO BANCARIO", "PAGAMENTO EFETUADO", "PGTO DEBITO EM CC/POUP", "CREDITO PAGAMENTO"). NÃO gere um lançamento pra essa linha — não é receita nova da família, é só a baixa de uma dívida cujos gastos já foram lançados quando a fatura anterior foi extraída. Incluir geraria receita falsa e contaria o mesmo gasto duas vezes. Ignore essa linha completamente (não entra em "lancamentos").
- Não invente lançamento que você não consegue ler. Prefira baixar a confiança a preencher no chute.`

type Entrada = {
  base64: string
  mimeType: string
}

export async function extrairDocumento({ base64, mimeType }: Entrada): Promise<ResultadoExtracao> {
  const ehPdf = mimeType === 'application/pdf'

  const conteudo: Anthropic.ContentBlockParam[] = [
    ehPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
            data: base64,
          },
        },
    {
      type: 'text',
      text: 'Extraia os lançamentos deste documento seguindo o schema.',
    },
  ]

  let resposta
  try {
    resposta = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16000,
      system: SISTEMA,
      output_config: {
        format: { type: 'json_schema', schema },
      },
      messages: [{ role: 'user', content: conteudo }],
    })
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      // Não expõe o corpo técnico da API (chave, saldo, etc.) direto pro usuário.
      if (e.status === 429) throw new Error('Muita gente lendo documentos agora. Tente de novo em alguns minutos.')
      throw new Error('Não consegui processar o documento agora. Tente de novo mais tarde ou lance manualmente.')
    }
    throw e
  }

  if (resposta.stop_reason === 'refusal') {
    throw new Error('A leitura do documento foi recusada pelo modelo.')
  }

  const bloco = resposta.content.find((b) => b.type === 'text')
  if (!bloco || bloco.type !== 'text') {
    throw new Error('O modelo não devolveu conteúdo legível.')
  }

  return JSON.parse(bloco.text) as ResultadoExtracao
}
