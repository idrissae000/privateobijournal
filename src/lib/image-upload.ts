"use client";

const MAX_WIDTH = 1600;
const QUALITY = 0.8;

// Resize to at most MAX_WIDTH wide and re-encode as JPEG @ 80%.
// createImageBitmap with imageOrientation "from-image" bakes in EXIF rotation (iPhone photos).
export async function compressImage(file: File): Promise<Blob> {
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

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", QUALITY),
  );
}

// Compress, then upload straight to R2 via a presigned URL. Returns the storage key.
export async function uploadImage(file: File): Promise<string> {
  const blob = await compressImage(file);

  const res = await fetch("/api/upload-url", { method: "POST" });
  if (!res.ok) throw new Error("Couldn't start upload");
  const { key, url } = (await res.json()) as { key: string; url: string };

  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!put.ok) throw new Error("Upload failed");
  return key;
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
