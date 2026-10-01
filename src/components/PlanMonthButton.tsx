"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { planMonth } from "@/app/actions";

export function PlanMonthButton({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} className="font-type min-h-11 rounded border border-ink/40 px-4 text-sm"
      onClick={() => start(async () => { await planMonth(year, month); router.refresh(); })}
    >
      {pending ? "opening…" : "Plan this month"}
    </button>
  );
}
