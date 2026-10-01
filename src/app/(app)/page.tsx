import { after } from "next/server";
import { DayScreen } from "@/components/DayScreen";
import { runCatchUpStep } from "@/lib/ai/catchup";
import { aiConfigured } from "@/lib/ai/config";
import { runPeriodicJobs } from "@/lib/ai/periodic";
import { getToday, requireUser } from "@/lib/data";

export default async function Home() {
  const { supabase } = await requireUser();
  const today = await getToday();

  // Quietly, after the page is sent: first read a few not-yet-read pages from before insights were on
  // (a handful per visit, bounded by the daily cap), then run whichever scheduled passes are due.
  if (aiConfigured()) {
    const ctx = { supabase, day: today };
    after(async () => {
      await runCatchUpStep(ctx, { maxItems: 6 });
      await runPeriodicJobs(ctx);
    });
  }
  return <DayScreen date={today} />;
}
