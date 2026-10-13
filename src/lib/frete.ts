export type Cotacao = {
  valorCents: number;
  prazoDias: number;
  transportadora: string;
  gratis: boolean;
  motivo?: string;
};

// shortcut: tabela de frete simulada por faixa de CEP (1º dígito) + peso por itens.
// Em produção, troque por Correios/Loggi/Jadlog — a interface Cotacao já é a do contrato.
const FAIXAS: Record<string, { valorCents: number; diasMax: number }> = {
  sudeste: { valorCents: 1990, diasMax: 4 },      // 0x, 1x
  sul: { valorCents: 2490, diasMax: 6 },          // 8x, 9x
  centro: { valorCents: 2490, diasMax: 6 },       // 2x-7x (centro-oeste/norte/nordeste simplificado)
};

export const FRETE_GRATIS_A_PARTIR_DE = 30000; // R$ 300,00

export function cotarFrete(cep: string, subtotalCents: number, totalItens = 1): Cotacao {
  const digitos = cep.replace(/\D/g, "");
  const d = digitos[0] ?? "5";
  const faixa = d === "0" || d === "1" ? FAIXAS.sudeste : d === "8" || d === "9" ? FAIXAS.sul : FAIXAS.centro;
  const acressimoPeso = Math.max(0, totalItens - 2) * 300; // R$ 3 por item acima de 2
  const base = faixa.valorCents + acressimoPeso;

  if (subtotalCents >= FRETE_GRATIS_A_PARTIR_DE) {
    return {
      valorCents: 0,
      prazoDias: faixa.diasMax,
      transportadora: "Loja Express",
      gratis: true,
      motivo: "frete grátis acima de R$ 300",
    };
  }
  return { valorCents: base, prazoDias: faixa.diasMax, transportadora: "Loja Express", gratis: false };
}
