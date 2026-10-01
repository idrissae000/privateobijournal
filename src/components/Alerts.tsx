"use client";

import { useState, useSyncExternalStore } from "react";
import type { Alert } from "@/lib/alerts";

const KEY = "obis-dismissed-alerts";
const EVENT = "obis-alerts-changed";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}
// localStorage can throw (private mode, blocked data): treat that as "nothing dismissed yet".
function snapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Soft, dismissible notes at the top of Today. Quiet by design: no counters, no streaks, no pushes. */
export function Alerts({ alerts }: { alerts: Alert[] }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const [hiddenNow, setHiddenNow] = useState<string[]>([]);
  if (raw === null) return null; // server render / first paint: show nothing rather than flash

  let stored: string[] = [];
  try {
    stored = JSON.parse(raw);
  } catch { /* corrupted value: ignore it */ }
  const shown = alerts.filter((a) => !stored.includes(a.id) && !hiddenNow.includes(a.id));
  if (!shown.length) return null;

  return (
    <div className="space-y-2" role="region" aria-label="Gentle notes">
      {shown.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded border border-dashed border-ink/30 bg-paper-3/70 px-3 py-2">
          <p className="font-hand flex-1 text-xl leading-snug text-ink-soft">{a.text}</p>
          <button
            type="button" aria-label="Dismiss" className="font-type px-2 py-1 text-sm text-ink-soft"
            onClick={() => {
              setHiddenNow((h) => [...h, a.id]);
              try {
                localStorage.setItem(KEY, JSON.stringify([...stored, a.id].slice(-50)));
                window.dispatchEvent(new Event(EVENT));
              } catch { /* hidden for this visit only */ }
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
