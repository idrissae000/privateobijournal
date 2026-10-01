import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { FidelitySection } from "@/components/Fidelity";
import { Heading } from "@/components/scrap";
import { getAllEntries, getAllInfluences, getAllMonths } from "@/lib/data";
import { monthLabel, ymKey } from "@/lib/dates";
import { computeFidelity, FIDELITY_TEXT, fidelityLabel } from "@/lib/fidelity";
import { fmt1, ratingColor } from "@/lib/stats";

/** Who you actually lived up to: pooled across every month, then month by month. */
export async function FidelityTab({ supabase, aiOn }: { supabase: SupabaseClient; aiOn: boolean }) {
  const [months, influences, entries] = await Promise.all([getAllMonths(supabase), getAllInfluences(supabase), getAllEntries(supabase)]);

  // one row per character, pooling their scores over every month they appeared in
  const scoresByInfluence = new Map<string, number[]>();
  for (const e of entries) for (const s of e.scores) scoresByInfluence.set(s.influence_id, [...(scoresByInfluence.get(s.influence_id) ?? []), s.score]);
  const pooled = new Map<string, { name: string; scores: number[]; months: Set<string> }>();
  for (const i of influences) {
    const xs = scoresByInfluence.get(i.id) ?? [];
    if (!xs.length) continue;
    const key = i.name.toLowerCase();
    const cur = pooled.get(key) ?? { name: i.name, scores: [], months: new Set<string>() };
    cur.scores.push(...xs);
    cur.months.add(i.month_id);
    pooled.set(key, cur);
  }
  const ranked = [...pooled.values()]
    .map((p) => {
      const avg = p.scores.reduce((a, b) => a + b, 0) / p.scores.length;
      return { ...p, avg, days: p.scores.length, label: fidelityLabel(avg, p.scores.length) };
    })
    .sort((a, b) => b.avg - a.avg);

  const scoredMonths = months
    .filter((m) => !m.is_retrospective)
    .map((m) => ({ m, es: entries.filter((e) => e.month_id === m.id), inf: influences.filter((i) => i.month_id === m.id) }))
    .filter((x) => x.es.some((e) => e.scores.length > 0))
    .reverse();

  return (
    <div className="space-y-8">
      <p className="font-hand text-xl text-ink-soft">Each written day is read against the traits of your influences. This is how truly you lived each of them, not how good the days were.</p>

      {ranked.length === 0 ? (
        <p className="paper-card p-4 font-hand text-xl text-ink-soft">
          {aiOn ? "Nothing scored yet. Write a page with a few words in it and it starts to fill in." : "Fidelity needs the insight layer switched on."}
        </p>
      ) : (
        <section className="space-y-3">
          <Heading>Across everything</Heading>
          <ul className="paper-card space-y-4 p-4">
            {ranked.map((r) => (
              <li key={r.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-hand text-2xl leading-none">{r.name}</span>
                  <span className="font-type text-sm">{fmt1(r.avg)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded bg-ink/10" role="img" aria-label={`${r.name}: ${fmt1(r.avg)} out of 10`}>
                  <div className="h-full rounded" style={{ width: `${Math.max(4, r.avg * 10)}%`, background: ratingColor(Math.max(1, r.avg)) }} />
                </div>
                <p className="font-type mt-1 text-[11px] text-ink-soft">
                  {FIDELITY_TEXT[r.label]} · {r.days} day{r.days === 1 ? "" : "s"} scored{r.months.size > 1 ? ` across ${r.months.size} months` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scoredMonths.map(({ m, es, inf }) => (
        <section key={m.id} className="space-y-3">
          <Link href={`/month/${ymKey(m.year, m.month)}`}><Heading>{monthLabel(m.year, m.month)}</Heading></Link>
          <FidelitySection fidelity={computeFidelity(es, inf)} entries={es} aiOn={aiOn} />
        </section>
      ))}
    </div>
  );
}
