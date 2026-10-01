import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCtx } from "./client";
import { dailyCallLimit } from "./config";
import { generateArchetype } from "./archetype-job";
import { generateConclusion, queueConclusion } from "./conclusion-job";
import { analyzeEntry, queueEntryAnalysis } from "./entry-job";
import { hasForeshadowData, runForeshadow } from "./foreshadow-job";
import { claimIfDue, getReport } from "./reports";
import { runReview } from "./review-job";
import { suggestTraits } from "./traits-job";

export type CatchUpPlan = {
  traits: string[];
  entries: string[];
  conclusions: string[];
  archetype: boolean;
  foreshadow: boolean;
  review: boolean;
  total: number;
};

/**
 * Everything that existed before the insight layer (or that failed earlier) and has never been read.
 * Discarded trait suggestions ("declined"), deliberately skipped entries and refusals are NOT included.
 */
export async function catchUpPlan(supabase: SupabaseClient, opts: { includeFailed?: boolean } = {}): Promise<CatchUpPlan> {
  const statuses = opts.includeFailed ? ["none", "failed"] : ["none"];

  const [{ data: inf }, { data: ent }, { data: mon }, archetype, foreshadow, review, { count: influenceCount }] = await Promise.all([
    supabase.from("influences").select("id,traits").in("traits_status", statuses),
    supabase.from("entries").select("id,note").in("insight_status", statuses).not("note", "is", null).order("date", { ascending: false }),
    supabase
      .from("months").select("id").not("sealed_at", "is", null).eq("is_retrospective", false).in("ai_conclusion_status", statuses),
    getReport(supabase, "archetype"),
    getReport(supabase, "foreshadow"),
    getReport(supabase, "review"),
    supabase.from("influences").select("id", { count: "exact", head: true }),
  ]);

  const traits = (inf ?? []).filter((i) => !(i.traits as string[] | null)?.length).map((i) => i.id as string);
  const entries = (ent ?? []).filter((e) => (e.note as string | null)?.trim()).map((e) => e.id as string);
  const conclusions = (mon ?? []).map((m) => m.id as string);
  const needs = (r: { status: string } | null) => !r || (!!opts.includeFailed && r.status === "failed");

  const plan: CatchUpPlan = {
    traits, entries, conclusions,
    archetype: (influenceCount ?? 0) >= 1 && needs(archetype),
    foreshadow: needs(foreshadow) && (await hasForeshadowData(supabase)),
    review: (influenceCount ?? 0) >= 2 && needs(review),
    total: 0,
  };
  plan.total = traits.length + entries.length + conclusions.length + +plan.archetype + +plan.foreshadow + +plan.review;
  return plan;
}

async function creditsLeft(supabase: SupabaseClient, day: string): Promise<number> {
  const { data } = await supabase.from("ai_usage").select("count").eq("day", day).maybeSingle();
  return dailyCallLimit() - ((data?.count as number | undefined) ?? 0);
}

export type CatchUpResult = { plan: CatchUpPlan; processed: number; capReached: boolean };

/**
 * One bounded slice of catch-up work (default 6 items, ~35s of wall time) so it fits inside a function
 * invocation. Order matters: traits first (scoring uses them), then entries (newest first), then month
 * conclusions, then the whole-journal reports. Call repeatedly until `plan.total` hits 0.
 */
export async function runCatchUpStep(
  ctx: AiCtx,
  opts: { maxItems?: number; includeFailed?: boolean } = {},
): Promise<CatchUpResult> {
  const { supabase } = ctx;
  const deadline = Date.now() + 35_000;
  const plan = await catchUpPlan(supabase, opts);
  let budget = opts.maxItems ?? 6;
  let processed = 0;
  let capReached = false;

  async function batch(ids: string[], fn: (id: string) => Promise<void>) {
    for (let i = 0; i < ids.length && budget > 0; ) {
      if (Date.now() > deadline) return;
      const left = await creditsLeft(supabase, ctx.day);
      if (left <= 0) { capReached = true; return; }
      const chunk = ids.slice(i, i + Math.min(3, budget, left));
      budget -= chunk.length;
      processed += chunk.length;
      i += chunk.length;
      await Promise.all(chunk.map(fn));
    }
  }

  await batch(plan.traits, async (id) => {
    await supabase.from("influences").update({ traits_status: "pending" }).eq("id", id);
    await suggestTraits(ctx, id);
  });
  await batch(plan.entries, async (id) => {
    const hash = await queueEntryAnalysis(supabase, id);
    if (hash) await analyzeEntry(ctx, id, hash);
  });
  await batch(plan.conclusions, async (id) => {
    await queueConclusion(supabase, id);
    await generateConclusion(ctx, id);
  });

  // whole-journal reports last (they read what the steps above just produced)
  const reports: [boolean, "archetype" | "foreshadow" | "review", (c: AiCtx) => Promise<void>][] = [
    [plan.archetype, "archetype", generateArchetype],
    [plan.foreshadow, "foreshadow", runForeshadow],
    [plan.review, "review", runReview],
  ];
  for (const [needed, kind, run] of reports) {
    if (!needed || budget <= 0 || Date.now() > deadline) continue;
    if ((await creditsLeft(supabase, ctx.day)) <= 0) { capReached = true; break; }
    if (await claimIfDue(supabase, kind, { intervalMs: 0, force: true })) {
      budget -= 1;
      processed += 1;
      await run(ctx);
    }
  }

  return { plan: await catchUpPlan(supabase, opts), processed, capReached };
}
