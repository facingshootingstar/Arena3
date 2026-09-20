import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { addDaysISO, kindLabel, sportLabel, todayISO, weekdayShort } from "@/lib/arena3/labels";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type Court = {
  id: string;
  court_code: string;
  sport: string;
  status: string;
  convertible?: boolean;
  pair_court_id?: string | null;
};
export type OccSlot = {
  court_id: string;
  start: string;
  end: string;
  kind: string;
  ref: string;
  convert_group_id?: string | null;
};

export const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export { sportLabel };

function kindClass(kind: string) {
  if (kind === "session") return "bg-fg text-bg";
  if (kind === "hold") return "bg-hold/15 text-hold";
  if (kind === "maintenance" || kind === "convert") return "bg-wood text-muted";
  return "bg-accent/15 text-accent-2";
}

function occAt(slots: OccSlot[], courtId: string, date: string, hour: number): OccSlot | undefined {
  const start = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`).getTime();
  const end = start + 60 * 60 * 1000;
  return slots.find((s) => {
    if (s.court_id !== courtId) return false;
    const a = new Date(s.start).getTime();
    const b = new Date(s.end).getTime();
    return a < end && b > start;
  });
}

/**
 * Has this hour already finished?
 *
 * The slot is written in ICT, so the string carries `+07:00` and comparing the
 * parsed instant against `Date.now()` is correct whatever timezone the browser
 * is in. An hour counts as past only once it has fully elapsed — the 14:00 slot
 * is still live at 14:30, and the desk can still sell the tail of it as a
 * walk-in.
 */
function isPast(date: string, hour: number, now: number) {
  const end = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`).getTime() + 3_600_000;
  return end <= now;
}

/** Dimmed, struck-through treatment shared by both layouts. */
const PAST_CELL = "bg-wood/30 text-subtle/60 line-through decoration-subtle/40";

/**
 * A clock that ticks once a minute.
 *
 * The grid greys out hours as they elapse, so it has to re-render on its own —
 * leaving a tab open through 18:00 should not leave a sellable-looking 17:00
 * on screen. Starting at `0` and filling in from an effect keeps the server
 * render and the first client render identical, which is what hydration needs;
 * `0` simply means "nothing is past yet" for the one frame before the effect
 * runs.
 */
