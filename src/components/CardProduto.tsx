import Link from "next/link";
import { Estrelas } from "@/components/Estrelas";
import { formatBRL, parcelamento } from "@/lib/money";
import type { ProductCard } from "@/lib/catalog";

// SVGs locais: <img> puro (sem otimizador) — evita config extra e mantém CLS zero com width/height
export function CardProduto({ p }: { p: ProductCard }) {
  const { parcelas, valorParcelaCents } = parcelamento(p.priceCents);
  return (
    <Link
      href={`/produto/${p.slug}`}
      className="group flex flex-col rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-emerald-600"
    >
      {p.images[0] ? (
        <img
          src={p.images[0].url}
          alt={p.images[0].alt || p.title}
          width={400}
          height={400}
          loading="lazy"
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div aria-hidden className="aspect-square w-full rounded bg-zinc-100" />
      )}
      <p className="mt-3 text-xs text-zinc-500">{p.brand.name}</p>
      <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{p.title}</h3>
      {p.ratingCount > 0 && (
        <div className="mt-1">
          <Estrelas nota={p.ratingAvg} total={p.ratingCount} />
        </div>
      )}
      <p className="mt-2 text-lg font-semibold text-zinc-900">{formatBRL(p.priceCents)}</p>
      <p className="text-xs text-zinc-500">
        em até {parcelas}x de {formatBRL(valorParcelaCents)} sem juros
      </p>
    </Link>
  );
}
