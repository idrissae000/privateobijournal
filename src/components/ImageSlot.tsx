"use client";

import { useEffect, useRef, useState } from "react";
import { ImageSearchSheet } from "@/components/ImageSearchSheet";
import { PhotoSourceSheet } from "@/components/PhotoSourceSheet";
import { getPhotoUrls, uploadImage } from "@/lib/image-upload";

type Props = {
  /** R2 storage key of the current image, or null for an empty slot. */
  value: string | null;
  /** Already-signed view URL for `value` (server-rendered), saves a round trip. */
  url?: string | null;
  /** Called with the new storage key (and aspect ratio) once the upload has finished. */
  onChange: (key: string, ar: number) => void | Promise<void>;
  label?: string;
  className?: string;
  /** Extra content drawn over an empty slot, under the "+" */
  hint?: string;
  /** When set, tapping the slot asks where the photo comes from (library, camera, or a web search seeded with this text). */
  searchQuery?: string;
};

// Tap to pick from the camera roll or take a photo; uploads straight to R2 and shows immediately.
// Empty slots are dashed placeholders with a "+".
export function ImageSlot({ value, url, onChange, label = "Add photo", className = "", hint, searchQuery }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ key: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!value || url) return;
    let cancelled = false;
    getPhotoUrls([value])
      .then((urls) => !cancelled && urls[value] && setRemote({ key: value, url: urls[value] }))
      .catch(() => !cancelled && setError("Couldn't load photo"));
    return () => {
      cancelled = true;
    };
  }, [value, url]);

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    const preview = URL.createObjectURL(file); // show immediately, before the upload finishes
    setLocalUrl(preview);
    try {
      const { key, ar } = await uploadImage(file);
      await onChange(key, ar);
    } catch (e) {
      setLocalUrl(null);
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const src = localUrl ?? url ?? (remote && remote.key === value ? remote.url : null);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (searchQuery !== undefined ? setChoosing(true) : input.current?.click())}
        disabled={busy}
        aria-haspopup={searchQuery !== undefined ? "dialog" : undefined}
        aria-label={label}
        className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${
          src ? "" : "border-2 border-dashed border-ink/40 text-ink/60"
        }`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <span aria-hidden className="text-4xl leading-none">+</span>
            {hint && <span className="font-hand mt-1 text-lg leading-none">{hint}</span>}
          </>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm text-white">
            Uploading…
          </span>
        )}
      </button>
      {choosing && (
        <PhotoSourceSheet
          onClose={() => setChoosing(false)}
          onLibrary={() => { setChoosing(false); input.current?.click(); }}
          onCamera={() => { setChoosing(false); camera.current?.click(); }}
          onSearch={() => { setChoosing(false); setSearching(true); }}
        />
      )}
      {searching && <ImageSearchSheet initialQuery={searchQuery ?? ""} onClose={() => setSearching(false)} onPick={handleFile} onLibrary={() => input.current?.click()} />}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
