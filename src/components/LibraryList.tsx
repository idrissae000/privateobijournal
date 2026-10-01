"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Frame, Stamp } from "@/components/scrap";
import { hash } from "@/lib/collage";

export type LibraryItem = {
  key: string;
  name: string;
  url: string | null;
  sources: string[];
  why: string | null;
  /** months this character appeared in, oldest first */
  months: { ym: string; label: string }[];
  themes: string[];
  /** how truly this character was lived, across every month they appeared in */
  fidelity: { avg: number | null; days: number; label: "lived" | "partly" | "not" | "early" | "none" };
};

export type ThemeGroup = {
  theme: string;
  characters: string[];
  months: { ym: string; label: string }[];
};

export function LibraryList({ items, themeGroups }: { items: LibraryItem[]; themeGroups: ThemeGroup[] }) {
  const [view, setView] = useState<"characters" | "themes">("characters");
  const [q, setQ] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [theme, setTheme] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!recurring || i.months.length > 1) &&
        (!theme || i.themes.some((t) => t.toLowerCase() === theme.toLowerCase())) &&
        (!needle ||
          i.name.toLowerCase().includes(needle) ||
          i.sources.some((s) => s.toLowerCase().includes(needle)) ||
          i.themes.some((t) => t.toLowerCase().includes(needle))),
    );
  }, [items, q, recurring, theme]);

  const toggle = (
    <div role="tablist" className="font-type flex gap-2 text-sm">
      {(["characters", "themes"] as const).map((v) => (
        <button
          key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
          className={`label-tag min-h-10 ${view === v ? "!border-stamp !text-stamp" : ""}`}
        >
          {v}
        </button>
      ))}
    </div>
  );

  if (view === "themes") {
    return (
      <div className="space-y-6">
        {toggle}
        {themeGroups.length === 0 ? (
          <p className="font-hand text-center text-2xl text-ink-soft">No themes yet. Add #themes to a character or a month.</p>
        ) : (
          <ul className="space-y-5">
            {themeGroups.map((g) => (
              <li key={g.theme} className="paper-card space-y-2 p-4">
                <p className="font-hand text-3xl leading-none">#{g.theme}</p>
                {g.characters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {g.characters.map((c) => (
                      <button key={c} type="button" className="label-tag" onClick={() => { setView("characters"); setTheme(g.theme); setQ(""); }}>{c}</button>
                    ))}
                  </div>
                )}
                {g.months.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {g.months.map((m) => <Link key={m.ym} href={`/month/${m.ym}`} className="label-tag !border-dashed">{m.label}</Link>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toggle}
      <div className="flex items-center gap-3">
        <input
          className="input flex-1" type="search" placeholder="Search characters…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search the library"
        />
        <button
          type="button" onClick={() => setRecurring((r) => !r)} aria-pressed={recurring}
          className={`label-tag min-h-10 ${recurring ? "!border-stamp !text-stamp" : ""}`}
        >
          ↻ recurring
        </button>
      </div>

      {themeGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {themeGroups.filter((g) => g.characters.length > 0).slice(0, 12).map((g) => (
            <button
              key={g.theme} type="button" aria-pressed={theme === g.theme} onClick={() => setTheme(theme === g.theme ? null : g.theme)}
              className={`label-tag ${theme === g.theme ? "!border-stamp !text-stamp" : ""}`}
            >
              #{g.theme}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="font-hand text-center text-2xl text-ink-soft">{items.length ? "Nobody matches that." : "No influences yet."}</p>
      ) : (
        <ul className="space-y-8">
          {shown.map((i) => (
            <li key={i.key} className="flex gap-4">
              <div className="w-32 shrink-0" style={{ transform: `rotate(${(hash(i.key) - 0.5) * 8}deg)` }}>
                <Frame src={i.url} caption={i.name}>
                  {!i.url && <span className="absolute inset-0 flex items-center justify-center text-3xl text-ink/30">?</span>}
                </Frame>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-hand text-3xl leading-none">{i.name}</p>
                  {i.months.length > 1 && <Stamp rotate={-3} className="text-[10px]">×{i.months.length} months</Stamp>}
                </div>
                {i.fidelity.avg != null && i.fidelity.days >= 3 && (
                  <p className="font-type text-[11px] text-ink-soft">
                    lived up to {i.fidelity.avg.toFixed(1)}/10 · {i.fidelity.days} days scored{i.months.length > 1 ? ` across ${i.months.length} months` : ""}
                  </p>
                )}
                {i.sources.length > 0 && <p className="font-type text-xs text-ink-soft">{i.sources.join(" · ")}</p>}
                {i.themes.length > 0 && <p className="font-hand text-lg leading-tight text-stamp/80">{i.themes.map((t) => `#${t}`).join(" ")}</p>}
                {i.why && <p className="font-hand line-clamp-3 text-lg leading-snug">{i.why}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {i.months.map((m) => (
                    <Link key={m.ym} href={`/month/${m.ym}`} className="label-tag">{m.label}</Link>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
