"use client";

import { useEffect } from "react";

// Several sheets can be open at once (e.g. a photo search on top of the add-influence sheet),
// so locking is reference-counted: the page unlocks only when the last one closes.
let locks = 0;
let saved: { y: number; position: string; top: string; width: string; overflow: string } | null = null;

/**
 * While a pop-up sheet is open the page behind it must not scroll. `overflow: hidden` alone isn't enough
 * on iOS Safari, so the body is pinned in place (position: fixed) and the scroll position restored on close.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (locks++ === 0) {
      const b = document.body.style;
      const y = window.scrollY;
      saved = { y, position: b.position, top: b.top, width: b.width, overflow: b.overflow };
      b.position = "fixed";
      b.top = `-${y}px`;
      b.width = "100%";
      b.overflow = "hidden";
    }
    return () => {
      if (--locks === 0 && saved) {
        const b = document.body.style;
        b.position = saved.position;
        b.top = saved.top;
        b.width = saved.width;
        b.overflow = saved.overflow;
        window.scrollTo(0, saved.y);
        saved = null;
      }
    };
  }, [active]);
}
