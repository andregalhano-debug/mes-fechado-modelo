import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { criarContexto } from '@/lib/assistente/dados'
import { anthropic, consumirUso, ferramentas, instrucoes, MODELO } from '@/lib/assistente/ia'

export const maxDuration = 60

type Mensagem = { role: 'user' | 'assistant'; content: string }

// Mensagens vindas do navegador: só texto, tamanho limitado, alternando usuário/assistente
// e começando pelo usuário — nada de blocos arbitrários enviados pelo cliente.
function limpar(entrada: unknown): Mensagem[] | null {
  if (!Array.isArray(entrada)) return null
  const msgs = entrada
    .filter(
      (m): m is Mensagem =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-16)
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  const alternadas: Mensagem[] = []
  for (const m of msgs) {
    if (alternadas.length && alternadas[alternadas.length - 1].role === m.role) alternadas[alternadas.length - 1] = m
    else alternadas.push(m)
  }
  return alternadas.length && alternadas[alternadas.length - 1].role === 'user' ? alternadas : null
}

function mensagemDeErro(e: unknown) {
  if (e instanceof Anthropic.RateLimitError) return 'Muitas perguntas seguidas. Espere um minuto e tente de novo.'
  if (e instanceof Anthropic.APIError) {
    if (/credit balance/i.test(e.message)) return 'Os créditos da IA acabaram. Recarregue em console.anthropic.com para voltar a usar o assistente.'
    if (e.status && e.status >= 500) return 'A IA está instável agora. Tente de novo em instantes.'
    return 'Não consegui consultar a IA agora. Tente de novo.'
  }
  return 'Algo deu errado ao montar a resposta. Tente de novo.'
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Entre no app para usar o assistente.' }, { status: 401 })

  const corpo = await req.json().catch(() => null)
  const mensagens = limpar(corpo?.mensagens)
  if (!mensagens) return Response.json({ erro: 'Pergunta inválida.' }, { status: 400 })
  if (!consumirUso(user.id))
    return Response.json({ erro: 'Limite diário de perguntas atingido. Volte amanhã.' }, { status: 429 })

  const ctx = await criarContexto(supabase)
  const codificador = new TextEncoder()

  const corpoResposta = new ReadableStream({
    async start(controller) {
      const enviar = (evento: { t: string; v?: string }) => controller.enqueue(codificador.encode(JSON.stringify(evento) + '\n'))
      try {
        const runner = anthropic.beta.messages.toolRunner({
          model: MODELO,
          max_tokens: 2048,
          system: instrucoes(ctx),
          tools: ferramentas(ctx),
          messages: mensagens,
          max_iterations: 6,
          stream: true,
        })
        for await (const fluxo of runner) {
          for await (const evento of fluxo) {
            if (evento.type === 'content_block_start' && evento.content_block.type === 'tool_use')
              enviar({ t: 'ferramenta', v: evento.content_block.name })
            else if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta')
              enviar({ t: 'texto', v: evento.delta.text })
          }
          const final = await fluxo.finalMessage()
          if (final.stop_reason === 'refusal') enviar({ t: 'texto', v: '\n\nNão consigo ajudar com esse pedido.' })
          if (final.stop_reason === 'max_tokens') enviar({ t: 'texto', v: '…' })
        }
        enviar({ t: 'fim' })
      } catch (e) {
        console.error('assistente/chat', e)
        enviar({ t: 'erro', v: mensagemDeErro(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(corpoResposta, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
