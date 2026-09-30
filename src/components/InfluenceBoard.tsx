"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInfluence, updateInfluence } from "@/app/actions";
import { ImageSlot } from "@/components/ImageSlot";
import { ThemeEditor } from "@/components/ThemeEditor";
import { Frame, Tag } from "@/components/scrap";
import { hash } from "@/lib/collage";
import { formatShortDate } from "@/lib/dates";
import type { Influence } from "@/lib/types";

type Props = {
  influences: Influence[];
  urls: Record<string, string>;
  /** retrospective / detailed layout: show why + source under each card */
  detailed?: boolean;
  /** existing themes, offered as quick picks in the editor */
  themeSuggestions?: string[];
};

/** The evolving mood board: every influence added this month as a taped polaroid. */
export function InfluenceBoard({ influences, urls, detailed = false, themeSuggestions = [] }: Props) {
  const [editing, setEditing] = useState<Influence | null>(null);

  if (!influences.length) return null;

  return (
    <>
      <ul className={detailed ? "space-y-8" : "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3"}>
        {influences.map((inf) => {
          const rot = (hash(inf.id) - 0.5) * 9;
          return (
            <li key={inf.id} className={detailed ? "flex gap-4" : ""}>
              <button
                type="button" onClick={() => setEditing(inf)} aria-label={`Edit ${inf.name}`}
                className={`block text-left ${detailed ? "w-36 shrink-0" : "w-full"}`}
                style={{ transform: `rotate(${rot}deg)` }}
              >
                <Frame src={inf.image_key ? urls[inf.image_key] : null} caption={inf.name}>
                  {!inf.image_key && (
                    <span className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-ink/30 text-3xl text-ink/50">+</span>
                  )}
                </Frame>
              </button>
              <div className={detailed ? "min-w-0 flex-1 pt-2" : "mt-2 text-center"}>
                {detailed && <p className="font-hand text-3xl leading-none">{inf.name}</p>}
                {inf.source_note && <p className="font-type text-xs text-ink-soft">{inf.source_note}</p>}
                <p className="font-hand text-lg leading-none text-stamp/80">added {formatShortDate(inf.date_added)}</p>
                {detailed && (inf.themes ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{inf.themes.map((t) => <Tag key={t}>#{t}</Tag>)}</div>
                )}
                {detailed && (
                  <p className="font-hand mt-2 whitespace-pre-wrap text-xl leading-snug">
                    {inf.why_it_resonates ?? <span className="text-ink-soft">Why did this matter? Tap the photo to write it.</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <InfluenceEditor key={editing.id} influence={editing} url={editing.image_key ? urls[editing.image_key] : null} themeSuggestions={themeSuggestions} onClose={() => setEditing(null)} />}
    </>
  );
}

function InfluenceEditor({ influence, url, themeSuggestions, onClose }: { influence: Influence; url: string | null; themeSuggestions: string[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(influence.name);
  const [source, setSource] = useState(influence.source_note ?? "");
  const [why, setWhy] = useState(influence.why_it_resonates ?? "");
  const [imageKey, setImageKey] = useState<string | null>(influence.image_key);
  const [themes, setThemes] = useState<string[]>(influence.themes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await updateInfluence(influence.id, { name, sourceNote: source, why, imageKey, themes });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!confirm(`Remove ${influence.name} from this month?`)) return;
    start(async () => {
      await deleteInfluence(influence.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={save} onClick={(e) => e.stopPropagation()}
        className="safe-bottom paper-card mx-auto max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-xl p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-hand text-3xl">{influence.name}</h2>
          <button type="button" onClick={onClose} className="font-type px-2 py-2 text-sm underline">close</button>
        </div>
        <div className="flex gap-4">
          <div className="polaroid h-28 w-28 shrink-0 rotate-2">
            <ImageSlot value={imageKey} url={imageKey === influence.image_key ? url : null} onChange={(k) => setImageKey(k)} label="Change image" className="h-full w-full" searchQuery={name} />
          </div>
          <div className="flex-1 space-y-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} aria-label="Name" />
            <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Note (e.g. Day 9: finished Ragnarok)" maxLength={300} aria-label="Source note" />
          </div>
        </div>
        <label className="block">
          <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Why it resonates</span>
          <textarea className="lined mt-1 w-full bg-transparent p-1 text-base outline-none" rows={4} value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
        <ThemeEditor value={themes} onChange={setThemes} suggestions={themeSuggestions} label="Themes (what this character stands for)" />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button className="btn flex-1" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</button>
          <button type="button" className="btn-ghost text-red-800" onClick={remove} disabled={pending}>Remove</button>
        </div>
      </form>
    </div>
  );
}
