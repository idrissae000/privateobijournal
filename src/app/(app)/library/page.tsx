import { LibraryList, type LibraryItem } from "@/components/LibraryList";
import { Heading } from "@/components/scrap";
import { getAllInfluences, getAllMonths, requireUser, signKeys } from "@/lib/data";
import { monthLabel, ymKey } from "@/lib/dates";

export default async function LibraryPage() {
  const { supabase } = await requireUser();
  const [influences, months] = await Promise.all([getAllInfluences(supabase), getAllMonths(supabase)]);
  const monthById = new Map(months.map((m) => [m.id, m]));

  // Same name (case-insensitive) in several months = one recurring character.
  const groups = new Map<string, typeof influences>();
  for (const inf of influences) {
    const k = inf.name.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), inf]);
  }

  const raw = [...groups.entries()].map(([key, list]) => {
    const latestWithImage = [...list].reverse().find((i) => i.image_key);
    const latestWhy = [...list].reverse().find((i) => i.why_it_resonates);
    const seen = new Map<string, { ym: string; label: string }>();
    for (const i of list) {
      const m = monthById.get(i.month_id);
      if (m) seen.set(m.id, { ym: ymKey(m.year, m.month), label: monthLabel(m.year, m.month) });
    }
    return {
      key,
      name: list[list.length - 1].name,
      imageKey: latestWithImage?.image_key ?? null,
      sources: [...new Set(list.map((i) => i.source_note).filter((s): s is string => !!s))],
      why: latestWhy?.why_it_resonates ?? null,
      months: [...seen.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
    };
  });

  const urls = await signKeys(raw.map((r) => r.imageKey));
  const items: LibraryItem[] = raw
    .map(({ imageKey, ...r }) => ({ ...r, url: imageKey ? urls[imageKey] ?? null : null }))
    // most recently appearing first
    .sort((a, b) => (b.months.at(-1)?.ym ?? "").localeCompare(a.months.at(-1)?.ym ?? ""));

  return (
    <div className="space-y-6">
      <Heading>Character library</Heading>
      <p className="font-hand text-xl text-ink-soft">Everyone who has ever shaped a month. Recurring ones show up more than once.</p>
      <LibraryList items={items} />
    </div>
  );
}
