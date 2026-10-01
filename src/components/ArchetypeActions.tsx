"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateArchetypeNow } from "@/app/actions";

export function RegenerateArchetype({ label = "try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} className="font-type text-xs underline"
      onClick={() => start(async () => { await regenerateArchetypeNow(); router.refresh(); })}
    >
      {pending ? "starting…" : label}
    </button>
  );
}
