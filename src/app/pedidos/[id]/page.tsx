import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotaoComprarDeNovo, BotaoCopiar, SimuladorPagamento } from "@/components/AcoesPedido";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { provedorAtivo } from "@/lib/pagamentos";
import { getUsuarioAtual } from "@/lib/session";
import { CLASSE_STATUS, ROTULO_STATUS, formatarData, formatarDataHora } from "@/lib/statusPedido";

type Params = { params: Promise<{ id: string }> };
type Search = { searchParams: Promise<{ novo?: string }> };

// rota autenticada com banco: bloqueia no servidor (padrão das rotas da Etapa 1)
export const instant = false;

async function DetalhePedido({ id, novo }: { id: string; novo: boolean }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect(`/entrar?proximo=/pedidos/${id}`);

  const pedido = await db.order.findFirst({
    where: { id, userId: usuario.id },
    include: {
      itens: true,
      eventos: { orderBy: { createdAt: "asc" } },
      pagamento: true,
    },
  });
  if (!pedido) notFound();

  const pagamento = pedido.pagamento;
  const pendente = pagamento?.status === "PENDING";
  const modoDemo = provedorAtivo() === "mock";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Pedido {pedido.codigo}{" "}
            <span
              className={`ml-2 align-middle rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSE_STATUS[pedido.status]}`}
            >
              {ROTULO_STATUS[pedido.status]}
            </span>
          </h1>
          <p className="text-sm text-zinc-500">Feito em {formatarDataHora(pedido.createdAt)}</p>
        </div>
        <Link href="/pedidos" className="text-sm text-emerald-800 underline">
          ← Meus pedidos
        </Link>
      </header>

      {novo && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900"
        >
          Pedido realizado com sucesso! Abaixo estão as instruções de pagamento.
        </p>
      )}

      {/* ---- pagamento ---- */}
      <section aria-label="Pagamento" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Pagamento</h2>
        {pagamento && (
          <p className="mt-1 text-sm text-zinc-600">
            {pagamento.metodo === "PIX" ? "Pix" : pagamento.metodo === "CARD" ? "Cartão de crédito" : "Boleto bancário"}{" "}
            · {formatBRL(pagamento.valorCents)} ·{" "}
            {pagamento.status === "APPROVED" ? (
              <span className="font-medium text-emerald-800">aprovado ✓</span>
            ) : pagamento.status === "REFUSED" ? (
              <span className="font-medium text-red-700">recusado</span>
            ) : pagamento.status === "EXPIRED" ? (
              <span className="font-medium text-zinc-600">expirado</span>
            ) : (
              <span className="font-medium text-amber-700">aguardando</span>
            )}
          </p>
        )}

        {pendente && pagamento?.metodo === "PIX" && pagamento.copiaCola && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-700">
              Pague com Pix usando o código abaixo. Vence em{" "}
              {pagamento.vencimento ? formatarDataHora(pagamento.vencimento) : "30 minutos"}.
            </p>
            <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs break-all whitespace-pre-wrap">
              {pagamento.copiaCola}
            </pre>
            <div className="flex gap-2">
              <BotaoCopiar texto={pagamento.copiaCola} rotulo="código Pix" />
            </div>
            {pagamento.qrImagem && (
              // QR vem em base64 do provedor (modo demonstração não gera imagem)
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${pagamento.qrImagem}`} alt="QR Code do Pix" className="size-40 rounded" />
            )}
          </div>
        )}

        {pendente && pagamento?.metodo === "BOLETO" && pagamento.copiaCola && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-700">
              Linha digitável — vence em{" "}
              {pagamento.vencimento ? formatarData(pagamento.vencimento) : "3 dias"}:
            </p>
            <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs break-all whitespace-pre-wrap">
              {pagamento.copiaCola}
            </pre>
            <BotaoCopiar texto={pagamento.copiaCola} rotulo="linha digitável" />
          </div>
        )}

        {pendente && pagamento?.metodo === "CARD" && (
          <p className="mt-3 text-sm text-zinc-700">
            Aguardando aprovação do cartão. Em demonstração, use o simulador abaixo.
          </p>
        )}

        {pendente && modoDemo && <div className="mt-3">{<SimuladorPagamento pedidoId={pedido.id} />}</div>}

        {!pendente && pagamento?.status === "APPROVED" && (
          <p className="mt-2 text-sm text-zinc-600">Obrigado! Já estamos preparando seu pedido.</p>
        )}
      </section>

      {/* ---- rastreio ---- */}
      <section aria-label="Rastreio" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Envio e rastreio</h2>
        {pedido.rastreio ? (
          <p className="mt-1 text-sm text-zinc-700">
            Código de rastreio: <span className="font-mono font-medium">{pedido.rastreio}</span>
          </p>
        ) : pedido.status === "CANCELLED" ? (
          <p className="mt-1 text-sm text-zinc-600">Pedido cancelado — nada foi enviado.</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">Ainda não enviado. Você recebe o código por e-mail assim que sair.</p>
        )}
      </section>

      {/* ---- presente ---- */}
      {pedido.presente && (
        <section aria-label="Presente" className="rounded-lg border border-pink-200 bg-pink-50 p-4">
          <h2 className="font-semibold text-pink-900">Compra como presente</h2>
          <p className="mt-1 text-sm text-pink-900">Enviamos sem preços na caixa.</p>
          {pedido.presenteMensagem && (
            <p className="mt-2 rounded-md bg-white p-3 text-sm italic text-zinc-700">
              “{pedido.presenteMensagem}”
            </p>
          )}
        </section>
      )}

      {/* ---- itens ---- */}
      <section aria-label="Itens do pedido" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Itens</h2>
        <ul className="mt-3 divide-y divide-zinc-100">
          {pedido.itens.map((item) => (
            <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              {item.imagemUrl && (
                <Image
                  src={item.imagemUrl}
                  alt={item.titulo}
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 shrink-0 rounded object-cover"
                />
              )}
              <div className="flex-1 text-sm">
                <p className="font-medium">{item.titulo}</p>
                <p className="text-zinc-500">
                  {item.cor} · Tam {item.tamanho} · {item.sku}
                </p>
                <p className="text-zinc-600">
                  {item.quantidade}× {formatBRL(item.precoCents)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd>{formatBRL(pedido.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-600">Frete</dt>
            <dd>{pedido.freteCents === 0 ? "grátis" : formatBRL(pedido.freteCents)}</dd>
          </div>
          {pedido.descontoCents > 0 && (
            <div className="flex justify-between text-emerald-800">
              <dt>Desconto{pedido.cupomCode ? ` (${pedido.cupomCode})` : ""}</dt>
              <dd>-{formatBRL(pedido.descontoCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(pedido.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {/* ---- endereço ---- */}
      <section aria-label="Endereço de entrega" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Endereço de entrega</h2>
        <p className="mt-1 text-sm text-zinc-700">
          {pedido.logradouro}, {pedido.numero}
          {pedido.complemento ? ` (${pedido.complemento})` : ""} — {pedido.bairro}, {pedido.cidade}/{pedido.uf} · CEP{" "}
          {pedido.cep}
        </p>
      </section>

      {/* ---- histórico ---- */}
      <section aria-label="Histórico do pedido" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Histórico</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-zinc-100 pl-4">
          {pedido.eventos.map((ev) => (
            <li key={ev.id} className="relative text-sm">
              <span
                aria-hidden
                className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-emerald-700"
              />
              <p className="font-medium">{ROTULO_STATUS[ev.status]}</p>
              {ev.nota && <p className="text-zinc-600">{ev.nota}</p>}
              <p className="text-xs text-zinc-400">{formatarDataHora(ev.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <BotaoComprarDeNovo pedidoId={pedido.id} />
        <Link
          href="/loja"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Continuar comprando
        </Link>
      </div>
    </div>
  );
}

// params/searchParams e a consulta são request data: com instant=false a rota bloqueia no servidor
export default async function PaginaPedido({ params, searchParams }: Params & Search) {
  const { id } = await params;
  const { novo } = await searchParams;
  return <DetalhePedido id={id} novo={novo === "1"} />;
}
