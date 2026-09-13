import { cn } from "@/lib/cn";
import { addDaysISO, kindLabel, sportLabel, todayISO, weekdayShort } from "@/lib/arena3/labels";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
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
              "flex min-h-16 min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-[var(--radius-lg)] px-3 transition-colors duration-150",
              on ? "bg-accent text-accent-fg" : "bg-surface text-fg shadow-[var(--shadow-border)] hover:bg-wood",
            )}
          >
            <span className="text-2xs font-medium uppercase tracking-wide opacity-70">
              {it.isToday ? "Nay" : it.wd}
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
    { cls: "bg-surface shadow-[var(--shadow-border)]", label: "Trống" },
    { cls: "bg-fg", label: "Lớp" },
    { cls: "bg-accent/25", label: "Đặt" },
    { cls: "bg-hold/25", label: "Giữ" },
    { cls: "bg-wood", label: "Bảo trì / gộp" },
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
  const list = sport ? courts.filter((c) => c.sport === sport) : courts;
  const free = list.reduce((n, c) => n + HOURS.filter((h) => !occAt(slots, c.id, date, h)).length, 0);
  const hasClass = slots.some((s) => s.kind === "session" && list.some((c) => c.id === s.court_id));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CourtLegend />
        <p className="text-xs tabular-nums text-muted">{free} ô trống</p>
      </div>
      {!hasClass ? (
        <p className="text-sm text-muted">Chưa có buổi lớp trên sân ngày này — chỉ thấy đặt sân của hội viên.</p>
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
                if (occ) {
                  if (occ.kind === "convert" && onPick) {
                    return (
                      <button
                        key={h}
                        type="button"
                        title="Bấm để mở lại cặp sân"
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
                    className="grid min-h-11 place-items-center rounded-[var(--radius-xs)] bg-wood/60 text-xs tabular-nums text-muted transition-colors hover:bg-accent/15 hover:text-accent-2"
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
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `3.25rem repeat(${Math.max(list.length, 1)}, minmax(0, 1fr))` }}
        >
          <div className="sticky left-0 z-10 bg-surface px-2 py-2 text-2xs font-medium uppercase tracking-wider text-muted">
            Giờ
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
            <HourRow key={h} hour={h} list={list} slots={slots} date={date} onPick={onPick} />
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
}: {
  hour: number;
  list: Court[];
  slots: OccSlot[];
  date: string;
  onPick?: (court: Court, hour: number) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-t border-line/70 bg-surface px-2 py-1 text-xs tabular-nums text-muted">
        {String(hour).padStart(2, "0")}
      </div>
      {list.map((c) => {
        const occ = occAt(slots, c.id, date, hour);
        if (occ) {
          if (occ.kind === "convert" && onPick) {
            return (
              <div key={c.id} className="border-l border-t border-line/70 p-1">
                <button
                  type="button"
                  title="Bấm để mở lại cặp sân"
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
              aria-label={`Đặt ${c.court_code} ${String(hour).padStart(2, "0")}:00`}
              onClick={() => onPick?.(c, hour)}
              className="block h-9 w-full rounded-[var(--radius-xs)] bg-wood/50 transition-colors hover:bg-accent/20"
            />
          </div>
        );
      })}
    </>
  );
}
