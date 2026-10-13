"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cotarFreteCep, criarEndereco, finalizarCompra, validarCupom } from "@/app/actions/pedidos";
import { useCarrinho, type ItemCarrinho } from "@/lib/carrinho";
import { formatBRL } from "@/lib/money";

type Endereco = {
  id: string; apelido: string; cep: string; logradouro: string; numero: string;
  complemento: string | null; bairro: string; cidade: string; uf: string; padrao: boolean;
};

type CotacaoResumo = { valorCents: number; prazoDias: number; gratis: boolean; motivo?: string };

export function FluxoCheckout({ enderecos }: { enderecos: Endereco[] }) {
  const router = useRouter();
  const { itens, carregado, limpar } = useCarrinho();

  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [precificados, setPrecificados] = useState<ItemCarrinho[]>([]);
  const [enderecoId, setEnderecoId] = useState(enderecos.find((e) => e.padrao)?.id ?? enderecos[0]?.id ?? "");
  const [novoAberto, setNovoAberto] = useState(enderecos.length === 0);
  const [cotacao, setCotacao] = useState<CotacaoResumo | null>(null);
  const [presente, setPresente] = useState(false);
  const [presenteMensagem, setPresenteMensagem] = useState("");
  const [cupom, setCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ code: string; descontoCents: number; freteGratis: boolean } | null>(null);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<"PIX" | "CARD" | "BOLETO">("PIX");
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // preços e estoque sempre revalidados no servidor (localStorage é só cache de exibição)
  useEffect(() => {
    if (!carregado || itens.length === 0) return;
    let cancelado = false;
    fetch("/api/precos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantIds: itens.map((i) => i.variantId) }),
    })
      .then((r) => r.json())
      .then((data: { itens: ItemCarrinho[] }) => {
        if (cancelado) return;
        const porId = new Map(data.itens.map((i) => [i.variantId, i]));
        const atualizados = itens
          .map((i) => {
            const doServidor = porId.get(i.variantId);
            return doServidor ? { ...doServidor, quantidade: Math.min(i.quantidade, doServidor.estoque) } : null;
          })
          .filter((i): i is ItemCarrinho => i !== null);
        setPrecificados(atualizados);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar os itens do carrinho.");
      });
    return () => {
      cancelado = true;
    };
  }, [carregado, itens]);

  const itensFinais = precificados.length > 0 ? precificados : itens;
  const subtotalCents = itensFinais.reduce((a, i) => a + i.precoCents * i.quantidade, 0);
  const totalItens = itensFinais.reduce((a, i) => a + i.quantidade, 0);

  // cotação de frete do endereço escolhido
  useEffect(() => {
    if (!enderecoId || etapa !== 1) return;
    const endereco = enderecos.find((e) => e.id === enderecoId);
    if (!endereco || subtotalCents === 0) return;
    let cancelado = false;
    cotarFreteCep(endereco.cep, subtotalCents, totalItens).then((c) => {
      if (!cancelado) setCotacao(c);
    });
    return () => {
      cancelado = true;
    };
  }, [enderecoId, etapa, enderecos, subtotalCents, totalItens]);

  async function aplicarCupomClique() {
    setErroCupom(null);
    const r = await validarCupom(cupom, subtotalCents);
    if (r.ok) setCupomAplicado(r.desconto);
    else {
      setCupomAplicado(null);
      setErroCupom(r.erro);
    }
  }

  const freteCents = cupomAplicado?.freteGratis ? 0 : (cotacao?.valorCents ?? 0);
  const descontoCents = Math.min(
    subtotalCents,
    (cupomAplicado?.descontoCents ?? 0) + (metodo === "PIX" ? Math.round(subtotalCents * 0.05) : 0)
  );
  const totalCents = subtotalCents - descontoCents + freteCents;

  async function finalizar() {
    setFinalizando(true);
    setErro(null);
    const r = await finalizarCompra({
      itens: itensFinais.map((i) => ({ variantId: i.variantId, quantidade: i.quantidade })),
      addressId: enderecoId,
      cupomCode: cupomAplicado?.code,
      presente,
      presenteMensagem: presente ? presenteMensagem : undefined,
      metodo,
    });
    setFinalizando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    limpar();
    router.push(`/pedidos/${r.pedidoId}?novo=1`);
  }

  if (carregado && itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold">Nada para finalizar</h1>
        <p className="mt-1 text-zinc-600">Adicione produtos ao carrinho antes de ir para o checkout.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <ol aria-label="Etapas do checkout" className="flex gap-4 text-sm">
          <li aria-current={etapa === 1 ? "step" : undefined} className={etapa === 1 ? "font-semibold text-emerald-800" : "text-zinc-500"}>
            1. Entrega
          </li>
          <li aria-current={etapa === 2 ? "step" : undefined} className={etapa === 2 ? "font-semibold text-emerald-800" : "text-zinc-500"}>
            2. Pagamento
          </li>
        </ol>

        {etapa === 1 && (
          <section className="mt-4 space-y-5" aria-label="Endereço de entrega">
            <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
              <legend className="px-1 text-sm font-semibold">Endereço de entrega</legend>
              {enderecos.length > 0 && (
                <ul className="space-y-2">
                  {enderecos.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      <input
                        id={`end-${e.id}`}
                        type="radio"
                        name="endereco"
                        checked={enderecoId === e.id}
                        onChange={() => setEnderecoId(e.id)}
                        className="mt-1 size-4 accent-emerald-800"
                      />
                      <label htmlFor={`end-${e.id}`} className="text-sm">
                        <span className="font-medium">{e.apelido}</span> — {e.logradouro}, {e.numero}
                        {e.complemento ? ` (${e.complemento})` : ""} · {e.bairro}, {e.cidade}/{e.uf} · CEP {e.cep}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setNovoAberto((v) => !v)}
                className="mt-3 text-sm text-emerald-800 underline"
              >
                {novoAberto ? "Cancelar novo endereço" : "Usar um novo endereço"}
              </button>
              {novoAberto && (
                <NovoEndereco
                  onCriar={(id) => {
                    setEnderecoId(id);
                    setNovoAberto(false);
                  }}
                />
              )}
            </fieldset>

            {cotacao && (
              <p aria-live="polite" className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                {cotacao.gratis ? (
                  <span className="font-medium text-emerald-800">Frete grátis ({cotacao.motivo})</span>
                ) : (
                  <>
                    Frete: <span className="font-medium">{formatBRL(cotacao.valorCents)}</span>
                  </>
                )}{" "}
                · entrega em até {cotacao.prazoDias} dias úteis
              </p>
            )}

            <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
              <legend className="px-1 text-sm font-semibold">É um presente?</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={presente}
                  onChange={(e) => setPresente(e.target.checked)}
                  className="size-4 accent-emerald-800"
                />
                Sim, é um presente (enviamos sem preços na caixa)
              </label>
              {presente && (
                <>
                  <label htmlFor="msg-presente" className="mt-3 block text-sm font-medium">
                    Recado (opcional)
                  </label>
                  <textarea
                    id="msg-presente"
                    value={presenteMensagem}
                    onChange={(e) => setPresenteMensagem(e.target.value.slice(0, 300))}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Escreva uma mensagem para quem vai receber"
                  />
                </>
              )}
            </fieldset>

            <button
              type="button"
              disabled={!enderecoId || !cotacao}
              onClick={() => setEtapa(2)}
              className="rounded-md bg-emerald-800 px-4 py-3 font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              Ir para pagamento
            </button>
          </section>
        )}

        {etapa === 2 && (
          <section className="mt-4 space-y-5" aria-label="Pagamento">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <label htmlFor="cupom" className="text-sm font-semibold">
                Cupom de desconto
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="cupom"
                  value={cupom}
                  onChange={(e) => setCupom(e.target.value.toUpperCase())}
                  placeholder="BEMVINDO10"
                  className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={aplicarCupomClique}
                  className="rounded-md border border-emerald-800 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Aplicar
                </button>
              </div>
              {erroCupom && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {erroCupom}
                </p>
              )}
              {cupomAplicado && (
                <p className="mt-2 text-sm text-emerald-800">
                  Cupom {cupomAplicado.code} aplicado
                  {cupomAplicado.freteGratis ? " — frete grátis" : ""}
                  {cupomAplicado.descontoCents > 0 && `: -${formatBRL(cupomAplicado.descontoCents)}`}
                </p>
              )}
            </div>

            <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
              <legend className="px-1 text-sm font-semibold">Forma de pagamento</legend>
              <ul className="space-y-2 text-sm">
                {([
                  { id: "PIX", rotulo: `Pix — 5% de desconto (${formatBRL(subtotalCents - Math.round(subtotalCents * 0.05))})` },
                  { id: "CARD", rotulo: "Cartão de crédito — até 6x sem juros" },
                  { id: "BOLETO", rotulo: "Boleto bancário — compensa em até 3 dias úteis" },
                ] as const).map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <input
                      id={`pag-${m.id}`}
                      type="radio"
                      name="metodo"
                      checked={metodo === m.id}
                      onChange={() => setMetodo(m.id)}
                      className="size-4 accent-emerald-800"
                    />
                    <label htmlFor={`pag-${m.id}`}>{m.rotulo}</label>
                  </li>
                ))}
              </ul>
              {metodo === "CARD" && (
                <div className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="card-numero" className="text-xs font-medium">
                      Número do cartão
                    </label>
                    <input
                      id="card-numero"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="5031 4332 1540 6351"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="card-nome" className="text-xs font-medium">
                      Nome impresso
                    </label>
                    <input
                      id="card-nome"
                      autoComplete="cc-name"
                      placeholder="MARIA S SILVA"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-validade" className="text-xs font-medium">
                      Validade
                    </label>
                    <input
                      id="card-validade"
                      autoComplete="cc-exp"
                      placeholder="12/30"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-cvv" className="text-xs font-medium">
                      CVV
                    </label>
                    <input
                      id="card-cvv"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 sm:col-span-2">
                    Ambiente de demonstração: os dados do cartão não são enviados nem armazenados.
                  </p>
                </div>
              )}
            </fieldset>

            {erro && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {erro}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEtapa(1)}
                className="rounded-md border border-zinc-300 px-4 py-3 font-medium text-zinc-700"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={finalizar}
                disabled={finalizando || !enderecoId}
                className="rounded-md bg-emerald-800 px-4 py-3 font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                {finalizando ? "Processando..." : `Finalizar compra — ${formatBRL(totalCents)}`}
              </button>
            </div>
          </section>
        )}
      </div>

      <aside aria-label="Resumo do pedido" className="self-start rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Resumo</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {itensFinais.map((i) => (
            <li key={i.variantId} className="flex justify-between gap-2">
              <span className="text-zinc-600">
                {i.quantidade}× {i.titulo} ({i.tamanho})
              </span>
              <span>{formatBRL(i.precoCents * i.quantidade)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd>{formatBRL(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-600">Frete</dt>
            <dd>
              {freteCents === 0
                ? cupomAplicado?.freteGratis
                  ? "grátis (cupom)"
                  : cotacao
                    ? "grátis"
                    : "—"
                : formatBRL(freteCents)}
            </dd>
          </div>
          {descontoCents > 0 && (
            <div className="flex justify-between text-emerald-800">
              <dt>Descontos</dt>
              <dd>-{formatBRL(descontoCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(totalCents)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function NovoEndereco({ onCriar }: { onCriar: (id: string) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await criarEndereco({
        apelido: String(fd.get("apelido") || "Casa"),
        cep: String(fd.get("cep")),
        logradouro: String(fd.get("logradouro")),
        numero: String(fd.get("numero")),
        complemento: String(fd.get("complemento") || "") || undefined,
        bairro: String(fd.get("bairro")),
        cidade: String(fd.get("cidade")),
        uf: String(fd.get("uf")).toUpperCase(),
      });
      onCriar(r.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Confira os dados do endereço.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-2">
      {[
        { name: "apelido", label: "Apelido (ex.: Casa, Trabalho)" },
        { name: "cep", label: "CEP" },
        { name: "logradouro", label: "Logradouro" },
        { name: "numero", label: "Número" },
        { name: "complemento", label: "Complemento (opcional)" },
        { name: "bairro", label: "Bairro" },
        { name: "cidade", label: "Cidade" },
        { name: "uf", label: "UF" },
      ].map((c) => (
        <div key={c.name} className={c.name === "logradouro" || c.name === "complemento" ? "sm:col-span-2" : ""}>
          <label htmlFor={`novo-${c.name}`} className="text-xs font-medium">
            {c.label}
          </label>
          <input
            id={`novo-${c.name}`}
            name={c.name}
            type="text"
            required={c.name !== "complemento" && c.name !== "apelido"}
            maxLength={c.name === "uf" ? 2 : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      ))}
      {erro && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={salvando}
        className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50 sm:col-span-2"
      >
        {salvando ? "Salvando..." : "Salvar endereço"}
      </button>
    </form>
  );
}
