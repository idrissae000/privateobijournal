"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMonth } from "@/lib/data";
import { deleteObject, isOwnKey } from "@/lib/r2";
import { isValidDate } from "@/lib/dates";
import { normalizeThemes } from "@/lib/themes";
import type { Layout } from "@/lib/types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

const refresh = () => revalidatePath("/", "layout");

const clean = (s: unknown, max = 5000) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const orNull = (s: string) => (s === "" ? null : s);

/** Find or create the entry row for a date (and the month it belongs to). */
async function ensureEntry(supabase: Awaited<ReturnType<typeof createClient>>, date: string) {
  if (!isValidDate(date)) throw new Error("Bad date");
  const { data: existing } = await supabase.from("entries").select("id").eq("date", date).maybeSingle();
  if (existing) return existing.id as string;
  const month = await getOrCreateMonth(supabase, Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  await supabase
    .from("entries")
    .upsert({ date, month_id: month.id }, { onConflict: "user_id,date", ignoreDuplicates: true });
  const { data, error } = await supabase.from("entries").select("id").eq("date", date).single();
  if (error) throw error;
  return data.id as string;
}

export async function saveEntry(input: {
  date: string;
  rating: number | null;
  note: string;
  weighIn: number | null;
  influenceIds: string[];
}) {
  const { supabase } = await authed();
  const entryId = await ensureEntry(supabase, input.date);

  const rating = input.rating == null ? null : Math.round(input.rating);
  if (rating != null && (rating < 1 || rating > 10)) throw new Error("Rating must be 1-10");
  const weigh = input.weighIn == null || Number.isNaN(input.weighIn) ? null : input.weighIn;
  if (weigh != null && (weigh <= 0 || weigh > 999)) throw new Error("Bad weigh-in");

  const { error } = await supabase
    .from("entries")
    .update({ rating, note: orNull(clean(input.note)), weigh_in: weigh })
    .eq("id", entryId);
  if (error) throw error;

  await supabase.from("entry_influences").delete().eq("entry_id", entryId);
  const ids = [...new Set(input.influenceIds)];
  if (ids.length) {
    const { error: e2 } = await supabase
      .from("entry_influences")
      .insert(ids.map((influence_id) => ({ entry_id: entryId, influence_id })));
    if (e2) throw e2;
  }
  refresh();
  return entryId;
}

export async function addPhotos(date: string, items: { key: string; ar: number; progress?: boolean }[]) {
  const { supabase, user } = await authed();
  const entryId = await ensureEntry(supabase, date);
  const rows = items
    .filter((i) => isOwnKey(i.key, user.id))
    .map((i) => ({
      entry_id: entryId,
      storage_key: i.key,
      is_progress_photo: !!i.progress,
      is_hidden: !!i.progress, // progress photos never show up in general galleries
      layout: { ar: Number.isFinite(i.ar) && i.ar > 0 ? Math.min(5, Math.max(0.2, i.ar)) : 1 },
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("entry_photos").insert(rows);
  if (error) throw error;
  refresh();
}

export async function saveLayouts(updates: { id: string; layout: Layout }[]) {
  const { supabase } = await authed();
  await Promise.all(
    updates.map(async (u) => {
      const l = u.layout;
      const layout: Layout = {
        ar: l.ar, x: l.x, y: l.y, w: l.w, r: l.r, z: l.z,
      };
      const { error } = await supabase.from("entry_photos").update({ layout }).eq("id", u.id);
      if (error) throw error;
    }),
  );
  refresh();
}

export async function resetLayouts(entryId: string) {
  const { supabase } = await authed();
  const { data } = await supabase.from("entry_photos").select("id,layout").eq("entry_id", entryId);
  await Promise.all(
    (data ?? []).map((p) =>
      supabase.from("entry_photos").update({ layout: { ar: (p.layout as Layout | null)?.ar ?? 1 } }).eq("id", p.id),
    ),
  );
  refresh();
}

export async function setPhotoFlags(id: string, flags: { is_progress_photo?: boolean; is_hidden?: boolean }) {
  const { supabase } = await authed();
  const patch: Record<string, boolean> = {};
  if (flags.is_progress_photo != null) patch.is_progress_photo = flags.is_progress_photo;
  if (flags.is_hidden != null) patch.is_hidden = flags.is_hidden;
  // A progress photo is always hidden from general galleries.
  if (patch.is_progress_photo) patch.is_hidden = true;
  const { error } = await supabase.from("entry_photos").update(patch).eq("id", id);
  if (error) throw error;
  refresh();
}

export async function deletePhoto(id: string) {
  const { supabase } = await authed();
  const { data } = await supabase.from("entry_photos").select("storage_key").eq("id", id).maybeSingle();
  const { error } = await supabase.from("entry_photos").delete().eq("id", id);
  if (error) throw error;
  if (data?.storage_key) {
    // Only remove the object if no other row still points at it.
    const { count } = await supabase
      .from("entry_photos").select("id", { count: "exact", head: true }).eq("storage_key", data.storage_key);
    if (!count) await deleteObject(data.storage_key).catch(() => {});
  }
  refresh();
}

export async function addInfluence(input: {
  year: number;
  month: number;
  name: string;
  imageKey: string | null;
  why: string;
  sourceNote: string;
  dateAdded: string;
}) {
  const { supabase, user } = await authed();
  const name = clean(input.name, 120);
  if (!name) throw new Error("Name is required");
  if (input.imageKey && !isOwnKey(input.imageKey, user.id)) throw new Error("Bad image");
  const month = await getOrCreateMonth(supabase, input.year, input.month);
  const date = isValidDate(input.dateAdded) ? input.dateAdded : undefined;
  const { data, error } = await supabase
    .from("influences")
    .insert({
      month_id: month.id,
      name,
      image_key: input.imageKey,
      why_it_resonates: orNull(clean(input.why)),
      source_note: orNull(clean(input.sourceNote, 300)),
      ...(date ? { date_added: date } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  refresh();
  return data.id as string;
}

export async function updateInfluence(
  id: string,
  patch: { name?: string; imageKey?: string | null; why?: string; sourceNote?: string; themes?: string[] },
) {
  const { supabase, user } = await authed();
  const row: Record<string, string | string[] | null> = {};
  if (patch.name != null) {
    const n = clean(patch.name, 120);
    if (!n) throw new Error("Name is required");
    row.name = n;
  }
  if (patch.imageKey !== undefined) {
    if (patch.imageKey && !isOwnKey(patch.imageKey, user.id)) throw new Error("Bad image");
    row.image_key = patch.imageKey;
  }
  if (patch.why != null) row.why_it_resonates = orNull(clean(patch.why));
  if (patch.sourceNote != null) row.source_note = orNull(clean(patch.sourceNote, 300));
  if (patch.themes != null) row.themes = normalizeThemes(patch.themes);
  const { error } = await supabase.from("influences").update(row).eq("id", id);
  if (error) throw error;
  refresh();
}

export async function deleteInfluence(id: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from("influences").delete().eq("id", id);
  if (error) throw error;
  refresh();
}

export async function updateMonth(
  id: string,
  patch: { title?: string; coverImageKey?: string | null; reflection?: string; howItChanged?: string; themes?: string[] },
) {
  const { supabase, user } = await authed();
  const row: Record<string, string | string[] | null> = {};
  if (patch.title != null) row.title = orNull(clean(patch.title, 200));
  if (patch.coverImageKey !== undefined) {
    if (patch.coverImageKey && !isOwnKey(patch.coverImageKey, user.id)) throw new Error("Bad image");
    row.cover_image_key = patch.coverImageKey;
  }
  if (patch.reflection != null) row.month_end_reflection = orNull(clean(patch.reflection, 10000));
  if (patch.howItChanged != null) row.how_it_changed_me = orNull(clean(patch.howItChanged, 10000));
  if (patch.themes != null) row.themes = normalizeThemes(patch.themes);
  const { error } = await supabase.from("months").update(row).eq("id", id);
  if (error) throw error;
  refresh();
}

export async function sealMonth(id: string, title: string, reflection: string) {
  const { supabase } = await authed();
  const t = clean(title, 200);
  if (!t) throw new Error("Give the chapter a title first");
  const { error } = await supabase
    .from("months")
    .update({ title: t, month_end_reflection: orNull(clean(reflection, 10000)), sealed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  refresh();
}

export async function unsealMonth(id: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from("months").update({ sealed_at: null }).eq("id", id);
  if (error) throw error;
  refresh();
}

export async function changePassword(newPassword: string) {
  const { supabase } = await authed();
  if (newPassword.length < 10) return { error: "Use at least 10 characters." };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { error: error.message } : {};
}
