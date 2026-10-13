import type { Order, OrderItem, Pagamento, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { aplicarCupom } from "@/lib/cupom";
import { cotarFrete } from "@/lib/frete";
import { gerarCobranca, provedorAtivo } from "@/lib/pagamentos";

export type ItemCarrinhoInput = { variantId: string; quantidade: number };

export type PedidoComDetalhe = Order & {
  itens: OrderItem[];
  pagamento: Pagamento | null;
};

async function gerarCodigo(): Promise<string> {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para não confundir no suporte
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    let codigo = "LB-";
    for (let i = 0; i < 6; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    if (!(await db.order.findUnique({ where: { codigo } }))) return codigo;
  }
  throw new Error("Não foi possível gerar o código do pedido.");
}

export async function criarPedido(input: {
  userId: string;
  email: string;
  itens: ItemCarrinhoInput[];
  addressId: string;
  cupomCode?: string;
  presente: boolean;
  presenteMensagem?: string;
  metodo: PaymentMethod;
}): Promise<PedidoComDetalhe> {
  if (input.itens.length === 0) throw new Error("Seu carrinho está vazio.");

  const { pedido, pagamento } = await db.$transaction(async (tx) => {
    const variantes = await tx.productVariant.findMany({
      where: { id: { in: input.itens.map((i) => i.variantId) } },
      include: {
        product: {
          select: {
            title: true, slug: true, priceCents: true, sellerId: true,
            images: { take: 1, orderBy: { position: "asc" as const } },
          },
        },
      },
    });
    const porId = new Map(variantes.map((v) => [v.id, v]));

    for (const item of input.itens) {
      const v = porId.get(item.variantId);
      if (!v || !v.isActive) throw new Error("Um item do carrinho não está mais disponível.");
      if (v.stock < item.quantidade) {
        throw new Error(`Estoque insuficiente para ${v.product.title} (${v.color}/${v.size}).`);
      }
    }

    const endereco = await tx.address.findFirst({ where: { id: input.addressId, userId: input.userId } });
    if (!endereco) throw new Error("Endereço de entrega não encontrado.");

    const subtotal = input.itens.reduce(
      (acc, i) => acc + (porId.get(i.variantId)!.priceCents ?? porId.get(i.variantId)!.product.priceCents) * i.quantidade,
      0
    );
    const totalItens = input.itens.reduce((a, i) => a + i.quantidade, 0);

    let freteCents = cotarFrete(endereco.cep, subtotal, totalItens).valorCents;
    let descontoCents = 0;
    let cupomCode: string | null = null;
    if (input.cupomCode?.trim()) {
      const d = await aplicarCupom(input.cupomCode, subtotal);
      descontoCents = d.descontoCents;
      if (d.freteGratis) freteCents = 0;
      cupomCode = d.code;
    }
    // desconto da casa no Pix (cumulativo com cupom)
    if (input.metodo === "PIX") descontoCents += Math.round(subtotal * 0.05);
    descontoCents = Math.min(descontoCents, subtotal); // nunca zera o total
    const total = subtotal - descontoCents + freteCents;

    const codigo = await gerarCodigo();
    const pedido = await tx.order.create({
      data: {
        codigo,
        userId: input.userId,
        subtotalCents: subtotal,
        freteCents,
        descontoCents,
        totalCents: total,
        cupomCode,
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        complemento: endereco.complemento,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        presente: input.presente,
        presenteMensagem: input.presenteMensagem?.slice(0, 300) || null,
        itens: {
          create: input.itens.map((i) => {
            const v = porId.get(i.variantId)!;
            return {
              variantId: v.id,
              sku: v.sku,
              titulo: v.product.title,
              cor: v.color,
              tamanho: v.size,
              imagemUrl: v.product.images[0]?.url ?? null,
              precoCents: v.priceCents ?? v.product.priceCents,
              quantidade: i.quantidade,
              sellerId: v.product.sellerId,
            };
          }),
        },
        eventos: { create: [{ status: "PENDING", nota: "Pedido criado, aguardando pagamento" }] },
      },
    });

    // baixa de estoque (transacional: dois compradores nunca levam o mesmo item)
    for (const item of input.itens) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantidade } },
      });
    }
    if (cupomCode) {
      await tx.coupon.update({ where: { code: cupomCode }, data: { usos: { increment: 1 } } });
    }

    const pagamento = await tx.pagamento.create({
      data: { orderId: pedido.id, metodo: input.metodo, valorCents: total, provedor: provedorAtivo() },
    });
    return { pedido, pagamento };
  });

  // chamada ao provedor depois da transação (rede não deve segurar lock)
  const cobranca = await gerarCobranca(
    { id: pedido.id, codigo: pedido.codigo, totalCents: pedido.totalCents, email: input.email },
    input.metodo
  );
  await db.pagamento.update({
    where: { id: pagamento.id },
    data: {
      externoId: cobranca.externoId,
      copiaCola: cobranca.copiaCola,
      qrImagem: cobranca.qrImagem,
      vencimento: cobranca.vencimento,
    },
  });

  return buscarPedidoPorId(pedido.id);
}

export async function buscarPedidoPorId(id: string): Promise<PedidoComDetalhe> {
  return db.order.findUniqueOrThrow({ where: { id }, include: { itens: true, pagamento: true } });
}

export async function listarPedidosDoUsuario(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { itens: { take: 1 } },
  });
}

// webhook / simulador: grava o status e move o pedido no fluxo
export async function registrarPagamento(input: { externoId?: string; orderId?: string; status: PaymentStatus }) {
  const pagamento = await db.pagamento.findFirst({
    where: input.externoId ? { externoId: input.externoId } : { orderId: input.orderId },
  });
  if (!pagamento) throw new Error("Pagamento não encontrado.");

  if (pagamento.status === "APPROVED") return; // idempotente: webhook pode chegar duas vezes

  await db.$transaction(async (tx) => {
    await tx.pagamento.update({ where: { id: pagamento.id }, data: { status: input.status } });

    if (input.status === "APPROVED") {
      await tx.order.update({ where: { id: pagamento.orderId }, data: { status: "PAID" } });
      await tx.orderEvent.create({
        data: { orderId: pagamento.orderId, status: "PAID", nota: "Pagamento confirmado" },
      });
    } else if (input.status === "REFUSED") {
      await tx.orderEvent.create({
        data: { orderId: pagamento.orderId, status: "PENDING", nota: "Pagamento recusado — tente outro método" },
      });
    } else if (input.status === "EXPIRED") {
      // devolve estoque ao expirar
      const itens = await tx.orderItem.findMany({ where: { orderId: pagamento.orderId } });
      for (const item of itens) {
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantidade } } });
      }
      await tx.order.update({ where: { id: pagamento.orderId }, data: { status: "CANCELLED" } });
      await tx.orderEvent.create({
        data: { orderId: pagamento.orderId, status: "CANCELLED", nota: "Pagamento expirado — estoque devolvido" },
      });
    }
  });
}

// recompra em 1 clique: só itens cuja variação ainda existe e está ativa
export async function itensParaRecompra(orderId: string): Promise<ItemCarrinhoInput[]> {
  const pedido = await db.order.findUnique({ where: { id: orderId }, include: { itens: true } });
  if (!pedido) return [];
  const variantes = await db.productVariant.findMany({
    where: { id: { in: pedido.itens.map((i) => i.variantId) }, isActive: true },
    select: { id: true },
  });
  const disponiveis = new Set(variantes.map((v) => v.id));
  return pedido.itens
    .filter((i) => disponiveis.has(i.variantId))
    .map((i) => ({ variantId: i.variantId, quantidade: i.quantidade }));
}
