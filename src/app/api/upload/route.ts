import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { putObject } from "@/lib/r2";

export const runtime = "nodejs";

// Vercel functions accept request bodies up to ~4.5 MB; photos are compressed to well under that.
const MAX_BYTES = 4 * 1024 * 1024;

// Fallback path for uploads: the browser sends the (already compressed) JPEG here and the server
// puts it into R2. Used automatically when a direct presigned upload is blocked (CORS etc.).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return NextResponse.json({ error: "That photo is too large" }, { status: 413 });

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length === 0 || body.length > MAX_BYTES) {
    return NextResponse.json({ error: body.length ? "That photo is too large" : "Empty upload" }, { status: 400 });
  }
  // JPEG magic bytes only: the client always sends a re-encoded JPEG
  if (!(body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)) {
    return NextResponse.json({ error: "Not a JPEG" }, { status: 415 });
  }

  const key = `${user.id}/${crypto.randomUUID()}.jpg`;
  try {
    await putObject(key, body, "image/jpeg");
    return NextResponse.json({ key });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg =
      name === "Error" && e instanceof Error && e.message.includes("not configured")
        ? "Storage isn't configured (missing R2 env vars)"
        : /NoSuchBucket/.test(name) ? "R2 bucket not found. Check R2_BUCKET"
        : /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|Forbidden/.test(name)
          ? "R2 rejected the credentials. Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY and that the token can write to the bucket"
          : "Couldn't reach R2. Check R2_ACCOUNT_ID";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
