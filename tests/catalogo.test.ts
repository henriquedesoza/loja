import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  autocomplete,
  getCategories,
  getProductBySlug,
  getRelatedProducts,
  getSeller,
  listProducts,
  searchProductIds,
} from "@/lib/catalog";

const db = new PrismaClient();
const TENIS = "tenis-de-corrida-aurora-velocity-3";

beforeAll(async () => {
  expect(await db.product.count(), "rode `npm run db:seed` antes dos testes").toBeGreaterThan(0);
});

describe("catálogo: filtros", () => {
  it("categoria pai inclui produtos das subcategorias", () => {
    const todas = listProducts({ categorySlug: "moda", pageSize: 100 });
    const calcados = listProducts({ categorySlug: "calcados", pageSize: 100 });
    return Promise.all([todas, calcados]).then(([m, c]) => {
      expect(m.total).toBeGreaterThan(c.total);
      expect(c.items.some((p) => p.slug === TENIS)).toBe(true);
    });
  });

  it("filtra por marca", async () => {
    const r = await listProducts({ brandSlugs: ["botica-verde"], pageSize: 100 });
    expect(r.total).toBeGreaterThan(3);
  });

  it("filtra por faixa de preço", async () => {
    const r = await listProducts({ minPrice: 10000, maxPrice: 20000, pageSize: 100 });
    expect(r.total).toBeGreaterThan(0);
    for (const p of r.items) expect(p.priceCents).toBeGreaterThanOrEqual(10000);
  });

  it("filtra por avaliação mínima", async () => {
    const r = await listProducts({ minRating: 4, pageSize: 100 });
    for (const p of r.items) expect(p.ratingAvg).toBeGreaterThanOrEqual(4);
  });

  it("ordena por preço asc e desc", async () => {
    const asc = await listProducts({ sort: "preco-asc", pageSize: 10 });
    const desc = await listProducts({ sort: "preco-desc", pageSize: 10 });
    const precosAsc = asc.items.map((p) => p.priceCents);
    expect([...precosAsc].sort((a, b) => a - b)).toEqual(precosAsc);
    expect(desc.items[0].priceCents).toBeGreaterThanOrEqual(asc.items[0].priceCents);
  });

  it("pagina sem duplicar nem perder itens", async () => {
    const p1 = await listProducts({ page: 1, pageSize: 5 });
    const p2 = await listProducts({ page: 2, pageSize: 5 });
    const ids = new Set([...p1.items, ...p2.items].map((p) => p.id));
    expect(ids.size).toBe(10);
    expect(p1.total).toBe(p2.total);
  });
});

describe("busca (FTS + trigram)", () => {
  it("encontra produtos sem depender de acento ou caixa", async () => {
    const ids = await searchProductIds("aurora");
    expect(ids.length).toBeGreaterThan(3);
    const r = await listProducts({ q: "AURORA", pageSize: 100 });
    expect(r.items.some((p) => p.slug === TENIS)).toBe(true);
  });

  it("busca por termo sem resultado retorna vazio", async () => {
    expect(await searchProductIds("xyzabc-inexistente")).toEqual([]);
    const r = await listProducts({ q: "xyzabc-inexistente" });
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("autocomplete sugere a partir de 2 letras e limita a 8", async () => {
    expect(await autocomplete("a")).toEqual([]);
    const r = await autocomplete("aurora");
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(8);
  });
});

describe("produto, relacionados e vendedor", () => {
  it("detalhe traz imagens, variações, avaliações e perguntas", async () => {
    const p = await getProductBySlug(TENIS);
    expect(p).not.toBeNull();
    expect(p!.images.length).toBe(3);
    expect(p!.variants.length).toBeGreaterThan(5);
    expect(p!.reviews.length).toBeGreaterThan(0);
    expect(p!.seller.sellerSlug).toBeTruthy();
  });

  it("recomendações não incluem o próprio produto", async () => {
    const p = await getProductBySlug(TENIS);
    const rel = await getRelatedProducts(p!);
    expect(rel.length).toBeGreaterThan(0);
    expect(rel.some((r) => r.id === p!.id)).toBe(false);
  });

  it("página de vendedor filtra os produtos dele", async () => {
    const v = await getSeller("aurora-sport");
    expect(v).not.toBeNull();
    const r = await listProducts({ sellerSlug: "aurora-sport", pageSize: 100 });
    expect(r.total).toBeGreaterThan(0);
  });

  it("categoria raiz tem filhas no seed", async () => {
    const cats = await getCategories();
    expect(cats.length).toBeGreaterThan(3);
    expect(cats.every((c) => c.children.length > 0)).toBe(true);
  });
});
