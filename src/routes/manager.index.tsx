import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { CourtGrid, type Court, type OccSlot } from "@/components/court-grid";
import { Cover, MediaCaption, media } from "@/components/media";
import { Shell, money } from "@/components/shell";
import { Button, Card, DateField, Seg, Skeleton, Stat } from "@/components/ui";
import { CountUp, Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import { GLBackground, GlareHover, SplitText, SpotlightCard } from "@/components/fx";
import { apiGet } from "@/lib/arena3/client";
import { addDaysISO, formatDate, methodLabel, sourceLabel, todayISO } from "@/lib/arena3/labels";

export const Route = createFileRoute("/manager/")({
  component: Page,
});

type Rev = {
  from: string;
  to: string;
  totals: { revenue_vnd: number; gross_vnd?: number; refund_vnd: number; quota_hours: number };
  by_source: Record<string, number>;
  by_method: Record<string, number>;
};

type Occ = { date: string; items: Array<{ court_code: string; minutes: number; pct: number }> };

function daysInclusive(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function deltaHint(cur: number, prev: number) {
  if (prev === 0 && cur === 0) return "Same as the previous period";
  if (prev === 0) return "New this period";
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs the previous period`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Page() {
  const today = todayISO();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState("today");
  const [rev, setRev] = useState<Rev | null>(null);
  const [prev, setPrev] = useState<Rev | null>(null);
  const [occ, setOcc] = useState<Occ | null>(null);
  const [map, setMap] = useState<{ courts: Court[]; slots: OccSlot[] } | null>(null);
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => setChartReady(true), []);

  function applyPeriod(p: string) {
    setPeriod(p);
    if (p === "today") {
      setFrom(today);
      setTo(today);
    } else if (p === "week") {
      setFrom(addDaysISO(today, -6));
      setTo(today);
    } else if (p === "month") {
      setFrom(monthStart(today));
      setTo(today);
    }
  }

  async function load() {
    const n = daysInclusive(from, to);
    const prevTo = addDaysISO(from, -1);
    const prevFrom = addDaysISO(prevTo, -(n - 1));
    const [r, p, o, m] = await Promise.all([
      apiGet<Rev>(`/reports/revenue?from=${from}&to=${to}`),
      apiGet<Rev>(`/reports/revenue?from=${prevFrom}&to=${prevTo}`),
      apiGet<Occ>(`/reports/occupancy?date=${to}`),
      apiGet<{ courts: Court[]; slots: OccSlot[] }>(`/occupancy?date=${to}`),
    ]);
    setRev(r);
    setPrev(p);
    setOcc(o);
    setMap(m);
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const chartData = Object.entries(rev?.by_method ?? {}).map(([k, v]) => ({
    name: methodLabel(k),
    vnd: v,
  }));

  return (
    <Shell
      role="manager"
      title="Reports"
      subtitle={`Revenue = payments taken − refunds. Court usage for ${formatDate(to)}.`}
    >
      <GLBackground
        variant="dotgrid"
        position="fixed"
        className="-z-[1]"
        color="#1f5c43"
        gap={32}
        dot={1.5}
        radius={130}
        opacity={0.12}
      />
      <GlareHover className="mb-5 rounded-[var(--radius-xl)]" duration={1.1}>
        <Cover src={media.hallCourts} alt="" scrim="none" className="h-32 rounded-[var(--radius-xl)]">
          <MediaCaption>
            <p className="font-display text-2xl">Close the books for this period</p>
          </MediaCaption>
        </Cover>
      </GlareHover>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Seg
          value={period}
          onChange={applyPeriod}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "7 days" },
            { value: "month", label: "This month" },
            { value: "custom", label: "Custom" },
          ]}
        />
        <span className="text-2xs uppercase tracking-wider text-muted">From</span>
        <DateField
          value={from}
          onChange={(v) => {
            setPeriod("custom");
            setFrom(v);
          }}
          aria-label="From date"
        />
        <span className="text-2xs uppercase tracking-wider text-muted">To</span>
        <DateField
          value={to}
          onChange={(v) => {
            setPeriod("custom");
            setTo(v);
          }}
          aria-label="To date"
        />
        <Button
          variant="outline"
          onClick={() => {
            if (!rev || !occ) return;
            downloadCsv(`arena3-report-${from}_${to}.csv`, [
              ["From", formatDate(from), "To", formatDate(to)],
              [
                "Revenue",
                rev.totals.revenue_vnd,
                "Refunds",
                rev.totals.refund_vnd ?? 0,
                "Plan hours used",
                rev.totals.quota_hours,
              ],
              [],
              ["Method", "Amount"],
              ...Object.entries(rev.by_method).map(([k, v]) => [methodLabel(k), v]),
              [],
              ["Source", "Amount"],
              ...Object.entries(rev.by_source).map(([k, v]) => [sourceLabel(k), v]),
              [],
              ["Court", "Minutes", "%"],
              ...(occ.items ?? []).map((c) => [c.court_code, c.minutes, c.pct]),
            ]);
          }}
        >
          Export CSV
        </Button>
      </div>
      {!rev ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <Stagger className="grid gap-3 md:grid-cols-3" gap={0.08}>
          <StaggerItem>
          <Stat
            label="Revenue"
            value={money(rev.totals.revenue_vnd)}
            hint={prev ? deltaHint(rev.totals.revenue_vnd, prev.totals.revenue_vnd) : undefined}
          />
          </StaggerItem>
          <StaggerItem>
          <Stat
            label="Refunds"
            value={money(rev.totals.refund_vnd ?? 0)}
            hint={prev ? deltaHint(rev.totals.refund_vnd ?? 0, prev.totals.refund_vnd ?? 0) : undefined}
          />
          </StaggerItem>
          <StaggerItem>
          <Stat
            label="Plan hours used"
            value={rev.totals.quota_hours}
            hint={prev ? deltaHint(rev.totals.quota_hours, prev.totals.quota_hours) : undefined}
          />
          </StaggerItem>
        </Stagger>
      )}

      <Reveal className="mt-6 grid gap-3 md:grid-cols-2">
        <SpotlightCard className="rounded-[var(--radius-xl)]" size={380} strength={0.09}>
        <Card className="relative z-[2] h-full">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">By payment method</p>
          {chartReady && chartData.length ? (
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v) => money(Number(v ?? 0))}
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="vnd" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Nothing recorded yet.</p>
          )}
        </Card>
        </SpotlightCard>
        <SpotlightCard className="rounded-[var(--radius-xl)]" size={380} strength={0.09}>
        <Card className="relative z-[2] h-full">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">By source</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(rev?.by_source ?? {}).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-muted">{sourceLabel(k)}</span>
                <span className="tabular-nums">{money(v)}</span>
              </li>
            ))}
            {!Object.keys(rev?.by_source ?? {}).length ? (
              <li className="text-muted">Nothing recorded yet.</li>
            ) : null}
          </ul>
        </Card>
        </SpotlightCard>
      </Reveal>

      <SplitText
        as="h2"
        text={`Court usage · ${formatDate(to)}`}
        className="mt-8 font-display text-2xl"
      />
      <Stagger className="mt-3 grid gap-2 md:grid-cols-2" gap={0.05}>
        {(occ?.items ?? []).map((c) => (
          <StaggerItem key={c.court_code}>
          <Card className="p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{c.court_code}</span>
              <span className="tabular-nums">
                <CountUp to={c.pct} duration={0.9} suffix="%" />
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wood">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, c.pct)}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </Card>
          </StaggerItem>
        ))}
      </Stagger>
      {map ? (
        <div className="mt-4">
          <CourtGrid date={to} courts={map.courts} slots={map.slots} />
        </div>
      ) : (
        <Skeleton className="mt-4 h-64" />
      )}
    </Shell>
  );
}
