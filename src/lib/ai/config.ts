import "server-only";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Defaults to Claude Opus 5.5. Set INSIGHT_MODEL=claude-sonnet-5-5 for roughly half the cost. */
export const insightModel = () => process.env.INSIGHT_MODEL || "claude-opus-5-5";

/** Hard ceiling on Claude API calls per day, enforced atomically in the database. */
export const dailyCallLimit = () => Math.max(1, Number(process.env.INSIGHT_DAILY_CALL_LIMIT) || 60);

const MODERN = /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/;
/** `effort` and server-side fallbacks only exist on the newer model families. */
export const supportsEffort = (model: string) => MODERN.test(model);
export const supportsFallbacks = (model: string) => MODERN.test(model) && process.env.INSIGHT_FALLBACKS !== "off";
