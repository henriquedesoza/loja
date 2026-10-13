import { NextResponse } from "next/server";
import { autocomplete } from "@/lib/catalog";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const items = await autocomplete(q);
  return NextResponse.json({ items });
}
