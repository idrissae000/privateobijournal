import type { Entry, Influence } from "./types";

export type FidelityLabel = "lived" | "partly" | "not" | "early" | "none";

export type Fidelity = {
  influence: Influence;
  /** days this influence was scored on */
  days: number;
  avg: number | null;
  label: FidelityLabel;
};

export function fidelityLabel(avg: number | null, days: number): FidelityLabel {
  if (avg == null || days === 0) return "none";
  if (days < 3) return "early";
  if (avg >= 7) return "lived";
  if (avg >= 4.5) return "partly";
  return "not";
}

export const FIDELITY_TEXT: Record<FidelityLabel, string> = {
  lived: "Lived it",
  partly: "Partly there",
  not: "Picked, but didn't really show up",
  early: "Too early to tell",
  none: "Not scored yet",
};

/** Average in-character score per influence over the days it was scored (per-influence, not per-day). */
export function computeFidelity(entries: Entry[], influences: Influence[]): Fidelity[] {
  return influences.map((influence) => {
    const scores = entries.flatMap((e) => e.scores.filter((s) => s.influence_id === influence.id).map((s) => s.score));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { influence, days: scores.length, avg, label: fidelityLabel(avg, scores.length) };
  });
}

export const avgCharacterScore = (entries: Entry[]): number | null => {
  const xs = entries.filter((e) => e.character_score != null).map((e) => e.character_score as number);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
