import Link from "next/link";
import { EntryForm } from "@/components/EntryForm";
import { EntryPanel } from "@/components/EntryPanel";
import { AddInfluenceButton } from "@/components/AddInfluence";
import { Collage } from "@/components/Collage";
import { EntryInsight } from "@/components/EntryInsight";
import { Heading, Stamp, Tag, Tape } from "@/components/scrap";
import {
  getAllInfluences, getEntryByDate, getInfluences, getPhotosForEntries, getToday, isGalleryPhoto,
  requireUser, signKeys,
} from "@/lib/data";
import { formatLongDate, monthLabel } from "@/lib/dates";
import { ratingColor, ratingInk } from "@/lib/stats";

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** One scrapbook page: the day's entry on the left of the form, the collage below. */
export async function DayScreen({ date }: { date: string }) {
  const { supabase } = await requireUser();
  const today = await getToday();
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));

  const [entry, { data: monthRow }] = await Promise.all([
    getEntryByDate(supabase, date),
    supabase.from("months").select("id,is_retrospective").eq("year", year).eq("month", month).maybeSingle(),
  ]);
  const [influences, library, photos] = await Promise.all([
    monthRow ? getInfluences(supabase, monthRow.id) : Promise.resolve([]),
    getAllInfluences(supabase),
    entry ? getPhotosForEntries(supabase, [entry.id]) : Promise.resolve([]),
  ]);

  const gallery = photos.filter(isGalleryPhoto);
  const hasProgress = photos.some((p) => p.is_progress_photo);
  const urls = await signKeys(gallery.map((p) => p.storage_key));
  const tagged = influences.filter((i) => entry?.influence_ids.includes(i.id));
  const isToday = date === today;
  const isFuture = date > today;
  const editFirst = !entry && !isFuture;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-type text-xs uppercase tracking-wider text-ink-soft">
            {isToday ? "Today" : isFuture ? "Not yet" : "Looking back"} · <Link href={`/month/${date.slice(0, 7)}`} className="underline">{monthLabel(year, month)}</Link>
          </p>
          <Heading>{formatLongDate(date)}</Heading>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/day/${shift(date, -1)}`} aria-label="Previous day" className="font-type flex h-11 w-11 items-center justify-center text-xl">‹</Link>
          {!isFuture && date < today && (
            <Link href={`/day/${shift(date, 1)}`} aria-label="Next day" className="font-type flex h-11 w-11 items-center justify-center text-xl">›</Link>
          )}
          <Link href="/settings" aria-label="Settings" className="font-type flex h-11 w-11 items-center justify-center text-lg">⚙</Link>
        </div>
      </header>

      {/* The page itself */}
      <section className="paper-card relative -rotate-[0.6deg] p-5 pt-7">
        <Tape className="-top-3 left-6 -rotate-6" />
        <Tape className="-top-3 right-6 rotate-6" />
        {entry && (entry.rating != null || entry.note || tagged.length > 0 || entry.weigh_in != null) ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {entry.rating != null && (
                <Stamp rotate={-5} className="text-2xl">
                  <span style={{ color: "inherit" }}>{entry.rating}/10</span>
                </Stamp>
              )}
              {entry.weigh_in != null && <Tag>⚖ {entry.weigh_in}</Tag>}
              {tagged.map((i) => <Tag key={i.id} className="rotate-1">#{i.name}</Tag>)}
              {hasProgress && <Tag>📸 progress logged</Tag>}
            </div>
            {entry.note && <p className="font-hand whitespace-pre-wrap text-2xl leading-snug">{entry.note}</p>}
          </div>
        ) : (
          <p className="font-hand text-2xl text-ink-soft">
            {isFuture ? "This page is still blank — it hasn't happened yet." : "Nothing written yet. Add a line, a number, a photo."}
          </p>
        )}
        {entry?.rating != null && (
          <span
            aria-hidden
            className="absolute right-4 top-5 h-5 w-5 rounded-full border border-ink/20"
            style={{ background: ratingColor(entry.rating), color: ratingInk(entry.rating) }}
          />
        )}
      </section>

      {entry && <EntryInsight entry={entry} influences={influences} />}

      {gallery.length > 0 && (
        <Collage
          entryId={entry?.id ?? null}
          photos={gallery.map((p) => ({ id: p.id, url: urls[p.storage_key] ?? null, layout: p.layout }))}
        />
      )}

      {!isFuture && (
        <EntryPanel
          defaultOpen={editFirst}
          openLabel="Hide the form"
          closedLabel={entry ? "Edit this page" : "Write today's page"}
        >
          <EntryForm
            key={date}
            date={date}
            entry={entry}
            influences={influences}
            hasProgressToday={hasProgress}
            addInfluence={
              <AddInfluenceButton
                year={year} month={month} dateAdded={date}
                suggestions={library.map((l) => ({ name: l.name, image_key: l.image_key }))}
              />
            }
          />
        </EntryPanel>
      )}
    </div>
  );
}
