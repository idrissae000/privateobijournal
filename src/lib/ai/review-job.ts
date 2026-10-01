import "server-only";
import { type AiCtx, asArr, asEnum, asObj, asStr, asText, callJson, hashOf } from "./client";
import { insightModel } from "./config";
import { saveReport } from "./reports";
import { getAllInfluences, getAllMonths } from "@/lib/data";
import { effectiveTraits } from "@/lib/traits";
import { ymKey } from "@/lib/dates";

const CODES = [
  "duplicate_character", "trait_mismatch", "theme_mismatch", "theme_variant",
  "fact_check", "missing_why", "inconsistent", "other",
] as const;

const SCHEMA = {
  type: "object",
  properties: {
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", enum: [...CODES] },
          severity: { type: "string", enum: ["info", "warn"] },
          target_type: { type: "string", enum: ["influence", "month", "theme", "general"] },
          target_id: { type: "string" },
          message: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["code", "severity", "target_type", "target_id", "message", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["flags"],
  additionalProperties: false,
};

const SYSTEM = `Task: an accuracy and consistency review of the user's journal structure: their monthly chapters, influences, traits and themes.
You may ONLY raise flags for the user to look at. You never rewrite anything; "suggestion" is advice the user may ignore.
Look for:
- duplicate_character: the same character/person under different names or spellings across months (e.g. "Tony Soprano" vs "Anthony Soprano").
- trait_mismatch: a trait that doesn't fit the character you know (only when you are confident).
- theme_mismatch: a month's themes that its influences/reflection don't support, or an influence theme that contradicts its traits.
- theme_variant: near-duplicate theme tags that should probably be one ("sacrifice" / "sacrifices").
- fact_check: a "from" note that looks wrong about the source (wrong show/game title, etc.), only when confident.
- missing_why: an influence in a sealed month with no "why it resonates".
- inconsistent: something in the user's own words contradicting other data (e.g. a reflection claiming a theme no influence or entry carries).
- other: anything else worth a look.
Be conservative: report only what you'd bet on. Quote exact names. For a flag about a specific influence or month, set target_id to its id from the data and target_type accordingly;
for theme tags or anything cross-cutting use target_type "theme" or "general" and target_id "". 0 to 8 flags; an empty list is a fine answer.`;

export async function runReview(ctx: AiCtx): Promise<void> {
  const { supabase } = ctx;
  try {
    const [months, influences] = await Promise.all([getAllMonths(supabase), getAllInfluences(supabase)]);
    const ids = new Set([...months.map((m) => m.id), ...influences.map((i) => i.id)]);
    const ymById = new Map(months.map((m) => [m.id, ymKey(m.year, m.month)]));
    const themeCounts = new Map<string, number>();
    for (const t of [...months.flatMap((m) => m.themes ?? []), ...influences.flatMap((i) => i.themes ?? [])]) {
      themeCounts.set(t.toLowerCase(), (themeCounts.get(t.toLowerCase()) ?? 0) + 1);
    }

    const flags = await callJson(ctx, {
      system: SYSTEM,
      data: {
        months: months.map((m) => ({
          id: m.id, ym: ymKey(m.year, m.month), title: m.title, sealed: !!m.sealed_at, retrospective: m.is_retrospective,
          themes: m.themes, reflection: m.month_end_reflection?.slice(0, 300) ?? null, how_it_changed_me: m.how_it_changed_me?.slice(0, 300) ?? null,
        })),
        influences: influences.map((i) => ({
          id: i.id, name: i.name, month: ymById.get(i.month_id), from: i.source_note, themes: i.themes,
          traits: effectiveTraits(i).traits, why: i.why_it_resonates?.slice(0, 300) ?? null,
        })),
        theme_tags_in_use: [...themeCounts.entries()].map(([theme, uses]) => ({ theme, uses })),
      },
      task: "Run the review now.",
      schema: SCHEMA,
      effort: "medium",
      maxTokens: 8000,
      parse: (raw) =>
        asArr(asObj(raw).flags, 8).flatMap((f) => {
          const x = asObj(f);
          const code = asEnum(x.code, CODES);
          const message = asText(x.message, 400);
          if (!code || !message) return [];
          const tid = asStr(x.target_id, 64);
          const target_id = ids.has(tid) ? tid : null;
          return [{
            code,
            severity: asEnum(x.severity, ["info", "warn"] as const) ?? "info",
            target_type: target_id ? (asEnum(x.target_type, ["influence", "month"] as const) ?? "general") : (asEnum(x.target_type, ["theme", "general"] as const) ?? "general"),
            target_id,
            message,
            suggestion: asText(x.suggestion, 300) || null,
          }];
        }),
    });

    if (flags.length) {
      await supabase.from("ai_flags").upsert(
        flags.map((f) => ({ ...f, dedupe_key: hashOf([f.code, f.target_id, f.message.toLowerCase().slice(0, 80)]) })),
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      );
    }
    await saveReport(supabase, "review", { content: { flags_found: flags.length, model: insightModel() }, status: "done" });
  } catch {
    await saveReport(supabase, "review", { status: "failed" });
  }
}
