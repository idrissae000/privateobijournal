import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiCtx, asArr, asObj, asStr, asText, callJson, hashOf } from "./client";
import { insightModel } from "./config";
import { claimReport, getReport, saveReport, type Report } from "./reports";
import { getAllEntries, getAllInfluences, getAllMonths } from "@/lib/data";
import { avgCharacterScore, computeFidelity } from "@/lib/fidelity";
import { effectiveTraits } from "@/lib/traits";
import { monthLabel, ymKey } from "@/lib/dates";

export type ArchetypeContent = {
  archetype_name?: string;
  throughline?: string;
  arc?: string;
  becoming?: string;
  tensions?: string[];
  recurring_themes?: { theme: string; months: string[]; note: string }[];
  arc_watch?: {
    theme: string;
    then: { ym: string; stance: string; evidence: string };
    now: { ym: string; stance: string; evidence: string };
    comparison: string;
  }[];
  data_note?: string;
  model?: string;
};

const MIN_GAP_MS = 5 * 60_000;

const SCHEMA = {
  type: "object",
  properties: {
    archetype_name: { type: "string" },
    throughline: { type: "string" },
    arc: { type: "string" },
    becoming: { type: "string" },
    tensions: { type: "array", items: { type: "string" } },
    recurring_themes: {
      type: "array",
      items: {
        type: "object",
        properties: { theme: { type: "string" }, months: { type: "array", items: { type: "string" } }, note: { type: "string" } },
        required: ["theme", "months", "note"],
        additionalProperties: false,
      },
    },
    arc_watch: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          then: {
            type: "object",
            properties: { ym: { type: "string" }, stance: { type: "string" }, evidence: { type: "string" } },
            required: ["ym", "stance", "evidence"],
            additionalProperties: false,
          },
          now: {
            type: "object",
            properties: { ym: { type: "string" }, stance: { type: "string" }, evidence: { type: "string" } },
            required: ["ym", "stance", "evidence"],
            additionalProperties: false,
          },
          comparison: { type: "string" },
        },
        required: ["theme", "then", "now", "comparison"],
        additionalProperties: false,
      },
    },
    data_note: { type: "string" },
  },
  required: ["archetype_name", "throughline", "arc", "becoming", "tensions", "recurring_themes", "arc_watch", "data_note"],
  additionalProperties: false,
};

const SYSTEM = `Task: write the user's "living character sheet": written insight (not statistics) synthesised across ALL their months and influences.
The data is a timeline of monthly chapters. Each has influences (with traits, why they resonated, and how truly they were lived), the user's own reflections, and daily notes with the stance each expressed.

Write:
- archetype_name: a short evocative label for who they've been this stretch (e.g. "The Reluctant Reformer"). Not cheesy; earned by the data.
- throughline: 2 to 3 sentences, the thread running through every chapter.
- arc: 4 to 6 sentences on how the chapters connect and change, naming months. Plain paragraphs, no bullet lists.
- becoming: 2 to 3 sentences on who they have been becoming, as a direction, not a verdict.
- tensions: 0 to 3 genuine contradictions or pulls worth noticing.
- recurring_themes: up to 6 themes that show up in 2+ chapters, with the months (use the "ym" keys) and a one-sentence note.
- arc_watch ("then vs. now"): find the same underlying subject appearing in NON-ADJACENT chapters (at least 2 months apart) where the user's STANCE has clearly shifted
  (example: an earlier chapter's entries carry the belief that changing your body isn't possible; a later chapter carries the belief that it is).
  For each: theme, then {ym, stance, evidence}, now {ym, stance, evidence}, and a 2 to 3 sentence comparison. Evidence must be a short real quote or paraphrase from the data.
  Only include pairs where the subject truly overlaps AND the stance truly changed. An empty list is correct when there is no such pair.
- data_note: one sentence on how thin or thick the evidence is (e.g. "Based on 4 retrospective months and 19 written days").
Be specific, concrete and honest. Do not flatter. Do not diagnose. Do not invent events. Only use months present in the data.`;

type MonthIn = {
  ym: string;
  label: string;
  retrospective: boolean;
  sealed: boolean;
  title: string | null;
  themes: string[];
  your_reflection: string | null;
  how_it_changed_me: string | null;
  app_conclusion: string | null;
  avg_rating: number | null;
  avg_in_character: number | null;
  influences: { name: string; from: string | null; traits: string[]; themes: string[]; why: string | null; lived_score: number | null; days_scored: number }[];
  days: { date: string; rating: number | null; in_character: number | null; note: string | null; stances: { topic: string; stance: string }[]; read: string | null }[];
};

