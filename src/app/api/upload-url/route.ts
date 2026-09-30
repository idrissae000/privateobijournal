import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignUpload } from "@/lib/r2";

// Returns a short-lived presigned PUT URL for a new JPEG under the user's own prefix.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `${user.id}/${crypto.randomUUID()}.jpg`;
  try {
    const url = await presignUpload(key, "image/jpeg");
    return NextResponse.json({ key, url });
  } catch {
    return NextResponse.json({ error: "Storage isn't configured" }, { status: 500 });
  }
}
