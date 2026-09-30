import type { CSSProperties, ReactNode } from "react";

export function Tape({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`tape ${className}`} style={style} />;
}

/**
 * Polaroid frame. Its padding is in container-query units (% of its own width) so the
 * collage math in lib/collage.ts (FRAME_SIDE / FRAME_BOTTOM) matches what is rendered.
 */
export function Frame({
  src, alt = "", ar = 1, caption, tape = true, className = "", style, children,
}: {
  src?: string | null;
  alt?: string;
  ar?: number;
  caption?: ReactNode;
  tape?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={`relative ${className}`} style={{ containerType: "inline-size", ...style }}>
      {tape && <Tape className="-top-2.5 left-1/2 -ml-9 -rotate-3" />}
      <div
        className="relative bg-[#fffdf6] shadow-[0_2px_6px_rgba(59,47,30,0.28),0_10px_18px_-8px_rgba(59,47,30,0.3)]"
        style={{ padding: "6cqw 6cqw 20cqw" }}
      >
        <div className="relative overflow-hidden bg-paper-2" style={{ aspectRatio: ar }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} draggable={false} className="h-full w-full object-cover" />
          ) : null}
          {children}
        </div>
        {caption != null && (
          <div
            className="font-hand absolute inset-x-0 truncate px-[6cqw] text-center leading-none"
            style={{ bottom: "4.5cqw", fontSize: "max(13px, 9cqw)" }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

export function Stamp({ children, className = "", rotate = -6 }: { children: ReactNode; className?: string; rotate?: number }) {
  return (
    <span className={`stamp inline-block ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {children}
    </span>
  );
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label-tag inline-block ${className}`}>{children}</span>;
}

/** Hand-lettered heading with a wobbly underline. */
export function Heading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-hand relative inline-block text-3xl leading-tight ${className}`}>
      {children}
      <svg aria-hidden viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-1.5 w-full text-stamp/70">
        <path d="M0 3 Q 10 0 20 3 T 40 3 T 60 3 T 80 3 T 100 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </h2>
  );
}

export function Star({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 24" className={`h-6 w-14 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 14 C 18 4, 34 22, 56 10" />
      <path d="M48 5 L56 10 L49 17" />
    </svg>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="font-hand text-center text-2xl text-ink-soft">{children}</p>;
}
