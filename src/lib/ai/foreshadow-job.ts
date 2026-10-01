import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiCtx, asArr, asEnum, asObj, asStr, asText, callJson, hashOf } from "./client";
import { insightModel } from "./config";
import { saveReport } from "./reports";
import { getAllEntries, getAllInfluences, getAllMonths } from "@/lib/data";
import { effectiveTraits } from "@/lib/traits";
import { ymKey } from "@/lib/dates";

export type ForeshadowItem = {
  kind: "confirmed_early" | "emerging" | "unnamed";
  title: string;
  detail: string;
  influence_name: string | null;
  evidence_dates: string[];
  confidence: "medium" | "high";
};

export type ForeshadowContent = { items?: ForeshadowItem[]; model?: string; entries_considered?: number };

const KINDS = ["confirmed_early", "emerging", "unnamed"] as const;
const CONF = ["low", "medium", "high"] as const;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...KINDS] },
          title: { type: "string" },
          detail: { type: "string" },
          influence_name: { type: "string" },
          evidence_dates: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: [...CONF] },
        },
        required: ["kind", "title", "detail", "influence_name", "evidence_dates", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const SYSTEM = `Task: foreshadowing detection. Find places where the user's daily entries already sound like a pattern that is, or later becomes, an explicit influence, before they consciously named it.
Use the tone, language, stances and behaviours in the entries compared with each influence's traits. Three kinds:
- "confirmed_early": entries dated BEFORE an influence's date_added that already resembled that influence (so the influence was foreshadowed). influence_name = that influence.
- "emerging": entries from roughly the last 3 weeks that resemble an influence from the library that is NOT one of the current month's influences: it may be resurfacing. influence_name = that influence.
- "unnamed": a clear recurring pattern in recent entries that matches no influence yet. influence_name = "".
Rules: each item needs at least 2 separate entries as evidence (evidence_dates must be real dates from the data). Only report medium or high confidence: it is far better to return nothing than to stretch.
Maximum 4 items. "title" is a short label; "detail" is 1 to 3 sentences, second person, concrete, quoting or paraphrasing the entries.`;

/** Has the user written enough recently for this to mean anything? */
export async function hasForeshadowData(supabase: SupabaseClient): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { count } = await supabase
    .from("entries").select("id", { count: "exact", head: true }).gte("date", since).not("note", "is", null);
  const { count: infl } = await supabase.from("influences").select("id", { count: "exact", head: true });
  return (count ?? 0) >= 6 && (infl ?? 0) >= 1;
}

/** Changes only when there are new written pages (or influences) in the window the check looks at. */
export async function foreshadowFingerprint(supabase: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: es }, { count: infl }] = await Promise.all([
    supabase.from("entries").select("date").gte("date", since).not("note", "is", null).order("date", { ascending: false }),
    supabase.from("influences").select("id", { count: "exact", head: true }),
  ]);
  return hashOf([es?.length ?? 0, es?.[0]?.date ?? null, infl ?? 0]);
}

export async function runForeshadow(ctx: AiCtx): Promise<void> {
  const { supabase } = ctx;
  try {
    const [months, influences, allEntries] = await Promise.all([getAllMonths(supabase), getAllInfluences(supabase), getAllEntries(supabase)]);
    const monthYm = new Map(months.map((m) => [m.id, ymKey(m.year, m.month)]));
    const latestMonth = months.length ? ymKey(months[months.length - 1].year, months[months.length - 1].month) : "";
    const entries = allEntries.filter((e) => e.note).slice(-150);
    const dates = new Set(entries.map((e) => e.date));

    // one library row per character: earliest appearance
    const byName = new Map<string, (typeof influences)[number]>();
    for (const i of influences) {
      const k = i.name.toLowerCase();
      if (!byName.has(k)) byName.set(k, i);
    }

    const out = await callJson(ctx, {
      kind: "foreshadow",
      system: SYSTEM,
      data: {
        current_month: latestMonth,
        library: [...byName.values()].map((i) => ({
          name: i.name,
          date_added: i.date_added,
          first_month: monthYm.get(i.month_id),
          in_current_month: monthYm.get(i.month_id) === latestMonth,
          traits: effectiveTraits(i).traits,
          why: i.why_it_resonates?.slice(0, 200) ?? null,
        })),
        entries: entries.map((e) => ({
          date: e.date,
          rating: e.rating,
          note: e.note?.slice(0, 220),
          stances: (e.analysis?.topics ?? []).map((t) => t.stance),
          tone: e.analysis?.tone ?? [],
        })),
      },
      task: "Report foreshadowing now.",
      schema: SCHEMA,
      effort: "medium",
      maxTokens: 8000,
      parse: (raw): ForeshadowItem[] =>
        asArr(asObj(raw).items, 4).flatMap((it) => {
          const x = asObj(it);
          const kind = asEnum(x.kind, KINDS);
          const confidence = asEnum(x.confidence, CONF);
          const evidence = asArr(x.evidence_dates, 8).map((d) => asStr(d, 10)).filter((d) => dates.has(d));
          const name = asStr(x.influence_name, 120);
          const known = !name || byName.has(name.toLowerCase());
          if (!kind || !confidence || confidence === "low" || evidence.length < 2 || !known) return [];
          if (kind !== "unnamed" && !name) return [];
          const title = asStr(x.title, 90);
          const detail = asText(x.detail, 500);
          if (!title || !detail) return [];
          return [{ kind, title, detail, influence_name: name || null, evidence_dates: evidence, confidence }];
        }),
    });
    await saveReport(supabase, "foreshadow", {
      content: { items: out, model: insightModel(), entries_considered: entries.length } satisfies ForeshadowContent,
      fingerprint: await foreshadowFingerprint(supabase),
      status: "done",
    });
  } catch {
    await saveReport(supabase, "foreshadow", { status: "failed" });
  }
}
