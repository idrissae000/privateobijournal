"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMonth } from "@/app/actions";
import { ThemeEditor } from "@/components/ThemeEditor";
import { Tag } from "@/components/scrap";

/** A chapter's themes: what the month was really about. Suggests themes its influences share. */
export function MonthThemes({
  monthId, themes, shared, suggestions,
}: {
  monthId: string;
  themes: string[];
  /** themes carried by two or more of this month's influences */
  shared: string[];
  suggestions: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(themes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateMonth(monthId, { themes: draft });
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {themes.map((t) => <Tag key={t}>#{t}</Tag>)}
          <button type="button" className="font-type text-xs underline" onClick={() => { setDraft(themes); setEditing(true); }}>
            {themes.length ? "edit themes" : "+ add themes"}
          </button>
        </div>
        {!themes.length && shared.length > 0 && (
          <p className="font-hand text-lg leading-tight text-ink-soft">Your influences share: {shared.map((s) => `#${s}`).join(" ")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ThemeEditor label="Chapter themes" value={draft} onChange={setDraft} suggestions={[...shared, ...suggestions]} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save themes"}</button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
