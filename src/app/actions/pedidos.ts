"use server";

import { revalidatePath } from "next/cache";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ErroCupom, aplicarCupom } from "@/lib/cupom";
import { cotarFrete } from "@/lib/frete";
import { criarPedido, registrarPagamento } from "@/lib/pedidos";
import { provedorAtivo } from "@/lib/pagamentos";
import { getUsuarioAtual } from "@/lib/session";

async function exigirUsuario() {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Sessão expirada. Entre novamente.");
  return usuario;
}

export async function criarEndereco(dados: {
  apelido: string; cep: string; logradouro: string; numero: string;
  complemento?: string; bairro: string; cidade: string; uf: string;
}) {
  const usuario = await exigirUsuario();
  const cep = dados.cep.replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP deve ter 8 dígitos.");
  if (dados.uf.length !== 2) throw new Error("UF deve ter 2 letras.");

  const existe = await db.address.findFirst({ where: { userId: usuario.id } });
  const endereco = await db.address.create({
    data: { ...dados, cep, complemento: dados.complemento || null, userId: usuario.id, padrao: !existe },
  });
  return { id: endereco.id };
}

export async function validarCupom(codigo: string, subtotalCents: number) {
  try {
    const d = await aplicarCupom(codigo, subtotalCents);
    return { ok: true as const, desconto: d };
  } catch (e) {
    if (e instanceof ErroCupom) return { ok: false as const, erro: e.message };
    throw e;
  }
}

export async function cotarFreteCep(cep: string, subtotalCents: number, totalItens: number) {
  return cotarFrete(cep, subtotalCents, totalItens);
}

export async function finalizarCompra(input: {
  itens: { variantId: string; quantidade: number }[];
  addressId: string;
  cupomCode?: string;
  presente: boolean;
  presenteMensagem?: string;
  metodo: PaymentMethod;
}) {
  const usuario = await exigirUsuario();
  try {
    const pedido = await criarPedido({
      userId: usuario.id,
      email: usuario.email,
      itens: input.itens,
      addressId: input.addressId,
      cupomCode: input.cupomCode?.trim() || undefined,
      presente: input.presente,
      presenteMensagem: input.presenteMensagem,
      metodo: input.metodo,
    });
    revalidatePath("/pedidos");
    return { ok: true as const, pedidoId: pedido.id, codigo: pedido.codigo };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Não foi possível concluir o pedido." };
  }
}

export async function comprarDeNovo(pedidoId: string) {
  const usuario = await exigirUsuario();
  const pedido = await db.order.findFirst({
    where: { id: pedidoId, userId: usuario.id },
    include: { itens: true },
  });
  if (!pedido) throw new Error("Pedido não encontrado.");
  const variantes = await db.productVariant.findMany({
    where: { id: { in: pedido.itens.map((i) => i.variantId) }, isActive: true, stock: { gt: 0 } },
    include: {
      product: {
        select: { title: true, slug: true, priceCents: true, images: { take: 1, orderBy: { position: "asc" as const } } },
      },
    },
  });
  return {
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
      quantidade: pedido.itens.find((i) => i.variantId === v.id)?.quantidade ?? 1,
    })),
  };
}

// simulador do fluxo de webhook — só existe quando não há provedor real configurado
export async function simularPagamento(pedidoId: string, acao: "aprovar" | "recusar" | "expirar") {
  if (provedorAtivo() !== "mock") throw new Error("Disponível apenas no ambiente de demonstração.");
  const usuario = await exigirUsuario();
  const pedido = await db.order.findFirst({ where: { id: pedidoId, userId: usuario.id } });
  if (!pedido) throw new Error("Pedido não encontrado.");

  const status: PaymentStatus = acao === "aprovar" ? "APPROVED" : acao === "recusar" ? "REFUSED" : "EXPIRED";
  await registrarPagamento({ orderId: pedido.id, status });
  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true as const };
}
