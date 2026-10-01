import "server-only";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Defaults to Claude Sonnet 5. Set INSIGHT_MODEL to switch (e.g. claude-opus-5-5 for the most capable reading). */
export const insightModel = () => process.env.INSIGHT_MODEL || "claude-sonnet-5";

/** Hard ceiling on Claude API calls per day, enforced atomically in the database. */
export const dailyCallLimit = () => Math.max(1, Number(process.env.INSIGHT_DAILY_CALL_LIMIT) || 60);

const MODERN = /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/;
/** The server-side refusal fallback is documented for these models only (not plain Sonnet 5). */
const FALLBACK_MODELS = /^claude-(opus-5(-5)?|fable-5-1|sonnet-5-5)$/;
/** `effort` exists on the newer model families. */
export const supportsEffort = (model: string) => MODERN.test(model);
export const supportsFallbacks = (model: string) => FALLBACK_MODELS.test(model) && process.env.INSIGHT_FALLBACKS !== "off";
