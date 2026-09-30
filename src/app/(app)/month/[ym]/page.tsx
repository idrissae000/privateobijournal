import Link from "next/link";
import { notFound } from "next/navigation";
import { AddInfluenceButton } from "@/components/AddInfluence";
import { CalendarGrid } from "@/components/CalendarGrid";
import { InfluenceBoard } from "@/components/InfluenceBoard";
import { MonthCoverPhoto } from "@/components/MonthCoverPhoto";
import { MonthThemes } from "@/components/MonthThemes";
import { RetroEditor } from "@/components/RetroEditor";
import { SealPanel } from "@/components/SealPanel";
import { WeightChart } from "@/components/WeightChart";
import { Empty, Frame, Heading, Stamp, Tape } from "@/components/scrap";
import {
  getAllInfluences, getAllMonths, getEntries, getInfluences, getOrCreateMonth, getPhotosForEntries, getToday,
  isGalleryPhoto, requireUser, signKeys,
} from "@/lib/data";
import {
  dayKey, daysInMonth, formatShortDate, monthLabel, nextYm, parseYm, prevYm, ymKey,
} from "@/lib/dates";
import { computeStats, fmt1 } from "@/lib/stats";
import { collectThemes, sharedThemes } from "@/lib/themes";
import type { Month } from "@/lib/types";

