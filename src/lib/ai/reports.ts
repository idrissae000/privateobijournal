import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportKind = "archetype" | "foreshadow" | "review";

export type Report<T = Record<string, unknown>> = {
  kind: ReportKind;
  content: T;
  fingerprint: string | null;
  status: "pending" | "done" | "failed";
  generated_at: string;
};

export async function getReport<T = Record<string, unknown>>(supabase: SupabaseClient, kind: ReportKind): Promise<Report<T> | null> {
  const { data } = await supabase
    .from("ai_reports").select("kind,content,fingerprint,status,generated_at").eq("kind", kind).maybeSingle();
  return (data as Report<T> | null) ?? null;
}

const age = (r: Report | null) => (r ? Date.now() - new Date(r.generated_at).getTime() : Infinity);

/**
 * Decide whether a background job for this report should start now, and if so claim it (status "pending",
 * stamped now) so a second request arriving moments later doesn't start a duplicate.
 *  - needsRefresh: the data changed since the stored report
 *  - minGapMs: don't regenerate more often than this (cost control)
 *  - pendingTimeoutMs: a "pending" claim older than this is treated as a crashed job
 */
export async function claimReport(
  supabase: SupabaseClient,
  kind: ReportKind,
  opts: { needsRefresh: boolean; minGapMs: number; pendingTimeoutMs?: number },
): Promise<{ claimed: boolean; existing: Report | null }> {
  const existing = await getReport(supabase, kind);
  if (!opts.needsRefresh && existing && existing.status !== "failed") return { claimed: false, existing };
  if (existing?.status === "pending" && age(existing) < (opts.pendingTimeoutMs ?? 3 * 60_000)) return { claimed: false, existing };
  if (existing && existing.status !== "pending" && age(existing) < opts.minGapMs) return { claimed: false, existing };

  await supabase.from("ai_reports").upsert(
    {
      kind,
      content: existing?.content ?? {},
      fingerprint: existing?.fingerprint ?? null,
      status: "pending",
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" },
  );
  return { claimed: true, existing };
}

export async function saveReport(
  supabase: SupabaseClient,
  kind: ReportKind,
  patch: { content?: unknown; fingerprint?: string | null; status: "done" | "failed" },
): Promise<void> {
  const row: Record<string, unknown> = { kind, status: patch.status, generated_at: new Date().toISOString() };
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.fingerprint !== undefined) row.fingerprint = patch.fingerprint;
  await supabase.from("ai_reports").upsert(row, { onConflict: "user_id,kind" });
}

/**
 * For scheduled jobs (not driven by data changes): claim the job if it has never run, or last ran more than
 * `intervalMs` ago. A failed run backs off for 30 minutes; a stuck "pending" claim expires after 3 minutes.
 * `force` (the admin "run now" button) skips the interval but still respects a live pending claim.
 */
export async function claimIfDue(
  supabase: SupabaseClient,
  kind: ReportKind,
  opts: { intervalMs: number; force?: boolean },
): Promise<boolean> {
  const r = await getReport(supabase, kind);
  if (r?.status === "pending" && age(r) < 3 * 60_000) return false;
  if (!opts.force) {
    if (r?.status === "done" && age(r) < opts.intervalMs) return false;
    if (r?.status === "failed" && age(r) < 30 * 60_000) return false;
  }
  await supabase.from("ai_reports").upsert(
    {
      kind,
      content: r?.content ?? {},
      fingerprint: r?.fingerprint ?? null,
      status: "pending",
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" },
  );
  return true;
}
