"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { comprarDeNovo, simularPagamento } from "@/app/actions/pedidos";
import { useCarrinho } from "@/lib/carrinho";

export function BotaoComprarDeNovo({ pedidoId }: { pedidoId: string }) {
  const { adicionarVarios } = useCarrinho();
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  return (
    <button
      type="button"
      disabled={carregando}
      onClick={async () => {
        setCarregando(true);
        try {
          const r = await comprarDeNovo(pedidoId);
          if (r.itens.length === 0) return;
          adicionarVarios(r.itens);
          router.push("/carrinho");
        } finally {
          setCarregando(false);
        }
      }}
      className="rounded-md border border-emerald-800 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
    >
      {carregando ? "Montando carrinho..." : "Comprar de novo"}
    </button>
  );
}

export function SimuladorPagamento({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);

  async function simular(acao: "aprovar" | "recusar" | "expirar") {
    setProcessando(true);
    try {
      await simularPagamento(pedidoId, acao);
      router.refresh();
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm">
      <p className="font-medium text-zinc-700">Ambiente de demonstração</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Simula a notificação do provedor de pagamento (webhook).
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={processando}
          onClick={() => simular("aprovar")}
          className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          Aprovar pagamento
        </button>
        <button
          type="button"
          disabled={processando}
          onClick={() => simular("recusar")}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Recusar
        </button>
        <button
          type="button"
          disabled={processando}
          onClick={() => simular("expirar")}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          Expirar (devolve estoque)
        </button>
      </div>
    </div>
  );
}

export function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // clipboard bloqueado pelo navegador: o texto continua visível para seleção manual
        }
      }}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-emerald-700 hover:text-emerald-800"
    >
      {copiado ? "Copiado ✓" : `Copiar ${rotulo}`}
    </button>
  );
}
