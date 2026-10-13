import Link from "next/link";
import { notFound } from "next/navigation";
import { CardProduto } from "@/components/CardProduto";
import { Estrelas } from "@/components/Estrelas";
import { CalculadoraFrete, GaleriaProduto, SeletorVariacoes } from "@/components/ProdutoInterativo";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";

export const instant = false;
// nota: produto inexistente mostra a UI de 404 com status 200 (shell PPR do Next 16);
// se afetar SEO/monitoramento, resolve-se com uma checagem no proxy.ts na Etapa 2

export default async function Produto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const produto = await getProductBySlug(slug);
  if (!produto) notFound();
  const relacionados = await getRelatedProducts(produto);

  const notas = [5, 4, 3, 2, 1].map((n) => ({
    n,
    qtd: produto.reviews.filter((r) => r.rating === n).length,
  }));

  return (
    <article className="space-y-12">
      <nav aria-label="Trilha de navegação" className="text-sm text-zinc-500">
        <Link href="/loja" className="underline">Catálogo</Link>
        {" / "}
        <Link href={`/loja?categoria=${produto.category.slug}`} className="underline">
          {produto.category.name}
        </Link>
        {" / "}
        <span aria-current="page">{produto.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <GaleriaProduto imagens={produto.images} titulo={produto.title} />

        <div>
          <p className="text-sm text-zinc-500">{produto.brand.name}</p>
          <h1 className="mt-1 text-2xl font-semibold">{produto.title}</h1>
          {produto.ratingCount > 0 && (
            <div className="mt-2">
              <Estrelas nota={produto.ratingAvg} total={produto.ratingCount} />
            </div>
          )}

          <div className="mt-6">
            <SeletorVariacoes
              produto={{ priceCents: produto.priceCents, title: produto.title, slug: produto.slug }}
              variacoes={produto.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                color: v.color,
                size: v.size,
                priceCents: v.priceCents,
                stock: v.stock,
              }))}
              imagemUrl={produto.images[0]?.url ?? null}
            />
          </div>

          <div className="mt-4">
            <CalculadoraFrete subtotalCents={produto.priceCents} totalItens={1} />
          </div>

          {produto.seller.sellerSlug && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
              <p className="font-medium">Vendido por {produto.seller.name}</p>
              <p className="mt-1 line-clamp-2 text-zinc-600">{produto.seller.sellerBio}</p>
              <Link
                href={`/vendedor/${produto.seller.sellerSlug}`}
                className="mt-2 inline-block text-emerald-800 underline"
              >
                Ver página do vendedor
              </Link>
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby="desc" className="max-w-3xl">
        <h2 id="desc" className="text-lg font-semibold">
          Descrição do produto
        </h2>
        <p className="mt-2 leading-relaxed text-zinc-700">{produto.description}</p>
      </section>

      <section aria-labelledby="avaliacoes" className="max-w-3xl">
        <h2 id="avaliacoes" className="text-lg font-semibold">
          Avaliações dos compradores
        </h2>
        {produto.ratingCount === 0 ? (
          <p className="mt-2 text-zinc-600">Este produto ainda não tem avaliações.</p>
        ) : (
          <div className="mt-3 grid gap-6 sm:grid-cols-[200px_1fr]">
            <div className="self-start rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-3xl font-semibold">{produto.ratingAvg.toFixed(1).replace(".", ",")}</p>
              <Estrelas nota={produto.ratingAvg} />
              <p className="mt-1 text-sm text-zinc-500">{produto.ratingCount} avaliações</p>
              <ul className="mt-3 space-y-1 text-xs text-zinc-600">
                {notas.map(({ n, qtd }) => (
                  <li key={n} className="flex items-center gap-2">
                    <span className="w-6">{n}★</span>
                    <span aria-hidden className="h-2 flex-1 overflow-hidden rounded bg-zinc-200">
                      <span
                        className="block h-full bg-amber-500"
                        style={{ width: `${produto.ratingCount ? (qtd / produto.ratingCount) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-6 text-right">{qtd}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="space-y-4">
              {produto.reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Estrelas nota={r.rating} />
                    <span className="text-xs text-zinc-500">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")} — {r.user.name}
                    </span>
                  </div>
                  <h3 className="mt-2 font-medium">{r.title}</h3>
                  <p className="mt-1 text-sm text-zinc-700">{r.body}</p>
                  {r.photos.length > 0 && (
                    <ul className="mt-3 flex gap-2">
                      {r.photos.map((foto) => (
                        <li key={foto.url}>
                          <img
                            src={foto.url}
                            alt={`Foto enviada na avaliação de ${r.user.name}`}
                            width={80}
                            height={80}
                            loading="lazy"
                            className="rounded border border-zinc-200 object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="perguntas" className="max-w-3xl">
        <h2 id="perguntas" className="text-lg font-semibold">
          Perguntas e respostas
        </h2>
        {produto.questions.length === 0 ? (
          <p className="mt-2 text-zinc-600">Nenhuma pergunta ainda. Compre para perguntar ao vendedor.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {produto.questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="font-medium">
                  <span className="text-emerald-800">P:</span> {q.body}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {q.user.name} — {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                </p>
                {q.answers.map((a) => (
                  <div key={a.id} className="mt-3 border-l-2 border-emerald-200 pl-3">
                    <p className="text-sm text-zinc-700">
                      <span className="font-medium text-emerald-800">R:</span> {a.body}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {a.user.name} — {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {relacionados.length > 0 && (
        <section aria-labelledby="relacionados">
          <h2 id="relacionados" className="text-lg font-semibold">
            Quem comprou este também levou
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {relacionados.map((p) => (
              <li key={p.id}>
                <CardProduto p={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
