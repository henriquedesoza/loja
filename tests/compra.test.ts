import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ErroCupom, aplicarCupom } from "@/lib/cupom";
import { cotarFrete } from "@/lib/frete";
import { criarPedido, registrarPagamento } from "@/lib/pedidos";

const TENIS = "tenis-de-corrida-aurora-velocity-3";
const CRIADOS: string[] = [];

let comprador: { id: string; email: string };
let endereco: { id: string; cep: string };
let variante: { id: string; stock: number; priceCents: number | null };
let produto: { priceCents: number; title: string; sellerId: string };

beforeAll(async () => {
  expect(await db.product.count(), "rode `npm run db:seed` antes dos testes").toBeGreaterThan(0);

  const user = await db.user.findUnique({ where: { email: "comprador1@loja.dev" }, select: { id: true, email: true } });
  expect(user, "conta comprador1@loja.dev não existe — rode `npm run db:seed`").toBeTruthy();
  comprador = user!;

  const addr = await db.address.findFirst({ where: { userId: comprador.id } });
  expect(addr, "endereço do seed não existe — rode `npm run db:seed`").toBeTruthy();
  endereco = { id: addr!.id, cep: addr!.cep };

  const prod = await db.product.findUniqueOrThrow({
    where: { slug: TENIS },
    include: { variants: { where: { isActive: true }, take: 1 } },
  });
  produto = { priceCents: prod.priceCents, title: prod.title, sellerId: prod.sellerId };
  variante = {
    id: prod.variants[0].id,
    stock: prod.variants[0].stock,
    priceCents: prod.variants[0].priceCents,
  };
});

afterAll(async () => {
  // remove pedidos de teste (itens/eventos/pagamento caem em cascata)
  await db.order.deleteMany({ where: { id: { in: CRIADOS } } });
  await db.$disconnect();
});

describe("frete por CEP", () => {
  it("tabela por região e frete grátis acima do limite", () => {
    expect(cotarFrete("01310-100", 10000, 1).valorCents).toBe(1990); // Sudeste
    expect(cotarFrete("90000-000", 10000, 1).valorCents).toBe(2490); // Sul
    expect(cotarFrete("60000-000", 10000, 1).valorCents).toBe(2490); // demais regiões
    const gratis = cotarFrete("01310-100", 30000, 1);
    expect(gratis.valorCents).toBe(0);
    expect(gratis.gratis).toBe(true);
    // peso: mais itens = frete mais caro (abaixo do limite de grátis)
    expect(cotarFrete("01310-100", 10000, 5).valorCents).toBe(1990 + 3 * 300);
  });
});

describe("cupons", () => {
  it("percentual com mínimo", async () => {
    const d = await aplicarCupom("bemvindo10", 20000); // case-insensitive
    expect(d.code).toBe("BEMVINDO10");
    expect(d.descontoCents).toBe(2000);
  });

  it("rejeita abaixo do mínimo, expirado e inexistente", async () => {
    await expect(aplicarCupom("BEMVINDO10", 5000)).rejects.toBeInstanceOf(ErroCupom);
    await expect(aplicarCupom("NAOEXISTE", 20000)).rejects.toBeInstanceOf(ErroCupom);
  });

  it("frete grátis zera o valor do frete", async () => {
    const d = await aplicarCupom("FRETEGRATIS", 20000);
    expect(d.freteGratis).toBe(true);
    expect(d.descontoCents).toBe(0);
  });
});

