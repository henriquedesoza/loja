import { redirect } from "next/navigation";
import { FluxoCheckout } from "@/components/FluxoCheckout";
import { db } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/session";

export const metadata = { title: "Checkout" };

// rota autenticada com banco: bloqueia no servidor (padrão das rotas da Etapa 1)
export const instant = false;

export default async function Checkout() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/entrar?proximo=/checkout");

  const enderecos = await db.address.findMany({
    where: { userId: usuario.id },
    orderBy: [{ padrao: "desc" }, { createdAt: "asc" }],
  });

  return <FluxoCheckout enderecos={enderecos} />;
}
