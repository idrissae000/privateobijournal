"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  today: "M4 5h16v14H4zM4 9h16M8 3v4M16 3v4",
  month: "M5 4h14v16H5zM9 4v16M5 9h14",
  timeline: "M12 3v18M12 7h6M12 12H6M12 17h6",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 5.5l3.8-1 2 15-3.8 1z",
  progress: "M4 18l5-6 4 3 7-9M16 6h4v4",
  you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
};

export function Nav({ monthHref }: { monthHref: string }) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Today", icon: icons.today, active: path === "/" || path.startsWith("/day") },
    { href: monthHref, label: "Month", icon: icons.month, active: path.startsWith("/month") },
    { href: "/timeline", label: "Timeline", icon: icons.timeline, active: path.startsWith("/timeline") },
    { href: "/library", label: "Library", icon: icons.library, active: path.startsWith("/library") },
    { href: "/progress", label: "Progress", icon: icons.progress, active: path.startsWith("/progress") },
    { href: "/archetype", label: "You", icon: icons.you, active: path.startsWith("/archetype") || path.startsWith("/admin") },
  ];
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 border-dashed border-ink/30 bg-paper-3/95 backdrop-blur"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((t) => (
          <li key={t.label} className="flex-1">
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`font-type flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                t.active ? "text-stamp" : "text-ink-soft"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
