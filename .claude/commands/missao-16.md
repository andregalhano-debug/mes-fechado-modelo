---
description: Mês Fechado · Missão 16 · Alertas antes de vencer
---

# Missão 16 · Alertas antes de vencer

Siga o CLAUDE.md. Fale em português simples, um passo por vez, e espere o aluno responder "feito" quando o passo depender dele. Texto extra que o aluno escreveu depois do comando: $ARGUMENTS

## Objetivo
Construir os avisos por e-mail de conta perto de vencer e de conta atrasada. Esta missão é construção de verdade: você escreve o código.

## Passos
1. Mostre o plano em 3 a 5 linhas e espere aprovação:
   - rotina diária (Vercel Cron em vercel.json, protegida pelo CRON_SECRET, igual às outras em src/app/api/cron);
   - procura contas não pagas que vencem em até 7 dias e contas atrasadas, por casa;
   - e-mail simples em português pelo Resend (fetch para a API do Resend com RESEND_API_KEY), com descrição, vencimento, valor e link para o sistema;
   - um jeito de testar na hora.
2. Ele cria a conta no Resend e a chave; a chave vai SÓ na Vercel (RESEND_API_KEY, Sensitive). Sem domínio próprio, o Resend só envia para o e-mail da própria conta: explique isso.
3. Implemente, rode testar:banco e build, commit e push.
4. Teste com ele e confira a caixa de entrada (e o spam).

## Para fechar
Resuma em 3 linhas o que foi feito e diga ao aluno o que mandar para a Lia: o link de progresso e uma frase dizendo que o alerta de teste chegou.
