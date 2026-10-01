import { InsightPoller } from "@/components/InsightPoller";
import { RetryConclusion } from "@/components/InsightActions";
import { Tape } from "@/components/scrap";
import type { Month } from "@/lib/types";

const VERDICT: Record<NonNullable<Month["ai_conclusion_verdict"]>, string> = {
  stayed_true: "stayed true",
  partly: "partly true",
  drifted: "drifted",
  not_enough_data: "too little to say",
};

const STALE_MS = 3 * 60_000;
function isStale(at: string | null): boolean {
  return !at || Date.now() - new Date(at).getTime() > STALE_MS;
}

/** The app's month-end read. Sits next to the user's own reflection, never in place of it. */
export function MonthConclusion({ month }: { month: Month }) {
  const status = month.ai_conclusion_status;
  if (status === "none" || status === "skipped") return null;

  if (status === "pending" && !isStale(month.ai_conclusion_at)) {
    return (
      <div role="status" className="paper-card px-4 py-3">
        <InsightPoller active />
        <p className="font-hand animate-pulse text-xl text-ink-soft">reading the whole month against your influences…</p>
      </div>
    );
  }
  if (status === "failed" || status === "pending") {
    return (
      <div className="paper-card px-4 py-3">
        <p className="font-hand text-xl text-ink-soft">Couldn&apos;t write the month&apos;s read just now. <RetryConclusion monthId={month.id} /></p>
      </div>
    );
  }
  if (!month.ai_conclusion) return null;
  return (
    <aside className="paper-card relative space-y-2 p-5 pt-6" aria-label="The app's read on this month">
      <Tape className="-top-3 right-8 rotate-3" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-type text-[10px] uppercase tracking-wider text-ink-soft">the app&apos;s read on the month</span>
        {month.ai_conclusion_verdict && <span className="stamp text-[11px]" style={{ transform: "rotate(-3deg)" }}>{VERDICT[month.ai_conclusion_verdict]}</span>}
      </div>
      <p className="font-hand whitespace-pre-wrap text-2xl leading-snug">{month.ai_conclusion}</p>
      <p className="font-type text-[10px] text-ink-soft">Written from your daily scores. Your own reflection above stays yours.</p>
    </aside>
  );
}
