import { TelaCarrinho } from "@/components/TelaCarrinho";

export const metadata = { title: "Carrinho" };

// carrinho vive no localStorage do navegador (hóspede e logado) — o preço é revalidado no servidor no checkout
export default function Carrinho() {
  return <TelaCarrinho />;
}
