import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { CourtGrid, type Court, type OccSlot } from "@/components/court-grid";
import { Cover, MediaCaption, media } from "@/components/media";
import { Shell, money } from "@/components/shell";
import { Button, Card, DateField, Seg, Skeleton, Stat } from "@/components/ui";
import { apiGet } from "@/lib/arena3/client";
import {
  addDaysISO,
  formatViDate,
  methodLabel,
  sourceLabel,
  todayISO,
} from "@/lib/arena3/labels";

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
  if (prev === 0 && cur === 0) return "Bằng kỳ trước";
  if (prev === 0) return "Mới phát sinh";
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% so với kỳ trước`;
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
      title="Báo cáo"
      subtitle={`Doanh thu = phiếu thu − hoàn. Công suất ${formatViDate(to)}.`}
    >
      <Cover src={media.hallCourts} alt="" scrim="none" className="mb-5 h-32 rounded-[var(--radius-xl)]">
        <MediaCaption>
          <p className="font-display text-2xl">Khóa sổ trong kỳ</p>
        </MediaCaption>
      </Cover>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Seg
          value={period}
          onChange={applyPeriod}
          options={[
            { value: "today", label: "Hôm nay" },
            { value: "week", label: "7 ngày" },
            { value: "month", label: "Tháng này" },
            { value: "custom", label: "Tùy chọn" },
          ]}
        />
        <span className="text-2xs uppercase tracking-wider text-muted">Từ</span>
        <DateField
          value={from}
          onChange={(v) => {
            setPeriod("custom");
            setFrom(v);
          }}
          aria-label="Từ ngày"
        />
        <span className="text-2xs uppercase tracking-wider text-muted">Đến</span>
        <DateField
          value={to}
          onChange={(v) => {
            setPeriod("custom");
            setTo(v);
          }}
          aria-label="Đến ngày"
        />
        <Button
          variant="outline"
          onClick={() => {
            if (!rev || !occ) return;
            downloadCsv(`arena3-bao-cao-${from}_${to}.csv`, [
              ["Từ", formatViDate(from), "Đến", formatViDate(to)],
              [
                "Doanh thu",
                rev.totals.revenue_vnd,
                "Hoàn",
                rev.totals.refund_vnd ?? 0,
                "Giờ gói",
                rev.totals.quota_hours,
              ],
              [],
              ["Hình thức", "Số tiền"],
              ...Object.entries(rev.by_method).map(([k, v]) => [methodLabel(k), v]),
              [],
              ["Nguồn", "Số tiền"],
              ...Object.entries(rev.by_source).map(([k, v]) => [sourceLabel(k), v]),
              [],
              ["Sân", "Phút", "%"],
              ...(occ.items ?? []).map((c) => [c.court_code, c.minutes, c.pct]),
            ]);
          }}
        >
          Xuất Excel
        </Button>
      </div>
      {!rev ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat
            label="Doanh thu"
            value={money(rev.totals.revenue_vnd)}
            hint={prev ? deltaHint(rev.totals.revenue_vnd, prev.totals.revenue_vnd) : undefined}
          />
          <Stat
            label="Hoàn"
            value={money(rev.totals.refund_vnd ?? 0)}
            hint={prev ? deltaHint(rev.totals.refund_vnd ?? 0, prev.totals.refund_vnd ?? 0) : undefined}
          />
          <Stat
            label="Giờ tiêu gói"
            value={rev.totals.quota_hours}
            hint={prev ? deltaHint(rev.totals.quota_hours, prev.totals.quota_hours) : undefined}
          />
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Card>
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">Theo hình thức</p>
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
            <p className="mt-4 text-sm text-muted">Chưa phát sinh.</p>
          )}
        </Card>
        <Card>
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">Theo nguồn</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(rev?.by_source ?? {}).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-muted">{sourceLabel(k)}</span>
                <span className="tabular-nums">{money(v)}</span>
              </li>
            ))}
            {!Object.keys(rev?.by_source ?? {}).length ? <li className="text-muted">Chưa phát sinh.</li> : null}
          </ul>
        </Card>
      </div>

      <h2 className="mt-8 font-display text-2xl">Công suất sân · {formatViDate(to)}</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(occ?.items ?? []).map((c) => (
          <Card key={c.court_code} className="p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{c.court_code}</span>
              <span className="tabular-nums">{c.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wood">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, c.pct)}%` }} />
            </div>
          </Card>
        ))}
      </div>
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
