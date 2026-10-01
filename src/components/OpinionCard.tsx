import { AskOpinionButton } from "@/components/AskOpinionButton";
import { InsightPoller } from "@/components/InsightPoller";
import { OpinionBody } from "@/components/Opinion";
import { Tape } from "@/components/scrap";
import { formatShortDate } from "@/lib/dates";
import { isStalePending, type OpinionRow } from "@/lib/opinion";

/** A pinned opinion card for a month's breakdown (server-rendered; states: none, thinking, failed, done). */
export function OpinionCard({
  type, id, row, hasContent, emptyHint,
}: {
  type: "month" | "character";
  id: string;
  row: OpinionRow | undefined;
  /** is there anything to judge yet? */
  hasContent: boolean;
  emptyHint: string;
}) {
  if (!hasContent) return <p className="paper-card p-4 font-hand text-xl text-ink-soft">{emptyHint}</p>;

  if (row?.status === "pending" && !isStalePending(row.generated_at)) {
    return (
      <div role="status" className="paper-card px-4 py-3">
        <InsightPoller active />
        <p className="font-hand animate-pulse text-xl text-ink-soft">thinking about whether this works for you…</p>
      </div>
    );
  }
  const hasOpinion = !!row?.content?.verdict;
  if (!row || (!hasOpinion && row.status !== "done")) {
    return (
      <div className="paper-card px-4 py-3">
        <p className="font-hand text-xl text-ink-soft">
          {row ? "Couldn't form an opinion just now. " : "No opinion yet. "}
          <AskOpinionButton type={type} id={id} label={row ? "try again" : "give me your opinion"} />
        </p>
      </div>
    );
  }
  return (
    <aside className="paper-card relative space-y-3 p-5 pt-6" aria-label="The app's opinion on this breakdown">
      <Tape className="-top-3 right-10 rotate-3" />
      <OpinionBody o={row.content} />
      <p className="font-type text-[10px] text-ink-soft">
        Just an opinion, yours to disagree with; nothing was changed. Written {formatShortDate(row.generated_at.slice(0, 10))} · <AskOpinionButton type={type} id={id} />
      </p>
    </aside>
  );
}
