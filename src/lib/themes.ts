import type { Influence, Month } from "./types";

export const MAX_THEMES = 12;
export const MAX_THEME_LENGTH = 32;

/** Trim, collapse spaces, drop empties/duplicates (case-insensitive), cap count and length. */
export function normalizeThemes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw.replace(/\s+/g, " ").trim().replace(/^#/, "").slice(0, MAX_THEME_LENGTH).trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_THEMES) break;
  }
  return out;
}

/** Every theme in use, most-used first (for suggestions). Keeps the first spelling seen. */
export function collectThemes(months: Pick<Month, "themes">[], influences: Pick<Influence, "themes">[]): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const list of [...months.map((m) => m.themes), ...influences.map((i) => i.themes)]) {
    for (const t of list ?? []) {
      const k = t.toLowerCase();
      const cur = counts.get(k);
      counts.set(k, { label: cur?.label ?? t, n: (cur?.n ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((c) => c.label);
}

/** Themes carried by two or more of these influences: the "what do they have in common" hint. */
export function sharedThemes(influences: Pick<Influence, "themes">[]): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const inf of influences) {
    for (const t of new Set((inf.themes ?? []).map((x) => x.toLowerCase()))) {
      const label = (inf.themes ?? []).find((x) => x.toLowerCase() === t)!;
      const cur = counts.get(t);
      counts.set(t, { label: cur?.label ?? label, n: (cur?.n ?? 0) + 1 });
    }
  }
  return [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).map((c) => c.label);
}
