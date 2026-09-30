"use client";

const MAX_WIDTH = 1600;
const QUALITY = 0.8;

// Resize to at most MAX_WIDTH wide and re-encode as JPEG @ 80%.
// createImageBitmap with imageOrientation "from-image" bakes in EXIF rotation (iPhone photos).
export async function compressImage(file: File): Promise<{ blob: Blob; ar: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff"; // flatten transparency for JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", QUALITY),
  );
  return { blob, ar: width / height };
}

// Once a direct browser->R2 upload has been blocked (typically a missing CORS rule), go through the
// server for the rest of this page's life instead of failing first every time.
let directBlocked = false;

async function uploadViaServer(blob: Blob): Promise<string> {
  const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
  const body = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!res.ok || !body.key) throw new Error(body.error ?? "Upload failed");
  return body.key;
}

// Compress, then upload to R2. Tries a direct presigned PUT first; if the browser can't do that
// (CORS not set up on the bucket, network filtering), falls back to uploading via the server.
export async function uploadImage(file: File): Promise<{ key: string; ar: number }> {
  const { blob, ar } = await compressImage(file);

  if (!directBlocked) {
    try {
      const res = await fetch("/api/upload-url", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't start upload");
      const { key, url } = (await res.json()) as { key: string; url: string };
      const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (put.ok) return { key, ar };
      directBlocked = true; // R2 answered but refused (e.g. signature/CORS preflight rejection)
    } catch {
      directBlocked = true; // "Failed to fetch": blocked before reaching R2
    }
  }
  return { key: await uploadViaServer(blob), ar };
}

// --- Signed view URLs (private bucket), cached client-side until shortly before expiry ---
const cache = new Map<string, { url: string; expires: number }>();
const TTL_MS = 50 * 60 * 1000; // server URLs last 60 min

export async function getPhotoUrls(keys: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = keys.filter((k) => !(cache.get(k) && cache.get(k)!.expires > now));
  if (missing.length) {
    const res = await fetch("/api/photo-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: missing }),
    });
    if (!res.ok) throw new Error("Couldn't load photos");
    const { urls } = (await res.json()) as { urls: Record<string, string> };
    for (const [k, url] of Object.entries(urls)) cache.set(k, { url, expires: now + TTL_MS });
  }
  return Object.fromEntries(keys.flatMap((k) => (cache.has(k) ? [[k, cache.get(k)!.url]] : [])));
}
