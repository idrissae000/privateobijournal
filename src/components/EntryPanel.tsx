"use client";

import { useState } from "react";

/** Collapsible wrapper that keeps its own open state, so server refreshes never collapse the form. */
export function EntryPanel({ defaultOpen, openLabel, closedLabel, children }: {
  defaultOpen: boolean;
  openLabel: string;
  closedLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button type="button" className="btn-ghost w-full text-center" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? openLabel : closedLabel}
      </button>
      {/* hidden, not unmounted: unsaved input survives toggling */}
      <div hidden={!open}>{children}</div>
    </div>
  );
}
