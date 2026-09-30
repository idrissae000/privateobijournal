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
};

export function LibraryList({ items }: { items: LibraryItem[] }) {
  const [q, setQ] = useState("");
  const [recurring, setRecurring] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!recurring || i.months.length > 1) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.sources.some((s) => s.toLowerCase().includes(needle))),
    );
  }, [items, q, recurring]);

  return (
    <div className="space-y-6">
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
                {i.sources.length > 0 && <p className="font-type text-xs text-ink-soft">{i.sources.join(" · ")}</p>}
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
