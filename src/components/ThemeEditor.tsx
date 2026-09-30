"use client";

import { useState } from "react";
import { MAX_THEMES, MAX_THEME_LENGTH, normalizeThemes } from "@/lib/themes";

/** Chip editor for free-form themes. Enter / comma adds; tap a suggestion to reuse an existing theme. */
export function ThemeEditor({
  value, onChange, suggestions = [], label = "Themes",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  label?: string;
}) {
  const [draft, setDraft] = useState("");
  const have = new Set(value.map((v) => v.toLowerCase()));
  const offer = [...new Map(suggestions.map((s) => [s.toLowerCase(), s])).values()]
    .filter((s) => !have.has(s.toLowerCase()))
    .slice(0, 8);

  function add(raw: string) {
    const next = normalizeThemes([...value, ...raw.split(",")]);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <span className="font-type text-xs uppercase tracking-wider text-ink-soft">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((t) => (
          <span key={t} className="label-tag inline-flex items-center gap-1.5">
            #{t}
            <button type="button" aria-label={`Remove ${t}`} className="px-0.5 text-ink-soft" onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
          </span>
        ))}
        {value.length < MAX_THEMES && (
          <input
            className="input !w-auto min-w-28 flex-1 !py-1 !text-sm" placeholder="add a theme…" value={draft} maxLength={MAX_THEME_LENGTH}
            onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) add(draft); } }}
            onBlur={() => draft.trim() && add(draft)}
            aria-label="Add a theme"
          />
        )}
      </div>
      {offer.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offer.map((s) => (
            <button key={s} type="button" className="label-tag !border-dashed opacity-80" onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
