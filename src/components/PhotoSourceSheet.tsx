"use client";

import { createPortal } from "react-dom";

/** "Where is the photo coming from?" Camera, photo library, or the web. */
export function PhotoSourceSheet({
  onCamera, onLibrary, onSearch, onClose,
}: {
  onCamera: () => void;
  onLibrary: () => void;
  onSearch: () => void;
  onClose: () => void;
}) {
  const options = [
    { label: "Choose from my photo library", icon: "🖼", run: onLibrary },
    { label: "Take a photo", icon: "📷", run: onCamera },
    { label: "Search the web", icon: "🔍", run: onSearch },
  ];
  return createPortal(
    // portal events bubble through the React tree: keep them from reaching a parent sheet
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/50"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onSubmit={(e) => e.stopPropagation()}
    >
      <div
        role="dialog" aria-label="Add a photo" onClick={(e) => e.stopPropagation()}
        className="safe-bottom paper-card mx-auto w-full max-w-xl space-y-2 rounded-t-xl p-5"
      >
        <h2 className="font-hand mb-2 text-3xl">Add a photo</h2>
        {options.map((o) => (
          <button key={o.label} type="button" onClick={o.run} className="btn-ghost flex w-full items-center gap-3 text-left">
            <span aria-hidden className="text-xl">{o.icon}</span>
            {o.label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="font-type w-full py-3 text-sm underline">cancel</button>
      </div>
    </div>,
    document.body,
  );
}
