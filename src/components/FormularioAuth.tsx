"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

const mensagens: Record<string, string> = {
  "Invalid email or password": "E-mail ou senha incorretos.",
  "User already exists": "Já existe uma conta com este e-mail.",
  "Password must be at least 8 characters": "A senha precisa ter no mínimo 8 caracteres.",
};

export function FormularioAuth({ modo, proximo = "/" }: { modo: "entrar" | "cadastro"; proximo?: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const nome = String(fd.get("nome") ?? "");

    const r =
      modo === "entrar"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name: nome, email, password });

    setCarregando(false);
    if (r.error) {
      setErro(mensagens[r.error.message ?? ""] ?? "Não foi possível continuar. Confira os dados e tente de novo.");
      return;
    }
    router.push(proximo);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">{modo === "entrar" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {modo === "entrar" ? "Acesse para comprar e acompanhar pedidos." : "Leva menos de um minuto."}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        {modo === "cadastro" && (
          <div>
            <label htmlFor="nome" className="block text-sm font-medium">
              Nome completo
            </label>
            <input
              id="nome" name="nome" type="text" required autoComplete="name"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Senha
          </label>
          <input
            id="password" name="password" type="password" required minLength={8}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          {modo === "cadastro" && <p className="mt-1 text-xs text-zinc-500">Mínimo de 8 caracteres.</p>}
        </div>

        {erro && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-md bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900 disabled:opacity-60"
        >
          {carregando ? "Enviando..." : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-600">
        {modo === "entrar" ? (
          <>
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="text-emerald-800 underline">
              Cadastre-se
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/entrar" className="text-emerald-800 underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
