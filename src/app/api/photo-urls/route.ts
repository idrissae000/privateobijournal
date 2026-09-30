import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnKey, presignView } from "@/lib/r2";

// Turns storage keys into short-lived presigned GET URLs (private bucket).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const keys: unknown = body?.keys;
  if (!Array.isArray(keys) || keys.length > 200) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const valid = keys.filter((k): k is string => isOwnKey(k, user.id));

  try {
    const entries = await Promise.all(valid.map(async (k) => [k, await presignView(k)] as const));
    return NextResponse.json({ urls: Object.fromEntries(entries) });
  } catch {
    return NextResponse.json({ error: "Storage isn't configured" }, { status: 500 });
  }
}
