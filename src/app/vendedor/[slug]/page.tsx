import { notFound } from "next/navigation";
import { CardProduto } from "@/components/CardProduto";
import { listProducts, getSeller } from "@/lib/catalog";

export const instant = false;

export default async function Vendedor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendedor = await getSeller(slug);
  if (!vendedor) notFound();

  const produtos = await listProducts({ sellerSlug: slug, sort: "avaliacao", pageSize: 24 });

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">{vendedor.name}</h1>
        {vendedor.sellerBio && <p className="mt-2 max-w-2xl text-zinc-700">{vendedor.sellerBio}</p>}
        <p className="mt-2 text-sm text-zinc-500">
          {produtos.total} {produtos.total === 1 ? "produto anunciado" : "produtos anunciados"}
        </p>
      </header>

      <section aria-label={`Produtos de ${vendedor.name}`}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.items.map((p) => (
            <li key={p.id}>
              <CardProduto p={p} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
