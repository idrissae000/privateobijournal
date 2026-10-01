import "server-only";
import { type AiCtx, skipStatus, asArr, asEnum, asObj, asStr, callJson } from "./client";
import { normalizeTraits } from "@/lib/traits";

const SCHEMA = {
  type: "object",
  properties: {
    traits: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["traits", "confidence"],
  additionalProperties: false,
};

const SYSTEM = `Task: suggest 3 to 5 core traits for ONE influence (a fictional character, real person, or idea the user is drawn to this month).
- A trait is 1 to 4 words and describes an observable disposition, value or habit a person could show in an ordinary day
  (examples: "restrains his anger", "reluctant protector", "talks himself into things", "loyal to a fault"). Not looks, not plot facts.
- Base them on what you genuinely know about the character/figure. If you don't recognise it, use only the note and the user's own words
  and set confidence to "low". "high" = you know this character well; "medium" = partial/ambiguous.
- Do not restate or rewrite the user's "why it resonates" text. Your traits are additive.`;

/** Fills `suggested_traits` for an influence. Never touches the user's own fields. */
export async function suggestTraits(ctx: AiCtx, influenceId: string): Promise<void> {
  const { supabase } = ctx;
  const { data: inf } = await supabase
    .from("influences")
    .select("id,name,source_note,why_it_resonates,themes")
    .eq("id", influenceId)
    .maybeSingle();
  if (!inf) return;

  try {
    const out = await callJson(ctx, {
      kind: "traits",
      system: SYSTEM,
      data: { name: inf.name, from: inf.source_note, why_it_resonates: inf.why_it_resonates, themes: inf.themes },
      task: "Suggest the traits now.",
      schema: SCHEMA,
      effort: "low",
      maxTokens: 4000,
      parse: (raw) => {
        const o = asObj(raw);
        const traits = normalizeTraits(asArr(o.traits, 8).map((t) => asStr(t, 60)));
        if (!traits.length) throw new Error("no traits");
        return { traits: traits.slice(0, 5), confidence: asEnum(o.confidence, ["high", "medium", "low"] as const) ?? "low" };
      },
    });
    await supabase
      .from("influences")
      .update({ suggested_traits: out.traits, traits_confidence: out.confidence, traits_status: "suggested" })
      .eq("id", influenceId)
      .eq("traits_status", "pending");
  } catch (e) {
    await supabase
      .from("influences")
      .update({ traits_status: skipStatus(e) })
      .eq("id", influenceId)
      .eq("traits_status", "pending");
  }
}
