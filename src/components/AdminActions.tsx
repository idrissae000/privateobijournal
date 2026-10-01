"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateArchetypeNow, runForeshadowNow, runReviewNow, setFlagStatus, testAiConnection } from "@/app/actions";
import { InsightPoller } from "@/components/InsightPoller";

export function AdminActions({
  aiOn, reviewPending, foreshadowPending, archetypePending,
}: { aiOn: boolean; reviewPending: boolean; foreshadowPending: boolean; archetypePending: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ started?: boolean; ok?: boolean; message?: string }>, label: string) =>
    start(async () => {
      setNote(null);
      const r = await fn();
      if (r.message !== undefined) setNote({ ok: !!r.ok, text: r.message });
      else setNote({ ok: !!r.started, text: r.started ? `${label} started. It runs in the background; this page updates when it's done.` : `${label}: nothing to do right now (not enough data, or already running).` });
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <InsightPoller active={reviewPending || foreshadowPending || archetypePending} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(testAiConnection, "Connection test")}>Test connection</button>
        <button type="button" className="btn-ghost" disabled={pending || !aiOn || reviewPending} onClick={() => run(runReviewNow, "Accuracy pass")}>
          {reviewPending ? "Reviewing…" : "Run accuracy pass now"}
        </button>
        <button type="button" className="btn-ghost" disabled={pending || !aiOn || foreshadowPending} onClick={() => run(runForeshadowNow, "Foreshadowing check")}>
          {foreshadowPending ? "Checking…" : "Run foreshadowing check"}
        </button>
        <button type="button" className="btn-ghost" disabled={pending || !aiOn || archetypePending} onClick={() => run(regenerateArchetypeNow, "Character sheet")}>
          {archetypePending ? "Rewriting…" : "Rewrite character sheet"}
        </button>
      </div>
      {note && <p role="status" className={`text-sm ${note.ok ? "text-moss" : "text-red-700"}`}>{note.text}</p>}
    </div>
  );
}

export type FlagRow = {
  id: string; code: string; severity: "info" | "warn"; message: string; suggestion: string | null;
  href: string | null; where: string | null;
};

const CODE_LABEL: Record<string, string> = {
  duplicate_character: "Possible duplicate", trait_mismatch: "Trait check", theme_mismatch: "Theme check",
  theme_variant: "Theme spelling", fact_check: "Fact check", missing_why: "Missing 'why'", inconsistent: "Inconsistent", other: "Worth a look",
};

export function FlagList({ flags }: { flags: FlagRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!flags.length) return <p className="font-hand text-xl text-ink-soft">Nothing flagged. Flags only ever point at things; they never change what you wrote.</p>;
  return (
    <ul className="space-y-3">
      {flags.map((f) => (
        <li key={f.id} className="paper-card space-y-1.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`label-tag ${f.severity === "warn" ? "!border-stamp !text-stamp" : ""}`}>{CODE_LABEL[f.code] ?? f.code}</span>
            {f.href && f.where && <a href={f.href} className="font-type text-xs underline">{f.where}</a>}
          </div>
          <p className="font-hand text-2xl leading-snug">{f.message}</p>
          {f.suggestion && <p className="font-hand text-xl leading-snug text-ink-soft">Maybe: {f.suggestion}</p>}
          <div className="flex gap-4 pt-1">
            <button type="button" disabled={pending} className="font-type text-xs underline" onClick={() => start(async () => { await setFlagStatus(f.id, "resolved"); router.refresh(); })}>I fixed it</button>
            <button type="button" disabled={pending} className="font-type text-xs underline" onClick={() => start(async () => { await setFlagStatus(f.id, "dismissed"); router.refresh(); })}>It&apos;s fine, dismiss</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
