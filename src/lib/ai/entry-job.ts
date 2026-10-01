import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiCtx, skipStatus, asArr, asInt, asObj, asStr, asText, callJson, hashOf } from "./client";
import { insightModel } from "./config";
import { effectiveTraits } from "@/lib/traits";
import { monthLabel } from "@/lib/dates";
import type { Influence } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    scorable: { type: "boolean" },
    character_score: { type: "integer" },
    per_influence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          influence_id: { type: "string" },
          applicable: { type: "boolean" },
          score: { type: "integer" },
          note: { type: "string" },
        },
        required: ["influence_id", "applicable", "score", "note"],
        additionalProperties: false,
      },
    },
    insight: { type: "string" },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { topic: { type: "string" }, stance: { type: "string" }, evidence: { type: "string" } },
        required: ["topic", "stance", "evidence"],
        additionalProperties: false,
      },
    },
    tone: { type: "array", items: { type: "string" } },
  },
  required: ["scorable", "character_score", "per_influence", "insight", "topics", "tone"],
  additionalProperties: false,
};

const SYSTEM = `Task: read ONE day's journal entry against the influences of the user's current month and their traits.

Scoring ("in-character" fidelity):
- For each influence in "influences", give a 0-10 score for how closely what the entry describes (actions, choices, mindset, how they handled things)
  matched that influence's traits. This is fidelity to the traits, NOT how good the day was: a hard day handled the way the character would can score high,
  a great day that ignored the traits can score low. 0 = acted against the traits, 5 = mixed or only loosely connected, 10 = clearly embodied.
- If the entry gives no real evidence about an influence, set applicable=false (and score 0) instead of guessing 5.
- If an influence has no traits listed, judge from what you know of it plus the user's own words, and stay conservative.
- "character_score" is the overall in-character-ness of the day across the applicable influences; weigh the ones in tagged_influence_ids most heavily.
  If none are applicable, set scorable=false and character_score=0.
- "note" per influence: at most 14 words of evidence from the entry.

"insight": one or two sentences, max 260 characters, second person, specific to what they wrote. Connect it to an influence or trait only when the connection is real.
No praise inflation, no generic encouragement, don't repeat the wording of earlier insights in recent_days.

"topics": 0 to 3 underlying subjects the entry explicitly touches (e.g. "changing my body", "being a good father"), each with the stance/belief the user expresses
(max 12 words, e.g. "believes change is possible") and a short quote of at most 12 words. Only when explicit. Otherwise [].
"tone": up to 3 single-word descriptors of the entry's tone.`;

type Eff = ReturnType<typeof effectiveTraits>;
const forPrompt = (i: Influence) => {
  const e: Eff = effectiveTraits(i);
  return { id: i.id, name: i.name, from: i.source_note, why: i.why_it_resonates, themes: i.themes, traits: e.traits, traits_source: e.source };
};

async function loadEntry(supabase: SupabaseClient, entryId: string) {
  const { data: entry } = await supabase
    .from("entries")
    .select("id,date,month_id,rating,note,weigh_in,insight_hash,insight_status,entry_influences(influence_id)")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return null;
  const { data: influences } = await supabase
    .from("influences").select("*").eq("month_id", entry.month_id).order("date_added").order("created_at");
  return { entry, influences: (influences ?? []) as Influence[] };
}

/**
 * Called synchronously from the save action. Decides whether this save needs (re)analysis and, if so,
 * marks the entry "pending" so the page can show it is being read. Returns the hash to run with.
 */
