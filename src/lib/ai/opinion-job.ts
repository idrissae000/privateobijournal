import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiCtx, asArr, asEnum, asObj, asStr, asText, callJson, hashOf } from "./client";
import { insightModel } from "./config";
import type { ArchetypeContent } from "./archetype-job";
import { getReport } from "./reports";
import { getAllEntries, getAllInfluences, getAllMonths } from "@/lib/data";
import { computeFidelity, avgCharacterScore } from "@/lib/fidelity";
import { effectiveTraits } from "@/lib/traits";
import { monthLabel, ymKey } from "@/lib/dates";
import type { Opinion, OpinionRow, Verdict } from "@/lib/opinion";
import type { Influence, Month } from "@/lib/types";

const VERDICTS = ["strong", "good", "mixed", "weak"] as const;

const BASE_PROPS = {
  verdict: { type: "string", enum: [...VERDICTS] },
  headline: { type: "string" },
  fit: { type: "string" },
  strengths: { type: "array", items: { type: "string" } },
  concerns: { type: "array", items: { type: "string" } },
  suggestions: { type: "array", items: { type: "string" } },
};
const MONTH_SCHEMA = {
  type: "object",
  properties: BASE_PROPS,
  required: ["verdict", "headline", "fit", "strengths", "concerns", "suggestions"],
  additionalProperties: false,
};
const CHARACTER_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_PROPS,
    trait_notes: {
      type: "array",
      items: {
        type: "object",
        properties: { trait: { type: "string" }, note: { type: "string" } },
        required: ["trait", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdict", "headline", "fit", "strengths", "concerns", "suggestions", "trait_notes"],
  additionalProperties: false,
};

const COMMON_RULES = `Give your honest opinion, as a thoughtful friend who has read the whole journal would: not a sales pitch.
- verdict: "strong" (clearly a good fit), "good" (works, with small reservations), "mixed" (real strengths and real problems), "weak" (probably not serving them). Use "mixed" or "weak" whenever that's the truth.
- headline: one sentence, at most 110 characters, that states your verdict in plain words.
- fit: 2 to 4 sentences on how this fits THIS person specifically, using their history (earlier chapters, what they actually lived up to, the character sheet's throughline/becoming/tensions when given). Be concrete; name chapters or characters.
- strengths / concerns / suggestions: 0 to 3 each, one sentence each. Suggestions are options the user can ignore (add, drop, narrow, clarify); nothing will be changed for them.
- Never flatter, never diagnose, never give medical or therapy advice. If the history is thin, say so and keep claims modest.`;

const MONTH_SYSTEM = `Task: give your opinion of ONE month's "breakdown": the set of influences (characters, people, ideas) the user has chosen for that month, with their traits, why-notes and themes. Is it a good breakdown for them?
Consider: coherence (do these influences share something, or is it a grab bag?), contrast and balance (do they pull in useful different directions, or are they redundant or all the same note?), fit with who they have been and are becoming, whether it asks for something realistic given what they have actually lived up to before (fidelity history of recurring characters), and whether the traits are specific enough to be lived.
The month may be the current one or an upcoming one being planned ("timing"); for an upcoming month judge it as a plan.
${COMMON_RULES}`;

const CHARACTER_SYSTEM = `Task: give your opinion of ONE character's "breakdown" for this user: the traits chosen for them (plus the user's why-note and themes). Is it a good breakdown, and is it a good character for this person?
Consider: are the traits accurate to the character, distinct from each other, concrete enough to be observed in an ordinary day, and do they capture why the user is drawn to them? Does the character fit who the user has been and is becoming, and the other influences this month? If they recur, how truly did the user live them before (fidelity history)?
Also fill trait_notes: one short note (max 14 words) per trait saying whether it is accurate, vague, redundant or especially useful. Use the trait text exactly as given.
${COMMON_RULES}`;

// ---------------------------------------------------------------------------------------------------------

const infoFor = (i: Influence) => ({
  name: i.name,
  from: i.source_note,
  why: i.why_it_resonates?.slice(0, 500) ?? null,
  themes: i.themes ?? [],
  traits: effectiveTraits(i).traits,
  traits_source: effectiveTraits(i).source,
});

/** Changes only when the breakdown being judged changes, so an unchanged breakdown is never re-judged. */
export const monthOpinionFingerprint = (month: Pick<Month, "themes">, influences: Influence[]) =>
  hashOf({ themes: month.themes ?? [], influences: influences.map(infoFor) });
export const characterOpinionFingerprint = (inf: Influence, monthThemes: string[]) => hashOf({ c: infoFor(inf), monthThemes });

export async function getOpinions(
  supabase: SupabaseClient, type: "month" | "character", ids: string[],
): Promise<Map<string, OpinionRow>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("ai_opinions").select("subject_type,subject_id,content,fingerprint,status,generated_at").eq("subject_type", type).in("subject_id", ids);
  return new Map(((data ?? []) as OpinionRow[]).map((r) => [r.subject_id, r]));
}

const ageOf = (r: OpinionRow | undefined) => (r ? Date.now() - new Date(r.generated_at).getTime() : Infinity);

/**
 * Decide whether to (re)generate an opinion now, and claim it if so (stamping "pending") so concurrent requests don't
 * start duplicates. Automatic regeneration is rare: only if the breakdown actually changed AND `minGapMs` has passed.
 * `force` (the "ask again" button) skips those checks.
 */
export async function claimOpinion(
  supabase: SupabaseClient, type: "month" | "character", id: string,
  opts: { fingerprint: string; minGapMs?: number; force?: boolean; existing?: OpinionRow },
): Promise<boolean> {
  const row = opts.existing ?? (await getOpinions(supabase, type, [id])).get(id);
  if (row?.status === "pending" && ageOf(row) < 3 * 60_000) return false;
  if (!opts.force && row) {
    if (row.status === "done" && row.fingerprint === opts.fingerprint) return false;
    if (row.status === "done" && ageOf(row) < (opts.minGapMs ?? 0)) return false;
    if (row.status === "failed" && ageOf(row) < 30 * 60_000) return false;
  }
  await supabase.from("ai_opinions").upsert(
    {
      subject_type: type, subject_id: id, content: row?.content ?? {}, fingerprint: row?.fingerprint ?? null,
      status: "pending", generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subject_type,subject_id" },
  );
  return true;
}

async function save(supabase: SupabaseClient, type: "month" | "character", id: string, patch: { content?: Opinion; fingerprint?: string; status: "done" | "failed" }) {
  const row: Record<string, unknown> = { subject_type: type, subject_id: id, status: patch.status, generated_at: new Date().toISOString() };
  if (patch.content) row.content = patch.content;
  if (patch.fingerprint) row.fingerprint = patch.fingerprint;
  await supabase.from("ai_opinions").upsert(row, { onConflict: "user_id,subject_type,subject_id" });
}

function parseOpinion(raw: unknown, withTraits: string[] | null): Opinion {
  const o = asObj(raw);
  const verdict = asEnum(o.verdict, VERDICTS) as Verdict | null;
  const headline = asStr(o.headline, 160);
  const fit = asText(o.fit, 900);
  if (!verdict || !headline || !fit) throw new Error("incomplete opinion");
  const list = (x: unknown) => asArr(x, 3).map((s) => asStr(s, 260)).filter(Boolean);
  const out: Opinion = { verdict, headline, fit, strengths: list(o.strengths), concerns: list(o.concerns), suggestions: list(o.suggestions), model: insightModel() };
  if (withTraits) {
    const known = new Set(withTraits.map((t) => t.toLowerCase()));
    out.trait_notes = asArr(o.trait_notes, 8)
      .map((n) => {
        const x = asObj(n);
        return { trait: asStr(x.trait, 60), note: asStr(x.note, 160) };
      })
      .filter((n) => n.note && known.has(n.trait.toLowerCase()));
  }
  return out;
}

/** The user's history in compact form: the months before `beforeYm`, with how truly each character was lived. */
async function history(supabase: SupabaseClient, beforeYm: string) {
  const [months, influences, entries, sheet] = await Promise.all([
    getAllMonths(supabase), getAllInfluences(supabase), getAllEntries(supabase), getReport<ArchetypeContent>(supabase, "archetype"),
  ]);
  const past = months.filter((m) => ymKey(m.year, m.month) < beforeYm).slice(-6);
  return {
    months: months, influences, entries,
    past: past.map((m) => {
      const es = entries.filter((e) => e.month_id === m.id);
      const mi = influences.filter((i) => i.month_id === m.id);
      const fid = computeFidelity(es, mi);
      const ratings = es.filter((e) => e.rating != null).map((e) => e.rating as number);
      return {
        month: monthLabel(m.year, m.month), title: m.title, themes: m.themes ?? [], retrospective: m.is_retrospective,
        avg_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        avg_in_character: avgCharacterScore(es) == null ? null : Math.round((avgCharacterScore(es) as number) * 10) / 10,
        influences: mi.map((i, idx) => ({ name: i.name, traits: effectiveTraits(i).traits, lived_score: fid[idx].avg == null ? null : Math.round((fid[idx].avg as number) * 10) / 10, days_scored: fid[idx].days })),
      };
    }),
    sheet: sheet?.content?.throughline
      ? { throughline: sheet.content.throughline, becoming: sheet.content.becoming, tensions: sheet.content.tensions }
      : null,
  };
}

export async function generateMonthOpinion(ctx: AiCtx, monthId: string): Promise<void> {
  const { supabase } = ctx;
  try {
    const { data } = await supabase.from("months").select("*").eq("id", monthId).maybeSingle();
    const month = data as Month | null;
    if (!month) return;
    const h = await history(supabase, ymKey(month.year, month.month));
    const influences = h.influences.filter((i) => i.month_id === monthId);
    if (!influences.length) return;
    const ym = ymKey(month.year, month.month);
    const now = ctx.month;
    const out = await callJson(ctx, {
      kind: "opinions",
      system: MONTH_SYSTEM,
      data: {
        month: monthLabel(month.year, month.month),
        timing: ym > now ? "upcoming" : ym === now ? "current" : "past",
        month_themes: month.themes ?? [],
        influences: influences.map(infoFor),
        recurring_from_before: influences
          .filter((i) => h.influences.some((o) => o.id !== i.id && o.name.toLowerCase() === i.name.toLowerCase() && o.month_id !== monthId))
          .map((i) => i.name),
        history: h.past,
        character_sheet: h.sheet,
      },
      task: "Give your opinion on this month's breakdown now.",
      schema: MONTH_SCHEMA,
      effort: "medium",
      maxTokens: 6000,
      parse: (raw) => parseOpinion(raw, null),
    });
    await save(supabase, "month", monthId, { content: out, fingerprint: monthOpinionFingerprint(month, influences), status: "done" });
  } catch {
    await save(supabase, "month", monthId, { status: "failed" });
  }
}

export async function generateCharacterOpinion(ctx: AiCtx, influenceId: string): Promise<void> {
  const { supabase } = ctx;
  try {
    const { data } = await supabase.from("influences").select("*").eq("id", influenceId).maybeSingle();
    const inf = data as Influence | null;
    if (!inf) return;
    const { data: m } = await supabase.from("months").select("*").eq("id", inf.month_id).maybeSingle();
    const month = m as Month | null;
    const ym = month ? ymKey(month.year, month.month) : ctx.month;
    const h = await history(supabase, "9999-99");
    const peers = h.influences.filter((i) => i.month_id === inf.month_id && i.id !== inf.id).map((i) => i.name);
    const appearances = h.influences
      .filter((i) => i.name.toLowerCase() === inf.name.toLowerCase() && i.id !== inf.id)
      .map((i) => {
        const mm = h.months.find((x) => x.id === i.month_id);
        const es = h.entries.filter((e) => e.month_id === i.month_id);
        const f = computeFidelity(es, [i])[0];
        return { month: mm ? monthLabel(mm.year, mm.month) : null, traits: effectiveTraits(i).traits, lived_score: f.avg == null ? null : Math.round(f.avg * 10) / 10, days_scored: f.days };
      });
    const traits = effectiveTraits(inf).traits;
    const out = await callJson(ctx, {
      kind: "opinions",
      system: CHARACTER_SYSTEM,
      data: {
        character: infoFor(inf),
        month: month ? monthLabel(month.year, month.month) : null,
        timing: ym > ctx.month ? "upcoming" : ym === ctx.month ? "current" : "past",
        month_themes: month?.themes ?? [],
        other_influences_this_month: peers,
        earlier_appearances: appearances,
        history: h.past,
        character_sheet: h.sheet,
      },
      task: "Give your opinion on this character's breakdown now.",
      schema: CHARACTER_SCHEMA,
      effort: "medium",
      maxTokens: 6000,
      parse: (raw) => parseOpinion(raw, traits),
    });
    await save(supabase, "character", influenceId, { content: out, fingerprint: characterOpinionFingerprint(inf, month?.themes ?? []), status: "done" });
  } catch {
    await save(supabase, "character", influenceId, { status: "failed" });
  }
}
