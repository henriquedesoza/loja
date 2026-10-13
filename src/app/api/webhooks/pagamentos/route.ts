import { NextResponse } from "next/server";
import { registrarPagamento } from "@/lib/pedidos";
import { buscarPagamentoExterno, provedorAtivo, statusDoEvento, verificarAssinatura } from "@/lib/pagamentos";

// Webhook único: Mercado Pago (assinatura HMAC verificada) ou simulador local.
// Em produção use MP_ACCESS_TOKEN + MP_WEBHOOK_SECRET — o ramo mock fica inalcançável.
export async function POST(request: Request) {
  const corpo = await request.text();
  let body: { type?: string; data?: { id?: string; orderId?: string; status?: string } };
  try {
    body = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const dataId = body.data?.id ? String(body.data.id) : undefined;

  if (provedorAtivo() === "mercadopago") {
    if (!(await verificarAssinatura(request.headers, corpo, dataId))) {
      return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
    }
    if (body.type === "payment" && dataId) {
      const { statusExterno } = await buscarPagamentoExterno(dataId);
      await registrarPagamento({ externoId: dataId, status: statusDoEvento(statusExterno) });
    }
    return NextResponse.json({ ok: true });
  }

  // ---- modo demonstração: mesma ação do webhook, disparada pelo simulador ----
  if (body.type === "mock_pagamento" && body.data?.orderId && body.data?.status) {
    await registrarPagamento({ orderId: String(body.data.orderId), status: statusDoEvento(String(body.data.status)) });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erro: "evento não reconhecido" }, { status: 400 });
}
