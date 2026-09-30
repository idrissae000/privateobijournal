import { ProgressView, type ProgressItem } from "@/components/ProgressView";
import { Heading } from "@/components/scrap";
import { getToday, requireUser, signKeys } from "@/lib/data";
import type { Layout } from "@/lib/types";

type Row = {
  id: string;
  storage_key: string;
  layout: Layout | null;
  entries: { date: string; weigh_in: number | null } | null;
};

// The only place progress photos are shown.
export default async function ProgressPage() {
  const { supabase } = await requireUser();
  const today = await getToday();
  const { data } = await supabase
    .from("entry_photos")
    .select("id,storage_key,layout,entries(date,weigh_in)")
    .eq("is_progress_photo", true);

  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => r.entries)
    .sort((a, b) => a.entries!.date.localeCompare(b.entries!.date));
  const urls = await signKeys(rows.map((r) => r.storage_key));
  const items: ProgressItem[] = rows.map((r) => ({
    id: r.id,
    url: urls[r.storage_key] ?? null,
    date: r.entries!.date,
    ar: r.layout?.ar ?? 1,
    weight: r.entries!.weigh_in != null ? Number(r.entries!.weigh_in) : null,
  }));

  return (
    <div className="space-y-6">
      <Heading>Progress</Heading>
      <ProgressView items={items} today={today} />
    </div>
  );
}
