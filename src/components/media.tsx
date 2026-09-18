import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { media, sportPhoto } from "@/lib/arena3/media";
import { CourtBackdrop } from "./mark";

export { media, sportPhoto };

export function Cover({
  src,
  alt,
  className,
  imgClassName,
  scrim = "auto",
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  scrim?: "auto" | "media" | "hero" | "none";
  children?: ReactNode;
}) {
  const showScrim = scrim === "media" || scrim === "hero" || (scrim === "auto" && children != null);
  return (
    <div className={cn("relative overflow-hidden bg-wood", className)}>
      <img src={src} alt={alt} className={cn("absolute inset-0 z-0 size-full object-cover", imgClassName)} />
      {showScrim ? (
        <div
          className={cn("pointer-events-none absolute inset-0 z-[1]", scrim === "hero" ? "hero-scrim" : "media-scrim")}
        />
      ) : null}
      {children ? <div className="relative z-[2] size-full">{children}</div> : null}
    </div>
  );
}

/** Solid 82% ink bar — captions never sit on the photo itself (Stitch/WCAG). */
export function MediaCaption({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("absolute inset-x-0 bottom-0 caption-bar px-4 py-3", className)}>{children}</div>;
}

export function PassCard({
  plan,
  sport,
  endOn,
  hours,
  code,
}: {
  plan: string;
  sport: string;
  endOn: string;
  hours: number;
  code?: string | null;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-xl)] bg-pass p-6 text-pass-fg transition-transform duration-300 hover:-translate-y-0.5">
      <span className="sweep pointer-events-none absolute inset-0" aria-hidden />
      <CourtBackdrop className="pointer-events-none absolute -right-10 -bottom-8 h-56 w-56 text-pass-fg opacity-[0.14]" />
      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-[var(--radius-sm)] border border-pass-fg/20 bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-fg">
              Membership pass
            </span>
            <p className="mt-3 font-display text-2xl tracking-tight">{plan}</p>
          </div>
          {code ? (
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-pass-muted">Member code</p>
              <p className="font-mono text-sm font-semibold tracking-wider">{code}</p>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-pass-fg/15 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pass-muted">Sport</p>
            <p className="mt-0.5 text-sm font-semibold">{sport}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pass-muted">Court hours</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{hours} left</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-pass-muted">Valid through</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{endOn}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HeroVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  return (
    <video
      className={cn("absolute inset-0 size-full object-cover", className)}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}

function secsLeft(until: string) {
  return Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
}

export function HoldTimer({ until, onExpire }: { until: string; onExpire?: () => void }) {
  const [left, setLeft] = useState(() => secsLeft(until));
  const fired = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const n = secsLeft(until);
      setLeft(n);
      if (n <= 0 && !fired.current) {
        fired.current = true;
        expireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [until]);
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <span className="tabular-nums">
      {m}:{s}
    </span>
  );
}
