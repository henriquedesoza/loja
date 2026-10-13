import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type SortKey = "relevancia" | "preco-asc" | "preco-desc" | "avaliacao" | "novidades";

export type CatalogFilters = {
  q?: string;
  categorySlug?: string;
  brandSlugs?: string[];
  sellerSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  /** ids retornados pelo FTS (ver searchProductIds) */
  searchIds?: string[];
};

// FTS em SQL puro: português, com websearch e rank. pg_trgm cobre o ILIKE do autocomplete.
export async function searchProductIds(q: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "isActive" = true
      AND (
        to_tsvector('portuguese', title || ' ' || description) @@ websearch_to_tsquery('portuguese', ${q})
        OR title ILIKE '%' || ${q} || '%'
      )
    ORDER BY ts_rank(
      to_tsvector('portuguese', title || ' ' || description),
      websearch_to_tsquery('portuguese', ${q})
    ) DESC
    LIMIT 100`;
  return rows.map((r) => r.id);
}

export function buildProductWhere(f: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];
  if (f.searchIds) and.push({ id: { in: f.searchIds } });
  if (f.categorySlug) {
    and.push({ category: { OR: [{ slug: f.categorySlug }, { parent: { slug: f.categorySlug } }] } });
  }
  if (f.brandSlugs?.length) and.push({ brand: { slug: { in: f.brandSlugs } } });
  if (f.sellerSlug) and.push({ seller: { sellerSlug: f.sellerSlug } });
  if (f.minPrice != null) and.push({ priceCents: { gte: f.minPrice } });
  if (f.maxPrice != null) and.push({ priceCents: { lte: f.maxPrice } });
  if (f.minRating != null) and.push({ ratingAvg: { gte: f.minRating } });
  return { AND: and };
}

const SORTS: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  relevancia: [{ ratingCount: "desc" }, { ratingAvg: "desc" }, { id: "asc" }],
  "preco-asc": [{ priceCents: "asc" }],
  "preco-desc": [{ priceCents: "desc" }],
  avaliacao: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  novidades: [{ createdAt: "desc" }],
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  priceCents: true,
  ratingAvg: true,
  ratingCount: true,
  images: { take: 1, orderBy: { position: "asc" as const } },
  brand: { select: { name: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export async function listProducts(f: CatalogFilters) {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 24;
  const termo = f.q?.trim();
  const searchIds = termo ? await searchProductIds(termo) : undefined;
  if (termo && searchIds?.length === 0) return { items: [], total: 0, page, pageSize, pages: 1 };
  const where = buildProductWhere({ ...f, searchIds });
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: SORTS[f.sort ?? "relevancia"],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: cardSelect,
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function autocomplete(q: string) {
  const termo = q.trim();
  if (termo.length < 2) return [];
  return db.product.findMany({
    where: { isActive: true, title: { contains: termo, mode: "insensitive" } },
    take: 8,
    select: {
      slug: true,
      title: true,
      priceCents: true,
      images: { take: 1, orderBy: { position: "asc" as const } },
    },
  });
}

const detailSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  priceCents: true,
  ratingAvg: true,
  ratingCount: true,
  brandId: true,
  categoryId: true,
  createdAt: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  seller: { select: { id: true, name: true, sellerSlug: true, sellerBio: true } },
  images: { orderBy: { position: "asc" as const } },
  variants: {
    where: { isActive: true },
    select: { id: true, sku: true, color: true, size: true, priceCents: true, stock: true },
  },
  reviews: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
      photos: { select: { url: true } },
    },
  },
  questions: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
      answers: {
        select: { id: true, body: true, createdAt: true, user: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetail = Prisma.ProductGetPayload<{ select: typeof detailSelect }>;

export function getProductBySlug(slug: string) {
  return db.product.findUnique({ where: { slug }, select: detailSelect });
}

// "quem comprou este também levou": mesma categoria ou mesma marca, melhor avaliados
export async function getRelatedProducts(p: { id: string; brandId: string; categoryId: string }) {
  return db.product.findMany({
    where: {
      isActive: true,
      id: { not: p.id },
      OR: [{ categoryId: p.categoryId }, { brandId: p.brandId }],
    },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 6,
    select: cardSelect,
  });
}

export async function getCategories() {
  const categorias = await db.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: { children: { orderBy: { name: "asc" } } },
  });
  return categorias;
}

export async function getBrands() {
  return db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });
}

export async function getSeller(slug: string) {
  return db.user.findUnique({
    where: { sellerSlug: slug },
    select: { id: true, name: true, sellerSlug: true, sellerBio: true, image: true },
  });
}