describe("fluxo de compra", () => {
  it("cria pedido Pix com cupom, baixa estoque e aprova via webhook", async () => {
    const preco = variante.priceCents ?? produto.priceCents;
    const estoqueAntes = (await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock;

    const pedido = await criarPedido({
      userId: comprador.id,
      email: comprador.email,
      itens: [{ variantId: variante.id, quantidade: 1 }],
      addressId: endereco.id,
      cupomCode: "BEMVINDO10",
      presente: true,
      presenteMensagem: "Parabéns!",
      metodo: "PIX",
    });
    CRIADOS.push(pedido.id);

    const freteEsperado = cotarFrete(endereco.cep, preco, 1).valorCents;
    const descontoEsperado = Math.round(preco * 0.1) + Math.round(preco * 0.05); // cupom 10% + Pix 5%
    expect(pedido.subtotalCents).toBe(preco);
    expect(pedido.freteCents).toBe(freteEsperado);
    expect(pedido.descontoCents).toBe(descontoEsperado);
    expect(pedido.totalCents).toBe(preco - descontoEsperado + freteEsperado);

    // snapshot e vendedor
    expect(pedido.itens).toHaveLength(1);
    expect(pedido.itens[0].titulo).toBe(produto.title);
    expect(pedido.itens[0].sellerId).toBe(produto.sellerId);
    expect(pedido.presente).toBe(true);

    // estoque baixado e cupom contabilizado
    const estoqueDepois = (await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock;
    expect(estoqueDepois).toBe(estoqueAntes - 1);
    const cupom = await db.coupon.findUniqueOrThrow({ where: { code: "BEMVINDO10" } });
    expect(cupom.usos).toBeGreaterThanOrEqual(1);

    // cobrança mock gerada (Pix copia-e-cola com validade)
    expect(pedido.pagamento?.status).toBe("PENDING");
    expect(pedido.pagamento?.metodo).toBe("PIX");
    expect(pedido.pagamento?.copiaCola).toBeTruthy();
    expect(pedido.pagamento?.vencimento?.getTime()).toBeGreaterThan(Date.now());

    // webhook aprova → pedido PAIDO (idempotente: segunda chamada não duplica evento)
    await registrarPagamento({ orderId: pedido.id, status: "APPROVED" });
    await registrarPagamento({ orderId: pedido.id, status: "APPROVED" });
    const pago = await db.order.findUniqueOrThrow({ where: { id: pedido.id }, include: { eventos: true, pagamento: true } });
    expect(pago.status).toBe("PAID");
    expect(pago.pagamento?.status).toBe("APPROVED");
    expect(pago.eventos.filter((e) => e.status === "PAID")).toHaveLength(1);
  });

  it("recusa de pagamento mantém o pedido pendente para tentar de novo", async () => {
    const pedido = await criarPedido({
      userId: comprador.id,
      email: comprador.email,
      itens: [{ variantId: variante.id, quantidade: 1 }],
      addressId: endereco.id,
      metodo: "CARD",
      presente: false,
    });
    CRIADOS.push(pedido.id);

    await registrarPagamento({ orderId: pedido.id, status: "REFUSED" });
    const recusado = await db.order.findUniqueOrThrow({ where: { id: pedido.id }, include: { pagamento: true } });
    expect(recusado.pagamento?.status).toBe("REFUSED");
    expect(recusado.status).toBe("PENDING");
  });

  it("expiração devolve o estoque e cancela o pedido", async () => {
    const estoqueAntes = (await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock;
    const pedido = await criarPedido({
      userId: comprador.id,
      email: comprador.email,
      itens: [{ variantId: variante.id, quantidade: 2 }],
      addressId: endereco.id,
      metodo: "BOLETO",
      presente: false,
    });
    CRIADOS.push(pedido.id);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock).toBe(estoqueAntes - 2);

    await registrarPagamento({ orderId: pedido.id, status: "EXPIRED" });
    const cancelado = await db.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(cancelado.status).toBe("CANCELLED");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock).toBe(estoqueAntes);
  });

  it("recusa estoque insuficiente sem criar pedido", async () => {
    const atual = (await db.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock;
    await expect(
      criarPedido({
        userId: comprador.id,
        email: comprador.email,
        itens: [{ variantId: variante.id, quantidade: atual + 99 }],
        addressId: endereco.id,
        metodo: "PIX",
        presente: false,
      })
    ).rejects.toThrow(/Estoque insuficiente/);
  });

  it("endereço de outro usuário é rejeitado", async () => {
    const outro = await db.user.findFirst({ where: { email: "comprador2@loja.dev" } });
    await expect(
      criarPedido({
        userId: outro!.id,
        email: outro!.email,
        itens: [{ variantId: variante.id, quantidade: 1 }],
        addressId: endereco.id, // pertence ao comprador1
        metodo: "PIX",
        presente: false,
      })
    ).rejects.toThrow(/Endereço/);
  });
});
