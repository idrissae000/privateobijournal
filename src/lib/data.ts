import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { presignView } from "@/lib/r2";
import { todayInTz, daysInMonth, dayKey } from "@/lib/dates";
import type { Entry, Influence, Month, Photo } from "@/lib/types";

export async function getTz(): Promise<string> {
  const c = await cookies();
  return c.get("tz")?.value ?? "UTC";
}

export async function getToday(): Promise<string> {
  return todayInTz(await getTz());
}

/** The signed-in user, or redirect to /login. Also returns an RLS-scoped client. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** Sign a set of storage keys for viewing. Missing/failed keys are simply omitted. */
export async function signKeys(keys: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter((k): k is string => !!k))];
  const out: Record<string, string> = {};
  try {
    await Promise.all(unique.map(async (k) => { out[k] = await presignView(k); }));
  } catch {
    // storage not configured: render without images
  }
  return out;
}

export async function getOrCreateMonth(supabase: Client, year: number, month: number): Promise<Month> {
  const { data: existing } = await supabase
    .from("months").select("*").eq("year", year).eq("month", month).maybeSingle();
  if (existing) return existing as Month;
  await supabase.from("months").upsert({ year, month }, { onConflict: "user_id,year,month", ignoreDuplicates: true });
  const { data, error } = await supabase.from("months").select("*").eq("year", year).eq("month", month).single();
  if (error) throw error;
  return data as Month;
}

type EntryRow = Omit<Entry, "influence_ids"> & { entry_influences: { influence_id: string }[] };

const toEntry = (r: EntryRow): Entry => ({
  id: r.id, date: r.date, month_id: r.month_id, rating: r.rating, note: r.note, weigh_in: r.weigh_in,
  influence_ids: (r.entry_influences ?? []).map((x) => x.influence_id),
});

export async function getEntries(supabase: Client, monthId: string): Promise<Entry[]> {
  const { data } = await supabase
    .from("entries")
    .select("id,date,month_id,rating,note,weigh_in,entry_influences(influence_id)")
    .eq("month_id", monthId)
    .order("date");
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
}

export async function getEntryByDate(supabase: Client, date: string): Promise<Entry | null> {
  const { data } = await supabase
    .from("entries")
    .select("id,date,month_id,rating,note,weigh_in,entry_influences(influence_id)")
    .eq("date", date)
    .maybeSingle();
  return data ? toEntry(data as unknown as EntryRow) : null;
}

export async function getInfluences(supabase: Client, monthId: string): Promise<Influence[]> {
  const { data } = await supabase
    .from("influences").select("*").eq("month_id", monthId).order("date_added").order("created_at");
  return (data ?? []) as Influence[];
}

export async function getAllInfluences(supabase: Client): Promise<Influence[]> {
  const { data } = await supabase.from("influences").select("*").order("date_added").order("created_at");
  return (data ?? []) as Influence[];
}

export async function getAllMonths(supabase: Client): Promise<Month[]> {
  const { data } = await supabase.from("months").select("*").order("year").order("month");
  return (data ?? []) as Month[];
}

export async function getPhotosForEntries(supabase: Client, entryIds: string[]): Promise<Photo[]> {
  if (!entryIds.length) return [];
  const { data } = await supabase
    .from("entry_photos").select("*").in("entry_id", entryIds).order("created_at");
  return (data ?? []) as Photo[];
}

/** Photos that may appear in general galleries/collages: never hidden, never progress. */
export const isGalleryPhoto = (p: Photo) => !p.is_hidden && !p.is_progress_photo;

export function monthDates(year: number, month: number): string[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => dayKey(year, month, i + 1));
}
