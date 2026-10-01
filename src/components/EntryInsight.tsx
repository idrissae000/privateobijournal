import { InsightPoller } from "@/components/InsightPoller";
import { RetryEntryInsight } from "@/components/InsightActions";
import { Tape } from "@/components/scrap";
import { ratingColor, ratingInk } from "@/lib/stats";
import type { Entry, Influence } from "@/lib/types";

const STALE_PENDING_MS = 3 * 60_000;

// A "pending" mark older than this means the background job died: show a retry instead of a spinner.
function isStalePending(at: string | null): boolean {
  return !at || Date.now() - new Date(at).getTime() > STALE_PENDING_MS;
}

/** The app's quiet read on a saved entry: a pinned margin note, written in the background. */
export function EntryInsight({ entry, influences }: { entry: Entry; influences: Influence[] }) {
  const status = entry.insight_status;
  if (status === "skipped" || (status === "none" && !entry.insight)) return null;

  const stalePending = status === "pending" && isStalePending(entry.insight_at);

  if (status === "pending" && !stalePending) {
    return (
      <div role="status" aria-live="polite" className="paper-card relative rotate-[0.8deg] px-4 py-3">
        <InsightPoller active />
        <p className="font-hand animate-pulse text-xl text-ink-soft">reading today&apos;s page…</p>
      </div>
    );
  }
  if (status === "failed" || stalePending) {
    return (
      <div className="paper-card px-4 py-3">
        <p className="font-hand text-xl text-ink-soft">Couldn&apos;t read this page just now. <RetryEntryInsight entryId={entry.id} /></p>
      </div>
    );
  }

  const names = new Map(influences.map((i) => [i.id, i.name]));
  const scores = entry.scores.filter((s) => names.has(s.influence_id));

  return (
    <aside className="paper-card relative rotate-[0.8deg] space-y-2 px-4 pb-4 pt-5" aria-label="The app's read on this entry">
      <Tape className="-top-3 left-8 -rotate-3" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-type text-[10px] uppercase tracking-wider text-ink-soft">the app&apos;s read{status === "none" ? " · refreshing in a few minutes" : ""}</span>
        {entry.character_score != null && (
          <span className="stamp text-[11px]" style={{ transform: "rotate(-3deg)" }}>in character {entry.character_score}/10</span>
        )}
      </div>
      {entry.insight && <p className="font-hand text-2xl leading-snug">{entry.insight}</p>}
      {scores.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {scores.map((s) => (
            <li
              key={s.influence_id}
              title={s.note ?? undefined}
              className="label-tag flex items-center gap-1.5"
            >
              {names.get(s.influence_id)}
              <span className="rounded px-1.5" style={{ background: ratingColor(Math.max(1, s.score)), color: ratingInk(Math.max(1, s.score)) }}>{s.score}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
