import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCtx } from "./client";
import { getTz } from "@/lib/data";
import { todayInTz } from "@/lib/dates";

/** Context for AI jobs: the signed-in client plus "today" and the budget month in the user's time zone. */
export async function makeAiCtx(supabase: SupabaseClient): Promise<AiCtx> {
  const today = todayInTz(await getTz());
  return { supabase, day: today, month: today.slice(0, 7) };
}
