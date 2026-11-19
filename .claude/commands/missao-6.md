---
description: Mês Fechado · Missão 6 · A cara do seu sistema
---

# Missão 6 · A cara do seu sistema

Siga o CLAUDE.md. Fale em português simples, um passo por vez, e espere o aluno responder "feito" quando o passo depender dele. Texto extra que o aluno escreveu depois do comando: $ARGUMENTS

## Objetivo
Trocar o nome, a frase e a cor do sistema, publicar e ver a mudança no ar. É a primeira mudança feita por você no código dele.

## Passos
1. Leia o PERFIL.md (se existir). Pergunte o nome do sistema (ex.: "Contas da Casa"), uma frase curta e a cor preferida. Dê 3 sugestões se ele não souber.
2. Altere src/lib/meu-sistema.ts (nome, assinatura, descricao).
3. Gere uma escala de 11 tons a partir da cor escolhida e troque os tokens --color-militar-50 a --color-militar-950 em src/app/globals.css (o bloco claro). Confira o contraste do texto nos tons 600 e 700.
4. Rode npm run testar:banco e npm run build. Commit ("Nome e cor do meu sistema") e push.
5. Explique que a Vercel publica em 1 a 2 minutos e peça para ele abrir o site e conferir o nome novo.

## Para fechar
Resuma em 3 linhas o que foi feito e diga ao aluno o que mandar para a Lia: o link de progresso (Configurações → Progresso na trilha) ou o endereço do site com o nome novo.
