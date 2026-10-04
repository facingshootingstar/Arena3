import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Stat } from "@/components/ui";
import { ExportButtons } from "@/components/report-panels";
import { ApiClientError, apiGet, apiPost } from "@/lib/arena3/client";
import { addDaysISO, formatDate, sportLabel, todayISO } from "@/lib/arena3/labels";

type Counts = { present: number; late: number; absent: number; excused: number; rate_pct: number | null };

type Report = {
  from: string;
  to: string;
  totals: Counts;
  classes: Array<Counts & { class_id: string; class_code: string; sport: string; coach: string; students: number }>;
  coaches: Array<Counts & { coach_id: string; coach: string; classes: number }>;
  students: Array<Counts & { user_id: string; full_name: string; member_code: string | null; class_code: string; sport: string }>;
};

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/**
 * Attendance rate = (present + late) ÷ (sessions marked − excused). Excused
 * absences are not held against anyone, and nothing here is a penalty (BR-73).
 */
export function AttendancePanel({ canExport }: { canExport: boolean }) {
  const [from, setFrom] = useState(() => addDaysISO(todayISO(), -29));
  const [to, setTo] = useState(todayISO);
  const [data, setData] = useState<Report | null>(null);
  const [view, setView] = useState<"class" | "coach" | "student">("class");

  useEffect(() => {
    let live = true;
    setData(null);
    apiGet<Report>(`/reports/attendance?from=${from}&to=${to}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => {
        if (live) toast.error(e.message);
      });
    return () => {
      live = false;
    };
  }, [from, to]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Select value={view} onChange={(e) => setView(e.target.value as typeof view)} aria-label="Group by">
          <option value="class">By class</option>
          <option value="coach">By coach</option>
          <option value="student">By student</option>
        </Select>
        {canExport ? <ExportButtons kind="attendance" from={from} to={to} /> : null}
      </div>

      {!data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Attendance rate" value={pct(data.totals.rate_pct)} />
            <Stat label="Present or late" value={String(data.totals.present + data.totals.late)} />
            <Stat label="Absent" value={String(data.totals.absent)} />
            <Stat label="Excused (not counted)" value={String(data.totals.excused)} />
          </div>
          {view === "class" ? (
            <Table
              head={["Class", "Coach", "Students", "Present", "Late", "Absent", "Excused", "Rate"]}
              rows={data.classes.map((c) => [
                `${c.class_code} · ${sportLabel(c.sport)}`,
                c.coach,
                c.students,
                c.present,
                c.late,
                c.absent,
                c.excused,
                pct(c.rate_pct),
              ])}
            />
          ) : view === "coach" ? (
            <Table
              head={["Coach", "Classes", "Present", "Late", "Absent", "Excused", "Rate"]}
              rows={data.coaches.map((c) => [c.coach, c.classes, c.present, c.late, c.absent, c.excused, pct(c.rate_pct)])}
            />
          ) : (
            <Table
              head={["Student", "Class", "Present", "Late", "Absent", "Excused", "Rate"]}
              rows={data.students.map((s) => [
                `${s.full_name}${s.member_code ? ` (${s.member_code})` : ""}`,
                s.class_code,
                s.present,
                s.late,
                s.absent,
                s.excused,
                pct(s.rate_pct),
              ])}
            />
          )}
        </>
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  if (!rows.length) return <EmptyState title="No marked sessions in this window" hint="Pick a longer range." />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type RiskItem = {
  user_id: string;
  full_name: string;
  member_code: string | null;
  phone: string | null;
  plan_end_on: string | null;
  reasons: Array<{ kind: string; message: string }>;
  attendance_pct: number | null;
  last_seen_at: string | null;
  contacted: boolean;
  last_contact: { at: string; outcome: string; note: string | null; by: string } | null;
};

const CHANNELS = [
  { value: "phone", label: "Phone call" },
  { value: "zalo", label: "Zalo" },
  { value: "sms", label: "SMS" },
  { value: "in_person", label: "In person" },
];
const OUTCOMES = [
  { value: "reached", label: "Spoke to them" },
  { value: "will_return", label: "Will come back" },
  { value: "reschedule", label: "Wants another time" },
  { value: "leaving", label: "Leaving" },
  { value: "no_answer", label: "No answer" },
];
const outcomeLabel = (v: string) => OUTCOMES.find((o) => o.value === v)?.label ?? v;

/** Members who may be drifting away, with what has already been done about it (FR-TRN-09). */
export function AtRiskPanel({ canContact = true }: { canContact?: boolean }) {
  const [items, setItems] = useState<RiskItem[] | null>(null);
  const [idleDays, setIdleDays] = useState<number | null>(null);
  const [target, setTarget] = useState<RiskItem | null>(null);
  const [form, setForm] = useState({ channel: "phone", outcome: "reached", note: "" });
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiGet<{ items: RiskItem[]; idle_days: number }>("/at-risk");
    setItems(r.items);
    setIdleDays(r.idle_days);
  }, []);
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [load]);

  async function save() {
    if (!target) return;
    setBusy(true);
    setFieldError(null);
    try {
      await apiPost("/contacts", {
        user_id: target.user_id,
        reason: target.reasons[0]?.kind ?? "other",
        channel: form.channel,
        outcome: form.outcome,
        note: form.note,
      });
      toast.success("Contact saved");
      setTarget(null);
      setForm({ channel: "phone", outcome: "reached", note: "" });
      await load();
    } catch (e) {
      if (e instanceof ApiClientError && e.body.field) setFieldError(e.message);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!items) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Three things put someone here: absent three sessions running, no visit for {idleDays ?? "—"}+ days on a live
        plan, or a plan ending soon with low attendance. Contacting them is a courtesy call — never a penalty.
      </p>
      {!items.length ? <EmptyState title="Nobody is at risk" hint="Everyone with a plan has been in recently." /> : null}
      {items.map((m) => (
        <Card key={m.user_id} className="grid gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {m.full_name} <span className="text-xs text-muted">{m.member_code}</span>
              </p>
              <p className="text-xs text-muted">
                {m.phone ?? "no phone"}
                {m.plan_end_on ? ` · plan until ${formatDate(m.plan_end_on)}` : " · no live plan"}
                {m.attendance_pct !== null ? ` · attendance ${m.attendance_pct}%` : ""}
                {m.last_seen_at ? ` · last seen ${formatDate(m.last_seen_at)}` : " · never seen"}
              </p>
            </div>
            <Badge tone={m.contacted ? "muted" : "hold"}>{m.contacted ? "Contacted" : "Not contacted"}</Badge>
          </div>
          <ul className="grid gap-1 text-sm">
            {m.reasons.map((r) => (
              <li key={r.kind}>• {r.message}</li>
            ))}
          </ul>
          {m.last_contact ? (
            <p className="text-xs text-muted">
              {formatDate(m.last_contact.at)} · {m.last_contact.by}: {outcomeLabel(m.last_contact.outcome)}
              {m.last_contact.note ? ` — ${m.last_contact.note}` : ""}
            </p>
          ) : null}
          {canContact ? (
            <div>
              <Button size="sm" variant="outline" onClick={() => setTarget(m)}>
                Log a contact
              </Button>
            </div>
          ) : null}
        </Card>
      ))}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Contact ${target.full_name}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="How">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What happened" hint={fieldError ?? undefined}>
            <Select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              {OUTCOMES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)">
            <Input value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
