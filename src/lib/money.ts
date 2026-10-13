export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const PARCELA_MINIMA_CENTS = 3000; // R$ 30,00
export const MAX_PARCELAS = 6; // sem juros

export type Parcelamento = {
  parcelas: number;
  valorParcelaCents: number;
  totalCents: number;
};

// regra da loja: até 6x sem juros, parcela mínima R$ 30
export function parcelamento(precoCents: number): Parcelamento {
  const parcelas = Math.max(1, Math.min(MAX_PARCELAS, Math.floor(precoCents / PARCELA_MINIMA_CENTS)));
  const valorParcelaCents = Math.round(precoCents / parcelas);
  return { parcelas, valorParcelaCents, totalCents: precoCents };
}
