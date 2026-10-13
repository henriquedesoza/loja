import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const db = new PrismaClient();
const email = `teste-${Date.now()}@loja.dev`;
const senha = "senha-de-teste-123";
const headers = new Headers();

afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
});

describe("fluxo de autenticação (Better Auth + Prisma)", () => {
  it("cadastro cria usuário BUYER com senha armazenada como hash", async () => {
    const r = await auth.api.signUpEmail({
      body: { name: "Teste Comprador", email, password: senha },
      headers,
    });
    expect(r.user.email).toBe(email);

    const user = await db.user.findUnique({ where: { email }, include: { accounts: true } });
    expect(user?.role).toBe("BUYER");
    expect(user?.accounts[0]?.providerId).toBe("credential");
    const senhaGravada = user?.accounts[0]?.password ?? "";
    expect(senhaGravada).not.toBe(senha);
    expect(senhaGravada).toMatch(/^[^:]+:.+$/); // formato salt:hash do Better Auth
  });

  it("login aceita a senha correta e cria sessão persistida", async () => {
    const ok = await auth.api.signInEmail({ body: { email, password: senha }, headers });
    expect(ok.token).toBeTruthy();

    const user = await db.user.findUnique({ where: { email }, include: { sessions: true } });
    expect(user?.sessions.length).toBeGreaterThan(0);
    expect(user?.sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    // token é guardado com hash, nunca em texto puro
    expect(user?.sessions[0].token).not.toBe(ok.token);
  });

  it("login recusa a senha errada", async () => {
    await expect(
      auth.api.signInEmail({ body: { email, password: "senha-errada-999" }, headers })
    ).rejects.toThrow();
  });

  it("cadastro duplicado é recusado", async () => {
    await expect(
      auth.api.signUpEmail({ body: { name: "Duplicado", email, password: senha }, headers })
    ).rejects.toThrow();
  });
});
