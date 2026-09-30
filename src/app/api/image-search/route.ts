import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/data";

type BraveImage = {
  title?: string;
  url?: string;
  source?: string;
  thumbnail?: { src?: string };
  properties?: { url?: string };
};

const isHttp = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u) && u.length < 2048;

// Web image search via the Brave Search API (set BRAVE_SEARCH_API_KEY). Results are just links:
// picking one goes through /api/import-image, which brings the photo into your own R2 bucket.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) return NextResponse.json({ results: [] });

  // Monthly cap, enforced in the database so concurrent requests can't slip past it.
  // Brave bills per request beyond its free credit, so never call it once the cap is reached.
  const limit = Math.max(1, Number(process.env.IMAGE_SEARCH_MONTHLY_LIMIT) || 800);
  const month = (await getToday()).slice(0, 7);
  const { data: used, error: capError } = await supabase.rpc("take_search_credit", { p_month: month, p_limit: limit });
  if (capError) return NextResponse.json({ error: "Couldn't check the search allowance" }, { status: 500 });
  if (used == null) return NextResponse.json({ error: "search_limit", limit }, { status: 429 });
  const remaining = Math.max(0, limit - (used as number));

  const endpoint = process.env.IMAGE_SEARCH_ENDPOINT ?? "https://api.search.brave.com/res/v1/images/search";
  try {
    const res = await fetch(`${endpoint}?${new URLSearchParams({ q, count: "24", safesearch: "strict" })}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `Search failed (${res.status})` }, { status: 502 });
    const data = (await res.json()) as { results?: BraveImage[] };
    const results = (data.results ?? [])
      .map((r) => ({
        thumb: r.thumbnail?.src,
        full: r.properties?.url ?? r.url,
        title: (r.title ?? "").slice(0, 120),
        source: (r.source ?? "").slice(0, 80),
      }))
      .filter((r) => isHttp(r.thumb) && isHttp(r.full))
      .slice(0, 24);
    return NextResponse.json({ results, remaining, limit });
  } catch {
    return NextResponse.json({ error: "Search is unreachable right now" }, { status: 502 });
  }
}
