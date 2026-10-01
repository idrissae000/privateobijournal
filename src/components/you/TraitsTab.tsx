import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Heading, Tag } from "@/components/scrap";
import { getAllInfluences, getAllMonths } from "@/lib/data";
import { monthLabel, ymKey } from "@/lib/dates";
import type { Influence } from "@/lib/types";

/** Every character with the traits their days are scored against, and which are waiting for your say. */
export async function TraitsTab({ supabase, aiOn }: { supabase: SupabaseClient; aiOn: boolean }) {
  const [influences, months] = await Promise.all([getAllInfluences(supabase), getAllMonths(supabase)]);
  const monthById = new Map(months.map((m) => [m.id, m]));

  // latest appearance per character
  const latest = new Map<string, Influence>();
  for (const i of influences) latest.set(i.name.toLowerCase(), i);
  const rows = [...latest.values()];
  const review = rows.filter((i) => i.traits_status === "suggested");
  const have = rows.filter((i) => i.traits.length > 0 && i.traits_status !== "suggested");
  const none = rows.filter((i) => i.traits.length === 0 && i.traits_status !== "suggested");

  const where = (i: Influence) => {
    const m = monthById.get(i.month_id);
    return m ? { href: `/month/${ymKey(m.year, m.month)}`, label: monthLabel(m.year, m.month) } : null;
  };

  const Card = ({ i, hint }: { i: Influence; hint: string }) => {
    const w = where(i);
    const traits = i.traits.length ? i.traits : i.suggested_traits;
    return (
      <li className="paper-card space-y-1.5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-hand text-2xl leading-none">{i.name}</span>
          {w && <Link href={w.href} className="font-type text-[11px] underline">open on {w.label}</Link>}
        </div>
        {traits.length > 0 && <div className="flex flex-wrap gap-1.5">{traits.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
        <p className="font-type text-[11px] text-ink-soft">{hint}</p>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <p className="font-hand text-xl text-ink-soft">Traits are what your daily pages get read against. To keep, edit or discard a suggestion, open the character from its month.</p>

      {review.length > 0 && (
        <section className="space-y-3">
          <Heading>Suggestions to review</Heading>
          <ul className="space-y-3">{review.map((i) => <Card key={i.id} i={i} hint={`✨ suggested${i.traits_confidence === "low" ? " (low confidence, check them)" : ""}`} />)}</ul>
        </section>
      )}
      {have.length > 0 && (
        <section className="space-y-3">
          <Heading>Your traits</Heading>
          <ul className="space-y-3">{have.map((i) => <Card key={i.id} i={i} hint="used when scoring your pages" />)}</ul>
        </section>
      )}
      {none.length > 0 && (
        <section className="space-y-3">
          <Heading>No traits yet</Heading>
          <ul className="space-y-3">
            {none.map((i) => (
              <Card key={i.id} i={i} hint={i.traits_status === "declined" ? "you discarded the suggestion" : i.traits_status === "pending" ? "thinking…" : aiOn ? "will be suggested automatically" : "needs the insight layer switched on"} />
            ))}
          </ul>
        </section>
      )}
      {rows.length === 0 && <p className="paper-card p-4 font-hand text-xl text-ink-soft">Add an influence and its traits appear here.</p>}
    </div>
  );
}
