"use client";

import { useMemo, useState } from "react";
import { cotarFreteCep } from "@/app/actions/pedidos";
import { useCarrinho } from "@/lib/carrinho";
import type { Cotacao } from "@/lib/frete";
import { formatBRL, parcelamento } from "@/lib/money";

type Imagem = { url: string; alt: string };
type Variante = { id: string; sku: string; color: string; size: string; priceCents: number | null; stock: number };

export function GaleriaProduto({ imagens, titulo }: { imagens: Imagem[]; titulo: string }) {
  const [ativa, setAtiva] = useState(0);
  const imagem = imagens[ativa];
  if (!imagem) return null;
  return (
    <div>
      <img
        src={imagem.url}
        alt={imagem.alt || titulo}
        width={800}
        height={800}
        className="aspect-square w-full rounded-lg border border-zinc-200 object-cover"
      />
      {imagens.length > 1 && (
        <ul className="mt-3 flex gap-2" aria-label="Outras fotos">
          {imagens.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setAtiva(i)}
                aria-label={`Ver foto ${i + 1} de ${imagens.length}`}
                aria-current={i === ativa}
                className={`rounded-md border-2 ${i === ativa ? "border-emerald-700" : "border-transparent"}`}
              >
                <img src={img.url} alt="" width={72} height={72} className="rounded object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SeletorVariacoes({
  produto,
  variacoes,
  imagemUrl,
}: {
  produto: { priceCents: number; title: string; slug: string };
  variacoes: Variante[];
  imagemUrl: string | null;
}) {
  const { adicionar } = useCarrinho();
  const [adicionado, setAdicionado] = useState(false);

  const cores = useMemo(() => [...new Set(variacoes.map((v) => v.color))], [variacoes]);
  const [cor, setCor] = useState(cores[0]);
  const tamanhosDaCor = useMemo(
    () => [...new Set(variacoes.filter((v) => v.color === cor).map((v) => v.size))],
    [variacoes, cor]
  );
  const [tamanho, setTamanho] = useState(tamanhosDaCor[0]);
  const variante = variacoes.find((v) => v.color === cor && v.size === tamanho);
  const preco = variante?.priceCents ?? produto.priceCents;
  const { parcelas, valorParcelaCents } = parcelamento(preco);
  const estoque = variante?.stock ?? 0;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">Cor: {cor}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {cores.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCor(c);
                setTamanho([...new Set(variacoes.filter((v) => v.color === c).map((v) => v.size))][0]);
              }}
              aria-pressed={c === cor}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                c === cor ? "border-emerald-700 bg-emerald-50 font-medium" : "border-zinc-300 bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Tamanho</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {tamanhosDaCor.map((t) => {
            const v = variacoes.find((x) => x.color === cor && x.size === t);
            const esgotado = (v?.stock ?? 0) === 0;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTamanho(t)}
                aria-pressed={t === tamanho}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  t === tamanho ? "border-emerald-700 bg-emerald-50 font-medium" : "border-zinc-300 bg-white"
                } ${esgotado ? "text-zinc-400 line-through" : ""}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-2xl font-semibold">{formatBRL(preco)}</p>
        <p className="text-sm text-zinc-600">
          em até {parcelas}x de {formatBRL(valorParcelaCents)} sem juros
        </p>
        <p className="mt-1 text-sm text-zinc-600">no Pix {formatBRL(preco - Math.round(preco * 0.05))} (5% de desconto)</p>
        {estoque > 0 && estoque <= 4 && (
          <p className="mt-2 text-sm font-medium text-orange-700">Últimas {estoque} unidades</p>
        )}
        <button
          type="button"
          disabled={estoque === 0 || !variante}
          onClick={() => {
            if (!variante) return;
            adicionar({
              variantId: variante.id,
              sku: variante.sku,
              titulo: produto.title,
              slug: produto.slug,
              cor,
              tamanho,
              precoCents: preco,
              estoque,
              imagemUrl,
            });
            setAdicionado(true);
            setTimeout(() => setAdicionado(false), 2500);
          }}
          className="mt-4 w-full rounded-md bg-emerald-800 px-4 py-3 font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estoque === 0 ? "Esgotado" : adicionado ? "Adicionado ao carrinho ✓" : "Adicionar ao carrinho"}
        </button>
        {estoque === 0 && <p className="mt-2 text-sm text-zinc-600">Opção esgotada — escolha outra combinação.</p>}
      </div>
    </div>
  );
}

export function CalculadoraFrete({
  cepInicial,
  subtotalCents,
  totalItens,
}: {
  cepInicial?: string;
  subtotalCents: number;
  totalItens: number;
}) {
  const [cep, setCep] = useState(cepInicial ?? "");
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      setCotacao(await cotarFreteCep(cep, subtotalCents, totalItens));
    } catch {
      setErro("Não foi possível calcular o frete. Confira o CEP.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={consultar} className="rounded-lg border border-zinc-200 bg-white p-4">
      <label htmlFor="frete-cep" className="text-sm font-semibold">
        Calcular frete e prazo
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="frete-cep"
          inputMode="numeric"
          value={cep}
          onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="00000-000"
          className="w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={carregando || cep.length !== 8}
          className="rounded-md border border-emerald-800 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
        >
          {carregando ? "Calculando..." : "Calcular"}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {erro && <p className="text-red-700">{erro}</p>}
        {cotacao && (
          <p className="text-zinc-700">
            {cotacao.gratis ? (
              <>
                <span className="font-medium text-emerald-800">Frete grátis</span> — {cotacao.motivo}.{" "}
              </>
            ) : (
              <>
                {cotacao.transportadora}: <span className="font-medium">{formatBRL(cotacao.valorCents)}</span>.{" "}
              </>
            )}
            Chega em até {cotacao.prazoDias} dias úteis.
          </p>
        )}
      </div>
    </form>
  );
}
