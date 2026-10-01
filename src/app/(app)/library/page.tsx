import { LibraryList, type LibraryItem, type ThemeGroup } from "@/components/LibraryList";
import { Heading } from "@/components/scrap";
import { getAllInfluences, getAllMonths, requireUser, signKeys } from "@/lib/data";
import { fidelityLabel } from "@/lib/fidelity";
import { monthLabel, ymKey } from "@/lib/dates";

export default async function LibraryPage() {
  const { supabase } = await requireUser();
  const [influences, months, { data: scoreRows }] = await Promise.all([
    getAllInfluences(supabase),
    getAllMonths(supabase),
    supabase.from("entry_influence_scores").select("influence_id,score"),
  ]);
  const scoresByInfluence = new Map<string, number[]>();
  for (const r of (scoreRows ?? []) as { influence_id: string; score: number }[]) {
    scoresByInfluence.set(r.influence_id, [...(scoresByInfluence.get(r.influence_id) ?? []), r.score]);
  }
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
      fidelity: (() => {
        const xs = list.flatMap((i) => scoresByInfluence.get(i.id) ?? []);
        const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        return { avg, days: xs.length, label: fidelityLabel(avg, xs.length) };
      })(),
      themes: [...new Map(list.flatMap((i) => i.themes ?? []).map((t) => [t.toLowerCase(), t])).values()],
      months: [...seen.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
    };
  });

  const urls = await signKeys(raw.map((r) => r.imageKey));
  const items: LibraryItem[] = raw
    .map(({ imageKey, ...r }) => ({ ...r, url: imageKey ? urls[imageKey] ?? null : null }))
    // most recently appearing first
    .sort((a, b) => (b.months.at(-1)?.ym ?? "").localeCompare(a.months.at(-1)?.ym ?? ""));

  // Theme -> the characters and the months that carry it
  const groupsByKey = new Map<string, ThemeGroup>();
  const group = (t: string) => {
    const k = t.toLowerCase();
    if (!groupsByKey.has(k)) groupsByKey.set(k, { theme: t, characters: [], months: [] });
    return groupsByKey.get(k)!;
  };
  for (const r of raw) for (const t of r.themes) group(t).characters.push(r.name);
  for (const m of months) {
    for (const t of m.themes ?? []) group(t).months.push({ ym: ymKey(m.year, m.month), label: monthLabel(m.year, m.month) });
  }
  const themeGroups = [...groupsByKey.values()].sort(
    (a, b) => b.characters.length + b.months.length - (a.characters.length + a.months.length) || a.theme.localeCompare(b.theme),
  );

  return (
    <div className="space-y-6">
      <Heading>Character library</Heading>
      <p className="font-hand text-xl text-ink-soft">Everyone who has ever shaped a month. Recurring ones show up more than once.</p>
      <LibraryList items={items} themeGroups={themeGroups} />
    </div>
  );
}
