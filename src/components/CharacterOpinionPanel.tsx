"use client";

import { AskOpinionButton } from "@/components/AskOpinionButton";
import { InsightPoller } from "@/components/InsightPoller";
import { OpinionBody } from "@/components/Opinion";
import { isStalePending, type OpinionRow } from "@/lib/opinion";

/** Inside a character's editor: Claude's opinion of this character's breakdown (traits, why, fit). */
export function CharacterOpinionPanel({ influenceId, row, aiOn }: { influenceId: string; row: OpinionRow | undefined; aiOn: boolean }) {
  if (!aiOn) return null;
  const pending = row?.status === "pending" && !isStalePending(row.generated_at);
  const done = !!row?.content?.verdict;

  return (
    <section className="space-y-3 border-t border-dashed border-ink/30 pt-4" aria-label="Opinion on this breakdown">
      <InsightPoller active={pending} />
      <div>
        <h3 className="font-hand text-2xl leading-none">Is this a good breakdown?</h3>
        <p className="font-type mt-1 text-[11px] text-ink-soft">An honest opinion on these traits and on how this character fits you. Nothing is changed.</p>
      </div>
      {pending && <p role="status" className="font-hand animate-pulse text-xl text-ink-soft">thinking it over…</p>}
      {!pending && done && (
        <>
          <OpinionBody o={row!.content} />
          <p className="font-type text-[10px] text-ink-soft">Yours to disagree with · <AskOpinionButton type="character" id={influenceId} /></p>
        </>
      )}
      {!pending && !done && (
        <p className="font-hand text-xl text-ink-soft">
          {row?.status === "failed" ? "Couldn't form an opinion just now. " : ""}
          <AskOpinionButton type="character" id={influenceId} label={row?.status === "failed" ? "try again" : "give me your opinion"} />
        </p>
      )}
    </section>
  );
}
