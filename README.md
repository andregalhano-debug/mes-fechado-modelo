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

## Colocar no ar (a Lia te guia em cada etapa)

1. **GitHub**: clique em *Use this template* e crie o repositório como **Private**.
2. **Supabase**: projeto novo na região São Paulo. No SQL Editor, rode os arquivos de `supabase/migrations` **em ordem** (0001 a 0024).
3. **Segurança do login**: em *Authentication → Sign In / Providers → Email*, **desligue "Allow new users to sign up"**. Só entra quem você criar.
4. **Seu usuário**: *Authentication → Users → Add user*. O primeiro usuário cria a casa, as categorias e vira admin.
   - **Outras pessoas da casa só entram com convite.** Antes de criar o usuário delas, rode no SQL Editor: `insert into convite (email, nome) values ('pessoa@exemplo.com', 'Ana');`. Quem não foi convidado até consegue ter uma conta, mas não vê nada.
5. **Computador**: instale Node.js (LTS), Git e VS Code. Copie `.env.example` para `.env.local`, preencha, e rode `npm install` e `npm run dev`.
6. **Vercel**: importe o repositório, cadastre as variáveis do `.env.local` e publique.
7. **Modo demonstração (opcional)**: rode `supabase/dados-exemplo.sql` no SQL Editor para ver o sistema com dados fictícios. O fim do arquivo explica como apagar.

## Testar o banco sem medo

`npm run testar:banco` roda todas as migrações num Postgres de verdade dentro do seu computador (nada vai para a internet) e confere: primeiro acesso, convites, dados de exemplo e se alguém de fora consegue ler a sua casa (não pode). Rode sempre que você ou o seu Claude mexerem no banco.

## Personalizar

- **Nome e textos**: variáveis `NEXT_PUBLIC_NOME_SISTEMA`, `NEXT_PUBLIC_ASSINATURA`, `NEXT_PUBLIC_DESCRICAO` e `NEXT_PUBLIC_ROTULO_CASA`.
- **Cor principal**: tons `--color-militar-*` em `src/app/globals.css` (peça ao seu Claude uma escala a partir da cor que você quiser).
- **Qualquer outra coisa**: peça ao seu Claude, do seu jeito. Ele conhece este código.

## Cuidados

- `.env.local` nunca vai para o GitHub (o `.gitignore` já cuida disso). Repositório sempre privado.
- Chaves e senhas só no `.env.local` e na Vercel, nunca no chat (nem com a Lia, nem com o Claude).
- Coloque um limite mensal de gasto na API da Anthropic.
- Isto é uma ferramenta de organização, não recomendação de investimento.
