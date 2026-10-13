import type { Coupon } from "@prisma/client";
import { db } from "@/lib/db";

export class ErroCupom extends Error {}

export type Desconto = {
  code: string;
  descontoCents: number;
  freteGratis: boolean;
  descricao: string;
};

// cupom: PERCENTUAL (valorCents em bps, 1000 = 10%), FIXO (centavos) ou FRETE_GRATIS
export async function aplicarCupom(code: string, subtotalCents: number): Promise<Desconto> {
  const cupom = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!cupom || !cupom.ativo) throw new ErroCupom("Cupom não encontrado.");
  if (cupom.validade && cupom.validade < new Date()) throw new ErroCupom("Cupom expirado.");
  if (cupom.maxUsos != null && cupom.usos >= cupom.maxUsos) throw new ErroCupom("Cupom esgotado.");
  if (subtotalCents < cupom.minimoCents) {
    throw new ErroCupom(`Pedido mínimo de ${(cupom.minimoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para este cupom.`);
  }

  const desconto =
    cupom.tipo === "PERCENTUAL" ? Math.round((subtotalCents * cupom.valorCents) / 10000)
    : cupom.tipo === "FIXO" ? Math.min(cupom.valorCents, subtotalCents)
    : 0;

  return {
    code: cupom.code,
    descontoCents: desconto,
    freteGratis: cupom.tipo === "FRETE_GRATIS",
    descricao: cupom.descricao,
  };
}

export type { Coupon };
