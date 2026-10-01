import "server-only";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Defaults to Claude Sonnet 5. Set INSIGHT_MODEL to switch (e.g. claude-opus-5-5 for the most capable reading). */
export const insightModel = () => process.env.INSIGHT_MODEL || "claude-sonnet-5";

/** Runaway guard: max Claude calls per day, enforced atomically in the database. */
export const dailyCallLimit = () => Math.max(1, Number(process.env.INSIGHT_DAILY_CALL_LIMIT) || 60);

const MODERN = /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/;
/** The server-side refusal fallback is documented for these models only (not plain Sonnet 5). */
const FALLBACK_MODELS = /^claude-(opus-5(-5)?|fable-5-1|sonnet-5-5)$/;
/** `effort` exists on the newer model families. */
export const supportsEffort = (model: string) => MODERN.test(model);
export const supportsFallbacks = (model: string) => FALLBACK_MODELS.test(model) && process.env.INSIGHT_FALLBACKS !== "off";

// ---------------------------------------------------------------------------------------------------------
// Money. Everything is tracked in micro-dollars (1 USD = 1,000,000), which is exactly tokens x ($ per MTok).
// ---------------------------------------------------------------------------------------------------------

/** The monthly budget in US dollars (INSIGHT_MONTHLY_BUDGET_USD, default $5). */
export const monthlyBudgetUsd = () => {
  const n = Number(process.env.INSIGHT_MONTHLY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 5;
};

/** The app stops at 95% of the budget: our cost figures are computed from token counts, so leave a margin. */
export const SAFETY_MARGIN = 0.95;
export const budgetLimitMicro = () => Math.round(monthlyBudgetUsd() * 1_000_000 * SAFETY_MARGIN);

/** What each kind of work is for. Each gets a share of the monthly budget so nothing can eat all of it. */
export type AiKind = "reads" | "sheet" | "opinions" | "traits" | "conclusions" | "foreshadow" | "review" | "reserve";

export const KIND_INFO: Record<AiKind, { label: string; share: number; typicalOutputTokens: number }> = {
  reads: { label: "Daily reads", share: 0.4, typicalOutputTokens: 2500 },
  sheet: { label: "Character sheet & Arc Watch", share: 0.2, typicalOutputTokens: 7000 },
  opinions: { label: "Breakdown opinions", share: 0.15, typicalOutputTokens: 3000 },
  traits: { label: "Character traits", share: 0.05, typicalOutputTokens: 1500 },
  conclusions: { label: "Month-end conclusions", share: 0.05, typicalOutputTokens: 2500 },
  foreshadow: { label: "Foreshadowing", share: 0.05, typicalOutputTokens: 4000 },
  review: { label: "Accuracy review", share: 0.05, typicalOutputTokens: 4000 },
  reserve: { label: "Reserve (overflow, tests)", share: 0.05, typicalOutputTokens: 1500 },
};
export const KINDS = Object.keys(KIND_INFO) as AiKind[];
export const kindLimitMicro = (k: AiKind) => Math.round(budgetLimitMicro() * KIND_INFO[k].share);

export const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;
