import Link from "next/link";
import { after } from "next/server";
import { ArchetypeView } from "@/components/ArchetypeView";
import { InsightPoller } from "@/components/InsightPoller";
import { Empty, Heading } from "@/components/scrap";
import { aiConfigured } from "@/lib/ai/config";
import { checkArchetype, generateArchetype, type ArchetypeContent } from "@/lib/ai/archetype-job";
import type { ForeshadowContent } from "@/lib/ai/foreshadow-job";
import { getReport } from "@/lib/ai/reports";
import { getToday, requireUser } from "@/lib/data";

export default async function ArchetypePage() {
  const { supabase } = await requireUser();
  const aiOn = aiConfigured();
  const state = await checkArchetype(supabase, aiOn);

  // Out of date? Quietly rewrite it in the background; this view keeps showing the last version meanwhile.
  if (state.shouldRun) {
    const ctx = { supabase, day: await getToday() };
    after(() => generateArchetype(ctx));
  }
  const foreshadow = aiOn ? await getReport<ForeshadowContent>(supabase, "foreshadow") : null;

  const report = state.report;
  const hasContent = !!report?.content?.throughline;

  return (
    <div className="space-y-6">
      <div>
        <Heading>You, so far</Heading>
        <p className="font-hand mt-2 text-xl text-ink-soft">A living character sheet, written from everything you&apos;ve logged. It updates itself as you add pages.</p>
      </div>

      {!aiOn ? (
        <div className="paper-card space-y-2 p-4">
          <p className="font-hand text-2xl">Insights are switched off.</p>
          <p className="font-type text-xs text-ink-soft">
            Add an <code>ANTHROPIC_API_KEY</code> to this deployment to turn on traits, daily reflections and this page.{" "}
            <Link href="/admin" className="underline">Setup status</Link>
          </p>
        </div>
      ) : !state.ready ? (
        <Empty>Add a few influences and write a few pages. There&apos;s nothing to read yet.</Empty>
      ) : hasContent ? (
        <ArchetypeView
          content={report!.content as ArchetypeContent}
          status={report!.status}
          generatedAt={report!.generated_at}
          stale={state.stale}
          foreshadow={foreshadow?.content ?? null}
        />
      ) : (
        <div role="status" className="paper-card p-4">
          <InsightPoller active={report?.status === "pending" || state.shouldRun} />
          <p className="font-hand animate-pulse text-2xl text-ink-soft">
            {report?.status === "failed" ? "Couldn't write your first character sheet just now. Open this page again in a few minutes." : "writing your first character sheet…"}
          </p>
        </div>
      )}
    </div>
  );
}
