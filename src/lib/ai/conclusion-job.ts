import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiCtx, skipStatus, asEnum, asObj, asText, callJson } from "./client";
import { getEntries, getInfluences } from "@/lib/data";
import { avgCharacterScore, computeFidelity } from "@/lib/fidelity";
import { effectiveTraits } from "@/lib/traits";
import { monthLabel } from "@/lib/dates";
import type { ConclusionVerdict, Month } from "@/lib/types";

const VERDICTS = ["stayed_true", "partly", "drifted", "not_enough_data"] as const;
const MIN_SCORED_DAYS = 3;

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: [...VERDICTS] },
    conclusion: { type: "string" },
  },
  required: ["verdict", "conclusion"],
  additionalProperties: false,
};

const SYSTEM = `Task: write the app's month-end conclusion: did this month stay true to its influences overall?
Base it on the daily in-character scores (already computed: do not recompute them), the per-influence averages and what the days say.
- Two short paragraphs, at most 700 characters in total, second person.
- verdict: "stayed_true" (influences mostly showed up, overall around 6.5+), "partly" (mixed, or one influence carried the month), "drifted" (overall below about 4.5, or the influences barely showed up).
- Name which influences were lived and which were only picked. If one influence carried the month, say so.
- The user already wrote their own reflection (user_reflection). It stays as theirs: don't repeat it and don't treat it as wrong. You may note where the numbers agree with it or add what it missed.
- Be candid about uncertainty: this is a reading of brief daily notes, not a measurement.`;

/** Marks the month as "pending" right away; the real work happens in generateConclusion. */
export async function queueConclusion(supabase: SupabaseClient, monthId: string): Promise<void> {
  await supabase
    .from("months")
    .update({ ai_conclusion_status: "pending", ai_conclusion_at: new Date().toISOString() })
    .eq("id", monthId);
}

export async function generateConclusion(ctx: AiCtx, monthId: string): Promise<void> {
  const { supabase } = ctx;
  const { data } = await supabase.from("months").select("*").eq("id", monthId).maybeSingle();
  const month = data as Month | null;
  if (!month) return;
  const done = (patch: Record<string, unknown>) =>
    supabase.from("months").update({ ...patch, ai_conclusion_at: new Date().toISOString() }).eq("id", monthId);

  try {
    const [entries, influences] = await Promise.all([getEntries(supabase, monthId), getInfluences(supabase, monthId)]);
    const fid = computeFidelity(entries, influences);
    const scoredDays = entries.filter((e) => e.character_score != null);
    const label = monthLabel(month.year, month.month);

    if (scoredDays.length < MIN_SCORED_DAYS || !influences.length) {
      await done({
        ai_conclusion_status: "done",
        ai_conclusion_verdict: "not_enough_data",
        ai_conclusion:
          `Only ${scoredDays.length} day${scoredDays.length === 1 ? "" : "s"} in ${label} could be read against your influences, ` +
          `which isn't enough to say whether the month stayed true to them. A few more written days per month and this gets sharper.`,
      });
      return;
    }

    const names = new Map(influences.map((i) => [i.id, i.name]));
    const out = await callJson(ctx, {
      kind: "conclusions",
      system: SYSTEM,
      data: {
        month: label,
        title: month.title,
        themes: month.themes,
        user_reflection: month.month_end_reflection,
        overall: {
          days_logged: entries.length,
          days_scored: scoredDays.length,
          avg_in_character: round1(avgCharacterScore(entries)),
        },
        influences: fid.map((f) => ({
          name: f.influence.name,
          traits: effectiveTraits(f.influence).traits,
          why: f.influence.why_it_resonates,
          days_scored: f.days,
          avg_score: round1(f.avg),
        })),
        days: entries.map((e) => ({
          date: e.date,
          rating: e.rating,
          in_character: e.character_score,
          tagged: e.influence_ids.map((id) => names.get(id)).filter(Boolean),
          read: e.insight?.slice(0, 160) ?? null,
        })),
      },
      task: "Write the conclusion now.",
      schema: SCHEMA,
      effort: "low",
      maxTokens: 5000,
      parse: (raw) => {
        const o = asObj(raw);
        const conclusion = asText(o.conclusion, 900);
        if (!conclusion) throw new Error("empty conclusion");
        return { conclusion, verdict: (asEnum(o.verdict, VERDICTS) ?? "partly") as ConclusionVerdict };
      },
    });
    await done({ ai_conclusion_status: "done", ai_conclusion: out.conclusion, ai_conclusion_verdict: out.verdict });
  } catch (e) {
    await done({ ai_conclusion_status: skipStatus(e) });
  }
}

const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
