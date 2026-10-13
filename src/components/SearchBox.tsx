"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatBRL } from "@/lib/money";

type Sugestao = { slug: string; title: string; priceCents: number; images: { url: string }[] };

// autocomplete com combobox ARIA: teclado (setas/enter/esc) e clique
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState(""); // termo dono das sugestões atuais
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`);
      if (!r.ok) return;
      const data: { items: Sugestao[] } = await r.json();
      setBusca(q);
      setSugestoes(data.items);
      setAberto(true);
      setIndice(-1);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  // só mostra sugestões que correspondem ao termo digitado agora
  const visiveis = q === busca ? sugestoes : [];
  const mostrar = aberto && visiveis.length > 0;

  const irPara = (i: number) => {
    const item = visiveis[i];
    if (!item) return;
    router.push(`/produto/${item.slug}`);
  };

  return (
    <form
      role="search"
      action="/loja"
      method="get"
      className="relative"
      onSubmit={(e) => {
        if (indice >= 0) {
          e.preventDefault();
          irPara(indice);
        }
      }}
    >
      <label htmlFor="busca" className="sr-only">
        Buscar produtos
      </label>
      <input
        id="busca"
        name="q"
        type="search"
        value={q}
        autoComplete="off"
        placeholder="Busque por produto, marca ou categoria"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIndice((i) => Math.min(i + 1, visiveis.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIndice((i) => Math.max(i - 1, -1)); }
          else if (e.key === "Escape") { setAberto(false); setIndice(-1); }
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls="sugestoes"
        aria-autocomplete="list"
        aria-activedescendant={indice >= 0 ? `sug-${indice}` : undefined}
        className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400"
      />
      {mostrar && (
        <ul
          id="sugestoes"
          role="listbox"
          aria-label="Sugestões de busca"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {visiveis.map((s, i) => (
            <li
              key={s.slug}
              id={`sug-${i}`}
              role="option"
              aria-selected={i === indice}
              onMouseDown={(e) => { e.preventDefault(); router.push(`/produto/${s.slug}`); }}
              onMouseEnter={() => setIndice(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === indice ? "bg-emerald-50" : ""}`}
            >
              {s.images[0] && (
                <Image src={s.images[0].url} alt="" width={32} height={32} className="rounded" unoptimized />
              )}
              <span className="flex-1 truncate">{s.title}</span>
              <span className="text-zinc-500">{formatBRL(s.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