export async function queueEntryAnalysis(supabase: SupabaseClient, entryId: string): Promise<string | null> {
  const loaded = await loadEntry(supabase, entryId);
  if (!loaded) return null;
  const { entry, influences } = loaded;
  const tags = (entry.entry_influences as { influence_id: string }[]).map((t) => t.influence_id).sort();

  const hash = hashOf({
    n: entry.note ?? "", r: entry.rating, w: entry.weigh_in, t: tags,
    i: influences.map((i) => [i.id, i.name, effectiveTraits(i).traits]),
  });
  if (entry.insight_hash === hash && (entry.insight_status === "done" || entry.insight_status === "pending")) return null;

  if (!entry.note || !entry.note.trim()) {
    // Nothing written to read: clear any earlier reading rather than leave a stale one.
    await supabase.from("entry_influence_scores").delete().eq("entry_id", entryId);
    await supabase
      .from("entries")
      .update({ insight_status: "skipped", insight: null, character_score: null, insight_hash: hash, analysis: null })
      .eq("id", entryId);
    return null;
  }
  await supabase
    .from("entries")
    .update({ insight_status: "pending", insight_hash: hash, insight_at: new Date().toISOString() })
    .eq("id", entryId);
  return hash;
}

/** The actual Claude call + write-back. Runs in the background (after the response is sent). */
export async function analyzeEntry(ctx: AiCtx, entryId: string, hash: string): Promise<void> {
  const { supabase } = ctx;
  const loaded = await loadEntry(supabase, entryId);
  if (!loaded) return;
  const { entry, influences } = loaded;

  const [{ data: recent }, { data: monthRatings }] = await Promise.all([
    supabase
      .from("entries")
      .select("date,rating,character_score,insight")
      .eq("month_id", entry.month_id).lt("date", entry.date).not("insight", "is", null)
      .order("date", { ascending: false }).limit(4),
    supabase.from("entries").select("rating").eq("month_id", entry.month_id).not("rating", "is", null),
  ]);
  const ratings = (monthRatings ?? []).map((r) => r.rating as number);
  const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const ids = new Set(influences.map((i) => i.id));
  const tagged = (entry.entry_influences as { influence_id: string }[]).map((t) => t.influence_id);

  try {
    const out = await callJson(ctx, {
      system: SYSTEM,
      data: {
        date: entry.date,
        month: monthLabel(Number(entry.date.slice(0, 4)), Number(entry.date.slice(5, 7))),
        entry: { rating: entry.rating, note: entry.note, weigh_in: entry.weigh_in },
        tagged_influence_ids: tagged,
        month_average_rating: avg,
        influences: influences.map(forPrompt),
        recent_days: (recent ?? []).reverse(),
      },
      task: "Read this entry now.",
      schema: SCHEMA,
      effort: "low",
      maxTokens: 6000,
      parse: (raw) => {
        const o = asObj(raw);
        const per = asArr(o.per_influence, 20).flatMap((p) => {
          const x = asObj(p);
          const id = asStr(x.influence_id, 64);
          const score = asInt(x.score, 0, 10);
          if (!ids.has(id) || x.applicable !== true || score == null) return [];
          return [{ influence_id: id, score, note: asStr(x.note, 140) }];
        });
        const insight = asText(o.insight, 400);
        if (!insight) throw new Error("no insight");
        const scorable = o.scorable === true && per.length > 0;
        return {
          per,
          insight,
          score: scorable ? asInt(o.character_score, 0, 10) : null,
          topics: asArr(o.topics, 3).map((t) => {
            const x = asObj(t);
            return { topic: asStr(x.topic, 60), stance: asStr(x.stance, 100), evidence: asStr(x.evidence, 100) };
          }).filter((t) => t.topic && t.stance),
          tone: asArr(o.tone, 3).map((t) => asStr(t, 24)).filter(Boolean),
        };
      },
    });

    // Only write if the entry hasn't been edited again since this run started.
    const { data: updated } = await supabase
      .from("entries")
      .update({
        insight: out.insight,
        character_score: out.score,
        insight_status: "done",
        insight_at: new Date().toISOString(),
        analysis: { topics: out.topics, tone: out.tone, model: insightModel() },
      })
      .eq("id", entryId).eq("insight_hash", hash)
      .select("id");
    if (!updated?.length) return;

    await supabase.from("entry_influence_scores").delete().eq("entry_id", entryId);
    if (out.per.length) {
      await supabase.from("entry_influence_scores").insert(out.per.map((p) => ({ entry_id: entryId, ...p })));
    }
  } catch (e) {
    await supabase
      .from("entries")
      .update({ insight_status: skipStatus(e) })
      .eq("id", entryId).eq("insight_hash", hash);
  }
}
