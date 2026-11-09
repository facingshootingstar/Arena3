import { useEffect, useState } from "react";
import { cn } from "@/client/lib/cn";
import { locale, t } from "@/client/lib/i18n";
import { kindLabel, sportLabel, todayISO } from "@/shared/arena3/labels";
import { SportDot } from "@/client/components/sports-ui";
import type { Court, OccSlot } from "@/client/components/court-grid";

const OPEN = 6;
const CLOSE = 22;
const SPAN = CLOSE - OPEN;

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString(locale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Hours since 00:00 ICT on `date`, clamped to the open day. */
function at(date: string, iso: string) {
  const h = (new Date(iso).getTime() - new Date(`${date}T00:00:00+07:00`).getTime()) / 3_600_000;
  return Math.min(CLOSE, Math.max(OPEN, h));
}

const BAR: Record<string, string> = {
  booking: "bg-accent/80 text-accent-fg",
  session: "bg-slot-class text-on-media",
  hold: "stripes border border-dashed border-hold bg-hold/20 text-hold",
  maintenance: "stripes bg-wood text-muted",
};

/**
 * One court per row, one continuous bar per booking or class, laid on a 06–22 time axis.
 *
 * The report reads a day as "who had which court when"; an hour-by-hour square grid made the
 * reader assemble each booking out of separate cells. Here a two-hour booking is one bar with
 * its own times on it.
 */
export function CourtTimeline({ date, courts, slots }: { date: string; courts: Court[]; slots: OccSlot[] }) {
  // The "now" line is client-only, so the server render and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (date !== todayISO()) return;
    const tick = () => setNow((Date.now() - new Date(`${date}T00:00:00+07:00`).getTime()) / 3_600_000);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [date]);

  const groups = new Map<string, Court[]>();
  for (const c of courts) groups.set(c.sport, [...(groups.get(c.sport) ?? []), c]);
  const pos = (h: number) => `${((h - OPEN) / SPAN) * 100}%`;
  const ticks = Array.from({ length: SPAN / 2 + 1 }, (_, i) => OPEN + i * 2);
  const kinds = Array.from(new Set(slots.map((s) => s.kind))).filter((k) => BAR[k]);

  return (
    <div className="rounded-[var(--radius-xl)] bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="overflow-x-auto" role="region" aria-label={t("Court timeline, scrolls sideways")} tabIndex={0}>
        <div className="min-w-[680px]">
          <div className="flex text-2xs text-muted">
            <div className="w-20 shrink-0" />
            <div className="relative h-5 flex-1">
              {ticks.map((h) => (
                <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(h) }}>
                  {String(h).padStart(2, "0")}h
                </span>
              ))}
            </div>
          </div>
          {Array.from(groups.entries()).map(([sport, list]) => (
            <div key={sport} className="mt-2">
              <p className="flex items-center gap-1.5 py-1 text-xs font-semibold">
                <SportDot sport={sport} />
                {sportLabel(sport)}
              </p>
              {list.map((c) => {
                const mine = slots.filter((s) => s.court_id === c.id && BAR[s.kind]);
                return (
                  <div key={c.id} className="flex items-center border-t border-line/40">
                    <div className="w-20 shrink-0 py-1.5 text-xs font-medium">{c.court_code}</div>
                    <div className="relative h-8 flex-1">
                      {ticks.map((h) => (
                        <span key={h} className="absolute inset-y-0 w-px bg-line/40" style={{ left: pos(h) }} />
                      ))}
                      {mine.map((s) => {
                        const a = at(date, s.start);
                        const b = at(date, s.end);
                        if (b <= a) return null;
                        const label = `${kindLabel(s.kind)} · ${hhmm(s.start)}–${hhmm(s.end)}`;
                        const ended = now != null && b <= now;
                        return (
                          <div
                            key={`${s.start}-${s.ref ?? s.kind}`}
                            title={`${c.court_code} · ${label}`}
                            className={cn(
                              "absolute inset-y-1 overflow-hidden whitespace-nowrap rounded-[var(--radius-xs)] px-1.5 text-2xs font-medium leading-6",
                              BAR[s.kind],
                              ended && "opacity-60",
                            )}
                            style={{ left: pos(a), width: `calc(${((b - a) / SPAN) * 100}% - 2px)` }}
                          >
                            {hhmm(s.start)}–{hhmm(s.end)}
                          </div>
                        );
                      })}
                      {now != null && now > OPEN && now < CLOSE ? (
                        <span className="absolute inset-y-0 w-0.5 bg-danger" style={{ left: pos(now) }} aria-hidden />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-line/50 pt-2.5 text-2xs text-muted">
        {kinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-5 rounded-[2px]", BAR[k])} />
            {kindLabel(k)}
          </span>
        ))}
        {now != null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-danger" />
            {t("Now")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
