import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/dates";

type Client = Awaited<ReturnType<typeof createClient>>;

type SeedMonth = {
  year: number;
  month: number;
  retrospective: boolean;
  influences: { name: string; source_note?: string }[];
};

const SEED: SeedMonth[] = [
  { year: 2025, month: 3, retrospective: true, influences: [{ name: "Jimmy McGill", source_note: "Better Call Saul" }] },
  { year: 2025, month: 4, retrospective: true, influences: [{ name: "Tony Soprano", source_note: "The Sopranos" }] },
  {
    year: 2025, month: 6, retrospective: true,
    influences: [
      { name: "AJ Soprano", source_note: "The Sopranos" },
      { name: "Christopher Moltisanti", source_note: "The Sopranos" },
    ],
  },
  { year: 2025, month: 7, retrospective: true, influences: [{ name: "Arthur Morgan", source_note: "Red Dead Redemption 2" }] },
  {
    year: 2026, month: 9, retrospective: false,
    influences: [
      { name: "Kratos", source_note: "God of War Ragnarok" },
      { name: "Hal Jordan", source_note: "Green Lantern" },
    ],
  },
];

/**
 * First-run seed: only when the account has no months at all. Inserting months uses
 * ignoreDuplicates, so a concurrent second call can't duplicate anything, and influences are
 * only added for months this call actually created.
 */
export async function seedIfEmpty(supabase: Client, tz: string): Promise<void> {
  const { count } = await supabase.from("months").select("id", { count: "exact", head: true });
  if (count && count > 0) return;

  const today = todayInTz(tz);
  for (const m of SEED) {
    const { data: created } = await supabase
      .from("months")
      .upsert(
        { year: m.year, month: m.month, is_retrospective: m.retrospective },
        { onConflict: "user_id,year,month", ignoreDuplicates: true },
      )
      .select("id");
    const monthId = created?.[0]?.id;
    if (!monthId) continue;
    const stamp = m.retrospective ? `${m.year}-${String(m.month).padStart(2, "0")}-01` : today.startsWith(`${m.year}-${String(m.month).padStart(2, "0")}`) ? today : `${m.year}-${String(m.month).padStart(2, "0")}-01`;
    await supabase.from("influences").insert(
      m.influences.map((i) => ({ month_id: monthId, name: i.name, source_note: i.source_note ?? null, date_added: stamp })),
    );
  }
}
