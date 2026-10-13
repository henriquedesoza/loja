import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioAuth } from "@/components/FormularioAuth";
import { getUsuarioAtual } from "@/lib/session";

export const metadata = { title: "Criar conta" };

async function ConteudoCadastro() {
  if (await getUsuarioAtual()) redirect("/");
  return <FormularioAuth modo="cadastro" />;
}

export default function Cadastro() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Carregando…</p>}>
      <ConteudoCadastro />
    </Suspense>
  );
}
