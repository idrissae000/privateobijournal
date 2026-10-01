"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { catchUpStep } from "@/app/actions";

export type CatchUpCounts = { traits: number; entries: number; conclusions: number; sheet: boolean; foreshadow: boolean; review: boolean; total: number };

function describe(c: CatchUpCounts): string {
  const parts: string[] = [];
  if (c.entries) parts.push(`${c.entries} written page${c.entries === 1 ? "" : "s"}`);
  if (c.traits) parts.push(`${c.traits} character${c.traits === 1 ? "" : "s"} without traits`);
  if (c.conclusions) parts.push(`${c.conclusions} sealed month${c.conclusions === 1 ? "" : "s"}`);
  if (c.sheet) parts.push("your character sheet");
  if (c.foreshadow) parts.push("the foreshadowing check");
  if (c.review) parts.push("the accuracy review");
  return parts.join(", ");
}

/**
 * First-run catch-up: reads everything that existed before insights were switched on. It also advances a few
 * items on its own whenever you open Today; this button just does the rest in one go, with progress.
 */
export function CatchUpBanner({ counts }: { counts: CatchUpCounts }) {
  const router = useRouter();
  const [state, setState] = useState<{ running: boolean; left: number; note: string | null }>({ running: false, left: counts.total, note: null });

  async function run() {
    setState({ running: true, left: counts.total, note: null });
    let prev = counts.total;
    let stalls = 0;
    let note: string | null = null;
    try {
      for (let i = 0; i < 80; i++) {
        const r = await catchUpStep();
        if (!r.enabled) { note = "Insights aren't switched on for this deployment."; break; }
        setState({ running: true, left: r.remaining, note: null });
        if (r.remaining === 0) { prev = 0; break; }
        if (r.budgetReached) { prev = r.remaining; note = "This month's AI budget is used up. The rest waits until the 1st (or raise INSIGHT_MONTHLY_BUDGET_USD)."; break; }
        if (r.capReached) { prev = r.remaining; note = "Hit today's AI call limit. The rest continues automatically tomorrow as you use the app."; break; }
        // Two rounds in a row with nothing finished means the rest is failing: stop rather than keep spending.
        if (r.remaining >= prev) {
          if (++stalls >= 2) { prev = r.remaining; note = "Some items couldn't be read just now. Try again later, or check the Review tab for the reason."; break; }
        } else {
          stalls = 0;
        }
        prev = r.remaining;
      }
    } catch {
      note = "Something interrupted it. Press the button again to continue where it stopped.";
    }
    setState({ running: false, left: prev, note });
    router.refresh();
  }

  if (counts.total === 0) return null;
  return (
    <section className="paper-card space-y-2 border-2 border-dashed border-stamp/50 p-4" aria-label="Catch up">
      <p className="font-hand text-2xl leading-snug">Some of your earlier pages haven&apos;t been read yet.</p>
      <p className="font-type text-xs text-ink-soft">Waiting: {describe(counts)}.</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" className="btn" disabled={state.running} onClick={run}>
          {state.running ? `Reading… ${state.left} left` : "Read them now"}
        </button>
        {state.running && <span className="font-hand animate-pulse text-xl text-ink-soft">this takes a minute or two</span>}
      </div>
      {state.note && <p role="status" className="text-sm text-ink-soft">{state.note}</p>}
    </section>
  );
}

