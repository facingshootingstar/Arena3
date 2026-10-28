import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAsset } from "./media";
import { Spot, type SpotName } from "./illustrations";
import { CountUp, useReducedMotionAfterMount } from "./motion";
import { GLBackground } from "./fx";

export type PageHeroStat = {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  live?: boolean;
};

/**
 * The head of a screen.
 *
 * `compact` is the working screen's: a Large Title, one line under it, at most one or two figures
 * that the stat strip below does not repeat, and the screen's main action on the right, all
 * on the page itself with no card and no picture. The default keeps the photograph for the screens
 * where a banner slot earns it (booking, classes, the gate) and falls back to a quiet card with an
 * illustration when the slot is off. The scrim is a token, so the title keeps AA contrast on any photo.
 */
export function PageHero({
  slot,
  title,
  subtitle,
  badge,
  stats,
  action,
  fallbackSpot = "court",
  variant = "photo",
  className,
}: {
  slot?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  stats?: PageHeroStat[];
  action?: ReactNode;
  fallbackSpot?: SpotName;
  variant?: "photo" | "compact";
  className?: string;
}) {
  const asset = useAsset(variant === "compact" ? undefined : slot);
  const reduced = useReducedMotionAfterMount();
  const hasImage = variant !== "compact" && Boolean(asset.enabled && asset.url);

  const figures =
    stats && stats.length > 0 ? (
      <ul
        className={cn(
          "flex flex-wrap items-center gap-x-5 gap-y-1",
          variant === "compact" ? "mt-3" : "mt-3 border-t border-on-media/15 pt-2.5 sm:mt-4 sm:pt-3",
          variant !== "compact" && !hasImage && "border-line",
        )}
      >
        {stats.map((s, idx) => (
          <li key={idx} className="flex items-baseline gap-1.5 text-footnote sm:text-subheadline">
            {s.live ? (
              <span aria-hidden="true" className="relative top-px flex size-2 self-center">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-volt opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-volt" />
              </span>
            ) : null}
            <span className={cn("font-semibold tabular-nums tracking-tight", hasImage ? "text-on-media" : "text-fg")}>
              {s.prefix}
              {typeof s.value === "number" && !reduced ? <CountUp to={s.value} duration={0.8} /> : s.value}
              {s.suffix}
            </span>
            <span className={cn("font-medium", hasImage ? "text-on-media-muted" : "text-muted")}>{s.label}</span>
          </li>
        ))}
      </ul>
    ) : null;

  const heading = (
    <div className="min-w-0 max-w-2xl">
      {badge ? <div className="mb-1.5">{badge}</div> : null}
      <h1
        className={cn(
          "font-display text-balance",
          variant === "compact" ? "text-large-title" : "text-title-1 sm:text-large-title",
          hasImage ? "text-on-media" : "text-fg",
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className={cn(
            "mt-1 max-w-xl text-subheadline sm:text-callout",
            hasImage ? "text-on-media-muted" : "text-muted",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );

  if (variant === "compact") {
    return (
      <header className={cn("mb-6", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {heading}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {figures}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "relative mb-6 overflow-hidden rounded-[var(--radius-xl)]",
        hasImage
          ? "bg-night text-on-media shadow-[var(--shadow-md)] ring-1 ring-inset ring-on-media/15"
          : "bg-surface text-fg shadow-[var(--shadow-border),var(--shadow-sm)]",
        // Desktop 168px, mobile 112px (taller when figures are present).
        "min-h-[112px] sm:min-h-[168px]",
        className,
      )}
    >
      {hasImage ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={asset.url}
            alt={asset.alt || ""}
            loading="eager"
            className={cn(
              "h-full w-full object-cover object-center",
              !reduced && "transition-transform duration-[900ms] ease-[var(--ease-spring)] hover:scale-[1.03]",
            )}
          />
          {/* Token scrim (not black): keeps the title at AA and lets the picture breathe on the right. */}
          <div aria-hidden="true" className="page-scrim absolute inset-0" />
          {!reduced ? (
            <GLBackground variant="dotgrid" opacity={0.1} className="pointer-events-none mix-blend-screen" />
          ) : null}
        </div>
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-25 dark:opacity-15 sm:right-8">
          <Spot name={fallbackSpot} className="h-24 w-28 sm:h-32 sm:w-36" />
        </div>
      )}

      <div className="relative z-10 flex min-h-[112px] flex-col justify-between p-4 sm:min-h-[168px] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          {heading}
          {action ? <div className="mt-2 shrink-0 sm:mt-0">{action}</div> : null}
        </div>
        {figures}
      </div>
    </header>
  );
}
