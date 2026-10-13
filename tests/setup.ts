import { readFileSync } from "node:fs";

// vitest não carrega .env do Next; espelha DATABASE_URL e segredos para o processo
for (const linha of readFileSync(".env", "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_][A-Z0-9_]*)="?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
