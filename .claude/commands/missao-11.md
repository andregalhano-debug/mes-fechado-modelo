---
description: Mês Fechado · Missão 11 · A chave da IA, com limite de gasto
---

# Missão 11 · A chave da IA, com limite de gasto

Siga o CLAUDE.md. Fale em português simples, um passo por vez, e espere o aluno responder "feito" quando o passo depender dele. Texto extra que o aluno escreveu depois do comando: $ARGUMENTS

## Objetivo
O sistema poder ler faturas com a API do Claude, com um limite mensal baixo.

## Passos
1. Explique a diferença entre a assinatura do Claude (este chat) e a API (o sistema), cobradas separado.
2. Leia src/lib e estime quanto custa ler uma fatura por mês com o modelo configurado.
3. Guie: console.anthropic.com → créditos mínimos → Limits com limite mensal baixo (US$ 5 a 10) → API Keys → criar "meu-sistema".
4. A chave vai SÓ na Vercel: Settings → Environment Variables → ANTHROPIC_API_KEY, marcada como Sensitive → depois Deployments → ⋯ → Redeploy. Nunca no chat.

## Para fechar
Resuma em 3 linhas o que foi feito e diga ao aluno o que mandar para a Lia: o link de progresso (ele mostra a chave da IA configurada, sem revelar a chave).
