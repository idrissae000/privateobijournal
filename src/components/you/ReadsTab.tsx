import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Heading, Tag } from "@/components/scrap";
import { getAllEntries, getAllMonths } from "@/lib/data";
import { formatShortDate, monthLabel, ymKey } from "@/lib/dates";

const VERDICT = { stayed_true: "stayed true", partly: "partly true", drifted: "drifted", not_enough_data: "too little to say" } as const;

/** Everything the app has written back to you: month-end conclusions and the daily reads. */
export async function ReadsTab({ supabase, aiOn }: { supabase: SupabaseClient; aiOn: boolean }) {
  const [months, entries] = await Promise.all([getAllMonths(supabase), getAllEntries(supabase)]);
  const concluded = months.filter((m) => m.ai_conclusion && m.ai_conclusion_status === "done").reverse();
  const reads = entries.filter((e) => e.insight && e.insight_status === "done").reverse().slice(0, 40);

  return (
    <div className="space-y-8">
      <p className="font-hand text-xl text-ink-soft">What the app has said about your pages and months. Your own words stay on the pages themselves.</p>

      <section className="space-y-3">
        <Heading>Month-end reads</Heading>
        {concluded.length === 0 ? (
          <p className="paper-card p-4 font-hand text-xl text-ink-soft">Seal a month and its read shows up here.</p>
        ) : (
          <ul className="space-y-3">
            {concluded.map((m) => (
              <li key={m.id} className="paper-card space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/month/${ymKey(m.year, m.month)}`} className="font-type text-xs uppercase tracking-wider underline">{monthLabel(m.year, m.month)}</Link>
                  {m.ai_conclusion_verdict && <Tag>{VERDICT[m.ai_conclusion_verdict]}</Tag>}
                </div>
                <p className="font-hand whitespace-pre-wrap text-xl leading-snug">{m.ai_conclusion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <Heading>Daily reads</Heading>
        {reads.length === 0 ? (
          <p className="paper-card p-4 font-hand text-xl text-ink-soft">
            {aiOn ? "Write a page with a few words in it and the app's read of it lands here." : "Daily reads need the insight layer switched on."}
          </p>
        ) : (
          <ul className="space-y-3">
            {reads.map((e) => (
              <li key={e.id} className="paper-card space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/day/${e.date}`} className="font-type text-xs uppercase tracking-wider underline">{formatShortDate(e.date)}</Link>
                  {e.rating != null && <Tag>rated {e.rating}</Tag>}
                  {e.character_score != null && <Tag>in character {e.character_score}/10</Tag>}
                </div>
                <p className="font-hand text-xl leading-snug">{e.insight}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
