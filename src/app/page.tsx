import Link from "next/link";
import { Suspense } from "react";
import { CardProduto } from "@/components/CardProduto";
import { getCategories, listProducts, type SortKey } from "@/lib/catalog";

// Cada seção consulta o banco: fica atrás de Suspense para o shell estático renderizar na hora
async function SecaoCategorias() {
  const categorias = await getCategories();
  return (
    <section aria-labelledby="cat">
      <h2 id="cat" className="text-lg font-semibold">
        Categorias
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categorias.map((c) => (
          <li key={c.id}>
            <Link
              href={`/loja?categoria=${c.slug}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium hover:border-emerald-600"
            >
              {c.name}
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                {c.children.map((f) => f.name).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SecaoProdutos({ id, titulo, ordem }: { id: string; titulo: string; ordem: SortKey }) {
  const { items } = await listProducts({ sort: ordem, pageSize: 8 });
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline justify-between">
        <h2 id={id} className="text-lg font-semibold">
          {titulo}
        </h2>
        <Link href={`/loja?ordem=${ordem}`} className="text-sm text-emerald-800 underline">
          ver todos
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <CardProduto p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const Esqueleto = () => (
  <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="h-64 animate-pulse rounded-lg bg-zinc-200" />
    ))}
  </div>
);

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-xl bg-emerald-900 px-6 py-10 text-white sm:px-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Marketplace brasileiro, do seu jeito</h1>
        <p className="mt-2 max-w-xl text-emerald-100">
          Milhares de produtos de vendedores independentes. Pix com desconto, cartão em até 6x
          sem juros e entrega para todo o Brasil.
        </p>
        <Link
          href="/loja"
          className="mt-5 inline-block rounded-md bg-white px-4 py-2 font-medium text-emerald-900 hover:bg-emerald-50"
        >
          Ver catálogo completo
        </Link>
      </section>

      <Suspense fallback={<Esqueleto />}>
        <SecaoCategorias />
      </Suspense>
      <Suspense fallback={<Esqueleto />}>
        <SecaoProdutos id="destaques" titulo="Melhor avaliados" ordem="avaliacao" />
      </Suspense>
      <Suspense fallback={<Esqueleto />}>
        <SecaoProdutos id="novidades" titulo="Novidades" ordem="novidades" />
      </Suspense>
    </div>
  );
}
