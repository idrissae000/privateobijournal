import { Stamp } from "@/components/scrap";
import { VERDICT_LABEL, type Opinion } from "@/lib/opinion";

/** The opinion itself: verdict stamp, headline, how it fits, and what's good / worrying / worth trying. */
export function OpinionBody({ o }: { o: Partial<Opinion> }) {
  if (!o.verdict || !o.headline) return null;
  const list = (title: string, items: string[] | undefined, mark: string, tone = "") =>
    items && items.length > 0 ? (
      <div>
        <p className="font-type mb-0.5 text-[10px] uppercase tracking-wider text-ink-soft">{title}</p>
        <ul className={`font-hand space-y-0.5 text-xl leading-snug ${tone}`}>
          {items.map((t) => <li key={t}><span aria-hidden>{mark} </span>{t}</li>)}
        </ul>
      </div>
    ) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp rotate={-3} className="text-[11px]">{VERDICT_LABEL[o.verdict]}</Stamp>
      </div>
      <p className="font-hand text-3xl leading-tight">{o.headline}</p>
      {o.fit && <p className="font-hand whitespace-pre-wrap text-xl leading-snug">{o.fit}</p>}
      {list("What works", o.strengths, "✓")}
      {list("What worries me", o.concerns, "△", "text-stamp/90")}
      {list("You could", o.suggestions, "→")}
      {o.trait_notes && o.trait_notes.length > 0 && (
        <div>
          <p className="font-type mb-0.5 text-[10px] uppercase tracking-wider text-ink-soft">Trait by trait</p>
          <ul className="font-type space-y-0.5 text-xs">
            {o.trait_notes.map((n) => <li key={n.trait}><strong>{n.trait}</strong>: <span className="text-ink-soft">{n.note}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
