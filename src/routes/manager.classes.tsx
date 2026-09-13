import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, DateField, Field, Input, Select, StatusBadge } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { composeWeeklyRrule, levelLabel, rruleLabel, sportLabel, todayISO, addDaysISO } from "@/lib/arena3/labels";

export const Route = createFileRoute("/manager/classes")({
  component: Page,
});

const DAYS = [
  { k: "MO", l: "T2" },
  { k: "TU", l: "T3" },
  { k: "WE", l: "T4" },
  { k: "TH", l: "T5" },
  { k: "FR", l: "T6" },
  { k: "SA", l: "T7" },
  { k: "SU", l: "CN" },
];

function Page() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      sport: string;
      level: string;
      status: string;
      court_code: string;
      coach_name: string;
      enrolled_count: number;
      capacity: number;
      rrule?: string;
    }>
  >([]);
  const [courts, setCourts] = useState<Array<{ id: string; court_code: string; sport: string }>>([]);
  const [days, setDays] = useState<string[]>(["TU", "TH"]);
  const [hour, setHour] = useState(19);
  const [form, setForm] = useState({
    sport: "badminton",
    level: "beginner",
    coach_id: "00000000-0000-0000-0000-000000000003",
    court_id: "10000000-0000-0000-0000-000000000007",
    capacity: 12,
    duration_min: 90,
    start_on: todayISO(),
    end_on: addDaysISO(todayISO(), 60),
  });

  async function load() {
    setItems((await apiGet<{ items: typeof items }>("/classes")).items);
    setCourts((await apiGet<{ items: typeof courts }>("/courts")).items);
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  function toggleDay(k: string) {
    setDays((prev) => (prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]));
  }

  return (
    <Shell role="manager" title="Lớp học" subtitle="Chọn thứ và giờ — hệ thống tự chặn trùng sân / HLV.">
      <Card className="mb-6 grid gap-3 md:grid-cols-3">
        <Field label="Môn">
          <Select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
            <option value="badminton">Cầu lông</option>
            <option value="basketball">Bóng rổ</option>
            <option value="volleyball">Bóng chuyền</option>
          </Select>
        </Field>
        <Field label="Trình độ">
          <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="beginner">Mới</option>
            <option value="intermediate">Trung bình</option>
            <option value="advanced">Nâng cao</option>
            <option value="team">Đội</option>
          </Select>
        </Field>
        <Field label="Sân">
          <Select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.court_code} · {sportLabel(c.sport)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="md:col-span-2">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">Lặp mỗi tuần</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button
                key={d.k}
                type="button"
                onClick={() => toggleDay(d.k)}
                className={`min-h-9 min-w-11 rounded-[var(--radius-sm)] px-2 text-sm font-medium ${
                  days.includes(d.k) ? "bg-fg text-bg" : "bg-wood text-muted"
                }`}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <Field label="Giờ bắt đầu">
          <Select value={String(hour)} onChange={(e) => setHour(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bắt đầu">
          <DateField value={form.start_on} onChange={(v) => setForm({ ...form, start_on: v })} aria-label="Ngày bắt đầu" />
        </Field>
        <Field label="Sĩ số">
          <Input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </Field>
        <div className="flex items-end">
          <Button
            className="w-full"
            onClick={async () => {
              try {
                const row = await apiPost<{ id: string }>("/classes", {
                  ...form,
                  rrule: composeWeeklyRrule(days, hour),
                });
                toast.success("Đã tạo nháp");
                const pub = await apiPost<{ sessions: unknown[]; skipped: unknown[] }>(`/classes/${row.id}/publish`);
                toast.success(`Xuất bản ${pub.sessions.length} buổi`);
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Lỗi");
              }
            }}
          >
            Tạo & xuất bản
          </Button>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((c) => (
          <Card key={c.id}>
            <StatusBadge status={c.status} />
            <h2 className="mt-2 font-display text-2xl">
              {sportLabel(c.sport)} · {levelLabel(c.level)}
            </h2>
            <p className="text-sm text-muted">
              {c.coach_name} · {c.court_code} · {c.enrolled_count}/{c.capacity}
            </p>
            {c.rrule ? <p className="text-sm">{rruleLabel(c.rrule)}</p> : null}
            {c.status === "draft" ? (
              <Button
                className="mt-3"
                onClick={async () => {
                  try {
                    await apiPost(`/classes/${c.id}/publish`);
                    toast.success("Đã xuất bản");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                Xuất bản
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
    </Shell>
  );
}
