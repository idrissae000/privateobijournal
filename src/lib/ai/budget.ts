import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AiKind, KINDS, budgetLimitMicro, insightModel, kindLimitMicro, monthlyBudgetUsd } from "./config";
import { typicalMicro } from "./pricing";

export type KindSpend = { limit: number; spent: number; calls: number };
export type BudgetStatus = {
  month: string;
  /** what the app will actually let itself spend (95% of the budget) */
  limit: number;
  /** the headline budget the user set, in micro-dollars */
  budget: number;
  spent: number;
  calls: number;
  remaining: number;
  perKind: Record<AiKind, KindSpend>;
};

/** Reads the ledger totals for one month (all amounts in micro-dollars). */
export async function budgetStatus(supabase: SupabaseClient, month: string): Promise<BudgetStatus> {
  const { data } = await supabase.from("ai_spend").select("kind,micro_usd,calls").eq("month", month);
  const perKind = Object.fromEntries(KINDS.map((k) => [k, { limit: kindLimitMicro(k), spent: 0, calls: 0 }])) as Record<AiKind, KindSpend>;
  for (const r of (data ?? []) as { kind: AiKind; micro_usd: number; calls: number }[]) {
    if (perKind[r.kind]) {
      perKind[r.kind].spent += Number(r.micro_usd);
      perKind[r.kind].calls += Number(r.calls);
    }
  }
  const spent = KINDS.reduce((a, k) => a + perKind[k].spent, 0);
  const calls = KINDS.reduce((a, k) => a + perKind[k].calls, 0);
  const limit = budgetLimitMicro();
  return { month, limit, budget: Math.round(monthlyBudgetUsd() * 1_000_000), spent, calls, remaining: Math.max(0, limit - spent), perKind };
}

/** How much `kind` could still spend: its own share plus whatever the reserve has left, capped by the monthly total. */
export function available(status: BudgetStatus, kind: AiKind): number {
  const own = Math.max(0, status.perKind[kind].limit - status.perKind[kind].spent);
  const reserve = kind === "reserve" ? 0 : Math.max(0, status.perKind.reserve.limit - status.perKind.reserve.spent);
  return Math.min(status.remaining, own + reserve);
}

/** A typical-sized call for this kind: used by loops to stop before they'd be refused. */
export const typicalCost = (kind: AiKind) => typicalMicro(insightModel(), kind, 12_000);
export const canAfford = (status: BudgetStatus, kind: AiKind) => available(status, kind) >= typicalCost(kind);
