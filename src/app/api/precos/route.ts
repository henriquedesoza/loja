import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// preços do carrinho sempre revalidados no servidor (nunca confiar no localStorage)
export async function POST(request: Request) {
  const body = (await request.json()) as { variantIds?: string[] };
  const ids = (body.variantIds ?? []).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ itens: [] });

  const variantes = await db.productVariant.findMany({
    where: { id: { in: ids }, isActive: true },
    include: {
      product: {
        select: { title: true, slug: true, priceCents: true, images: { take: 1, orderBy: { position: "asc" as const } } },
      },
    },
  });

  return NextResponse.json({
    itens: variantes.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      titulo: v.product.title,
      slug: v.product.slug,
      cor: v.color,
      tamanho: v.size,
      precoCents: v.priceCents ?? v.product.priceCents,
      estoque: v.stock,
      imagemUrl: v.product.images[0]?.url ?? null,
    })),
  });
}
