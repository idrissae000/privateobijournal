import type { Entry, Influence } from "./types";

export type InfluenceStat = { influence: Influence; days: number; avg: number | null };

export type MonthStats = {
  ratedDays: number;
  avg: number | null;
  best: Entry | null;
  worst: Entry | null;
  /** average rating across days tagged with at least one influence */
  taggedAvg: number | null;
  taggedDays: number;
  perInfluence: InfluenceStat[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeStats(entries: Entry[], influences: Influence[]): MonthStats {
  const rated = entries.filter((e) => e.rating != null);
  const ratings = rated.map((e) => e.rating as number);

  let best: Entry | null = null;
  let worst: Entry | null = null;
  for (const e of rated) {
    if (!best || (e.rating as number) > (best.rating as number)) best = e;
    if (!worst || (e.rating as number) < (worst.rating as number)) worst = e;
  }

  const taggedRated = rated.filter((e) => e.influence_ids.length > 0);
  const perInfluence = influences.map((influence) => {
    const days = rated.filter((e) => e.influence_ids.includes(influence.id));
    return { influence, days: days.length, avg: mean(days.map((e) => e.rating as number)) };
  });

  return {
    ratedDays: rated.length,
    avg: mean(ratings),
    best,
    worst,
    taggedAvg: mean(taggedRated.map((e) => e.rating as number)),
    taggedDays: taggedRated.length,
    perInfluence,
  };
}

export const fmt1 = (n: number | null) => (n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1));

/** Sequential single-hue ramp (moss green), light -> dark, for ratings 1..10. */
export const RATING_COLORS = [
  "#e6ebd2", "#d6e1bd", "#c3d6a7", "#adc891", "#97b87b",
  "#7fa464", "#688e51", "#527841", "#3f6235", "#2d4b29",
];
export const ratingColor = (r: number) => RATING_COLORS[Math.min(10, Math.max(1, Math.round(r))) - 1];
export const ratingInk = (r: number) => (Math.round(r) >= 7 ? "#f6f0df" : "#2c2418");
