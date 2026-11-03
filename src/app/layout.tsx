import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "./nav";
import { FaixaVisao } from "@/components/faixa-visao";
import { createClient } from "@/lib/supabase/server";
import { obterVisao } from "@/lib/pessoa";
import { primeiroNome, ROTULO_JUNTOS } from "@/lib/donos";
import { Assistente } from "@/components/assistente";
import { AvisoBiometria } from "@/components/aviso-biometria";
import { cookies } from "next/headers";
import { COOKIE_PERIODO } from "@/lib/periodo";
import { SCRIPT_MASCARA } from "@/lib/mascara-valores";
import { MARCA } from "@/lib/marca";
import "./globals.css";

// Fonte do app: Plus Jakarta Sans (moderna, boa leitura de números com tabular-nums)
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: MARCA.titulo,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  description: MARCA.descricao,
  icons: { icon: '/icone.svg', apple: '/icone.svg' },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Seletor global de pessoa no menu: só quando há sessão (na tela de login a lista vem vazia).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const visao = user ? await obterVisao(supabase) : null;
  const opcoesPessoa = visao
    ? [{ valor: "todos", rotulo: ROTULO_JUNTOS }, ...visao.membros.map((m) => ({ valor: m.id, rotulo: primeiroNome(m.nome) }))]
    : [];
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, pra não piscar claro→escuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tema');var e=t?t==='escuro':window.matchMedia('(prefers-color-scheme: dark)').matches;if(e)document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
        {/* Olho de ocultar valores: marca e borra os números do sistema todo, antes de pintar. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MASCARA }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--fundo-pagina)] md:flex-row">
        <Nav opcoesPessoa={opcoesPessoa} pessoaAtual={visao?.pessoa ?? "todos"} />
        <div className="min-w-0 flex-1">
          {user && (
            <FaixaVisao
              opcoes={opcoesPessoa}
              atual={visao?.pessoa ?? "todos"}
              periodo={(await cookies()).get(COOKIE_PERIODO)?.value ?? "tudo"}
            />
          )}
          {user && <AvisoBiometria />}
          {children}
        </div>
        {user && <Assistente visao={visao?.nomePessoa ?? ROTULO_JUNTOS} />}
      </body>
    </html>
  );
}
