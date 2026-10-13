import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioAuth } from "@/components/FormularioAuth";
import { getUsuarioAtual } from "@/lib/session";

export const metadata = { title: "Entrar" };

// searchParams é request data no Cache Components: aguardado dentro do Suspense
export default function Entrar({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  return (
    <Suspense fallback={<p className="text-zinc-500">Carregando…</p>}>
      <ConteudoEntrar searchParams={searchParams} />
    </Suspense>
  );
}

async function ConteudoEntrar({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo: bruto } = await searchParams;
  const proximo = bruto && bruto.startsWith("/") ? bruto : "/";
  if (await getUsuarioAtual()) redirect(proximo);
  return <FormularioAuth modo="entrar" proximo={proximo} />;
}
