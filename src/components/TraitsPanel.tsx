"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTraits, discardTraits, requestTraits } from "@/app/actions";
import { InsightPoller } from "@/components/InsightPoller";
import { ThemeEditor } from "@/components/ThemeEditor";
import { MAX_TRAITS, MAX_TRAIT_LENGTH, normalizeTraits } from "@/lib/traits";
import type { Influence } from "@/lib/types";

const traitEditor = { prefix: "", normalize: normalizeTraits, max: MAX_TRAITS, maxLength: MAX_TRAIT_LENGTH } as const;

/**
 * Traits: what the daily entries are scored against. Claude suggests 3-5 when an influence is added;
 * the user keeps, edits or discards them. Nothing here touches the "why it resonates" text.
 */
export function TraitsPanel({ influence, aiOn }: { influence: Influence; aiOn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accepted, setAccepted] = useState<string[]>(influence.traits ?? []);
  const [draft, setDraft] = useState<string[]>(influence.suggested_traits ?? []);
  const [seenSuggestion, setSeenSuggestion] = useState((influence.suggested_traits ?? []).join("|"));
  const [error, setError] = useState<string | null>(null);

  // When a fresh suggestion lands (the poller refreshed the page), load it into the editable draft.
  const incoming = (influence.suggested_traits ?? []).join("|");
  if (incoming !== seenSuggestion) {
    setSeenSuggestion(incoming);
    setDraft(influence.suggested_traits ?? []);
  }

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  const status = influence.traits_status;
  const dirty = accepted.join("|") !== (influence.traits ?? []).join("|");

  return (
    <section className="space-y-3 border-t border-dashed border-ink/30 pt-4" aria-label="Traits">
      <InsightPoller active={status === "pending"} />
      <div>
        <h3 className="font-hand text-2xl leading-none">Traits</h3>
        <p className="font-type mt-1 text-[11px] text-ink-soft">Your daily entries get read against these. Your own words above stay untouched.</p>
      </div>

      {status === "pending" && <p role="status" className="font-hand animate-pulse text-xl text-ink-soft">thinking about {influence.name}…</p>}

      {status === "suggested" && draft.length > 0 && (
        <div className="space-y-2 rounded border-2 border-dashed border-stamp/50 p-3">
          <p className="font-hand text-xl leading-snug">
            Suggested for {influence.name}
            {influence.traits_confidence === "low" && <span className="text-stamp"> · I&apos;m not sure about this one, check them</span>}
            {influence.traits_confidence === "medium" && <span className="text-ink-soft"> · partly sure</span>}
          </p>
          <ThemeEditor {...traitEditor} label="Edit before keeping" value={draft} onChange={setDraft} placeholder="add a trait…" />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn" disabled={pending || !draft.length} onClick={() => run(() => acceptTraits(influence.id, [...accepted, ...draft]))}>
              {pending ? "Saving…" : "Keep these"}
            </button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => discardTraits(influence.id))}>Discard</button>
          </div>
        </div>
      )}

      {(status === "failed" || status === "skipped") && (
        <p className="font-hand text-xl text-ink-soft">
          Couldn&apos;t suggest traits just now.{" "}
          <button type="button" className="font-type text-xs underline" disabled={pending} onClick={() => run(() => requestTraits(influence.id))}>try again</button>
        </p>
      )}

      {(accepted.length > 0 || status === "done" || status === "none" || status === "suggested") && (
        <div className="space-y-2">
          <ThemeEditor {...traitEditor} label="Your traits" value={accepted} onChange={setAccepted} placeholder="add a trait…" />
          {dirty && (
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => acceptTraits(influence.id, accepted))}>Save traits</button>
          )}
        </div>
      )}

      {aiOn && status !== "pending" && status !== "suggested" && (
        <button type="button" className="font-type text-xs underline" disabled={pending} onClick={() => run(() => requestTraits(influence.id))}>
          {accepted.length ? "suggest different traits" : "suggest traits for me"}
        </button>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
