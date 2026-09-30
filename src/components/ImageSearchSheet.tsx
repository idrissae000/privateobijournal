"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type Result = { thumb: string; full: string; title: string; source: string };

/** Find a photo on the web (or paste a link / a copied image) instead of saving it to the phone first. */
export function ImageSearchSheet({
  initialQuery, onClose, onPick, onLibrary,
}: {
  initialQuery: string;
  onClose: () => void;
  onPick: (file: File) => void | Promise<void>;
  /** switch to picking from the phone's photo library instead */
  onLibrary?: () => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Result[] | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<"search" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(q.trim())}`);
      const body = await res.json().catch(() => ({}));
      if (res.status === 501) { setNotConfigured(true); setResults([]); return; }
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setResults(body.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(null);
    }
  }

  async function importFrom(...urls: string[]) {
    setBusy("import");
    setError(null);
    for (const u of urls) {
      try {
        const res = await fetch(`/api/import-image?url=${encodeURIComponent(u)}`);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) continue;
        await onPick(new File([blob], "web-image", { type: blob.type }));
        onClose();
        return;
      } catch {
        // try the next candidate
      }
    }
    setBusy(null);
    setError("Couldn't grab that one. Try another image.");
  }

  function onPaste(e: React.ClipboardEvent) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      setBusy("import");
      Promise.resolve(onPick(file)).then(onClose, () => setBusy(null));
    }
  }

  return createPortal(
    // React bubbles events through portals to the parent React tree (e.g. the add-influence form),
    // so stop submit/click here or searching would also submit, and closing would also close, the parent.
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/50"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onSubmit={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()} onPaste={onPaste}
        className="safe-bottom paper-card mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-xl p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-hand text-3xl">Find a photo</h2>
          <button type="button" onClick={onClose} className="font-type px-2 py-2 text-sm underline">close</button>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <input
            className="input flex-1" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Kratos God of War Ragnarok" aria-label="Search the web for images" autoFocus
          />
          <button className="btn" disabled={busy !== null || !q.trim()}>{busy === "search" ? "…" : "Search"}</button>
        </form>

        {notConfigured && (
          <p className="font-hand text-xl leading-snug text-ink-soft">
            Web search isn&apos;t switched on yet (it needs a search API key). You can still paste an image link or a copied image below.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        {results && results.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {results.map((r) => (
              <li key={r.full}>
                <button
                  type="button" disabled={busy === "import"} onClick={() => importFrom(r.full, r.thumb)}
                  className="block aspect-square w-full overflow-hidden bg-paper-2 disabled:opacity-50" aria-label={r.title || "Use this image"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumb} alt={r.title} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {results && results.length === 0 && !notConfigured && <p className="font-hand text-center text-xl text-ink-soft">Nothing found. Try different words.</p>}
        {busy === "import" && <p className="font-hand text-center text-xl">Bringing it in…</p>}

        {onLibrary && (
          <button type="button" className="btn-ghost" onClick={() => { onClose(); onLibrary(); }}>🖼 Use a photo from my library instead</button>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); if (link.trim()) void importFrom(link.trim()); }}
          className="space-y-1 border-t border-dashed border-ink/30 pt-3"
        >
          <label className="font-type text-xs uppercase tracking-wider text-ink-soft" htmlFor="img-link">Or paste an image link / a copied image</label>
          <div className="flex gap-2">
            <input id="img-link" className="input flex-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
            <button className="btn-ghost" disabled={busy !== null || !link.trim()}>Use</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
