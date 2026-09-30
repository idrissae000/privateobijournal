import Link from "next/link";
import { dayKey, daysInMonth, firstWeekday } from "@/lib/dates";
import { RATING_COLORS, ratingColor, ratingInk } from "@/lib/stats";
import type { Entry } from "@/lib/types";

/** Month calendar, each day colored by its rating (one green ramp, light -> dark = 1 -> 10). */
export function CalendarGrid({ year, month, entries, today }: { year: number; month: number; entries: Entry[]; today: string }) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const blanks = firstWeekday(year, month);
  const days = daysInMonth(year, month);

  return (
    <div>
      <div className="font-type mb-1 grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase text-ink-soft">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = dayKey(year, month, i + 1);
          const e = byDate.get(date);
          const future = date > today;
          const rated = e?.rating != null;
          return (
            <Link
              key={date} href={`/day/${date}`}
              aria-label={`${date}${rated ? `, rated ${e!.rating} out of 10` : e ? ", no rating" : ", no entry"}`}
              className={`font-type relative flex aspect-square flex-col items-center justify-center rounded text-xs ${
                rated ? "" : future ? "opacity-40" : ""
              } ${date === today ? "outline outline-2 outline-offset-1 outline-stamp" : ""}`}
              style={
                rated
                  ? { background: ratingColor(e!.rating!), color: ratingInk(e!.rating!) }
                  : { border: `1.5px ${e ? "solid" : "dashed"} rgba(59,47,30,0.3)` }
              }
            >
              <span className="text-[10px] leading-none opacity-70">{i + 1}</span>
              {rated && <span className="text-sm leading-none">{e!.rating}</span>}
              {!rated && e && <span aria-hidden className="text-[10px] leading-none">•</span>}
            </Link>
          );
        })}
      </div>
      <div className="font-type mt-3 flex items-center gap-2 text-[10px] text-ink-soft" aria-hidden>
        <span>1</span>
        <span className="flex h-2 flex-1 overflow-hidden rounded">
          {RATING_COLORS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
        </span>
        <span>10</span>
      </div>
    </div>
  );
}
