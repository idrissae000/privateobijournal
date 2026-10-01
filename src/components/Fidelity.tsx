import { avgCharacterScore, FIDELITY_TEXT, type Fidelity } from "@/lib/fidelity";
import { fmt1, ratingColor } from "@/lib/stats";
import type { Entry } from "@/lib/types";

/** Per-influence fidelity for a month: which influences were lived vs. only picked. */
export function FidelitySection({ fidelity, entries, aiOn }: { fidelity: Fidelity[]; entries: Entry[]; aiOn: boolean }) {
  const scored = fidelity.some((f) => f.days > 0);
  if (!scored && !aiOn) return null;
  const overall = avgCharacterScore(entries);
  const scoredDays = entries.filter((e) => e.character_score != null).length;

  return (
    <div className="paper-card space-y-3 p-4" aria-label="Influence fidelity">
      <p className="font-type text-xs uppercase tracking-wider text-ink-soft">Who I actually lived up to</p>
      {!scored ? (
        <p className="font-hand text-2xl text-ink-soft">Each day you write gets read against your influences. This fills in as the month goes.</p>
      ) : (
        <>
          <p className="font-hand text-2xl">
            {fmt1(overall)} <span className="text-lg text-ink-soft">average in-character · {scoredDays} day{scoredDays === 1 ? "" : "s"} read</span>
          </p>
          <ul className="space-y-3">
            {[...fidelity].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).map((f) => (
              <li key={f.influence.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-hand text-2xl leading-none">{f.influence.name}</span>
                  <span className="font-type text-sm">{fmt1(f.avg)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded bg-ink/10" role="img" aria-label={`${f.influence.name}: ${fmt1(f.avg)} out of 10`}>
                  {f.avg != null && <div className="h-full rounded" style={{ width: `${Math.max(4, f.avg * 10)}%`, background: ratingColor(Math.max(1, f.avg)) }} />}
                </div>
                <p className="font-type mt-1 text-[11px] text-ink-soft">
                  {FIDELITY_TEXT[f.label]} · scored on {f.days} day{f.days === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
