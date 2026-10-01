import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCtx } from "./client";
import { claimIfDue } from "./reports";
import { hasForeshadowData, runForeshadow } from "./foreshadow-job";
import { runReview } from "./review-job";

const DAY = 86_400_000;

/**
 * Lazy "cron": whenever the home page renders, quietly run whichever scheduled passes are due.
 * No scheduler or service key is needed, and nothing runs when the app isn't being used.
 * Call from `after()` so it never slows the page down.
 */
export async function runPeriodicJobs(ctx: AiCtx): Promise<void> {
  const { supabase } = ctx;
  if (await hasReviewData(supabase)) {
    if (await claimIfDue(supabase, "review", { intervalMs: 7 * DAY })) await runReview(ctx);
  }
  if (await hasForeshadowData(supabase)) {
    if (await claimIfDue(supabase, "foreshadow", { intervalMs: 3 * DAY })) await runForeshadow(ctx);
  }
}

async function hasReviewData(supabase: SupabaseClient): Promise<boolean> {
  const { count } = await supabase.from("influences").select("id", { count: "exact", head: true });
  return (count ?? 0) >= 2;
}
