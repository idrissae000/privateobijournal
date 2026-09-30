"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhotos, deletePhoto, setPhotoFlags } from "@/app/actions";
import { ImageSlot } from "@/components/ImageSlot";
import { Frame } from "@/components/scrap";
import { formatShortDate } from "@/lib/dates";

export type ProgressItem = { id: string; url: string | null; date: string; ar: number; weight: number | null };

/** Private progress photos: flipbook (scrub / play), grid timeline, and first-vs-last compare. */
export function ProgressView({ items, today }: { items: ProgressItem[]; today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"flip" | "grid" | "compare">("flip");
  const [idx, setIdx] = useState(Math.max(0, items.length - 1));
  const [playing, setPlaying] = useState(false);
  const [pending, start] = useTransition();

  const i = Math.min(idx, Math.max(0, items.length - 1));
  const cur = items[i];

  useEffect(() => {
    if (!playing || items.length < 2) return;
    const t = setInterval(() => {
      setIdx((n) => {
        if (n >= items.length - 1) { setPlaying(false); return n; }
        return n + 1;
      });
    }, 700);
    return () => clearInterval(t);
  }, [playing, items.length]);

  const adder = (
    <div className="flex items-center gap-3">
      <div className="polaroid h-20 w-20 !p-1.5">
        <ImageSlot
          value={null} label="Add progress photo" className="h-full w-full"
          onChange={async (key, ar) => { await addPhotos(today, [{ key, ar, progress: true }]); router.refresh(); }}
        />
      </div>
      <p className="font-hand text-xl leading-tight text-ink-soft">Add today&apos;s progress photo</p>
    </div>
  );

  if (!items.length) {
    return (
      <div className="space-y-6">
        <p className="font-hand text-center text-2xl text-ink-soft">No progress photos yet. They stay private — never in galleries.</p>
        {adder}
      </div>
    );
  }

  const first = items[0];
  const last = items[items.length - 1];

  return (
    <div className="space-y-6">
      <div role="tablist" className="font-type flex gap-2 text-sm">
        {(["flip", "grid", "compare"] as const).map((m) => (
          <button
            key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setPlaying(false); }}
            className={`label-tag min-h-10 ${mode === m ? "!border-stamp !text-stamp" : ""}`}
          >
            {m === "flip" ? "flipbook" : m === "grid" ? "timeline" : "first vs last"}
          </button>
        ))}
      </div>

      {mode === "flip" && cur && (
        <div className="space-y-4">
          <div className="mx-auto w-64 rotate-1">
            <Frame src={cur.url} ar={cur.ar} caption={`${formatShortDate(cur.date)}${cur.weight != null ? ` · ${cur.weight}` : ""}`} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost" onClick={() => setIdx(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous photo">‹</button>
            <input
              type="range" min={0} max={items.length - 1} value={i} className="rating h-10 flex-1"
              onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }} aria-label="Scrub through photos"
            />
            <button type="button" className="btn-ghost" onClick={() => setIdx(Math.min(items.length - 1, i + 1))} disabled={i === items.length - 1} aria-label="Next photo">›</button>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button" className="btn-ghost" disabled={items.length < 2}
              onClick={() => { if (!playing && i >= items.length - 1) setIdx(0); setPlaying((p) => !p); }}
            >
              {playing ? "❚❚ pause" : "▶ play"}
            </button>
            <span className="font-type text-xs text-ink-soft">{i + 1} / {items.length}</span>
            <div className="flex gap-2">
              <button
                type="button" className="font-type text-xs underline" disabled={pending}
                onClick={() => start(async () => { await setPhotoFlags(cur.id, { is_progress_photo: false, is_hidden: false }); router.refresh(); })}
              >
                move to gallery
              </button>
              <button
                type="button" className="font-type text-xs text-red-800 underline" disabled={pending}
                onClick={() => { if (confirm("Delete this photo for good?")) start(async () => { await deletePhoto(cur.id); router.refresh(); }); }}
              >
                delete
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "grid" && (
        <ul className="grid grid-cols-3 gap-4">
          {items.map((p, n) => (
            <li key={p.id}>
              <button type="button" className="block w-full" style={{ transform: `rotate(${((n * 53) % 9) - 4}deg)` }} onClick={() => { setIdx(n); setMode("flip"); }}>
                <Frame src={p.url} ar={p.ar} caption={formatShortDate(p.date)} tape={n % 2 === 0} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "compare" && (
        items.length < 2 ? (
          <p className="font-hand text-center text-2xl text-ink-soft">Add a second progress photo to compare.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-center">
              <Frame src={first.url} ar={first.ar} caption={formatShortDate(first.date)} className="-rotate-2" />
              <p className="font-type text-xs text-ink-soft">first{first.weight != null ? ` · ${first.weight}` : ""}</p>
            </div>
            <div className="space-y-2 text-center">
              <Frame src={last.url} ar={last.ar} caption={formatShortDate(last.date)} className="rotate-2" />
              <p className="font-type text-xs text-ink-soft">latest{last.weight != null ? ` · ${last.weight}` : ""}</p>
            </div>
          </div>
        )
      )}

      {adder}
    </div>
  );
}
