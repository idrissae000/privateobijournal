import { after } from "next/server";
import { DayScreen } from "@/components/DayScreen";
import { aiConfigured } from "@/lib/ai/config";
import { runPeriodicJobs } from "@/lib/ai/periodic";
import { getToday, requireUser } from "@/lib/data";

export default async function Home() {
  const { supabase } = await requireUser();
  const today = await getToday();

  // Scheduled passes (weekly accuracy review, foreshadowing) run quietly after the page is sent, only when due.
  if (aiConfigured()) {
    const ctx = { supabase, day: today };
    after(() => runPeriodicJobs(ctx));
  }
  return <DayScreen date={today} />;
}
