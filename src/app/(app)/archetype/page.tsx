import { after } from "next/server";
import { ArcWatchView, ForeshadowView, ReportStatus, SheetView } from "@/components/ArchetypeView";
import { CatchUpBanner } from "@/components/CatchUpBanner";
import { InsightPoller } from "@/components/InsightPoller";
import { Empty, Heading } from "@/components/scrap";
import { FidelityTab } from "@/components/you/FidelityTab";
import { ReadsTab } from "@/components/you/ReadsTab";
import { ReviewTab } from "@/components/you/ReviewTab";
import { TraitsTab } from "@/components/you/TraitsTab";
import { TABS, YouTabs, type TabId } from "@/components/you/YouTabs";
import { checkArchetype, generateArchetype, type ArchetypeContent } from "@/lib/ai/archetype-job";
import { catchUpPlan } from "@/lib/ai/catchup";
import { aiConfigured } from "@/lib/ai/config";
import type { ForeshadowContent } from "@/lib/ai/foreshadow-job";
import { getReport } from "@/lib/ai/reports";
import { getToday, requireUser } from "@/lib/data";

export default async function YouPage({ searchParams }: PageProps<"/archetype">) {
  const { tab: raw } = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === raw)?.id ?? "sheet";

  const { supabase } = await requireUser();
  const aiOn = aiConfigured();
  const today = await getToday();

  // The character sheet quietly refreshes itself (in the background) when you look at it and it's out of date.
  const state = tab === "sheet" || tab === "arc" ? await checkArchetype(supabase, aiOn) : null;
  if (state?.shouldRun) {
    const ctx = { supabase, day: today };
    after(() => generateArchetype(ctx));
  }
  const archetype = state?.report ?? (await getReport<ArchetypeContent>(supabase, "archetype"));
  const content = (archetype?.content ?? null) as ArchetypeContent | null;
  const hasSheet = !!content?.throughline;

  const [foreshadow, plan, { count: openFlags }, { count: suggested }] = await Promise.all([
    getReport<ForeshadowContent>(supabase, "foreshadow"),
    aiOn ? catchUpPlan(supabase, { includeFailed: true }) : Promise.resolve(null),
    supabase.from("ai_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("influences").select("id", { count: "exact", head: true }).eq("traits_status", "suggested"),
  ]);

  const off = (
    <div className="paper-card space-y-1 p-4">
      <p className="font-hand text-2xl">Insights are switched off.</p>
      <p className="font-type text-xs text-ink-soft">Add <code>ANTHROPIC_API_KEY</code> to this deployment to turn this on. The Review tab has the steps.</p>
    </div>
  );

  let body: React.ReactNode;
  if (tab === "sheet") {
    body = !aiOn ? off : !state?.ready ? (
      <Empty>Add a few influences and write a few pages. There&apos;s nothing to read yet.</Empty>
    ) : hasSheet ? (
      <div className="space-y-6">
        <InsightPoller active={archetype?.status === "pending"} />
        <SheetView content={content!} />
        <ReportStatus status={archetype!.status} generatedAt={archetype!.generated_at} stale={state.stale} note={content!.data_note} />
      </div>
    ) : (
      <div role="status" className="paper-card p-4">
        <InsightPoller active={archetype?.status === "pending" || !!state.shouldRun} />
        <p className="font-hand animate-pulse text-2xl text-ink-soft">
          {archetype?.status === "failed" ? "Couldn't write your first character sheet just now. It tries again when you open this page later." : "writing your first character sheet…"}
        </p>
      </div>
    );
  } else if (tab === "arc") {
    body = !aiOn ? off : (
      <div className="space-y-6">
        <InsightPoller active={archetype?.status === "pending"} />
        <ArcWatchView content={content} />
        {archetype && hasSheet && <ReportStatus status={archetype.status} generatedAt={archetype.generated_at} stale={state?.stale} />}
      </div>
    );
  } else if (tab === "foreshadow") {
    body = !aiOn ? off : <ForeshadowView foreshadow={foreshadow?.content ?? null} />;
  } else if (tab === "fidelity") {
    body = <FidelityTab supabase={supabase} aiOn={aiOn} />;
  } else if (tab === "reads") {
    body = <ReadsTab supabase={supabase} aiOn={aiOn} />;
  } else if (tab === "traits") {
    body = <TraitsTab supabase={supabase} aiOn={aiOn} />;
  } else {
    body = <ReviewTab supabase={supabase} today={today} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <Heading>You, so far</Heading>
        <p className="font-hand mt-2 text-xl text-ink-soft">What your pages add up to. It updates itself as you write.</p>
      </div>

      {plan && plan.total > 0 && (
        <CatchUpBanner
          counts={{
            traits: plan.traits.length, entries: plan.entries.length, conclusions: plan.conclusions.length,
            sheet: plan.archetype, foreshadow: plan.foreshadow, review: plan.review, total: plan.total,
          }}
        />
      )}

      <YouTabs
        active={tab}
        badges={{
          arc: content?.arc_watch?.length ?? 0,
          foreshadow: foreshadow?.content?.items?.length ?? 0,
          traits: suggested ?? 0,
          review: openFlags ?? 0,
        }}
      />
      <div>{body}</div>
    </div>
  );
}
