import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { AdminActions, FlagList, type FlagRow } from "@/components/AdminActions";
import { Heading } from "@/components/scrap";
import { aiConfigured, dailyCallLimit, insightModel } from "@/lib/ai/config";
import { getReport } from "@/lib/ai/reports";
import { getAllInfluences, getAllMonths } from "@/lib/data";
import { formatShortDate, monthLabel, ymKey } from "@/lib/dates";

const ago = (iso?: string) => (iso ? formatShortDate(iso.slice(0, 10)) : "never");

/** Status of the insight layer, the on-demand buttons, and the accuracy pass's flags. */
export async function ReviewTab({ supabase, today }: { supabase: SupabaseClient; today: string }) {
  const aiOn = aiConfigured();
  const [{ data: usage }, review, foreshadow, archetype, { data: flagRows }, { count: closed }, months, influences] = await Promise.all([
    supabase.from("ai_usage").select("count").eq("day", today).maybeSingle(),
    getReport(supabase, "review"),
    getReport(supabase, "foreshadow"),
    getReport(supabase, "archetype"),
    supabase.from("ai_flags").select("*").eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("ai_flags").select("id", { count: "exact", head: true }).neq("status", "open"),
    getAllMonths(supabase),
    getAllInfluences(supabase),
  ]);

  const monthById = new Map(months.map((m) => [m.id, m]));
  const flags: FlagRow[] = (flagRows ?? []).map((f) => {
    let href: string | null = null;
    let where: string | null = null;
    if (f.target_type === "influence") {
      const inf = influences.find((i) => i.id === f.target_id);
      const m = inf && monthById.get(inf.month_id);
      if (inf && m) { href = `/month/${ymKey(m.year, m.month)}`; where = `${inf.name} · ${monthLabel(m.year, m.month)}`; }
    } else if (f.target_type === "month") {
      const m = monthById.get(f.target_id);
      if (m) { href = `/month/${ymKey(m.year, m.month)}`; where = monthLabel(m.year, m.month); }
    }
    return { id: f.id, code: f.code, severity: f.severity, message: f.message, suggestion: f.suggestion, href, where };
  });

  const used = (usage?.count as number | undefined) ?? 0;
  const rows: [string, string][] = [
    ["Claude API key", aiOn ? "set" : "NOT set"],
    ["Model", insightModel()],
    ["AI calls today", `${used} of ${dailyCallLimit()} (daily cap)`],
    ["Character sheet", archetype ? `${archetype.status}, last written ${ago(archetype.generated_at)}` : "not written yet"],
    ["Accuracy pass (weekly)", review ? `${review.status}, last run ${ago(review.generated_at)}` : "hasn't run yet"],
    ["Foreshadowing check (every 3 days)", foreshadow ? `${foreshadow.status}, last run ${ago(foreshadow.generated_at)}` : "hasn't run yet"],
  ];

  return (
    <div className="space-y-6">
      <p className="font-hand text-xl text-ink-soft">What the insight layer is doing, and anything it thinks deserves a second look.</p>

      <section className="paper-card space-y-2 p-4">
        <dl className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 font-type text-xs">
              <dt className="text-ink-soft">{k}</dt>
              <dd className={`text-right ${k === "Claude API key" && !aiOn ? "text-red-700" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!aiOn && (
        <section className="paper-card space-y-2 p-4">
          <p className="font-hand text-2xl">To switch insights on</p>
          <ol className="font-type list-decimal space-y-1 pl-5 text-xs">
            <li>Create an API key at console.anthropic.com and add some credit.</li>
            <li>In Vercel → Settings → Environment Variables add <code>ANTHROPIC_API_KEY</code>.</li>
            <li>Redeploy, then come back here and press <em>Test connection</em>.</li>
          </ol>
        </section>
      )}

      <AdminActions
        aiOn={aiOn}
        reviewPending={review?.status === "pending"}
        foreshadowPending={foreshadow?.status === "pending"}
        archetypePending={archetype?.status === "pending"}
      />

      <section className="space-y-3">
        <Heading>Flags</Heading>
        <FlagList flags={flags} />
        {!!closed && <p className="font-type text-[11px] text-ink-soft">{closed} earlier flag{closed === 1 ? "" : "s"} dismissed or marked fixed.</p>}
      </section>

      <p className="font-type text-[11px] text-ink-soft">
        The accuracy pass only ever raises flags. It never edits your influences, themes, reflections or notes. <Link href="/settings" className="underline">Settings</Link>
      </p>
    </div>
  );
}
