"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, resetLayouts, saveLayouts, setPhotoFlags } from "@/app/actions";
import { frameHeight, resolveCollage, type Placed } from "@/lib/collage";
import { Frame } from "@/components/scrap";
import type { Layout } from "@/lib/types";

export type CollagePhoto = { id: string; url: string | null; layout: Layout | null };

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: "resize"; id: string; startX: number; w: number };

/**
 * The day's photo collage. Photos are auto-arranged; "Rearrange" lets you drag, resize,
 * rotate and layer them, then saves the layout.
 */
export function Collage({ photos, entryId }: { photos: CollagePhoto[]; entryId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const resolved = useMemo(() => resolveCollage(photos), [photos]);
  const items = editing ? draft : resolved.items;
  const height = editing
    ? Math.max(40, Math.max(0, ...draft.map((i) => i.y + i.h)) + 3)
    : resolved.height;
  const urlById = useMemo(() => new Map(photos.map((p) => [p.id, p.url])), [photos]);

  if (!photos.length) return null;

  const patch = (id: string, fn: (p: Placed) => Placed) =>
    setDraft((d) => d.map((p) => (p.id === id ? fn(p) : p)));

  function begin() {
    setDraft(resolved.items);
    setSelected(null);
    setError(null);
    setEditing(true);
  }

  function unitsPerPx() {
    const w = canvas.current?.getBoundingClientRect().width || 1;
    return 100 / w;
  }

  function onPointerDown(e: React.PointerEvent, p: Placed, kind: Drag["kind"]) {
    if (!editing) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(p.id);
    drag.current =
      kind === "move"
        ? { kind, id: p.id, startX: e.clientX, startY: e.clientY, x: p.x, y: p.y }
        : { kind, id: p.id, startX: e.clientX, w: p.w };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const k = unitsPerPx();
    if (d.kind === "move") {
      patch(d.id, (p) => ({
        ...p,
        x: Math.min(100 - p.w * 0.3, Math.max(-p.w * 0.7, d.x + (e.clientX - d.startX) * k)),
        y: Math.max(0, d.y + (e.clientY - d.startY) * k),
      }));
    } else {
      patch(d.id, (p) => {
        const w = Math.min(100, Math.max(16, d.w + (e.clientX - d.startX) * k));
        return { ...p, w, h: frameHeight(w, p.ar) };
      });
    }
  }

  const onPointerUp = () => { drag.current = null; };

  const sel = draft.find((p) => p.id === selected);
  const zs = draft.map((p) => p.z);

  function save() {
    setError(null);
    start(async () => {
      try {
        await saveLayouts(draft.map((p) => ({ id: p.id, layout: { ar: p.ar, x: round(p.x), y: round(p.y), w: round(p.w), r: round(p.r), z: p.z } })));
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function auto() {
    if (!entryId) return;
    start(async () => {
      await resetLayouts(entryId);
      setEditing(false);
      router.refresh();
    });
  }

  function flag(id: string) {
    start(async () => {
      await setPhotoFlags(id, { is_progress_photo: true });
      setEditing(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this photo for good?")) return;
    start(async () => {
      await deletePhoto(id);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div
        ref={canvas}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `100 / ${height}` }}
        onPointerDown={() => editing && setSelected(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.map((p) => (
          <div
            key={p.id}
            className={`absolute ${editing ? "cursor-grab touch-none" : ""}`}
            style={{
              left: `${p.x}%`,
              top: `${(p.y / height) * 100}%`,
              width: `${p.w}%`,
              zIndex: p.z + 100,
              transform: `rotate(${p.r}deg)`,
              outline: editing && selected === p.id ? "2px dashed var(--stamp)" : undefined,
              outlineOffset: 4,
            }}
            onPointerDown={(e) => onPointerDown(e, p, "move")}
          >
            <Frame src={urlById.get(p.id)} ar={p.ar} />
            {editing && selected === p.id && (
              <span
                role="button"
                aria-label="Resize photo"
                className="absolute -bottom-3 -right-3 h-7 w-7 cursor-nwse-resize touch-none rounded-full border-2 border-paper bg-stamp"
                onPointerDown={(e) => onPointerDown(e, p, "resize")}
              />
            )}
          </div>
        ))}
      </div>

      {!editing && (
        <div className="flex justify-end">
          <button type="button" onClick={begin} className="font-type text-sm underline">Rearrange photos</button>
        </div>
      )}

      {editing && (
        <div className="paper-card space-y-3 p-3">
          <p className="font-hand text-xl">
            {sel ? "Drag to move, pull the red dot to resize." : "Tap a photo to adjust it, drag to move."}
          </p>
          {sel && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => patch(sel.id, (p) => ({ ...p, r: clampR(p.r - 4) }))}>↺ tilt</button>
              <button type="button" className="btn-ghost" onClick={() => patch(sel.id, (p) => ({ ...p, r: clampR(p.r + 4) }))}>↻ tilt</button>
              <button type="button" className="btn-ghost" onClick={() => patch(sel.id, (p) => ({ ...p, z: Math.max(...zs) + 1 }))}>to front</button>
              <button type="button" className="btn-ghost" onClick={() => patch(sel.id, (p) => ({ ...p, z: Math.min(...zs) - 1 }))}>to back</button>
              <button type="button" className="btn-ghost" onClick={() => flag(sel.id)}>make progress photo</button>
              <button type="button" className="btn-ghost text-red-800" onClick={() => remove(sel.id)}>delete</button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save layout"}</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={auto}>Auto-arrange</button>
          </div>
        </div>
      )}
    </div>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
const clampR = (r: number) => Math.max(-30, Math.min(30, r));
