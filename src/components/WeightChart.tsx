"use client";

import { useState } from "react";
import { formatShortDate } from "@/lib/dates";

export type WeightPoint = { date: string; value: number };

const W = 320, H = 170, PAD = { l: 38, r: 12, t: 12, b: 26 };

/** Single-series line chart: one thin line, open markers, recessive grid, tap/hover readout, table view. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return null;

  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const span = hi - lo;
  lo -= span * 0.1; hi += span * 0.1;

  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d: string) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const a = active != null ? points[active] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i; });
    setActive(best);
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img"
          aria-label={`Weight from ${points[0].value} to ${points[points.length - 1].value}`}
          onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--ink)" strokeOpacity="0.12" strokeDasharray="3 4" />
              <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-soft)">{t.toFixed(1)}</text>
            </g>
          ))}
          <text x={PAD.l} y={H - 8} fontSize="10" fill="var(--ink-soft)">{formatShortDate(points[0].date)}</text>
          {points.length > 1 && <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10" fill="var(--ink-soft)">{formatShortDate(points[points.length - 1].date)}</text>}
          {points.length > 1 && <path d={path} fill="none" stroke="var(--moss)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {a && <line x1={x(a.date)} x2={x(a.date)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink)" strokeOpacity="0.3" />}
          {points.map((p, i) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={active === i ? 5 : 4} fill="var(--paper-3)" stroke="var(--moss)" strokeWidth="2" />
          ))}
        </svg>
        {a && (
          <div
            className="font-type pointer-events-none absolute -top-1 rounded bg-ink px-2 py-1 text-xs text-paper"
            style={{ left: `${Math.min(75, Math.max(0, (x(a.date) / W) * 100 - 12))}%` }}
          >
            {formatShortDate(a.date)} · {a.value}
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="font-type cursor-pointer text-xs text-ink-soft">View as table</summary>
        <table className="font-type mt-2 w-full text-sm">
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-b border-ink/10"><td className="py-1">{formatShortDate(p.date)}</td><td className="py-1 text-right">{p.value}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
