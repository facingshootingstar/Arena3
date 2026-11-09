import { useEffect, useState } from "react";
import { cn } from "@/client/lib/cn";
import { locale, t } from "@/client/lib/i18n";
import { kindLabel, todayISO } from "@/shared/arena3/labels";
import { SportDot } from "@/client/components/sports-ui";
import type { Court, OccSlot } from "@/client/components/court-grid";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString(locale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHIP: Record<string, string> = {
  booking: "bg-accent/15 text-fg",
  session: "bg-slot-class/25 text-fg",
  hold: "border border-dashed border-hold text-hold",
  maintenance: "bg-wood text-muted",
};

type Range = { kind: string; start: string; end: string };

/** Back-to-back slots of the same kind become one range: 18:00–19:00 + 19:00–20:00 → 18:00–20:00. */
function merge(slots: OccSlot[]): Range[] {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const out: Range[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && new Date(last.end).getTime() >= new Date(s.start).getTime()) {
      if (new Date(s.end) > new Date(last.end)) last.end = s.end;
    } else out.push({ kind: s.kind, start: s.start, end: s.end });
  }
  return out;
}

/**
 * The day per court in one line: which stretches are taken, joined where they run on.
 * Courts with nothing booked are listed together at the end instead of as empty rows.
 */
export function CourtTimeline({ date, courts, slots }: { date: string; courts: Court[]; slots: OccSlot[] }) {
  // "Now" is read on the client only, so the server render and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (date !== todayISO()) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [date]);

  const busy = courts
    .map((c) => ({ court: c, ranges: merge(slots.filter((s) => s.court_id === c.id && CHIP[s.kind])) }))
    .filter((r) => r.ranges.length > 0);
  const free = courts.filter((c) => !busy.some((b) => b.court.id === c.id));
  const kinds = Array.from(new Set(busy.flatMap((b) => b.ranges.map((r) => r.kind))));

  return (
    <div className="rounded-[var(--radius-xl)] bg-surface p-3 shadow-[var(--shadow-border)]">
      {busy.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">{t("No court is booked on this day.")}</p>
      ) : (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {busy.map(({ court, ranges }) => (
            <li key={court.id} className="flex items-start gap-3 border-b border-line/40 py-2">
              <span className="flex w-20 shrink-0 items-center gap-1.5 pt-0.5 text-xs font-semibold">
                <SportDot sport={court.sport} />
                {court.court_code}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {ranges.map((r) => {
                  const live = now != null && new Date(r.start).getTime() <= now && now < new Date(r.end).getTime();
                  const done = now != null && new Date(r.end).getTime() <= now;
                  return (
                    <span
                      key={r.start}
                      title={kindLabel(r.kind)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-2xs font-medium tabular-nums",
                        CHIP[r.kind],
                        live && "ring-1 ring-danger",
                        done && "opacity-50",
                      )}
                    >
                      {hhmm(r.start)}–{hhmm(r.end)}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted">
        <span>{free.length > 0 ? t("Free all day: {list}", { list: free.map((c) => c.court_code).join(", ") }) : null}</span>
        <span className="flex flex-wrap items-center gap-3">
          {kinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-4 rounded-full", CHIP[k])} />
              {kindLabel(k)}
            </span>
          ))}
          {now != null ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-full ring-1 ring-danger" />
              {t("In play now")}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
