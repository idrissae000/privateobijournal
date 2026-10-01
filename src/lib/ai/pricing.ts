import "server-only";
import { KIND_INFO, type AiKind } from "./config";

/** USD per million tokens [input, output]. Source: Anthropic's published model pricing. */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5": [2, 10],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-opus-4-6": [5, 25],
  "claude-fable-5": [10, 50],
  "claude-fable-5-1": [10, 50],
  "claude-haiku-4-5": [1, 5],
};
/** An unknown model is priced like the most expensive one, so the budget errs on the safe side. */
const FALLBACK: [number, number] = [10, 50];

export const priceFor = (model: string) => PRICES[model] ?? FALLBACK;

/** micro-dollars = tokens x ($/MTok), exactly. Thinking tokens are part of output_tokens. */
export function costMicro(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null } | null | undefined): number {
  const [pin, pout] = priceFor(model);
  return Math.round((usage?.input_tokens ?? 0) * pin + (usage?.output_tokens ?? 0) * pout);
}

/**
 * Pre-call reservation: chars/3 tokens of input plus the FULL output allowance (thinking counts inside max_tokens),
 * so a call can never cost more than what was reserved and the budget is a hard ceiling.
 */
export function estimateMicro(model: string, promptChars: number, maxTokens: number): number {
  const [pin, pout] = priceFor(model);
  return Math.ceil((promptChars / 3) * pin + maxTokens * pout);
}

/** What a typical call of this kind actually costs: used by loops to stop before they'd be refused. */
export function typicalMicro(model: string, kind: AiKind, promptChars: number): number {
  const [pin, pout] = priceFor(model);
  return Math.ceil((promptChars / 3) * pin + KIND_INFO[kind].typicalOutputTokens * pout);
}
