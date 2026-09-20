import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, DateField, Field, Input, Select, StatusBadge } from "@/components/ui";
import { Lift, Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import { SpotlightCard } from "@/components/fx";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { composeWeeklyRrule, levelLabel, rruleLabel, sportLabel, todayISO, addDaysISO } from "@/lib/arena3/labels";

export const Route = createFileRoute("/manager/classes")({
  component: Page,
});

const DAYS = [
  { k: "MO", l: "Mon" },
  { k: "TU", l: "Tue" },
  { k: "WE", l: "Wed" },
  { k: "TH", l: "Thu" },
  { k: "FR", l: "Fri" },
  { k: "SA", l: "Sat" },
  { k: "SU", l: "Sun" },
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

  const load = useCallback(async () => {
    setItems((await apiGet<{ items: typeof items }>("/classes")).items);
    setCourts((await apiGet<{ items: typeof courts }>("/courts")).items);
  }, []);
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [load]);

  function toggleDay(k: string) {
    setDays((prev) => (prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]));
  }

  return (
    <Shell role="manager" title="Classes" subtitle="Pick the days and the hour — clashes on court or coach are blocked for you.">
      <Reveal from="down">
      <Card className="mb-6 grid gap-3 md:grid-cols-3">
        <Field label="Sport">
          <Select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
            <option value="badminton">Badminton</option>
            <option value="basketball">Basketball</option>
            <option value="volleyball">Volleyball</option>
          </Select>
        </Field>
        <Field label="Level">
          <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="team">Squad</option>
          </Select>
        </Field>
        <Field label="Court">
          <Select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.court_code} · {sportLabel(c.sport)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="md:col-span-2">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">Repeats weekly on</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button
                key={d.k}
                type="button"
                onClick={() => toggleDay(d.k)}
                className={`relative min-h-9 min-w-11 rounded-[var(--radius-sm)] px-2 text-sm font-medium transition-colors duration-200 active:scale-95 ${
                  days.includes(d.k) ? "text-bg" : "bg-wood text-muted hover:bg-wood/70"
                }`}
              >
                {days.includes(d.k) ? (
                  <motion.span
                    layoutId={`byday-${d.k}`}
                    className="absolute inset-0 rounded-[var(--radius-sm)] bg-fg"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative">{d.l}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Start time">
          <Select value={String(hour)} onChange={(e) => setHour(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First day">
          <DateField value={form.start_on} onChange={(v) => setForm({ ...form, start_on: v })} aria-label="Start date" />
        </Field>
        <Field label="Capacity">
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
                toast.success("Draft created");
                const pub = await apiPost<{ sessions: unknown[]; skipped: unknown[] }>(`/classes/${row.id}/publish`);
                toast.success(`Published ${pub.sessions.length} sessions`);
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            Create & publish
          </Button>
        </div>
      </Card>
      </Reveal>
      <Stagger className="grid gap-3 md:grid-cols-2" gap={0.06}>
        {items.map((c) => (
          <StaggerItem key={c.id} className="h-full">
          <Lift className="h-full">
          <SpotlightCard className="h-full rounded-[var(--radius-xl)]" size={320} strength={0.1}>
          <Card interactive className="relative z-[2] h-full">
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
                    toast.success("Published");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Something went wrong");
                  }
                }}
              >
                Publish
              </Button>
            ) : null}
          </Card>
          </SpotlightCard>
          </Lift>
          </StaggerItem>
        ))}
      </Stagger>
    </Shell>
  );
}
