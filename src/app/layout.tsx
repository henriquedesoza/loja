import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SearchBox } from "@/components/SearchBox";
import { BotaoCarrinho } from "@/components/BotaoCarrinho";
import { CarrinhoProvider } from "@/lib/carrinho";
import { getUsuarioAtual } from "@/lib/session";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Loja — marketplace brasileiro", template: "%s | Loja" },
  description: "Marketplace brasileiro com frete rápido, Pix e parcelamento sem juros.",
};

// lê a sessão (headers) — por isso fica atrás de Suspense no layout
async function Conta() {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return (
      <>
        <Link href="/entrar" className="text-zinc-700 hover:text-emerald-800">
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="rounded-md bg-emerald-800 px-3 py-1.5 font-medium text-white hover:bg-emerald-900"
        >
          Criar conta
        </Link>
      </>
    );
  }
  return (
    <form action="/api/sair" method="post" className="flex items-center gap-3">
      <Link href="/pedidos" className="text-zinc-700 underline hover:text-emerald-800">
        Meus pedidos
      </Link>
      <span className="text-zinc-600">
        Olá, <span className="font-medium text-zinc-900">{usuario.name.split(" ")[0]}</span>
      </span>
      <button type="submit" className="text-zinc-700 underline hover:text-emerald-800">
        Sair
      </button>
    </form>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <CarrinhoProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-emerald-800 focus:text-white focus:px-4 focus:py-2"
          >
            Pular para o conteúdo
          </a>
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
              <Link href="/" className="text-xl font-bold tracking-tight text-emerald-800">
                loja<span className="text-zinc-900">.br</span>
              </Link>
              <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
                <SearchBox />
              </div>
              <nav aria-label="Conta" className="ml-auto flex items-center gap-4 text-sm">
                <Suspense
                  fallback={<span aria-hidden className="inline-block h-8 w-32 animate-pulse rounded bg-zinc-100" />}
                >
                  <Conta />
                </Suspense>
                <BotaoCarrinho />
              </nav>
            </div>
          </header>

          <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>

          <footer className="border-t border-zinc-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-500">
              <p>Loja.br — marketplace de demonstração. Preços e produtos fictícios para teste.</p>
              <p className="mt-1">Pagamentos em ambiente sandbox. Nenhuma cobrança real é feita.</p>
            </div>
          </footer>
        </CarrinhoProvider>
      </body>
    </html>
  );
}
