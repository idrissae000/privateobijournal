import Link from "next/link";
import { RegenerateArchetype } from "@/components/ArchetypeActions";
import { InsightPoller } from "@/components/InsightPoller";
import { Heading, Stamp, Tag, Tape } from "@/components/scrap";
import type { ArchetypeContent } from "@/lib/ai/archetype-job";
import type { ForeshadowContent, ForeshadowItem } from "@/lib/ai/foreshadow-job";
import { formatShortDate, monthLabel, parseYm } from "@/lib/dates";

const ymLabel = (ym: string) => {
  const p = parseYm(ym);
  return p ? monthLabel(p.year, p.month) : ym;
};

export function ArchetypeView({
  content, status, generatedAt, stale, foreshadow,
}: {
  content: ArchetypeContent;
  status: "pending" | "done" | "failed";
  generatedAt: string;
  stale: boolean;
  foreshadow: ForeshadowContent | null;
}) {
  const watch = content.arc_watch ?? [];
  const items = foreshadow?.items ?? [];

  return (
    <div className="space-y-8">
      <InsightPoller active={status === "pending"} />

      <section className="paper-card relative space-y-4 p-5 pt-7">
        <Tape className="-top-3 left-8 -rotate-6" />
        <Tape className="-top-3 right-8 rotate-6" />
        {content.archetype_name && <Stamp rotate={-3} className="text-base">{content.archetype_name}</Stamp>}
        <p className="font-hand text-3xl leading-snug">{content.throughline}</p>
        <div>
          <p className="font-type mb-1 text-[10px] uppercase tracking-wider text-ink-soft">The arc</p>
          <p className="font-hand whitespace-pre-wrap text-2xl leading-snug">{content.arc}</p>
        </div>
        {content.becoming && (
          <div>
            <p className="font-type mb-1 text-[10px] uppercase tracking-wider text-ink-soft">Who you&apos;ve been becoming</p>
            <p className="font-hand whitespace-pre-wrap text-2xl leading-snug">{content.becoming}</p>
          </div>
        )}
        {(content.tensions ?? []).length > 0 && (
          <div>
            <p className="font-type mb-1 text-[10px] uppercase tracking-wider text-ink-soft">Pulls in both directions</p>
            <ul className="font-hand list-disc space-y-1 pl-5 text-xl leading-snug">
              {content.tensions!.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        )}
      </section>

      {(content.recurring_themes ?? []).length > 0 && (
        <section className="space-y-3">
          <Heading>What keeps coming back</Heading>
          <ul className="space-y-3">
            {content.recurring_themes!.map((t) => (
              <li key={t.theme} className="paper-card space-y-1 p-4">
                <p className="font-hand text-2xl leading-none">#{t.theme}</p>
                {t.note && <p className="font-hand text-xl leading-snug text-ink-soft">{t.note}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {t.months.map((m) => <Link key={m} href={`/month/${m}`} className="label-tag !border-dashed">{ymLabel(m)}</Link>)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-label="Arc watch">
        <Heading>Then vs. now</Heading>
        {watch.length === 0 ? (
          <p className="font-hand text-xl text-ink-soft">
            Nothing to compare yet. This lights up when the same theme returns months apart with a different stance.
          </p>
        ) : (
          <ul className="space-y-5">
            {watch.map((w) => (
              <li key={`${w.theme}-${w.then.ym}-${w.now.ym}`} className="paper-card space-y-3 p-4">
                <p className="font-hand text-3xl leading-none">{w.theme}</p>
                <div className="grid grid-cols-2 gap-3">
                  {([["then", w.then], ["now", w.now]] as const).map(([k, side]) => (
                    <div key={k} className={`space-y-1 rounded p-2 ${k === "then" ? "-rotate-1 bg-paper-2/70" : "rotate-1 bg-paper-2"}`}>
                      <Link href={`/month/${side.ym}`} className="font-type text-[10px] uppercase tracking-wider underline">{k} · {ymLabel(side.ym)}</Link>
                      <p className="font-hand text-xl leading-tight">{side.stance}</p>
                      {side.evidence && <p className="font-type text-[11px] italic text-ink-soft">&ldquo;{side.evidence}&rdquo;</p>}
                    </div>
                  ))}
                </div>
                <p className="font-hand text-xl leading-snug">{w.comparison}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {items.length > 0 && (
        <section className="space-y-3" aria-label="Foreshadowing">
          <Heading>Before you named it</Heading>
          <ul className="space-y-3">
            {items.map((it) => <ForeshadowCard key={`${it.kind}-${it.title}`} item={it} />)}
          </ul>
        </section>
      )}

      <footer className="space-y-1 text-center">
        {content.data_note && <p className="font-type text-[11px] text-ink-soft">{content.data_note}</p>}
        <p className="font-type text-[11px] text-ink-soft">
          {status === "pending" ? "Updating with your latest pages…" : status === "failed" ? <>Couldn&apos;t refresh just now. <RegenerateArchetype /></> : `Written ${formatShortDate(generatedAt.slice(0, 10))}`}
          {status === "done" && stale && " · newer pages are waiting; it refreshes next time you open this."}
        </p>
      </footer>
    </div>
  );
}

const KIND_LABEL: Record<ForeshadowItem["kind"], string> = {
  confirmed_early: "Foreshadowed",
  emerging: "Echoing again",
  unnamed: "A pattern with no name yet",
};

function ForeshadowCard({ item }: { item: ForeshadowItem }) {
  return (
    <li className="paper-card space-y-1.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag>{KIND_LABEL[item.kind]}</Tag>
        {item.influence_name && <span className="font-hand text-xl">{item.influence_name}</span>}
      </div>
      <p className="font-hand text-2xl leading-tight">{item.title}</p>
      <p className="font-hand text-xl leading-snug text-ink-soft">{item.detail}</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {item.evidence_dates.map((d) => <Link key={d} href={`/day/${d}`} className="label-tag !border-dashed">{formatShortDate(d)}</Link>)}
      </div>
    </li>
  );
}
