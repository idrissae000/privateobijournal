import { formatShortDate } from "./dates";
import type { Entry } from "./types";

export type Alert = { id: string; kind: "gap" | "drift" | "fidelity"; text: string };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Gentle, non-gamified nudges for the Today page. Computed fresh on every view (so they vanish by themselves
 * when the situation changes), dismissible, never a push notification.
 */
export function computeAlerts(input: {
  today: string;
  /** entries of the current month */
  entries: Entry[];
  /** most recent entry anywhere, if any */
  lastEntryDate: string | null;
  monthName: string;
}): Alert[] {
  const { today, entries, lastEntryDate, monthName } = input;
  const out: Alert[] = [];

  if (lastEntryDate && lastEntryDate < today) {
    const n = daysBetween(lastEntryDate, today);
    if (n >= 3) {
      out.push({
        id: `gap-${lastEntryDate}`,
        kind: "gap",
        text: `It's been ${n} days since your last page (${formatShortDate(lastEntryDate)}). No pressure: even one line counts.`,
      });
    }
  }

  const rated = entries.filter((e) => e.rating != null && e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (rated.length >= 7) {
    const last = rated.slice(-5);
    const all = mean(rated.map((e) => e.rating as number));
    const recent = mean(last.map((e) => e.rating as number));
    if (recent <= all - 0.8) {
      out.push({
        id: `drift-${last[last.length - 1].date}`,
        kind: "drift",
        text: `Your last 5 rated days average ${recent.toFixed(1)}, a bit under your ${monthName} average of ${all.toFixed(1)}. Worth a glance, not a worry.`,
      });
    }
  }

  const scored = entries.filter((e) => e.character_score != null && e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (scored.length >= 8) {
    const recent = scored.slice(-4).map((e) => e.character_score as number);
    const before = scored.slice(0, -4).map((e) => e.character_score as number);
    if (mean(recent) <= mean(before) - 1.5) {
      out.push({
        id: `fidelity-${scored[scored.length - 1].date}`,
        kind: "fidelity",
        text: `Lately your days have read less like ${monthName}'s influences (${mean(recent).toFixed(1)} vs ${mean(before).toFixed(1)} earlier). Maybe they've shifted, or maybe it's just a stretch.`,
      });
    }
  }
  return out.slice(0, 2);
}
