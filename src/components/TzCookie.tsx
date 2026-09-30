"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Today" depends on the device's time zone. Remember it in a cookie so the server can
// compute the right local date; refresh once if it was missing or changed (e.g. travel).
export function TzCookie({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);
  return null;
}
