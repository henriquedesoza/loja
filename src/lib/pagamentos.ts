import { MercadoPagoConfig, Payment } from "mercadopago";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";

const MINUTO = 60 * 1000;

// sem MP_ACCESS_TOKEN o ambiente roda com gateway mock (mesma interface)
export function provedorAtivo(): "mercadopago" | "mock" {
  return process.env.MP_ACCESS_TOKEN ? "mercadopago" : "mock";
}

export type Cobranca = {
  externoId: string;
  copiaCola?: string;
  qrImagem?: string | null;
  vencimento: Date;
};

type PedidoCobranca = { id: string; codigo: string; totalCents: number; email: string };

export async function gerarCobranca(pedido: PedidoPedido, metodo: PaymentMethod): Promise<Cobranca> {
  if (provedorAtivo() === "mercadopago") {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const pagamento = await new Payment(client).create({
      body: {
        transaction_amount: pedido.totalCents / 100,
        description: `Pedido ${pedido.codigo} — loja.br`,
        external_reference: pedido.id,
        payer: { email: pedido.email },
        // cartão real exige token do CardForm do SDK JS no front: ver README (Etapa 2)
        payment_method_id: metodo === "PIX" ? "pix" : metodo === "BOLETO" ? "bolbradesco" : undefined,
        date_of_expiration: new Date(Date.now() + (metodo === "BOLETO" ? 72 : 30) * 60 * MINUTO).toISOString(),
      },
    });
    const tx = pagamento.point_of_interaction?.transaction_data;
    return {
      externoId: String(pagamento.id),
      copiaCola: tx?.qr_code,
      qrImagem: tx?.qr_code_base64,
      vencimento: pagamento.date_of_expiration ? new Date(pagamento.date_of_expiration) : new Date(Date.now() + 30 * MINUTO),
    };
  }

  // ---- mock (sandbox local) ----
  const vencimento = new Date(Date.now() + (metodo === "BOLETO" ? 72 : 30) * 60 * MINUTO);
  const externoId = `mock-${pedido.id}`;
  if (metodo === "PIX") {
    return {
      externoId,
      copiaCola: `00020101021226500014BR.GOV.BCB.PIX2528qrcode.mock.loja.br/pix/${pedido.codigo}5204581153039865802BR5925LOJA BR MARKETPLACE DEMO6009SAO PAULO62070503***6304${pedido.codigo.slice(-4)}`,
      qrImagem: null,
      vencimento,
    };
  }
  if (metodo === "BOLETO") {
    return {
      externoId,
      copiaCola: `34191.79001 01043.510047 91020.150008 9 ${String(pedido.totalCents).padStart(8, "0")}00000`,
      qrImagem: null,
      vencimento,
    };
  }
  return { externoId, vencimento };
}

// assinatura do webhook Mercado Pago: HMAC-SHA256 sobre "id:...;request-id:...;ts:..."
export async function verificarAssinatura(headers: Headers, corpo: string, dataId?: string): Promise<boolean> {
  if (provedorAtivo() === "mock") return true; // ambiente local não tem provedor real
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo) return false;

  const assinatura = headers.get("x-signature") ?? "";
  const pares = Object.fromEntries(assinatura.split(",").map((p) => p.split("=").map((s) => s.trim())));
  if (!pares.ts || !pares.v1) return false;

  const requestId = headers.get("x-request-id") ?? "";
  const manifest = `id:${dataId ?? ""};request-id:${requestId};ts:${pares.ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const hmac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(hmac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === pares.v1;
}

export function statusDoEvento(statusExterno: string): PaymentStatus {
  if (statusExterno === "approved") return "APPROVED";
  if (statusExterno === "rejected" || statusExterno === "cancelled") return "REFUSED";
  if (statusExterno === "expired") return "EXPIRED";
  return "PENDING";
}

export async function buscarPagamentoExterno(externoId: string) {
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
  const p = await new Payment(client).get({ id: externoId });
  return { statusExterno: p.status ?? "pending" };
}

type PedidoPedido = PedidoCobranca;
