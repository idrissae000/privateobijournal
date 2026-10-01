"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { askOpinion } from "@/app/actions";

export function AskOpinionButton({ type, id, label = "ask again" }: { type: "month" | "character"; id: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} className="font-type text-xs underline"
      onClick={() => start(async () => { await askOpinion(type, id); router.refresh(); })}
    >
      {pending ? "asking…" : label}
    </button>
  );
}
