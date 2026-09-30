"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sealMonth, unsealMonth } from "@/app/actions";
import { Stamp } from "@/components/scrap";

type Props = {
  monthId: string;
  title: string | null;
  reflection: string | null;
  sealedAt: string | null;
  /** The month is over (or on its last day): show the prompt up front. */
  due: boolean;
  influenceNames: string[];
  /** rendered inside the open panel: the month-end stats */
  children?: React.ReactNode;
};

/** Month-end ritual: "what do these influences have in common?" -> title + reflection -> seal. */
export function SealPanel({ monthId, title, reflection, sealedAt, due, influenceNames, children }: Props) {
  const router = useRouter();
  const [t, setT] = useState(title ?? "");
  const [r, setR] = useState(reflection ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sealedAt) {
    return (
      <section className="paper-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Stamp rotate={-4}>Sealed</Stamp>
          <button
            type="button" className="font-type text-xs underline" disabled={pending}
            onClick={() => start(async () => { await unsealMonth(monthId); router.refresh(); })}
          >
            reopen chapter
          </button>
        </div>
        {reflection && <p className="font-hand whitespace-pre-wrap text-2xl leading-snug">{reflection}</p>}
      </section>
    );
  }

  function seal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await sealMonth(monthId, t, r);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't seal");
      }
    });
  }

  const form = (
    <form onSubmit={seal} className="space-y-4">
      <p className="font-hand text-2xl leading-snug">
        Looking at these influences{influenceNames.length ? ` (${influenceNames.join(", ")})` : ""}, what do they have in common?
      </p>
      {children}
      <textarea
        className="lined w-full bg-transparent p-1 text-base outline-none" rows={5}
        value={r} onChange={(e) => setR(e.target.value)} placeholder="Write the reflection…" aria-label="Month-end reflection"
      />
      <label className="block">
        <span className="font-type text-xs uppercase tracking-wider text-ink-soft">Title this chapter</span>
        <input className="input font-hand !text-2xl" value={t} onChange={(e) => setT(e.target.value)} maxLength={200} placeholder="e.g. The Reluctant Fathers" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Sealing…" : "Seal this chapter"}</button>
    </form>
  );

  if (due) {
    return (
      <section className="paper-card relative space-y-2 border-2 border-dashed border-stamp/60 p-5">
        <Stamp rotate={3} className="absolute -top-3 right-4 bg-paper-3">Chapter ending</Stamp>
        {form}
      </section>
    );
  }
  return (
    <details className="paper-card p-4">
      <summary className="font-type cursor-pointer text-sm">Seal this chapter early</summary>
      <div className="pt-4">{form}</div>
    </details>
  );
}
