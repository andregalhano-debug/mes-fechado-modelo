# Meu Mês Fechado · modelo do sistema

Sistema de controle financeiro pessoal para você ter **no seu nome**, rodando nas **suas contas** (GitHub, Vercel e Supabase). É o modelo da trilha do Mês Fechado: a Lia, sua tutora de IA na Área do Aluno, acompanha cada passo. O guia de todas as missões fica em https://mes-fechado-ten.vercel.app/trilha.

> Este repositório não tem nenhum dado real. Tudo o que aparece no modo demonstração é fictício e tem "(exemplo)" no nome.

## O que vem pronto

- **Visão geral**: indicadores do mês clicáveis (a pagar, pagas, faturas, parcelas, fluxo, comprometimento, próxima renovação, documentos para revisar), desvios por categoria, gráficos.
- **Contas a pagar**: contas com mês âncora e repetição mensal/anual, cartões, assinaturas, parcelas, histórico, lançamentos, documentos e busca.
- **Enviar**: PDF de fatura, print de saldo ou foto de nota. A IA lê, você confere, o sistema grava.
- **Faturas pelo e-mail**: rotina diária que lê um Gmail só de faturas (inclusive PDF com senha).
- **Patrimônio**: contas, investimentos, bens e FGTS, mês a mês, sempre aberto com os valores ocultos.
- **Assistente**: perguntas sobre os seus dados, respondidas só com os números do sistema.
- **Segurança**: login com 2FA, biometria (passkey) no celular, olho que oculta os valores, cada pessoa da casa com a sua visão.

## Por que o sistema não se conecta ao seu banco

De propósito. Conectar o banco é como fazer uma cópia da chave da sua casa e entregar para o sistema e para uma empresa no meio do caminho: cada cópia é uma chance a mais de a chave se perder. Aqui ninguém tem cópia. O sistema só conhece o que você envia (PDF, print, e-mail da fatura).

- **Nenhuma chave guardada** que possa vazar e mostrar o seu extrato.
- **Ninguém no meio do caminho** (empresa intermediária) com os seus dados.
- **Golpe fácil de reconhecer**: este sistema nunca pede senha de banco, código de SMS ou conexão com banco. Se pedirem, é golpe.
- **Sem número errado escondido**: a fonte é a fatura oficial, e nada entra sem você conferir.

## Colocar no ar em 1 clique

[![Publicar na Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fandregalhano-debug%2Fmes-fechado-modelo&project-name=meu-mes-fechado&repository-name=meu-mes-fechado&env=CRON_SECRET&envDescription=Invente+uma+frase+longa%2C+sem+espa%C3%A7os+%28ex.%3A+minha-casa-azul-2026-segura%29.+Protege+as+rotinas+di%C3%A1rias.&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)

Entre com **Continue with GitHub** em tudo (Vercel, Supabase e Claude). Uma conta só, sem senha nova.

1. Clique no botão acima. A Vercel cria o **seu repositório privado** no GitHub (deixe marcado "Create private Git Repository").
2. Quando aparecer o **Supabase**: crie o banco no plano **Free**, região **South America (São Paulo)**.
3. Em **CRON_SECRET**, invente uma frase longa sem espaços.
4. Clique em **Deploy**. O banco se instala sozinho durante a publicação (nada de SQL Editor).
5. Abra o endereço do site: aparece o **Primeiro acesso**. Crie a sua conta e pronto, você é o dono.

**Já tem conta no Supabase?** Pode usar um projeto que já existe: veja o Caminho 2 na página `/instalar` do seu site (4 variáveis na Vercel e um Redeploy). Se o banco ainda não estiver ligado, o site abre direto nessa página.

**Pessoas da casa** entram por Configurações → Pessoas da casa (nome, e-mail e senha provisória), sem SQL e sem e-mail de confirmação. **Dados de exemplo** se carregam e se apagam por um botão em Configurações.

## Construir com o Claude Code

Abra [claude.ai/code](https://claude.ai/code), conecte o GitHub e escolha o repositório `meu-mes-fechado`. O Claude lê o `CLAUDE.md` e já conhece o projeto. Cada missão da trilha é um comando: digite `/missao-5`, `/missao-6`... Ele mexe no código, testa e publica (push → a Vercel publica sozinha). Você não precisa instalar nada no computador.

Prefere trabalhar no seu computador? Funciona igual: `git clone`, `npm install`, `npx vercel env pull .env.local` e `npm run dev`.

## Testar o banco sem medo

`npm run testar:banco` roda todas as migrações num Postgres de verdade dentro do seu computador (nada vai para a internet) e confere: primeiro acesso, convites, dados de exemplo e se alguém de fora consegue ler a sua casa (não pode). O Claude Code roda sozinho antes de cada publicação. Mudança no banco = arquivo novo numerado em `supabase/migrations/`, instalado automaticamente na próxima publicação.

## Personalizar

- **Nome e textos**: `src/lib/meu-sistema.ts` (ou `/missao-6` no Claude Code). As variáveis `NEXT_PUBLIC_NOME_SISTEMA` etc. na Vercel, se existirem, têm prioridade.
- **Cor principal**: tons `--color-militar-*` em `src/app/globals.css` (peça ao seu Claude uma escala a partir da cor que você quiser).
- **Qualquer outra coisa**: peça ao seu Claude, do seu jeito. Ele conhece este código.

## Cuidados

- Chaves só nas variáveis da Vercel (Sensitive). `.env.local`, se você usar o computador, nunca vai para o GitHub. Repositório sempre privado.
- Chaves e senhas nunca no chat (nem com a Lia, nem com o Claude).
- Coloque um limite mensal de gasto na API da Anthropic.
- Isto é uma ferramenta de organização, não recomendação de investimento.
