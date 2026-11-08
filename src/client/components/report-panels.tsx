import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Gauge, LayoutGrid, TrendingUp, UserPlus, Users } from "lucide-react";
import { CardTitle, SectionTitle } from "@/client/components/section";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { money } from "@/client/components/shell";
import { Badge, Button, Card, EmptyState, LoadError, Select, ShowMore, Skeleton, Stat } from "@/client/components/ui";
import { SportDot, useSports } from "@/client/components/sports-ui";
import { downloadReport } from "@/client/arena3/client";
import { levelLabel, sportLabel } from "@/shared/arena3/labels";
import { t, tk, tServer } from "@/client/lib/i18n";
import { useRead } from "@/client/lib/use-read";
import { useLimits } from "@/client/lib/use-centre";
import { cn } from "@/client/lib/cn";

type Kind = "revenue" | "capacity" | "members" | "attendance" | "at-risk";

/** Excel and PDF of the report on screen, with the same filters it is showing. */
export function ExportButtons({
  kind,
  from,
  to,
  extra = {},
  disabled = false,
}: {
  kind: Kind;
  from: string;
  to: string;
  extra?: Record<string, string | null | undefined>;
  /** The period on screen is one the server refuses, so there is nothing to export. */
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  async function go(format: "xlsx" | "pdf") {
    setBusy(format);
    try {
      const q = new URLSearchParams({ from, to, format });
      for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
      const name = await downloadReport(`/reports/${kind}/export?${q}`, `lelong-${kind}-${from}_${to}.${format}`);
      toast.success(t("Saved {name}", { name }));
    } catch (e) {
      toast.error(tServer((e as Error).message));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={disabled || busy !== null} onClick={() => void go("xlsx")}>
        {busy === "xlsx" ? t("Preparing…") : t("Export Excel")}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || busy !== null} onClick={() => void go("pdf")}>
        {busy === "pdf" ? t("Preparing…") : t("Export PDF")}
      </Button>
    </div>
  );
}

const hours = (min: number) => Math.round((min / 60) * 10) / 10;
const pctText = (v: number | null | undefined) => (v == null ? "-" : `${v}%`);

function SportSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { sports } = useSports();
  return (
    <div className="w-44">
      <Select aria-label={t("Sport")} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("All sports")}</option>
        {sports.map((s) => (
          <option key={s.code} value={s.code}>
            {sportLabel(s.code)}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ---- capacity -------------------------------------------------------------------

type Capacity = {
  open_hour: number;
  close_hour: number;
  totals: { sold_min: number; open_min: number; pct: number };
  by_sport: Array<{
    sport: string;
    sold_min: number;
    open_min: number;
    pct: number;
    peak_pct: number | null;
    offpeak_pct: number | null;
  }>;
  by_hour: Array<{ hour: number; pct: number }>;
  hours: number[];
  courts: Array<{
    court_id: string;
    court_code: string;
    sport: string;
    pct: number;
    cells: number[];
    cell_details?: Array<{ hr: number; pct: number; days_booked: number; days_total: number }>;
  }>;
  revenue_by_source: { court_vnd: number; class_vnd: number };
};

// A free hour is an empty outlined square, so the court × hour grid stays readable where nothing is booked.
const FREE_CELL: React.CSSProperties = { background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--color-line-strong)", color: "var(--color-fg)" };

function heat(pct: number, isSingleDay: boolean): React.CSSProperties {
  if (isSingleDay) {
    if (pct > 0) {
      // Booked is the ordinary state on a busy day, so it stays a step below full lime.
      return { background: "var(--color-heat-3)", color: "var(--color-accent-fg)" };
    }
    return FREE_CELL;
  }
  if (!(pct > 0)) return FREE_CELL;
  let bg = "var(--color-heat-0)";
  let fg = "var(--color-fg)";
  if (pct > 75) {
    bg = "var(--color-heat-5)";
    fg = "#ffffff";
  } else if (pct > 50) {
    bg = "var(--color-heat-4)";
    fg = "#ffffff";
  } else if (pct > 25) {
    bg = "var(--color-heat-3)";
    fg = "var(--color-fg)";
  } else if (pct > 10) {
    bg = "var(--color-heat-2)";
    fg = "var(--color-fg)";
  } else if (pct > 0) {
    bg = "var(--color-heat-1)";
    fg = "var(--color-fg)";
  }
  return {
    background: bg,
    color: fg,
  };
}

/** `summary` = totals and the per-sport table; `busy` = the whole-day court × hour grid, shown last on the page. */
export function CapacityPanel({ from, to, part = "summary" }: { from: string; to: string; part?: "summary" | "busy" }) {
  const [sport, setSport] = useState("");
  const q = new URLSearchParams({ from, to });
  if (sport) q.set("sport", sport);
  const limits = useLimits();
  const { data, error, reload } = useRead<Capacity>(`/reports/capacity?${q}`);

  const isSingleDay = from === to;
  // Hover/focus shows one readable line about the cell; clicking an hour keeps that column lit.
  const [spot, setSpot] = useState<{ court: string; hour: number; text: string } | null>(null);
  const [pinHour, setPinHour] = useState<number | null>(null);
  const courtsBySport = useMemo(() => {
    if (!data?.courts) return [];
    const map = new Map<string, typeof data.courts>();
    for (const c of data.courts) {
      const list = map.get(c.sport) ?? [];
      list.push(c);
      map.set(c.sport, list);
    }
    return Array.from(map.entries()).map(([s, list]) => ({
      sport: s,
      courts: list,
    }));
  }, [data]);

  const busiestSummary = useMemo(() => {
    if (!data?.by_hour?.length) return "";
    const sorted = [...data.by_hour]
      .filter((h) => h.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    if (sorted.length === 0) return t("No bookings in this window");
    const top3 = sorted.slice(0, limits.report_peak_hours);
    const text = top3
      .map((h, idx) =>
        idx === 0
          ? `${String(h.hour).padStart(2, "0")}:00 (${Math.round(h.pct)}%)`
          : `${String(h.hour).padStart(2, "0")}:00`
      )
      .join(", ");
    return t("Busiest: {hours}", { hours: text });
  }, [data, limits.report_peak_hours]);

  return (
    <section className="mt-10" aria-labelledby={part === "summary" ? "cap-h" : "busy-h"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {part === "summary" ? (
          <SectionTitle
            id="cap-h"
            icon={LayoutGrid}
            text={tk("Court capacity")}
            hint={t("Share of open hours that were sold, as bookings or class sessions.")}
          />
        ) : (
          <SectionTitle id="busy-h" icon={Flame} text={t("Busy hours")} hint={t("The whole day, hour by hour, for every court.")} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <SportSelect value={sport} onChange={setSport} />
          <ExportButtons kind="capacity" from={from} to={to} extra={{ sport }} />
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <LoadError message={error.message} onRetry={error.refused ? undefined : reload} />
        </div>
      ) : !data ? (
        <Skeleton className="mt-4 h-64" />
      ) : data.courts.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("No courts to report on")} hint={t("Courts that are ready for play show up here.")} />
        </div>
      ) : (
        <>
          {part === "summary" && (
          <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat
              label={t("Hours sold")}
              value={`${hours(data.totals.sold_min)} h`}
              hint={t("of {n} h open", { n: hours(data.totals.open_min) })}
            />
            <Stat label={t("Used")} value={`${data.totals.pct}%`} icon={Gauge} note={t("Hours sold ÷ hours open")} />
            <Stat
              label={t("Court rental vs classes")}
              value={money(data.revenue_by_source.court_vnd)}
              hint={t("Class fees {amount}", { amount: money(data.revenue_by_source.class_vnd) })}
            />
          </div>

          <Card className="mt-3 overflow-x-auto p-0" role="region" aria-label={t("Court use table, scrolls sideways")} tabIndex={0}>
            <table className="w-full text-sm">
              <thead className="text-left text-2xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("Sport")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Sold")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Used")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Peak")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Off-peak")}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_sport.map((s) => (
                  <tr key={s.sport} className="border-t border-line/60">
                    <td className="px-4 py-2">{sportLabel(s.sport)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{hours(s.sold_min)} h</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.pct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pctText(s.peak_pct)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pctText(s.offpeak_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          </>
          )}

          {part === "busy" && (
          <Card className="mt-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <CardTitle
                icon={Flame}
                title={t("When courts are busy ({from} – {to})", { from, to })}
                hint={
                  isSingleDay
                    ? t("Each square is one court for one hour: green is booked, outlined is free.")
                    : t("Each square shows how often that court was booked at that hour, {from} – {to}.", { from, to })
                }
              />
              {busiestSummary && (
                <div className="text-right">
                  <span className="inline-block rounded-full bg-surface px-3 py-1 text-xs font-medium text-fg border border-line">
                    {busiestSummary}
                  </span>
                </div>
              )}
            </div>

            <p className="min-h-5 px-4 pt-2 text-xs tabular-nums text-muted" aria-live="polite">
              {spot ? <span className="font-medium text-fg">{spot.text}</span> : t("Point at a square to read it; click an hour to light up its column.")}
            </p>
            <div className="overflow-x-auto px-2 pb-3 pt-1" role="region" aria-label={t("When courts are busy table, scrolls sideways")} tabIndex={0}>
              <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0.5 text-center text-xs">
                <thead className="text-2xs text-muted">
                  {/* Share of all courts booked at each hour, one bar per column so each bar sits over its hour;
                      the busiest hours glow. */}
                  <tr>
                    <th scope="row" className="sticky left-0 w-24 bg-surface px-2 pb-1 text-left align-bottom font-medium leading-tight">
                      {t("Courts booked")}
                    </th>
                    {data.by_hour.map((h) => {
                      const top = Math.max(1, ...data.by_hour.map((x) => x.pct));
                      const peak = h.pct > 0 && h.pct >= (top * limits.report_peak_pct) / 100;
                      return (
                        <th key={h.hour} className="px-0.5 font-normal" title={`${String(h.hour).padStart(2, "0")}:00 · ${Math.round(h.pct)}%`}>
                          <div className="flex h-20 flex-col items-stretch justify-end gap-1">
                            <span className={cn("tabular-nums", peak ? "font-semibold text-fg" : "text-muted")}>
                              {Math.round(h.pct)}%
                            </span>
                            <div
                              className={cn(
                                "mx-auto w-full max-w-8 rounded-t-[3px]",
                                peak ? "bg-accent shadow-[0_0_14px_rgb(212_245_60/0.4)]" : "bg-accent/35",
                              )}
                              style={{ height: h.pct > 0 ? `${Math.max(0.25, (h.pct / top) * 3)}rem` : "2px" }}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    <th className="sticky left-0 w-24 bg-surface px-2 py-1 text-left font-medium">{t("Court")}</th>
                    {data.hours.map((h) => (
                      <th key={h} className="px-0.5 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => setPinHour((cur) => (cur === h ? null : h))}
                          aria-pressed={pinHour === h}
                          title={t("Highlight this hour")}
                          className={cn(
                            "w-full rounded-[4px] py-0.5 transition-colors duration-150 hover:bg-accent/15 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary",
                            spot?.hour === h && "text-fg",
                            pinHour === h && "bg-accent font-semibold text-accent-fg hover:bg-accent hover:text-accent-fg",
                          )}
                        >
                          {String(h).padStart(2, "0")}h
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courtsBySport.map((group) => (
                    <Fragment key={`sport-group-${group.sport}`}>
                      <tr className="bg-surface/80">
                        <td
                          colSpan={data.hours.length + 1}
                          className="sticky left-0 bg-surface px-2 py-1 text-left text-xs font-semibold text-fg"
                        >
                          <div className="flex items-center gap-1.5">
                            <SportDot sport={group.sport} />
                            <span>{sportLabel(group.sport)}</span>
                          </div>
                        </td>
                      </tr>
                      {group.courts.map((c) => (
                        <tr key={c.court_id}>
                          <th
                            scope="row"
                            className={cn(
                              "sticky left-0 bg-surface px-2 py-1 text-left font-medium transition-colors",
                              spot?.court === c.court_code && "text-accent",
                            )}
                          >
                            {c.court_code}
                          </th>
                          {c.cells.map((p, i) => {
                            const detail = c.cell_details?.[i];
                            const booked = detail?.days_booked ?? (p > 0 ? 1 : 0);
                            const total = detail?.days_total ?? 1;
                            const title = isSingleDay
                              ? `${c.court_code} · ${String(data.hours[i]).padStart(2, "0")}:00 · ${p > 0 ? t("Booked") : t("Free")}`
                              : `${c.court_code} · ${String(data.hours[i]).padStart(2, "0")}:00 · ${t("booked {booked} of {total} days ({pct}%)", {
                                  booked,
                                  total,
                                  pct: Math.round(p),
                                })}`;
                            return (
                              <td
                                key={i}
                                className={cn(
                                  "h-7 min-w-[1.75rem] rounded-[4px] border border-transparent outline-none cursor-default transition-[transform,opacity] duration-150 ease-out hover:relative hover:z-10 hover:scale-110 hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary motion-reduce:hover:scale-100",
                                  pinHour != null && pinHour !== data.hours[i] && "opacity-35",
                                )}
                                style={heat(p, isSingleDay)}
                                onMouseEnter={() => setSpot({ court: c.court_code, hour: data.hours[i], text: title })}
                                onFocus={() => setSpot({ court: c.court_code, hour: data.hours[i], text: title })}
                                onMouseLeave={() => setSpot(null)}
                                onBlur={() => setSpot(null)}
                                tabIndex={0}
                                role="gridcell"
                                aria-label={title}
                                title={title}
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {isSingleDay ? (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line/50 px-4 py-2.5 text-2xs text-muted">
                <span className="font-medium">{t("Status:")}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3.5 rounded-[2px] border border-line" />
                  {t("Free")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3.5 rounded-[2px]" style={{ background: "var(--color-heat-3)" }} />
                  {t("Booked")}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line/50 px-4 py-2.5 text-2xs text-muted">
                <span className="font-medium">{t("Occupancy:")}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px] border border-line" />
                  0%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px]" style={{ background: "var(--color-heat-1)" }} />
                  1–10%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px]" style={{ background: "var(--color-heat-2)" }} />
                  11–25%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px]" style={{ background: "var(--color-heat-3)" }} />
                  26–50%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px]" style={{ background: "var(--color-heat-4)" }} />
                  51–75%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px]" style={{ background: "var(--color-heat-5)" }} />
                  76–100%
                </span>
              </div>
            )}
          </Card>
          )}
        </>
      )}
    </section>
  );
}

// ---- members and class sign-ups -------------------------------------------------

type MembersReport = {
  members: {
    new: number;
    active: number;
  };
  trend: Array<{ month: string; new_members: number; classes_joined: number }>;
  attendance_on: boolean;
  classes: Array<{
    id: string;
    code: string;
    sport: string;
    level: string;
    status: string;
    coach: string;
    capacity: number;
    enrolled: number;
    waitlisted: number;
    fill_pct: number;
    attendance_pct: number | null;
  }>;
};

export function MembersPanel({ from, to }: { from: string; to: string }) {
  const [sport, setSport] = useState("");
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => setChartReady(true), []);
  const q = new URLSearchParams({ from, to });
  if (sport) q.set("sport", sport);
  const { data, error, reload } = useRead<MembersReport>(`/reports/members?${q}`);
  // Only show the attendance column when at least one class has a figure for it.
  const showAttendance = !!data?.attendance_on && !!data?.classes.some((c) => c.attendance_pct != null);
  const CLASS_STEP = 12;
  const [classShown, setClassShown] = useState(CLASS_STEP);
  // Fullest first, so the classes that need a decision (full with a waitlist, or nearly empty) sit at the two ends.
  const classes = useMemo(
    () => [...(data?.classes ?? [])].sort((a, b) => b.fill_pct - a.fill_pct || b.waitlisted - a.waitlisted || a.code.localeCompare(b.code)),
    [data],
  );
  const classSummary = useMemo(() => {
    const full = classes.filter((c) => c.fill_pct >= 100).length;
    const low = classes.filter((c) => c.fill_pct < 40).length;
    const waiting = classes.reduce((n, c) => n + c.waitlisted, 0);
    return { full, low, waiting };
  }, [classes]);

  return (
    <section className="mt-10" aria-labelledby="mem-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          id="mem-h"
          icon={Users}
          text={tk("Members and class sign-ups")}
          hint={t("New members, participation and how full each class is.")}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SportSelect value={sport} onChange={setSport} />
          <ExportButtons kind="members" from={from} to={to} extra={{ sport }} />
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <LoadError message={error.message} onRetry={error.refused ? undefined : reload} />
        </div>
      ) : !data ? (
        <Skeleton className="mt-4 h-64" />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label={t("New members")} value={data.members.new} icon={UserPlus} note={t("Signed up in this period")} />
            <Stat label={t("Participating members")} value={data.members.active} hint={t("With a booking or confirmed class in this period")} />
          </div>

          <Card className="mt-3">
            <CardTitle icon={TrendingUp} title={t("Last 12 months")} hint={t("New members by signup month; confirmed class places by class start month.")} />
            {chartReady ? (
              <div className="mt-3 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="2 4" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      stroke="var(--color-muted)"
                      tickLine={false}
                      tickFormatter={(m: string) => `${m.slice(5)}/${m.slice(2, 4)}`}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="var(--color-muted)"
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-line)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "var(--color-wood)", opacity: 0.5 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="new_members" name={t("New members")} fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="classes_joined" name={t("Confirmed class places")} fill="var(--color-line-strong)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Skeleton className="mt-3 h-52" />
            )}
          </Card>

          <Card className="mt-3 p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
              <CardTitle icon={CalendarDays} title={t("Classes running in this period")} hint={t("How full each class was.")} />
              {classes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 text-2xs">
                  <span className="rounded-full border border-line px-2.5 py-1 tabular-nums text-muted">
                    {t("{n} classes", { n: classes.length })}
                  </span>
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 font-medium tabular-nums text-accent">
                    {t("{n} full", { n: classSummary.full })}
                  </span>
                  {classSummary.waiting > 0 ? (
                    <span className="rounded-full bg-warn/15 px-2.5 py-1 font-medium tabular-nums text-warn">
                      {t("{n} waiting", { n: classSummary.waiting })}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-line px-2.5 py-1 tabular-nums text-muted">
                    {t("{n} under 40%", { n: classSummary.low })}
                  </span>
                </div>
              ) : null}
            </div>
            {classes.length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-muted">{t("No classes were running in this period.")}</p>
            ) : (
              <div className="overflow-x-auto" role="region" aria-label={t("Classes table, scrolls sideways")} tabIndex={0}>
                <table className="mt-3 w-full min-w-[560px] text-sm">
                  <thead className="text-left text-2xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("Class")}</th>
                      <th className="px-3 py-2 font-medium">{t("Coach")}</th>
                      <th className="w-[38%] px-3 py-2 font-medium">{t("Full")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("Waitlist")}</th>
                      {showAttendance ? <th className="px-4 py-2 text-right font-medium">{t("Attendance")}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.slice(0, classShown).map((c) => {
                      const full = c.fill_pct >= 100;
                      const low = c.fill_pct < 40;
                      return (
                        <tr key={c.id} className="border-t border-line/50 transition-colors duration-150 hover:bg-fg/[0.03]">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2 font-medium">
                              <SportDot sport={c.sport} />
                              {c.code}
                            </span>
                            <span className="block pl-4 text-xs text-muted">{levelLabel(c.level)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-muted">{c.coach}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.07]" aria-hidden="true">
                                <div
                                  className={cn("h-full rounded-full", full ? "bg-accent" : low ? "bg-muted/50" : "bg-accent/55")}
                                  style={{ width: `${Math.min(100, c.fill_pct)}%` }}
                                />
                              </div>
                              <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                                <span className={cn("font-medium", full ? "text-accent" : low ? "text-muted" : "text-fg")}>
                                  {c.enrolled}/{c.capacity}
                                </span>
                                <span className="ml-1.5 text-muted">{c.fill_pct}%</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.waitlisted > 0 ? <Badge tone="hold">{c.waitlisted}</Badge> : <span className="text-muted/50">·</span>}
                          </td>
                          {showAttendance ? (
                            <td className="px-4 py-2.5 text-right tabular-nums">{pctText(c.attendance_pct)}</td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pb-4">
              <ShowMore shown={classShown} total={classes.length} step={CLASS_STEP} onMore={() => setClassShown((n) => n + CLASS_STEP)} />
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
