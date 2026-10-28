import { type ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { isEmptyFigure } from "@/lib/figure";
import { CountUp, useReducedMotionAfterMount } from "./motion";

export type StatItem = {
  id?: string;
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    pct: number;
    label?: string;
    good?: boolean;
  };
  icon?: ComponentType<{ className?: string }>;
  detail?: string;
  live?: boolean;
};

/**
 * A row of figures. A tile whose figure is zero or empty says so in one quiet line ("Nothing
 * yet") instead of drawing a 36px zero, so a screen at the start of a shift is not a wall of
 * zeros. A strip where every tile is empty collapses to one row of those lines.
 */
export function StatStrip({
  stats,
  items,
  className,
  columns = 4,
}: {
  stats?: StatItem[];
  items?: StatItem[];
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const list = stats ?? items ?? [];
  const reduced = useReducedMotionAfterMount();

  const colClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-3 sm:gap-4", colClass, className)}>
      {list.map((s, idx) => {
        const Icon = s.icon;
        const trend = s.trend;
        const isUp = trend?.direction === "up";
        const isDown = trend?.direction === "down";
        // Up is good unless the figure says otherwise (cancellations, refunds).
        const isPositive = trend && ((isUp && trend.good !== false) || (isDown && trend.good === false));
        const bad = trend && ((isDown && trend.good !== false) || (isUp && trend.good === false));
        const empty = !trend && isEmptyFigure(s.value);

        return (
          <div
            key={s.id ?? idx}
            className={cn(
              "flex flex-col justify-between rounded-[var(--radius-lg)] bg-surface p-3.5 shadow-[var(--shadow-border),var(--shadow-sm)] sm:p-4",
              empty && "justify-center py-3 sm:py-3.5",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-footnote font-medium text-muted">
                {s.live ? (
                  <span aria-hidden="true" className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-success" />
                  </span>
                ) : null}
                {s.label}
              </span>
              {Icon ? <Icon className="size-4 shrink-0 text-subtle" /> : null}
            </div>

            {empty ? (
              <p className="mt-1 text-callout text-subtle">{t("Nothing yet")}</p>
            ) : (
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <div className="figure text-title-1 text-fg sm:text-large-title">
                  {s.prefix}
                  {typeof s.value === "number" && !reduced ? <CountUp to={s.value} duration={0.9} /> : s.value}
                  {s.suffix}
                </div>

                {trend ? (
                  <div
                    className={cn(
                      "flex items-center gap-0.5 rounded-[var(--radius-pill)] px-2 py-0.5 text-caption font-semibold",
                      isPositive
                        ? "bg-success-tint text-success"
                        : bad
                          ? "bg-danger-tint text-danger"
                          : "bg-fill-strong text-muted",
                    )}
                    title={trend.label ?? t("vs last week")}
                  >
                    {isUp ? (
                      <ArrowUpRight className="size-3" strokeWidth={2.5} />
                    ) : isDown ? (
                      <ArrowDownRight className="size-3" strokeWidth={2.5} />
                    ) : (
                      <Minus className="size-3" strokeWidth={2.5} />
                    )}
                    <span>
                      {isUp ? "+" : isDown ? "-" : ""}
                      {Math.abs(trend.pct)}%
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {s.detail && !empty ? <div className="mt-1 text-caption text-subtle">{s.detail}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
