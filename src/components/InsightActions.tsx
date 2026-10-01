"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryConclusion, retryEntryInsight } from "@/app/actions";

export function RetryEntryInsight({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} className="font-type text-xs underline"
      onClick={() => start(async () => { await retryEntryInsight(entryId); router.refresh(); })}
    >
      {pending ? "trying…" : "try again"}
    </button>
  );
}

export function RetryConclusion({ monthId }: { monthId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} className="font-type text-xs underline"
      onClick={() => start(async () => { await retryConclusion(monthId); router.refresh(); })}
    >
      {pending ? "trying…" : "try again"}
    </button>
  );
}
