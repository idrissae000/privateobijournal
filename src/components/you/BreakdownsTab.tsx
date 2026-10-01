import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { AskOpinionButton } from "@/components/AskOpinionButton";
import { OpinionBody } from "@/components/Opinion";
import { Empty, Heading } from "@/components/scrap";
import { getOpinions } from "@/lib/ai/opinion-job";
import { getAllInfluences, getAllMonths, getToday } from "@/lib/data";
import { formatShortDate, monthLabel, ymKey } from "@/lib/dates";
import { VERDICT_LABEL } from "@/lib/opinion";

/** The app's opinions on the current and upcoming months' breakdowns, and on each of their characters. */
export async function BreakdownsTab({ supabase, aiOn }: { supabase: SupabaseClient; aiOn: boolean }) {
  if (!aiOn) return <Empty>Insights are switched off. Add an Anthropic key to get opinions.</Empty>;
  const currentYm = (await getToday()).slice(0, 7);
  const [allMonths, allInf] = await Promise.all([getAllMonths(supabase), getAllInfluences(supabase)]);
  const months = allMonths.filter((m) => !m.is_retrospective && ymKey(m.year, m.month) >= currentYm);
  const infl = allInf.filter((i) => months.some((m) => m.id === i.month_id));
  const [mOps, cOps] = await Promise.all([
    getOpinions(supabase, "month", months.map((m) => m.id)),
    getOpinions(supabase, "character", infl.map((i) => i.id)),
  ]);

  if (!months.length) return <Empty>No current or upcoming months yet. Open a future month from the month page to plan it.</Empty>;

  return (
    <div className="space-y-8">
      <p className="font-hand text-xl text-ink-soft">What I think of your breakdowns for this month and the ones you&apos;re planning. Opinions only. Nothing changes on its own.</p>
      {months.map((m) => {
        const ym = ymKey(m.year, m.month);
        const mine = infl.filter((i) => i.month_id === m.id);
        const op = mOps.get(m.id);
        return (
          <section key={m.id} className="space-y-3">
            <Heading>{monthLabel(m.year, m.month)}{ym > currentYm ? " · planned" : " · now"}</Heading>
            {op?.content?.verdict ? (
              <div className="paper-card space-y-2 p-4">
                <OpinionBody o={op.content} />
                <p className="font-type text-[10px] text-ink-soft">Written {formatShortDate(op.generated_at.slice(0, 10))} · <AskOpinionButton type="month" id={m.id} /></p>
              </div>
            ) : (
              <p className="paper-card p-4 font-hand text-xl text-ink-soft">
                {mine.length ? <>{op?.status === "pending" ? "thinking…" : "No opinion yet. "}{op?.status !== "pending" && <AskOpinionButton type="month" id={m.id} label="give me your opinion" />}</> : "No influences yet."}
              </p>
            )}
            {mine.length > 0 && (
              <ul className="space-y-2">
                {mine.map((i) => {
                  const c = cOps.get(i.id);
                  return (
                    <li key={i.id} className="paper-card flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="font-type text-sm">{i.name}</span>
                      <span className="font-type text-xs text-ink-soft">
                        {c?.content?.verdict ? <><em className="not-italic text-ink">{VERDICT_LABEL[c.content.verdict]}</em>: {c.content.headline} </> : c?.status === "pending" ? "thinking… " : ""}
                        <AskOpinionButton type="character" id={i.id} label={c?.content?.verdict ? "ask again" : "get opinion"} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href={`/month/${ym}`} className="font-type text-xs underline">open {monthLabel(m.year, m.month)}</Link>
          </section>
        );
      })}
    </div>
  );
}
