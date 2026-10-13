import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getUsuarioAtual() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
