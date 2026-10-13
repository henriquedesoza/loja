import Link from "next/link";
import { CardProduto } from "@/components/CardProduto";
import { getBrands, getCategories, listProducts, type SortKey } from "@/lib/catalog";

type Params = Record<string, string | string[] | undefined>;

type Filtros = {
  q?: string;
  categoria?: string;
  marcas: string[];
  precoMin?: number;
  precoMax?: number;
  nota?: number;
  ordem: SortKey;
  pagina: number;
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | string[] | undefined) => {
  const s = um(v)?.replace(",", ".");
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
};

function parseFiltros(sp: Params): Filtros {
  const nota = Number(um(sp.nota));
  const pagina = Number(um(sp.pagina) ?? "1");
  const ordem = um(sp.ordem) as SortKey | undefined;
  return {
    q: um(sp.q) || undefined,
    categoria: um(sp.categoria) || undefined,
    marcas: um(sp.marcas)?.split(",").filter(Boolean) ?? [],
    precoMin: num(sp.precoMin),
    precoMax: num(sp.precoMax),
    nota: [3, 4, 5].includes(nota) ? nota : undefined,
    ordem: ["relevancia", "preco-asc", "preco-desc", "avaliacao", "novidades"].includes(ordem ?? "")
      ? (ordem as SortKey)
      : "relevancia",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

function montarUrl(f: Filtros, patch: Partial<Filtros>): string {
  const j = { ...f, ...patch };
  const p = new URLSearchParams();
  if (j.q) p.set("q", j.q);
  if (j.categoria) p.set("categoria", j.categoria);
  if (j.marcas.length) p.set("marcas", j.marcas.join(","));
  if (j.precoMin) p.set("precoMin", String(j.precoMin / 100));
  if (j.precoMax) p.set("precoMax", String(j.precoMax / 100));
  if (j.nota) p.set("nota", String(j.nota));
  if (j.ordem !== "relevancia") p.set("ordem", j.ordem);
  if (j.pagina > 1) p.set("pagina", String(j.pagina));
  const s = p.toString();
  return s ? `/loja?${s}` : "/loja";
}

// rota blocking por padrão: filtros, busca e paginação dependem do request
export const instant = false;

const ORDEM: { chave: SortKey; rotulo: string }[] = [
  { chave: "relevancia", rotulo: "Mais relevantes" },
  { chave: "preco-asc", rotulo: "Menor preço" },
  { chave: "preco-desc", rotulo: "Maior preço" },
  { chave: "avaliacao", rotulo: "Melhor avaliados" },
  { chave: "novidades", rotulo: "Novidades" },
];

export default async function Catalogo({ searchParams }: { searchParams: Promise<Params> }) {
  const filtros = parseFiltros(await searchParams);
  const [resultado, categorias, marcas] = await Promise.all([
    listProducts({
      q: filtros.q,
      categorySlug: filtros.categoria,
      brandSlugs: filtros.marcas,
      minPrice: filtros.precoMin,
      maxPrice: filtros.precoMax,
      minRating: filtros.nota,
      sort: filtros.ordem,
      page: filtros.pagina,
    }),
    getCategories(),
    getBrands(),
  ]);

  const categoriaAtiva = categorias.find((c) => c.slug === filtros.categoria);
  const filhas = categorias.flatMap((c) => c.children).filter((f) => f.slug === filtros.categoria);
  const titulo = filtros.q ? `Resultados para “${filtros.q}”` : categoriaAtiva?.name ?? filhas[0]?.name ?? "Todos os produtos";

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside aria-label="Filtros" className="space-y-6 self-start rounded-lg border border-zinc-200 bg-white p-4">
        <form method="get" action="/loja" className="space-y-5">
          {filtros.q && <input type="hidden" name="q" value={filtros.q} />}
          {filtros.categoria && <input type="hidden" name="categoria" value={filtros.categoria} />}
          {filtros.ordem !== "relevancia" && <input type="hidden" name="ordem" value={filtros.ordem} />}

          <fieldset>
            <legend className="text-sm font-semibold">Marcas</legend>
            <ul className="mt-2 space-y-1">
              {marcas.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <input
                    id={`marca-${m.slug}`}
                    type="checkbox"
                    name="marcas"
                    value={m.slug}
                    defaultChecked={filtros.marcas.includes(m.slug)}
                    className="size-4 accent-emerald-800"
                  />
                  <label htmlFor={`marca-${m.slug}`} className="text-sm text-zinc-700">
                    {m.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Preço (R$)</legend>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="precoMin" className="sr-only">Preço mínimo</label>
              <input
                id="precoMin"
                type="number" min="0" step="1" name="precoMin" placeholder="mín"
                defaultValue={filtros.precoMin ? filtros.precoMin / 100 : ""}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <span aria-hidden className="text-zinc-400">–</span>
              <label htmlFor="precoMax" className="sr-only">Preço máximo</label>
              <input
                id="precoMax"
                type="number" min="0" step="1" name="precoMax" placeholder="máx"
                defaultValue={filtros.precoMax ? filtros.precoMax / 100 : ""}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Avaliação</legend>
            <ul className="mt-2 space-y-1">
              {[5, 4, 3].map((n) => (
                <li key={n} className="flex items-center gap-2">
                  <input
                    id={`nota-${n}`}
                    type="radio"
                    name="nota"
                    value={n}
                    defaultChecked={filtros.nota === n}
                    className="size-4 accent-emerald-800"
                  />
                  <label htmlFor={`nota-${n}`} className="text-sm text-zinc-700">
                    {n}★ ou mais
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900"
          >
            Aplicar filtros
          </button>
        </form>

        <nav aria-label="Categorias">
          <h2 className="text-sm font-semibold">Categorias</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link
                href={montarUrl(filtros, { categoria: undefined, pagina: 1 })}
                className={!filtros.categoria ? "font-semibold text-emerald-800" : "text-zinc-700"}
              >
                Todas
              </Link>
            </li>
            {categorias.map((c) => (
              <li key={c.id}>
                <Link
                  href={montarUrl(filtros, { categoria: c.slug, pagina: 1 })}
                  className={filtros.categoria === c.slug ? "font-semibold text-emerald-800" : "text-zinc-700"}
                >
                  {c.name}
                </Link>
                {c.children.length > 0 && (
                  <ul className="ml-3 mt-1 space-y-1">
                    {c.children.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={montarUrl(filtros, { categoria: f.slug, pagina: 1 })}
                          className={filtros.categoria === f.slug ? "font-semibold text-emerald-800" : "text-zinc-500"}
                        >
                          {f.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <section aria-label="Resultados">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {titulo}{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({resultado.total} {resultado.total === 1 ? "produto" : "produtos"})
            </span>
          </h1>
          <nav aria-label="Ordenar por" className="flex flex-wrap gap-3 text-sm">
            {ORDEM.map((o) => (
              <Link
                key={o.chave}
                href={montarUrl(filtros, { ordem: o.chave, pagina: 1 })}
                aria-current={filtros.ordem === o.chave ? "true" : undefined}
                className={filtros.ordem === o.chave ? "font-semibold text-emerald-800" : "text-zinc-600 underline"}
              >
                {o.rotulo}
              </Link>
            ))}
          </nav>
        </div>

        {resultado.items.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
            Nenhum produto encontrado. Tente outro termo ou remova alguns filtros.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {resultado.items.map((p) => (
              <li key={p.id}>
                <CardProduto p={p} />
              </li>
            ))}
          </ul>
        )}

        {resultado.pages > 1 && (
          <nav aria-label="Paginação" className="mt-6 flex items-center justify-center gap-4 text-sm">
            {filtros.pagina > 1 ? (
              <Link href={montarUrl(filtros, { pagina: filtros.pagina - 1 })} className="text-emerald-800 underline">
                ← Anterior
              </Link>
            ) : (
              <span className="text-zinc-300">← Anterior</span>
            )}
            <span className="text-zinc-600">
              Página {resultado.page} de {resultado.pages}
            </span>
            {resultado.page < resultado.pages ? (
              <Link href={montarUrl(filtros, { pagina: resultado.page + 1 })} className="text-emerald-800 underline">
                Próxima →
              </Link>
            ) : (
              <span className="text-zinc-300">Próxima →</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
