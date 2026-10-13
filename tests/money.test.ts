import { describe, expect, it } from "vitest";
import { formatBRL, parcelamento } from "@/lib/money";

// o ICU do Node separa "R$" do valor com espaço não separável (U+00A0)
const NBSP = "\u00A0";

describe("formatBRL", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(formatBRL(34990)).toBe(`R$${NBSP}349,90`);
    expect(formatBRL(0)).toBe(`R$${NBSP}0,00`);
    expect(formatBRL(1234567)).toBe(`R$${NBSP}12.345,67`);
  });
});

describe("parcelamento", () => {
  it("parcela em até 6x sem juros respeitando a parcela mínima de R$ 30", () => {
    expect(parcelamento(18000)).toEqual({ parcelas: 6, valorParcelaCents: 3000, totalCents: 18000 });
    expect(parcelamento(34990)).toEqual({ parcelas: 6, valorParcelaCents: 5832, totalCents: 34990 });
  });

  it("produto barato vira 1x (abaixo da parcela mínima)", () => {
    expect(parcelamento(2999)).toEqual({ parcelas: 1, valorParcelaCents: 2999, totalCents: 2999 });
  });

  it("o total nunca muda com o parcelamento (sem juros)", () => {
    const p = parcelamento(99900);
    expect(p.valorParcelaCents * p.parcelas).toBeCloseTo(99900, -1);
    expect(p.totalCents).toBe(99900);
  });
});
