import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { CLASSE_STATUS, ROTULO_STATUS, formatarData } from "@/lib/statusPedido";
import { getUsuarioAtual } from "@/lib/session";

export const metadata = { title: "Meus pedidos" };

// rota autenticada com banco: bloqueia no servidor (padrão das rotas da Etapa 1)
export const instant = false;

export default async function PedidosPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/entrar?proximo=/pedidos");

  const pedidos = await db.order.findMany({
    where: { userId: usuario.id },
    orderBy: { createdAt: "desc" },
    include: { itens: { take: 1 }, _count: { select: { itens: true } } },
  });

  if (pedidos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold">Você ainda não fez pedidos</h1>
        <Link
          href="/loja"
          className="mt-4 inline-block rounded-md bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900"
        >
          Explorar produtos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Meus pedidos</h1>
      <ul className="mt-3 space-y-3">
        {pedidos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/pedidos/${p.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-600"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">{p.codigo}</span>
                  <span className="ml-3 text-sm text-zinc-500">{formatarData(p.createdAt)}</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSE_STATUS[p.status]}`}
                >
                  {ROTULO_STATUS[p.status]}
                </span>
              </div>
              <p className="mt-2 truncate text-sm text-zinc-600">
                {p.itens[0]?.titulo}
                {p._count.itens > 1 ? ` e mais ${p._count.itens - 1} item(ns)` : ""}
              </p>
              <p className="mt-1 font-medium">{formatBRL(p.totalCents)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
