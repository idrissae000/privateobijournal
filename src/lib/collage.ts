import type { Layout, Photo } from "./types";

export type Placed = { id: string; ar: number; x: number; y: number; w: number; h: number; r: number; z: number };

/** Polaroid geometry, in fractions of the frame's own width (mirrors the CSS in <Frame>). */
export const FRAME_SIDE = 0.06;
export const FRAME_BOTTOM = 0.2;
export const frameHeight = (w: number, ar: number) => w * (FRAME_SIDE + (1 - 2 * FRAME_SIDE) / ar + FRAME_BOTTOM);

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const isPlaced = (l: Layout | null): l is Layout & Required<Omit<Layout, "ar">> =>
  !!l && l.x != null && l.y != null && l.w != null && l.r != null && l.z != null;

/**
 * Resolve a position for every photo. Photos with a saved layout keep it; the rest are
 * auto-arranged into a loose, slightly overlapping, slightly rotated collage below them.
 */
export function resolveCollage(photos: Pick<Photo, "id" | "layout">[]): { items: Placed[]; height: number } {
  const total = photos.length;
  const items: Placed[] = [];
  const unplaced: { id: string; ar: number }[] = [];
  let bottom = 0;
  let zMax = 0;

  for (const p of photos) {
    const ar = p.layout?.ar && p.layout.ar > 0 ? p.layout.ar : 1;
    if (isPlaced(p.layout)) {
      const h = frameHeight(p.layout.w, ar);
      items.push({ id: p.id, ar, x: p.layout.x, y: p.layout.y, w: p.layout.w, h, r: p.layout.r, z: p.layout.z });
      bottom = Math.max(bottom, p.layout.y + h);
      zMax = Math.max(zMax, p.layout.z);
    } else {
      unplaced.push({ id: p.id, ar });
    }
  }

  if (unplaced.length) {
    const cols = total <= 1 ? 1 : total <= 4 ? 2 : 3;
    const w = cols === 1 ? 66 : cols === 2 ? 47 : 32;
    const cell = 100 / cols;
    let rowTop = items.length ? bottom - 2 : 2;
    for (let i = 0; i < unplaced.length; i += cols) {
      const row = unplaced.slice(i, i + cols);
      let rowH = 0;
      row.forEach((u, c) => {
        const h = frameHeight(w, u.ar);
        rowH = Math.max(rowH, h);
        // when the last row is short, center it
        const offset = row.length < cols ? ((cols - row.length) * cell) / 2 : 0;
        const jx = (hash(u.id + "x") - 0.5) * 4;
        const jy = (hash(u.id + "y") - 0.5) * 4;
        const x = Math.min(100 - w, Math.max(0, offset + c * cell + (cell - w) / 2 + jx));
        items.push({
          id: u.id, ar: u.ar, x, y: Math.max(0, rowTop + jy), w, h,
          r: (hash(u.id + "r") - 0.5) * 12, z: ++zMax,
        });
      });
      rowTop += rowH * 0.94;
    }
    for (const it of items) bottom = Math.max(bottom, it.y + it.h);
  }

  return { items, height: Math.max(40, bottom + 3) };
}
