"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMonth } from "@/app/actions";

/** Retrospective chapters have no daily data: just a title and "how it changed me". */
export function RetroEditor({ monthId, title, howItChanged }: { monthId: string; title: string | null; howItChanged: string | null }) {
  const router = useRouter();
  const [t, setT] = useState(title ?? "");
  const [h, setH] = useState(howItChanged ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="paper-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await updateMonth(monthId, { title: t, howItChanged: h });
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save");
          }
        });
      }}
    >
      <label className="block">
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Chapter title</span>
        <input className="input font-hand !text-2xl" value={t} onChange={(e) => { setT(e.target.value); setSaved(false); }} maxLength={200} placeholder="Untitled chapter" />
      </label>
      <label className="block">
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">How it changed me</span>
        <textarea
          className="lined mt-1 w-full bg-transparent p-1 text-base outline-none" rows={6}
          value={h} onChange={(e) => { setH(e.target.value); setSaved(false); }} placeholder="Looking back, what did this month do to you?"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {saved && <span className="font-hand text-2xl text-moss">saved ✓</span>}
      </div>
    </form>
  );
}
