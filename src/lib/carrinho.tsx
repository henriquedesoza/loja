"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type ItemCarrinho = {
  variantId: string;
  sku: string;
  titulo: string;
  slug: string;
  cor: string;
  tamanho: string;
  precoCents: number;
  estoque: number;
  imagemUrl: string | null;
  quantidade: number;
};

type CarrinhoCtx = {
  itens: ItemCarrinho[];
  totalItens: number;
  subtotalCents: number;
  adicionar: (item: Omit<ItemCarrinho, "quantidade">, quantidade?: number) => void;
  adicionarVarios: (itens: ItemCarrinho[]) => void;
  definirQuantidade: (variantId: string, quantidade: number) => void;
  remover: (variantId: string) => void;
  limpar: () => void;
  carregado: boolean;
};

const CHAVE = "loja-carrinho-v1";
const ouvintes = new Set<() => void>();
const SEM_ITENS: ItemCarrinho[] = [];

// cache por conteúdo: getSnapshot deve retornar sempre a MESMA referência
// enquanto o localStorage não mudar (senão o React entra em loop infinito)
let brutoCache: string | null = null;
let itensCache: ItemCarrinho[] = SEM_ITENS;

function lerItens(): ItemCarrinho[] {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    return SEM_ITENS;
  }
  if (bruto === brutoCache) return itensCache;
  brutoCache = bruto;
  try {
    const itens: unknown = bruto ? JSON.parse(bruto) : [];
    itensCache = Array.isArray(itens) && itens.length > 0 ? (itens as ItemCarrinho[]) : SEM_ITENS;
  } catch {
    itensCache = SEM_ITENS; // localStorage corrompido: começa vazio em vez de quebrar
  }
  return itensCache;
}

function gravar(novos: ItemCarrinho[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novos));
  } catch {
    // sem espaço no storage: mantém só em memória nesta sessão
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const Contexto = createContext<CarrinhoCtx | null>(null);

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  // localStorage é uma external store: useSyncExternalStore evita mismatch de hidratação
  const itens = useSyncExternalStore(inscrever, lerItens, () => SEM_ITENS);
  const carregado = useSyncExternalStore(inscrever, () => true, () => false);

  const adicionar = useCallback(
    (item: Omit<ItemCarrinho, "quantidade">, quantidade = 1) => {
      const atuais = lerItens();
      const atual = atuais.find((i) => i.variantId === item.variantId);
      const qtd = Math.min((atual?.quantidade ?? 0) + quantidade, item.estoque);
      const novos = atual
        ? atuais.map((i) => (i.variantId === item.variantId ? { ...i, quantidade: qtd } : i))
        : [...atuais, { ...item, quantidade: qtd }];
      gravar(novos);
    },
    []
  );

  const adicionarVarios = useCallback((novos: ItemCarrinho[]) => {
    const porId = new Map(lerItens().map((i) => [i.variantId, i] as const));
    for (const n of novos) {
      const atual = porId.get(n.variantId);
      porId.set(n.variantId, {
        ...n,
        quantidade: Math.min((atual?.quantidade ?? 0) + n.quantidade, n.estoque),
      });
    }
    gravar([...porId.values()]);
  }, []);

  const definirQuantidade = useCallback((variantId: string, quantidade: number) => {
    const novos = lerItens()
      .map((i) =>
        i.variantId === variantId
          ? { ...i, quantidade: Math.min(Math.max(quantidade, 1), i.estoque) }
          : i
      )
      .filter((i) => i.quantidade > 0);
    gravar(novos);
  }, []);

  const remover = useCallback((variantId: string) => {
    gravar(lerItens().filter((i) => i.variantId !== variantId));
  }, []);

  const limpar = useCallback(() => {
    gravar([]);
  }, []);

  const valor = useMemo<CarrinhoCtx>(
    () => ({
      itens,
      carregado,
      totalItens: itens.reduce((a, i) => a + i.quantidade, 0),
      subtotalCents: itens.reduce((a, i) => a + i.precoCents * i.quantidade, 0),
      adicionar,
      adicionarVarios,
      definirQuantidade,
      remover,
      limpar,
    }),
    [itens, carregado, adicionar, adicionarVarios, definirQuantidade, remover, limpar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrinho() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro de <CarrinhoProvider>");
  return ctx;
}
