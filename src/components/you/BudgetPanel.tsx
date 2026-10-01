import type { SupabaseClient } from "@supabase/supabase-js";
import { Heading } from "@/components/scrap";
import { budgetStatus } from "@/lib/ai/budget";
import { KIND_INFO, KINDS, monthlyBudgetUsd, usd } from "@/lib/ai/config";
import { daysInMonth } from "@/lib/dates";

type Ledger = { at: string; kind: string; cost_micro: number; input_tokens: number; output_tokens: number; ok: boolean };

/** The "accountant" view: spent against the monthly budget, per category, a projection, and the receipts. */
export async function BudgetPanel({ supabase, today }: { supabase: SupabaseClient; today: string }) {
  const ym = today.slice(0, 7);
  const st = await budgetStatus(supabase, ym);
  const { data } = await supabase
    .from("ai_ledger").select("at,kind,cost_micro,input_tokens,output_tokens,ok").eq("month", ym).order("at", { ascending: false }).limit(200);
  const ledger = (data ?? []) as Ledger[];
  const ledgerTotal = ledger.reduce((a, r) => a + Number(r.cost_micro), 0);
  const ledgerComplete = ledger.length < 200;
  const day = Number(today.slice(8, 10));
  const projected = day > 0 ? (st.spent / day) * daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))) : 0;
  const pct = Math.min(100, Math.round((st.spent / st.budget) * 100));

  return (
    <section className="space-y-3">
      <Heading>Budget · {ym}</Heading>
      <div className="paper-card space-y-3 p-4">
        <p className="font-hand text-3xl">{usd(st.spent)} <span className="text-ink-soft">of {usd(st.budget)}</span></p>
        <div className="h-2 w-full overflow-hidden rounded bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly AI budget used">
          <div className={`h-full ${pct >= 90 ? "bg-stamp" : "bg-moss"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="font-type text-[11px] text-ink-soft">
          {st.calls} call{st.calls === 1 ? "" : "s"} this month · on pace for about {usd(projected)} · the app stops itself at {usd(st.limit)} (95%) so it can never pass ${monthlyBudgetUsd()}.
        </p>
        <table className="font-type w-full text-xs">
          <tbody>
            {KINDS.map((k) => (
              <tr key={k} className="border-t border-ink/10">
                <td className="py-1.5">{KIND_INFO[k].label}</td>
                <td className="py-1.5 text-right text-ink-soft">{st.perKind[k].calls} calls</td>
                <td className="py-1.5 text-right">{usd(st.perKind[k].spent)} / {usd(st.perKind[k].limit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ledgerComplete && (
          <p className="font-type text-[11px] text-ink-soft">
            Receipts add up to {usd(ledgerTotal)}; books say {usd(st.spent)}. {Math.abs(ledgerTotal - st.spent) < 10_000 ? "Balanced." : "Small differences come from calls still being settled."}
          </p>
        )}
      </div>
      {ledger.length > 0 && (
        <details className="paper-card p-4">
          <summary className="font-type cursor-pointer text-xs">Recent receipts</summary>
          <ul className="font-type mt-2 space-y-1 text-[11px]">
            {ledger.slice(0, 12).map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink-soft">{r.at.slice(5, 16).replace("T", " ")} · {r.kind}{r.ok ? "" : " (failed)"}</span>
                <span>{usd(Number(r.cost_micro))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
