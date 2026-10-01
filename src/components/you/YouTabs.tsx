import Link from "next/link";

export const TABS = [
  { id: "sheet", label: "Character sheet" },
  { id: "arc", label: "Then vs. now" },
  { id: "foreshadow", label: "Foreshadowing" },
  { id: "fidelity", label: "Fidelity" },
  { id: "reads", label: "Daily reads" },
  { id: "traits", label: "Traits" },
  { id: "review", label: "Review" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** Scrollable tab bar for the "You" area. Badges say when a tab has something waiting. */
export function YouTabs({ active, badges }: { active: TabId; badges: Partial<Record<TabId, number>> }) {
  return (
    <nav aria-label="Insight sections" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul role="tablist" className="font-type flex w-max gap-2 text-sm">
        {TABS.map((t) => {
          const n = badges[t.id];
          const on = t.id === active;
          return (
            <li key={t.id} role="presentation">
              <Link
                role="tab" aria-selected={on} aria-current={on ? "page" : undefined}
                href={`/archetype?tab=${t.id}`} replace scroll={false}
                className={`label-tag flex min-h-10 items-center gap-1.5 whitespace-nowrap ${on ? "!border-stamp !text-stamp" : ""}`}
              >
                {t.label}
                {!!n && <span className="rounded-full bg-stamp px-1.5 text-[10px] leading-4 text-paper-3" aria-label={`${n} waiting`}>{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
