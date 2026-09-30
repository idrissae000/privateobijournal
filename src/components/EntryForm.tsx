"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhotos, saveEntry } from "@/app/actions";
import { ImageSlot } from "@/components/ImageSlot";
import { uploadImage } from "@/lib/image-upload";
import { ratingColor, ratingInk } from "@/lib/stats";
import type { Entry, Influence } from "@/lib/types";

/** The under-a-minute daily entry: rating, note, optional weigh-in, tags, photo dump. */
export function EntryForm({
  date, entry, influences, hasProgressToday, addInfluence,
}: {
  date: string;
  entry: Entry | null;
  influences: Influence[];
  hasProgressToday: boolean;
  /** rendered next to the tag chips (the add-influence button) */
  addInfluence: React.ReactNode;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [weigh, setWeigh] = useState(entry?.weigh_in != null ? String(entry.weigh_in) : "");
  const [tags, setTags] = useState<string[]>(entry?.influence_ids ?? []);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const dump = useRef<HTMLInputElement>(null);

  const toggle = (id: string) => {
    setSaved(false);
    setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const w = weigh.trim() === "" ? null : Number(weigh);
    if (w != null && (!Number.isFinite(w) || w <= 0)) return setError("Weigh-in should be a number.");
    start(async () => {
      try {
        await saveEntry({ date, rating, note, weighIn: w, influenceIds: tags });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  async function photoDump(list: File[]) {
    setError(null);
    const done: { key: string; ar: number }[] = [];
    let failed = 0;
    let next = 0;
    setProgress(`Uploading 0/${list.length}…`);
    // small pool so a big camera-roll dump doesn't choke the phone
    await Promise.all(
      Array.from({ length: Math.min(3, list.length) }, async () => {
        while (next < list.length) {
          const f = list[next++];
          try {
            done.push(await uploadImage(f));
          } catch {
            failed++;
          }
          setProgress(`Uploading ${done.length + failed}/${list.length}…`);
        }
      }),
    );
    try {
      if (done.length) await addPhotos(date, done);
      if (failed) setError(`${failed} photo${failed > 1 ? "s" : ""} didn't upload. Try those again.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add photos");
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={save} className="paper-card space-y-5 p-4">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="rating" className="font-type text-xs uppercase tracking-wider text-ink-soft">How was the day?</label>
          <span
            className="font-type flex h-9 min-w-9 items-center justify-center rounded px-2 text-lg"
            style={rating ? { background: ratingColor(rating), color: ratingInk(rating) } : { border: "1.5px dashed var(--ink-soft)" }}
          >
            {rating ?? "—"}
          </span>
        </div>
        <input
          id="rating" type="range" min={1} max={10} step={1} value={rating ?? 5}
          onChange={(e) => { setRating(Number(e.target.value)); setSaved(false); }}
          onPointerDown={() => rating == null && setRating(5)}
          className="rating mt-2 h-10 w-full" aria-valuetext={rating ? `${rating} out of 10` : "not rated"}
        />
        {rating != null && (
          <button type="button" onClick={() => { setRating(null); setSaved(false); }} className="font-type text-xs underline">clear rating</button>
        )}
      </div>

      <label className="block">
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Quick note</span>
        <textarea
          className="lined mt-1 w-full bg-transparent p-1 text-base outline-none" rows={3}
          value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          placeholder="What stuck with you today?"
        />
      </label>

      <label className="flex items-center gap-3">
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Weigh-in</span>
        <input
          className="input max-w-28" inputMode="decimal" placeholder="optional" value={weigh}
          onChange={(e) => { setWeigh(e.target.value); setSaved(false); }}
        />
      </label>

      <div>
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">On my mind</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {influences.map((i) => {
            const on = tags.includes(i.id);
            return (
              <button
                key={i.id} type="button" onClick={() => toggle(i.id)} aria-pressed={on}
                className={`label-tag min-h-9 ${on ? "!border-stamp !bg-stamp/10 !text-stamp" : ""}`}
              >
                {on ? "✓ " : ""}{i.name}
              </button>
            );
          })}
          {addInfluence}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={() => dump.current?.click()} disabled={!!progress}>
          {progress ?? "📷 Photo dump"}
        </button>
        <input
          ref={dump} type="file" accept="image/*" multiple hidden
          onChange={(e) => {
            // copy first: resetting the input empties the live FileList
            const picked = [...(e.target.files ?? [])];
            e.target.value = "";
            if (picked.length) void photoDump(picked);
          }}
        />
        <div className="flex items-center gap-2">
          <div className="polaroid h-16 w-16 !p-1">
            <ImageSlot
              value={null} label="Add progress photo" className="h-full w-full"
              onChange={async (key, ar) => { await addPhotos(date, [{ key, ar, progress: true }]); router.refresh(); }}
            />
          </div>
          <span className="font-hand text-lg leading-tight text-ink-soft">
            {hasProgressToday ? "progress photo saved ✓" : "progress photo"}
          </span>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn flex-1" disabled={pending}>{pending ? "Saving…" : "Save entry"}</button>
        {saved && <span className="font-hand text-2xl text-moss">saved ✓</span>}
      </div>
    </form>
  );
}