const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** Everything the synthesis (and the freshness check) is based on. */
export async function buildArchetypeInput(supabase: SupabaseClient, level = 0): Promise<{ months: MonthIn[]; entryCount: number }> {
  const [months, influences, entries] = await Promise.all([getAllMonths(supabase), getAllInfluences(supabase), getAllEntries(supabase)]);
  const perMonth = level === 0 ? 45 : level === 1 ? 25 : 12;
  const noteLen = level === 0 ? 240 : 160;

  const out: MonthIn[] = months.map((m) => {
    const mi = influences.filter((i) => i.month_id === m.id);
    const me = entries.filter((e) => e.month_id === m.id);
    const ratings = me.filter((e) => e.rating != null).map((e) => e.rating as number);
    const fid = computeFidelity(me, mi);
    return {
      ym: ymKey(m.year, m.month),
      label: monthLabel(m.year, m.month),
      retrospective: m.is_retrospective,
      sealed: !!m.sealed_at,
      title: m.title,
      themes: m.themes ?? [],
      your_reflection: clip(m.month_end_reflection, 600),
      how_it_changed_me: clip(m.how_it_changed_me, 600),
      app_conclusion: level === 0 ? clip(m.ai_conclusion, 400) : null,
      avg_rating: round1(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null),
      avg_in_character: round1(avgCharacterScore(me)),
      influences: mi.map((i, idx) => ({
        name: i.name,
        from: i.source_note,
        traits: effectiveTraits(i).traits,
        themes: i.themes ?? [],
        why: clip(i.why_it_resonates, 500),
        lived_score: round1(fid[idx].avg),
        days_scored: fid[idx].days,
      })),
      days: me
        .filter((e) => e.note || e.rating != null)
        .slice(-perMonth)
        .map((e) => ({
          date: e.date,
          rating: e.rating,
          in_character: e.character_score,
          note: clip(e.note, noteLen),
          stances: (e.analysis?.topics ?? []).map((t) => ({ topic: t.topic, stance: t.stance })),
          read: level === 0 ? clip(e.insight, 140) : null,
        })),
    };
  });
  return { months: out, entryCount: entries.length };
}

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));

/** Is there enough in the journal to say anything yet? */
export const hasArchetypeData = (input: { months: MonthIn[] }) =>
  input.months.some((m) => m.influences.length > 0) && input.months.length >= 1;

export type ArchetypeState = {
  report: Report<ArchetypeContent> | null;
  stale: boolean;
  shouldRun: boolean;
  fingerprint: string;
  ready: boolean;
};

/**
 * Called when the archetype page renders: compares the journal to what the stored reading was based on
 * and claims a regeneration if it's out of date (debounced so rapid edits don't each cost a call).
 */
export async function checkArchetype(supabase: SupabaseClient, enabled: boolean): Promise<ArchetypeState> {
  const input = await buildArchetypeInput(supabase);
  const fingerprint = hashOf(input);
  const ready = hasArchetypeData(input);
  const existing = (await getReport<ArchetypeContent>(supabase, "archetype")) as Report<ArchetypeContent> | null;
  const stale = ready && existing?.fingerprint !== fingerprint;
  if (!enabled || !ready) return { report: existing, stale, shouldRun: false, fingerprint, ready };

  const { claimed } = await claimReport(supabase, "archetype", { needsRefresh: stale, minGapMs: MIN_GAP_MS });
  const report = claimed ? ((await getReport<ArchetypeContent>(supabase, "archetype")) as Report<ArchetypeContent> | null) : existing;
  return { report, stale, shouldRun: claimed, fingerprint, ready };
}

export async function generateArchetype(ctx: AiCtx): Promise<void> {
  const { supabase } = ctx;
  try {
    let level = 0;
    let input = await buildArchetypeInput(supabase, level);
    // keep the prompt a sane size on long journals
    while (JSON.stringify(input).length > 90_000 && level < 2) input = await buildArchetypeInput(supabase, ++level);
    const fingerprint = hashOf(await buildArchetypeInput(supabase)); // always the level-0 fingerprint the page compares against
    const known = new Set(input.months.map((m) => m.ym));

    const content = await callJson(ctx, {
      system: SYSTEM,
      data: { chapters: input.months },
      task: "Write the character sheet now.",
      schema: SCHEMA,
      effort: "medium",
      maxTokens: 14000,
      parse: (raw): ArchetypeContent => {
        const o = asObj(raw);
        const throughline = asText(o.throughline, 700);
        const arc = asText(o.arc, 1800);
        if (!throughline || !arc) throw new Error("incomplete");
        const stance = (x: unknown) => {
          const s = asObj(x);
          return { ym: asStr(s.ym, 7), stance: asStr(s.stance, 160), evidence: asStr(s.evidence, 200) };
        };
        return {
          archetype_name: asStr(o.archetype_name, 60),
          throughline,
          arc,
          becoming: asText(o.becoming, 700),
          tensions: asArr(o.tensions, 3).map((t) => asStr(t, 260)).filter(Boolean),
          recurring_themes: asArr(o.recurring_themes, 6)
            .map((t) => {
              const x = asObj(t);
              return {
                theme: asStr(x.theme, 60),
                months: asArr(x.months, 8).map((m) => asStr(m, 7)).filter((m) => known.has(m)),
                note: asStr(x.note, 260),
              };
            })
            .filter((t) => t.theme),
          // the model proposes pairs; we enforce the rules: real months, at least 2 apart, then before now
          arc_watch: asArr(o.arc_watch, 4)
            .map((p) => {
              const x = asObj(p);
              return { theme: asStr(x.theme, 80), then: stance(x.then), now: stance(x.now), comparison: asText(x.comparison, 600) };
            })
            .filter(
              (p) =>
                p.theme && p.comparison && known.has(p.then.ym) && known.has(p.now.ym) &&
                monthIndex(p.now.ym) - monthIndex(p.then.ym) >= 2,
            ),
          data_note: asStr(o.data_note, 240),
          model: insightModel(),
        };
      },
    });
    await saveReport(supabase, "archetype", { content, fingerprint, status: "done" });
  } catch {
    await saveReport(supabase, "archetype", { status: "failed" });
  }
}
