import type { OrderStatus } from "@prisma/client";

export const ROTULO_STATUS: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pagamento confirmado",
  PACKING: "Em separação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const CLASSE_STATUS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-900",
  PACKING: "bg-sky-100 text-sky-900",
  SHIPPED: "bg-indigo-100 text-indigo-900",
  DELIVERED: "bg-zinc-200 text-zinc-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function formatarData(data: Date): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatarDataHora(data: Date): string {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
