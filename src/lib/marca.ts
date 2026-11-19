// Nome e identidade do SEU sistema. Troque pelas variáveis na Vercel (e no .env.local):
//   NEXT_PUBLIC_NOME_SISTEMA   ex: "Contas da Casa"
//   NEXT_PUBLIC_ASSINATURA     linha pequena embaixo do nome, ex: "controle financeiro"
//   NEXT_PUBLIC_DESCRICAO      frase curta usada no navegador
// Sem variáveis, vale o arquivo src/lib/meu-sistema.ts (missão 6).
// A cor principal fica em src/app/globals.css (tokens --color-militar-*).
import { MEU_SISTEMA } from './meu-sistema'

const nome = (process.env.NEXT_PUBLIC_NOME_SISTEMA ?? '').replace(/["']/g, '').trim() || MEU_SISTEMA.nome

export const MARCA = {
  nome,
  /** Letra do ícone: a primeira letra do nome. */
  inicial: nome.charAt(0).toUpperCase(),
  assinatura: (process.env.NEXT_PUBLIC_ASSINATURA ?? '').trim() || MEU_SISTEMA.assinatura,
  titulo: nome,
  descricao: (process.env.NEXT_PUBLIC_DESCRICAO ?? '').trim() || MEU_SISTEMA.descricao,
}

/** Tela inicial: a Visão geral. */
export const INICIO = '/'
