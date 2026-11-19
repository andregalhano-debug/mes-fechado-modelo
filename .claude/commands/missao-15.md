---
description: Mês Fechado · Missão 15 · Faturas direto do e-mail
---

# Missão 15 · Faturas direto do e-mail

Siga o CLAUDE.md. Fale em português simples, um passo por vez, e espere o aluno responder "feito" quando o passo depender dele. Texto extra que o aluno escreveu depois do comando: $ARGUMENTS

## Objetivo
As faturas que chegam num Gmail só de faturas entram sozinhas no sistema, todo dia.

## Passos
1. Explique por que um Gmail SÓ de faturas é mais seguro do que o e-mail pessoal.
2. Guie: criar o Gmail de faturas → verificação em duas etapas → senha de app (myaccount.google.com/apppasswords).
3. Leia .env.example e explique as variáveis FATURAS_*. Ele cadastra na Vercel (Sensitive): FATURAS_GMAIL_USUARIO, FATURAS_GMAIL_SENHA_APP e, se o PDF tiver senha, FATURAS_PDF_CPFS ou FATURAS_PDF_NASCIMENTOS. Depois, Redeploy.
4. Ensine a rodar a rotina uma vez para testar (o endereço /api/cron/faturas-email com o CRON_SECRET), sem expor o segredo no chat.

## Para fechar
Resuma em 3 linhas o que foi feito e diga ao aluno o que mandar para a Lia: o link de progresso (ele mostra o e-mail configurado e a primeira fatura importada).
