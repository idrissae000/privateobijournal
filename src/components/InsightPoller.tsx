"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While background work is in flight, quietly re-fetch the page until it lands (or give up after a while). */
export function InsightPoller({ active, everyMs = 3000, maxMs = 90_000 }: { active: boolean; everyMs?: number; maxMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > maxMs) return clearInterval(id);
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, maxMs, router]);
  return null;
}
