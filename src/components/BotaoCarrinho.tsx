"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";

export function BotaoCarrinho() {
  const { totalItens, carregado } = useCarrinho();
  return (
    <Link
      href="/carrinho"
      aria-label={`Carrinho de compras, ${totalItens} ${totalItens === 1 ? "item" : "itens"}`}
      className="relative inline-flex items-center rounded-md border border-zinc-300 px-2.5 py-1.5 text-zinc-700 hover:border-emerald-600"
    >
      <span aria-hidden className="text-lg leading-none">🛒</span>
      {carregado && totalItens > 0 && (
        <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-emerald-800 text-xs font-semibold text-white">
          {totalItens}
        </span>
      )}
    </Link>
  );
}
