import type { Influence } from "./types";

/** Traits used for scoring: the ones the user accepted, else the pending suggestion, else none. */
export function effectiveTraits(inf: Pick<Influence, "traits" | "suggested_traits">): {
  traits: string[];
  source: "accepted" | "suggested" | "none";
} {
  if ((inf.traits ?? []).length) return { traits: inf.traits, source: "accepted" };
  if ((inf.suggested_traits ?? []).length) return { traits: inf.suggested_traits, source: "suggested" };
  return { traits: [], source: "none" };
}

export const MAX_TRAITS = 6;
export const MAX_TRAIT_LENGTH = 40;

/** Same cleanup as themes: trim, collapse spaces, dedupe case-insensitively, cap count and length. */
export function normalizeTraits(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TRAIT_LENGTH).trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_TRAITS) break;
  }
  return out;
}
