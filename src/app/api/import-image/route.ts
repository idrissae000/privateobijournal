import { Readable, Transform } from "node:stream";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPublic } from "@/lib/net-guard";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
// svg is excluded on purpose (can carry script, and can't be drawn to a canvas reliably)
const OK_TYPE = /^image\/(jpeg|jpg|png|webp|gif|avif|heic|heif|bmp)\b/i;

// Streams a public image back to the signed-in browser, which then compresses and uploads it to R2
// like any other photo. Fetching happens server-side because most image hosts block cross-site reads.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = new URL(request.url).searchParams.get("url") ?? "";
  if (!target || target.length > 2048) return NextResponse.json({ error: "Bad URL" }, { status: 400 });

  let upstream;
  try {
    upstream = await fetchPublic(target);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't fetch" }, { status: 502 });
  }

  const type = String(upstream.headers["content-type"] ?? "");
  const declared = Number(upstream.headers["content-length"] ?? 0);
  if (!OK_TYPE.test(type)) {
    upstream.destroy();
    return NextResponse.json({ error: "That link isn't a photo" }, { status: 415 });
  }
  if (declared > MAX_BYTES) {
    upstream.destroy();
    return NextResponse.json({ error: "That image is too large" }, { status: 413 });
  }

  let seen = 0;
  const capped = new Transform({
    transform(chunk, _enc, cb) {
      seen += chunk.length;
      if (seen > MAX_BYTES) return cb(new Error("Too large"));
      cb(null, chunk);
    },
  });
  upstream.on("error", (err) => capped.destroy(err));
  upstream.pipe(capped);

  return new Response(Readable.toWeb(capped) as ReadableStream, {
    headers: { "content-type": type.split(";")[0], "cache-control": "private, no-store" },
  });
}
