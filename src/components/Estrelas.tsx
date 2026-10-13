export function Estrelas({ nota, total }: { nota: number; total?: number }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span aria-hidden className="text-amber-500">
        {"★".repeat(Math.round(nota))}
        <span className="text-zinc-300">{"★".repeat(5 - Math.round(nota))}</span>
      </span>
      <span className="sr-only">Nota {nota.toFixed(1).replace(".", ",")} de 5</span>
      <span className="text-zinc-500">
        {nota.toFixed(1).replace(".", ",")}
        {total != null && ` (${total})`}
      </span>
    </span>
  );
}
