"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInfluence } from "@/app/actions";
import { ImageSlot } from "@/components/ImageSlot";

export type Suggestion = { name: string; image_key: string | null };

/** Bottom-sheet "add influence" action: name, image, why it resonates. Auto-stamped with the date. */
export function AddInfluenceButton({
  year, month, dateAdded, suggestions = [], label = "+ influence", className = "",
}: {
  year: number;
  month: number;
  dateAdded: string;
  suggestions?: Suggestion[];
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setName(""); setImageKey(null); setWhy(""); setSource(""); setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = suggestions.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    start(async () => {
      try {
        await addInfluence({
          year, month, name, imageKey: imageKey ?? match?.image_key ?? null, why, sourceNote: source, dateAdded,
        });
        reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that");
      }
    });
  }

  const uniqueNames = [...new Map(suggestions.map((s) => [s.name.toLowerCase(), s.name])).values()];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`btn-ghost ${className}`}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom paper-card mx-auto max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-xl p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-hand text-3xl">Add an influence</h2>
              <button type="button" onClick={() => setOpen(false)} className="font-type px-2 py-2 text-sm underline">close</button>
            </div>
            <p className="font-hand text-xl text-ink-soft">Who or what is on your mind? Stamped {dateAdded}.</p>

            <div className="flex gap-4">
              <div className="polaroid h-28 w-28 shrink-0 -rotate-2">
                <ImageSlot value={imageKey} onChange={(k) => setImageKey(k)} label="Add influence image" className="h-full w-full" searchQuery={name} />
              </div>
              <div className="flex-1 space-y-2">
                <input
                  className="input" placeholder="Name (e.g. Kratos)" value={name} list="influence-names"
                  onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus
                />
                <datalist id="influence-names">{uniqueNames.map((n) => <option key={n} value={n} />)}</datalist>
                <input
                  className="input" placeholder="From… (e.g. God of War Ragnarok)" value={source}
                  onChange={(e) => setSource(e.target.value)} maxLength={300}
                />
              </div>
            </div>

            <label className="block">
              <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Why it resonates</span>
              <textarea
                className="lined mt-1 w-full bg-transparent p-1 text-base outline-none" rows={3}
                value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Can stay empty for now"
              />
            </label>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button className="btn w-full" disabled={pending || !name.trim()}>{pending ? "Adding…" : "Add influence"}</button>
          </form>
        </div>
      )}
    </>
  );
}