export default async function MonthPage({ params }: PageProps<"/month/[ym]">) {
  const { ym } = await params;
  const parsed = parseYm(ym);
  if (!parsed) notFound();
  const { year, month: m } = parsed;

  const { supabase } = await requireUser();
  const today = await getToday();
  const currentYm = today.slice(0, 7);
  const isFutureMonth = ym > currentYm;

  let month: Month | null;
  if (isFutureMonth) {
    const { data } = await supabase.from("months").select("*").eq("year", year).eq("month", m).maybeSingle();
    month = (data as Month | null) ?? null;
  } else {
    month = await getOrCreateMonth(supabase, year, m);
  }

  const prev = prevYm(year, m);
  const next = nextYm(year, m);
  const nav = (
    <div className="flex items-center justify-between">
      <Link href={`/month/${ymKey(prev.year, prev.month)}`} className="font-type flex min-h-11 items-center px-1 text-sm">‹ {monthLabel(prev.year, prev.month)}</Link>
      <Link href="/timeline" className="font-type text-xs underline">all chapters</Link>
      {ymKey(next.year, next.month) <= currentYm ? (
        <Link href={`/month/${ymKey(next.year, next.month)}`} className="font-type flex min-h-11 items-center px-1 text-sm">{monthLabel(next.year, next.month)} ›</Link>
      ) : <span className="w-24" />}
    </div>
  );

  if (!month) {
    return (
      <div className="space-y-6">
        {nav}
        <Heading>{monthLabel(year, m)}</Heading>
        <Empty>This chapter hasn&apos;t started yet.</Empty>
      </div>
    );
  }

  const retro = month.is_retrospective;
  const [influences, library, allMonths, entries] = await Promise.all([
    getInfluences(supabase, month.id),
    getAllInfluences(supabase),
    getAllMonths(supabase),
    retro ? Promise.resolve([]) : getEntries(supabase, month.id),
  ]);
  const photos = await getPhotosForEntries(supabase, entries.map((e) => e.id));
  const dateByEntry = new Map(entries.map((e) => [e.id, e.date]));
  const gallery = photos.filter(isGalleryPhoto);
  const progress = photos
    .filter((p) => p.is_progress_photo)
    .sort((a, b) => (dateByEntry.get(a.entry_id!) ?? "").localeCompare(dateByEntry.get(b.entry_id!) ?? ""));
  const firstP = progress[0];
  const lastP = progress.length > 1 ? progress[progress.length - 1] : null;

  const urls = await signKeys([
    month.cover_image_key,
    ...influences.map((i) => i.image_key),
    ...gallery.map((p) => p.storage_key),
    firstP?.storage_key,
    lastP?.storage_key,
  ]);

  const stats = computeStats(entries, influences);
  const weights = entries.filter((e) => e.weigh_in != null).map((e) => ({ date: e.date, value: Number(e.weigh_in) }));
  const lastDay = dayKey(year, m, daysInMonth(year, m));
  const due = !retro && today >= lastDay;
  const inMonth = today.startsWith(ym);
  const stamped = inMonth ? today : dayKey(year, m, 1);

  const suggestions = library.map((l) => ({ name: l.name, image_key: l.image_key }));
  const allThemes = collectThemes(allMonths, library);

  return (
    <div className="space-y-8">
      {nav}

      {/* Cover spread */}
      <section className={`paper-card relative space-y-6 p-5 pt-8 ${retro ? "outline-2 -outline-offset-8 outline-dashed outline-ink/25" : ""}`}>
        <Tape className="-top-3 left-8 -rotate-6" />
        <Tape className="-top-3 right-8 rotate-6" />
        <div className="flex items-start justify-between gap-3">
          <p className="font-type text-xs uppercase tracking-wider text-ink-soft">Chapter · {monthLabel(year, m)}</p>
          {retro && <Stamp rotate={4} className="text-[11px] !text-ink-soft">retrospective</Stamp>}
          {month.sealed_at && !retro && <Stamp rotate={4} className="text-[11px]">sealed</Stamp>}
        </div>
        <div>
          <h1 className="font-hand text-5xl leading-none">{month.title ?? <span className="text-ink-soft">Untitled chapter</span>}</h1>
          {!month.title && !retro && (
            <p className="font-hand mt-2 text-xl text-ink-soft">The title gets written at the end of the month.</p>
          )}
        </div>
        <MonthThemes monthId={month.id} themes={month.themes ?? []} shared={sharedThemes(influences)} suggestions={allThemes} />
        <MonthCoverPhoto monthId={month.id} searchQuery={month.title ?? influences.map((i) => i.name).join(" ")} value={month.cover_image_key} url={month.cover_image_key ? urls[month.cover_image_key] : null} />

        <div className="space-y-4">
          <Heading>{retro ? "Who shaped it" : "Influences"}</Heading>
          {influences.length ? (
            <InfluenceBoard influences={influences} urls={urls} detailed={retro} themeSuggestions={allThemes} />
          ) : (
            <Empty>{retro ? "No influences here yet." : "Blank so far. Add whoever is on your mind."}</Empty>
          )}
          <AddInfluenceButton year={year} month={m} dateAdded={stamped} suggestions={suggestions} />
        </div>
      </section>

      {retro ? (
        <RetroEditor monthId={month.id} title={month.title} howItChanged={month.how_it_changed_me} />
      ) : (
        <>
          {(due || month.sealed_at) && (
            <SealPanel
              monthId={month.id} title={month.title} reflection={month.month_end_reflection}
              sealedAt={month.sealed_at} due={due} influenceNames={influences.map((i) => i.name)}
            >
              <p className="font-type text-xs text-ink-soft">
                {stats.ratedDays
                  ? `Average ${fmt1(stats.avg)} overall · ${fmt1(stats.taggedAvg)} on days with an influence tagged`
                  : "No rated days this month."}
              </p>
            </SealPanel>
          )}

          <section className="space-y-3">
            <Heading>The month</Heading>
            <div className="paper-card p-4">
              <CalendarGrid year={year} month={m} entries={entries} today={today} />
            </div>
          </section>

          <section className="space-y-3">
            <Heading>By the numbers</Heading>
            {stats.ratedDays ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Average" value={fmt1(stats.avg)} sub={`${stats.ratedDays} days rated`} />
                  <Stat label="Best" value={String(stats.best!.rating)} sub={formatShortDate(stats.best!.date)} href={`/day/${stats.best!.date}`} />
                  <Stat label="Worst" value={String(stats.worst!.rating)} sub={formatShortDate(stats.worst!.date)} href={`/day/${stats.worst!.date}`} />
                </div>
                {influences.length > 0 && (
                  <div className="paper-card space-y-2 p-4">
                    <p className="font-type text-xs uppercase tracking-wider text-ink-soft">Influence-tagged days vs. overall</p>
                    <p className="font-hand text-2xl">
                      {stats.taggedDays ? (
                        <>
                          {fmt1(stats.taggedAvg)} <span className="text-ink-soft">vs</span> {fmt1(stats.avg)}
                          <span className="text-lg text-ink-soft"> · {stats.taggedDays} tagged day{stats.taggedDays === 1 ? "" : "s"}</span>
                        </>
                      ) : (
                        <span className="text-ink-soft">Tag influences on your days to compare.</span>
                      )}
                    </p>
                    <table className="font-type w-full text-sm">
                      <tbody>
                        {stats.perInfluence.map(({ influence, days, avg }) => (
                          <tr key={influence.id} className="border-t border-ink/10">
                            <td className="py-1.5">{influence.name}</td>
                            <td className="py-1.5 text-right text-ink-soft">{days} day{days === 1 ? "" : "s"}</td>
                            <td className="w-16 py-1.5 text-right">{fmt1(avg)}</td>
                            <td className={`w-14 py-1.5 text-right ${avg != null && stats.avg != null ? (avg >= stats.avg ? "text-moss" : "text-stamp") : ""}`}>
                              {avg != null && stats.avg != null ? `${avg - stats.avg >= 0 ? "+" : ""}${(avg - stats.avg).toFixed(1)}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <Empty>Rate a day and the numbers show up here.</Empty>
            )}
          </section>

          {gallery.length > 0 && (
            <section className="space-y-3">
              <Heading>Photos</Heading>
              <ul className="grid grid-cols-3 gap-3">
                {gallery.map((p, i) => (
                  <li key={p.id} style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
                    <Link href={`/day/${dateByEntry.get(p.entry_id!)}`} aria-label={`Photo from ${dateByEntry.get(p.entry_id!)}`}>
                      <Frame src={urls[p.storage_key]} caption={formatShortDate(dateByEntry.get(p.entry_id!)!)} tape={i % 2 === 0} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weights.length > 0 && (
            <section className="space-y-3">
              <Heading>Weight</Heading>
              <div className="paper-card p-4">
                {weights.length > 1 ? (
                  <WeightChart points={weights} />
                ) : (
                  <p className="font-hand text-2xl">{weights[0].value} <span className="text-ink-soft">on {formatShortDate(weights[0].date)}. One more weigh-in and a line appears.</span></p>
                )}
              </div>
              {firstP && (
                <div className="space-y-2">
                  <p className="font-type text-xs uppercase tracking-wider text-ink-soft">
                    {lastP ? "First vs. last progress photo" : "Progress photo"} · <Link href="/progress" className="underline">all progress</Link>
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Frame src={urls[firstP.storage_key]} caption={formatShortDate(dateByEntry.get(firstP.entry_id!)!)} className="-rotate-2" />
                    {lastP && <Frame src={urls[lastP.storage_key]} caption={formatShortDate(dateByEntry.get(lastP.entry_id!)!)} className="rotate-2" />}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const body = (
    <div className="paper-card p-3">
      <p className="font-type text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="font-hand text-4xl leading-none">{value}</p>
      <p className="font-type mt-1 text-[11px] text-ink-soft">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