function useNowMinute() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DateStrip({
  value,
  onChange,
  days = 7,
}: {
  value: string;
  onChange: (v: string) => void;
  days?: number;
}) {
  const today = todayISO();
  const items = Array.from({ length: days }, (_, i) => {
    const iso = addDaysISO(today, i);
    return { iso, wd: weekdayShort(iso), day: Number(iso.slice(8, 10)), isToday: iso === today };
  });
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((it) => {
        const on = value === it.iso;
        return (
          <button
            key={it.iso}
            type="button"
            onClick={() => onChange(it.iso)}
            className={cn(
              "flex min-h-16 min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-[var(--radius-lg)] px-3 transition-[background-color,color,transform,box-shadow] duration-200 active:scale-95",
              on
                ? "bg-accent text-accent-fg shadow-[0_8px_20px_-12px_rgba(31,92,67,0.9)]"
                : "bg-surface text-fg shadow-[var(--shadow-border)] hover:-translate-y-0.5 hover:bg-wood",
            )}
          >
            <span className="text-2xs font-medium uppercase tracking-wide opacity-70">
              {it.isToday ? "Today" : it.wd}
            </span>
            <span className="font-display text-xl tabular-nums leading-none">{it.day}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CourtLegend() {
  const items = [
    { cls: "bg-surface shadow-[var(--shadow-border)]", label: "Free" },
    { cls: "bg-fg", label: "Class" },
    { cls: "bg-accent/25", label: "Booked" },
    { cls: "bg-hold/25", label: "On hold" },
    { cls: "bg-wood", label: "Maintenance / merged" },
    { cls: "bg-wood/30", label: "Already passed" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-[2px]", it.cls)} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function CourtGrid({
  date,
  courts,
  slots,
  sport,
  onPick,
}: {
  date: string;
  courts: Court[];
  slots: OccSlot[];
  sport?: string;
  onPick?: (court: Court, hour: number) => void;
}) {
  const now = useNowMinute();
  const list = sport ? courts.filter((c) => c.sport === sport) : courts;
  const free = list.reduce(
    (n, c) => n + HOURS.filter((h) => !occAt(slots, c.id, date, h) && !isPast(date, h, now)).length,
    0,
  );
  const hasClass = slots.some((s) => s.kind === "session" && list.some((c) => c.id === s.court_id));

  if (list.length === 0) {
    return (
      <div className="grid place-items-center gap-1 rounded-[var(--radius-xl)] bg-surface px-6 py-14 text-center shadow-[var(--shadow-border)]">
        <p className="font-medium">No {sport ? sportLabel(sport).toLowerCase() : ""} courts</p>
        <p className="text-sm text-muted">Nothing is set up for this sport yet. Try another filter.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CourtLegend />
        <p className="text-xs tabular-nums text-muted">{free} free slots left</p>
      </div>
      {!hasClass ? (
        <p className="text-sm text-muted">No classes scheduled on court today — you are seeing member bookings only.</p>
      ) : null}

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:hidden">
        {list.map((c) => (
          <div
            key={c.id}
            className="w-[min(20rem,85vw)] shrink-0 snap-center rounded-[var(--radius-lg)] bg-surface p-3 shadow-[var(--shadow-border)]"
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="font-medium">{c.court_code}</p>
              <p className="text-2xs text-muted">{sportLabel(c.sport)}</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS.map((h) => {
                const occ = occAt(slots, c.id, date, h);
                const label = String(h).padStart(2, "0");
                const past = isPast(date, h, now);
                // Past hours are shown, never offered — seeing the whole day is
                // the point of the grid, but nothing can be sold backwards.
                if (past) {
                  return (
                    <div
                      key={h}
                      title={occ ? `${kindLabel(occ.kind)} · finished` : "This hour has passed"}
                      className={cn(
                        "grid min-h-11 place-items-center rounded-[var(--radius-xs)] text-2xs font-medium tabular-nums",
                        PAST_CELL,
                      )}
                    >
                      {label}
                    </div>
                  );
                }
                if (occ) {
                  if (occ.kind === "convert" && onPick) {
                    return (
                      <button
                        key={h}
                        type="button"
                        title="Tap to release the paired court"
                        onClick={() => onPick(c, h)}
                        className={cn(
                          "grid min-h-11 place-items-center rounded-[var(--radius-xs)] text-2xs font-medium tabular-nums",
                          kindClass(occ.kind),
                        )}
                      >
                        {label}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={h}
                      title={`${kindLabel(occ.kind)} ${hhmm(occ.start)}–${hhmm(occ.end)}`}
                      className={cn(
                        "grid min-h-11 place-items-center rounded-[var(--radius-xs)] text-2xs font-medium tabular-nums",
                        kindClass(occ.kind),
                      )}
                    >
                      {label}
                    </div>
                  );
                }
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onPick?.(c, h)}
                    className="grid min-h-11 place-items-center rounded-[var(--radius-xs)] bg-wood/60 text-xs tabular-nums text-muted transition-[background-color,color,transform] duration-150 hover:bg-accent/20 hover:text-accent-2 active:scale-95"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-border)] md:block">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `3.25rem repeat(${list.length}, minmax(0, 1fr))`,
            // Sized to the courts actually on screen rather than a flat 640px.
            // Filtering to the two basketball courts used to leave the table
            // wider than its container, so a two-column grid scrolled sideways
            // for no reason. `max(100%, …)` fills the container when the courts
            // fit and only overflows — and only then shows a scrollbar — once
            // there are genuinely too many to lay out. 4.5rem is the narrowest
            // a "BC1 / Basketball" heading stays readable at.
            minWidth: `max(100%, ${3.25 + list.length * 4.5}rem)`,
          }}
        >
          <div className="sticky left-0 z-10 bg-surface px-2 py-2 text-2xs font-medium uppercase tracking-wider text-muted">
            Hour
          </div>
          {list.map((c) => (
            <div key={c.id} className="border-l border-line/80 px-1 py-2 text-center">
              <div className="text-xs font-medium">
                {c.court_code}
                {c.convertible ? <span className="ml-0.5 text-subtle">↔</span> : null}
              </div>
              <div className="text-2xs text-subtle">{sportLabel(c.sport)}</div>
            </div>
          ))}
          {HOURS.map((h) => (
            <HourRow key={h} hour={h} list={list} slots={slots} date={date} onPick={onPick} now={now} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({
  hour,
  list,
  slots,
  date,
  onPick,
  now,
}: {
  hour: number;
  list: Court[];
  slots: OccSlot[];
  date: string;
  onPick?: (court: Court, hour: number) => void;
  now: number;
}) {
  const past = isPast(date, hour, now);
  return (
    <>
      <div
        className={cn(
          "sticky left-0 z-10 border-t border-line/70 bg-surface px-2 py-1 text-xs tabular-nums",
          past ? "text-subtle/60 line-through" : "text-muted",
        )}
      >
        {String(hour).padStart(2, "0")}
      </div>
      {list.map((c) => {
        const occ = occAt(slots, c.id, date, hour);
        if (past) {
          return (
            <div key={c.id} className="border-l border-t border-line/70 p-1">
              <div
                title={occ ? `${kindLabel(occ.kind)} · finished` : "This hour has passed"}
                className={cn("h-9 overflow-hidden rounded-[var(--radius-xs)]", PAST_CELL)}
              />
            </div>
          );
        }
        if (occ) {
          if (occ.kind === "convert" && onPick) {
            return (
              <div key={c.id} className="border-l border-t border-line/70 p-1">
                <button
                  type="button"
                  title="Tap to release the paired court"
                  onClick={() => onPick(c, hour)}
                  className={cn("h-9 w-full overflow-hidden rounded-[var(--radius-xs)]", kindClass(occ.kind))}
                />
              </div>
            );
          }
          return (
            <div key={c.id} className="border-l border-t border-line/70 p-1">
              <div
                title={`${kindLabel(occ.kind)} ${hhmm(occ.start)}–${hhmm(occ.end)}`}
                className={cn("h-9 overflow-hidden rounded-[var(--radius-xs)]", kindClass(occ.kind))}
              />
            </div>
          );
        }
        return (
          <div key={c.id} className="border-l border-t border-line/70 p-1">
            <button
              type="button"
              aria-label={`Book ${c.court_code} at ${String(hour).padStart(2, "0")}:00`}
              onClick={() => onPick?.(c, hour)}
              className="block h-9 w-full rounded-[var(--radius-xs)] bg-wood/50 transition-[background-color,transform] duration-150 hover:scale-[1.04] hover:bg-accent/25 active:scale-95"
            />
          </div>
        );
      })}
    </>
  );
}
