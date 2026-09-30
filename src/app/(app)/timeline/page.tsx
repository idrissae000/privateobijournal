import Link from "next/link";
import { Frame, Heading, Stamp, Tag } from "@/components/scrap";
import { getAllInfluences, getAllMonths, getToday, requireUser, signKeys } from "@/lib/data";
import { monthLabel, ymKey } from "@/lib/dates";
import { fmt1 } from "@/lib/stats";

export default async function TimelinePage() {
  const { supabase } = await requireUser();
  const today = await getToday();
  const [months, influences, { data: ratings }] = await Promise.all([
    getAllMonths(supabase),
    getAllInfluences(supabase),
    supabase.from("entries").select("month_id,rating").not("rating", "is", null),
  ]);

  const avgByMonth = new Map<string, number>();
  const sums = new Map<string, { s: number; n: number }>();
  for (const r of ratings ?? []) {
    const cur = sums.get(r.month_id) ?? { s: 0, n: 0 };
    sums.set(r.month_id, { s: cur.s + r.rating, n: cur.n + 1 });
  }
  for (const [id, { s, n }] of sums) avgByMonth.set(id, s / n);

  const urls = await signKeys(months.map((m) => m.cover_image_key));
  const current = today.slice(0, 7);

  return (
    <div className="space-y-6">
      <Heading>Timeline</Heading>
      {months.length === 0 && <p className="font-hand text-center text-2xl text-ink-soft">No chapters yet.</p>}
      <ol className="relative space-y-8 border-l-2 border-dashed border-ink/30 pl-6">
        {months.map((m) => {
          const ym = ymKey(m.year, m.month);
          const names = influences.filter((i) => i.month_id === m.id).map((i) => i.name);
          const avg = avgByMonth.get(m.id);
          return (
            <li key={m.id} id={ym === current ? "now" : undefined} className="relative">
              <span aria-hidden className={`absolute -left-[33px] top-2 h-3.5 w-3.5 rounded-full border-2 border-ink ${ym === current ? "bg-stamp" : "bg-paper"}`} />
              <Link href={`/month/${ym}`} className="flex gap-4">
                <div className="w-24 shrink-0">
                  <Frame src={m.cover_image_key ? urls[m.cover_image_key] : null} tape={false} className="-rotate-2">
                    {!m.cover_image_key && <span className="absolute inset-0 flex items-center justify-center text-2xl text-ink/30">+</span>}
                  </Frame>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-type text-xs uppercase tracking-wider text-ink-soft">{monthLabel(m.year, m.month)}</p>
                  <p className="font-hand text-3xl leading-none">{m.title ?? <span className="text-ink-soft">Untitled chapter</span>}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {names.map((n) => <Tag key={n}>{n}</Tag>)}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {m.is_retrospective && <Stamp rotate={-2} className="text-[10px] !text-ink-soft">retrospective</Stamp>}
                    {m.sealed_at && <Stamp rotate={2} className="text-[10px]">sealed</Stamp>}
                    {avg != null && <span className="font-type text-xs text-ink-soft">avg {fmt1(avg)}</span>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      {months.some((m) => ymKey(m.year, m.month) === current) && (
        <p className="text-center"><a href="#now" className="font-type text-xs underline">jump to this month</a></p>
      )}
    </div>
  );
}
