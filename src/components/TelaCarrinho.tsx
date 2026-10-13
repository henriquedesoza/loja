"use client";

import Image from "next/image";
import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { formatBRL } from "@/lib/money";

export function TelaCarrinho() {
  const { itens, carregado, subtotalCents, definirQuantidade, remover } = useCarrinho();

  if (!carregado) {
    return <div aria-hidden className="h-64 animate-pulse rounded-lg bg-zinc-200" />;
  }

  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold">Seu carrinho está vazio</h1>
        <p className="mt-1 text-zinc-600">Que tal começar pelo catálogo?</p>
        <Link
          href="/loja"
          className="mt-4 inline-block rounded-md bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section aria-label="Itens do carrinho">
        <h1 className="text-lg font-semibold">
          Carrinho ({itens.length} {itens.length === 1 ? "item" : "itens"})
        </h1>
        <ul className="mt-3 space-y-3">
          {itens.map((item) => (
            <li key={item.variantId} className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4">
              <Link href={`/produto/${item.slug}`} className="shrink-0">
                {item.imagemUrl && (
                  <Image src={item.imagemUrl} alt={item.titulo} width={96} height={96} className="rounded object-cover" unoptimized />
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link href={`/produto/${item.slug}`} className="font-medium hover:text-emerald-800">
                      {item.titulo}
                    </Link>
                    <p className="text-sm text-zinc-500">
                      {item.cor} · Tam {item.tamanho} · {item.sku}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-semibold">{formatBRL(item.precoCents * item.quantidade)}</p>
                </div>
                <div className="mt-auto flex items-center gap-3 pt-3">
                  <label htmlFor={`qtd-${item.variantId}`} className="text-sm text-zinc-600">
                    Qtd:
                  </label>
                  <select
                    id={`qtd-${item.variantId}`}
                    value={item.quantidade}
                    onChange={(e) => definirQuantidade(item.variantId, Number(e.target.value))}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  >
                    {Array.from({ length: Math.max(1, Math.min(item.estoque, 10)) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {item.quantidade >= item.estoque && item.estoque <= 5 && (
                    <span className="text-xs text-orange-700">últimas unidades</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remover(item.variantId)}
                    className="ml-auto text-sm text-zinc-500 underline hover:text-red-700"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-label="Resumo do pedido" className="self-start rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Resumo</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd className="font-medium">{formatBRL(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-600">Frete</dt>
            <dd className="text-zinc-500">calculado no checkout</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">Pix com 5% de desconto · cartão em até 6x sem juros</p>
        <Link
          href="/checkout"
          className="mt-4 block rounded-md bg-emerald-800 px-4 py-3 text-center font-medium text-white hover:bg-emerald-900"
        >
          Ir para o checkout
        </Link>
      </aside>
    </div>
  );
}
