import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Clock, FileCheck2, MapPin, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckDraw } from "@/components/arena-icons";
import { StepTabs } from "@/components/coach-ui";
import { sessionDay } from "@/components/class-detail";
import { HomeworkPanel, PlanPanel, ResultsPanel } from "@/components/coach-training";
import { Shell, hhmm, useSessionUser } from "@/components/shell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { cn } from "@/lib/cn";
import { levelLabel, sportLabel } from "@/lib/arena3/labels";
import { t, tServer, tk, tData } from "@/lib/i18n";
import type { CoachSession } from "./coach.index";

export const Route = createFileRoute("/coach/attendance")({
  validateSearch: (search: Record<string, unknown>): { session?: string } => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  component: Page,
});

type SessionRow = CoachSession;

type AttRow = {
  id: string;
  full_name: string;
  member_code: string | null;
  health_notes: string | null;
  result: string | null;
};

type AttMeta = { locked: boolean; lock_at: string | null; status: string };

// Colour and icon say the answer before the word does: green tick, amber clock, red cross, grey note.
const RESULTS = [
  {
    v: "present",
    l: tk("Present"),
    Icon: Check,
    on: "border-green-700 bg-green-600 text-white",
    off: "border-green-300 bg-green-50 text-green-800 hover:bg-green-100",
    dot: "bg-green-600",
  },
  {
    v: "late",
    l: tk("Late"),
    Icon: Clock,
    on: "border-amber-600 bg-amber-400 text-black",
    off: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
    dot: "bg-amber-400",
  },
  {
    v: "absent",
    l: tk("Absent"),
    Icon: X,
    on: "border-red-700 bg-red-600 text-white",
    off: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
    dot: "bg-red-600",
  },
  {
    v: "excused",
    l: tk("Excused"),
    Icon: FileCheck2,
    on: "border-blue-700 bg-blue-600 text-white",
    off: "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100",
    dot: "bg-blue-600",
  },
];

function Page() {
  const { session: sessionParam } = Route.useSearch();
  const navigate = useNavigate();
  const user = useSessionUser();
  const [items, setItems] = useState<SessionRow[] | null>(null);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [meta, setMeta] = useState<AttMeta | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<SessionRow | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagsReady, setFlagsReady] = useState(false);
  const [step, setStep] = useState("register");
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  useEffect(() => {
    void apiGet<{ items: SessionRow[] }>("/coach/schedule")
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(tServer(e.message)));
    void apiGet<{ flags: Record<string, boolean> }>("/flags")
      .then((r) => setFlags(r.flags))
      .catch(() => undefined)
      .finally(() => setFlagsReady(true));
  }, []);

  // The session in the address bar (from a schedule card) is the one whose
  // register is on screen; with none chosen, the next one to come.
  useEffect(() => {
    if (!items?.length || !flagsReady) return;
    const next =
      items.find((s) => s.id === sessionParam) ??
      items.find((s) => s.status === "scheduled") ??
      items[0]!;
    if (next.id !== open?.id) void openSession(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sessionParam, flagsReady]);

  async function openSession(s: SessionRow, keepStep = false) {
    setOpen(s);
    if (!keepStep) setStep("register");
    setReason("");
    setMeta(null);
    try {
      if (flags.F4 !== false) {
        const r = await apiGet<{ items: AttRow[]; session: AttMeta }>(
          `/sessions/${s.id}/attendance`,
        );
        setAtt(r.items);
        setMeta(r.session);
        setMarks(Object.fromEntries(r.items.map((u) => [u.id, u.result ?? "present"])));
      } else {
        const r = await apiGet<{ items: AttRow[] }>(`/classes/${s.class_id}/roster`);
        setAtt(r.items);
        setMarks({});
      }
    } catch (e) {
      toast.error(e instanceof Error ? tServer(e.message) : t("Something went wrong"));
    }
  }

  const f4 = flags.F4 !== false;
  const isManager = user?.role === "manager";
  // After the lock only a manager may correct a register, and must say why (BR-53).
  const locked = !!meta?.locked;
  const blocked = locked && !isManager;

  async function saveRegister() {
    if (!open) return;
    try {
      await apiPost(`/sessions/${open.id}/attendance`, {
        items: Object.entries(marks).map(([user_id, result]) => ({ user_id, result })),
        ...(locked ? { reason } : {}),
      });
      toast.success(locked ? t("Register corrected") : t("Register saved"));
      setReason("");
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2200);
      await openSession(open, true);
    } catch (e) {
      toast.error(
        e instanceof Error ? tServer(e.message) : t("Attendance is switched off (flag F4)"),
      );
    }
  }

  const steps = [
    { value: "register", label: t("Attendance") },
    { value: "results", label: t("Results") },
    { value: "plan", label: t("Session plan") },
    { value: "homework", label: t("Homework") },
  ];
  const current = f4 ? step : "register";

  return (
    <Shell
      role="coach"
      title={t("Attendance")}
      subtitle={t("Pick a session, mark who came, then plan the next one.")}
    >
      {!items ? (
        <Skeleton className="h-24" />
      ) : !items.length ? (
        <EmptyState
          title={t("No sessions to take a register for")}
          hint={t("Sessions appear here once a class you teach is published.")}
        />
      ) : (
        <div className="mx-auto grid max-w-3xl gap-5">
          <Card className="grid gap-4 p-4 sm:p-5">
            {open ? (
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <div>
                  <p className="text-sm text-muted">{sessionDay(open.start_at)}</p>
                  <p className="figure text-3xl tabular-nums">
                    {hhmm(open.start_at)}
                    <span className="text-muted">–{hhmm(open.end_at)}</span>
                  </p>
                </div>
                <div className="grid gap-1 text-sm sm:justify-items-end">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{sportLabel(open.sport)}</Badge>
                    <Badge tone="muted">{levelLabel(open.level)}</Badge>
                    {locked ? <Badge tone="hold">{t("Locked")}</Badge> : null}
                  </p>
                  <p className="flex items-center gap-4 text-muted tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-4" />
                      {t("Court {court}", { court: open.court_code })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users aria-hidden className="size-4" />
                      {open.enrolled_count}/{open.capacity}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
            <Field label={t("Change session")}>
              <Select
                value={open?.id ?? ""}
                onChange={(e) =>
                  void navigate({ to: "/coach/attendance", search: { session: e.target.value } })
                }
              >
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sessionDay(s.start_at)} · {hhmm(s.start_at)} · {s.class_code} · {s.court_code}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          {open && f4 ? <StepTabs value={current} onChange={setStep} steps={steps} /> : null}

          {open && current === "register" && att.length ? (
            <div>
              {locked ? (
                <p className="mb-3 rounded-[var(--radius-md)] bg-hold/10 px-3 py-2 text-sm">
                  {meta?.lock_at
                    ? t("This register closed {day} at {time}.", {
                        day: sessionDay(meta.lock_at),
                        time: hhmm(meta.lock_at),
                      })
                    : t("This register closed after the session.")}{" "}
                  {isManager
                    ? t("You can still correct it — say why below.")
                    : t("Ask a manager to correct it.")}
                </p>
              ) : null}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums"
                  aria-live="polite"
                >
                  {RESULTS.map((r) => (
                    <span key={r.v} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className={cn("size-2.5 rounded-full", r.dot)} />
                      {t(r.l)} <b>{att.filter((u) => marks[u.id] === r.v).length}</b>
                    </span>
                  ))}
                  <span className="text-muted">{t("of {n}", { n: att.length })}</span>
                </p>
                {!blocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMarks(Object.fromEntries(att.map((u) => [u.id, "present"])))}
                  >
                    {t("Mark everyone present")}
                  </Button>
                ) : null}
              </div>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-line">
                  {att.map((u) => (
                    <li
                      key={u.id}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {f4 ? (
                            <Link
                              to="/coach/student/$id"
                              params={{ id: u.id }}
                              className="underline-offset-4 hover:underline"
                            >
                              {u.full_name}
                            </Link>
                          ) : (
                            u.full_name
                          )}
                          <span className="ml-2 text-xs font-normal text-muted">
                            {u.member_code}
                          </span>
                        </p>
                        {u.health_notes ? (
                          <p className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-danger">
                            {tData(u.health_notes)}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-4 gap-1 sm:w-[26rem]">
                        {RESULTS.map((r) => {
                          const on = marks[u.id] === r.v;
                          return (
                            <button
                              key={r.v}
                              type="button"
                              disabled={blocked}
                              aria-pressed={on}
                              onClick={() => setMarks((m) => ({ ...m, [u.id]: r.v }))}
                              className={cn(
                                "inline-flex min-h-11 items-center justify-center gap-1 rounded-[var(--radius-sm)] border px-1 text-xs transition-colors duration-150 active:scale-95 disabled:opacity-60",
                                on ? cn(r.on, "font-bold shadow-sm") : cn(r.off, "font-medium"),
                              )}
                            >
                              <r.Icon
                                aria-hidden
                                className={cn("hidden size-3.5 shrink-0 sm:block", on && "ai-pop")}
                              />
                              <span className="truncate">{t(r.l)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
              {locked && isManager ? (
                <div className="mt-3 max-w-md">
                  <Field label={t("Reason for the correction")}>
                    <Input
                      value={reason}
                      maxLength={300}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
              <div className="sticky bottom-24 z-10 mt-4 md:bottom-4">
                <Button
                  size="lg"
                  className="w-full shadow-[var(--shadow-soft)]"
                  disabled={
                    blocked || (locked && reason.trim().length < 3) || meta?.status === "cancelled"
                  }
                  onClick={saveRegister}
                >
                  {justSaved ? <CheckDraw key="saved" className="size-5" /> : null}
                  {justSaved ? t("Saved") : locked ? t("Save correction") : t("Save register")}
                </Button>
              </div>
            </div>
          ) : null}

          {open && current === "register" && !att.length ? (
            <p className="text-sm text-muted">
              {t("Nobody is enrolled in this session yet, so there is no register to take.")}
            </p>
          ) : null}

          {open && f4 && current === "results" ? (
            <ResultsPanel sessionId={open.id} cancelled={open.status === "cancelled"} />
          ) : null}
          {open && f4 && current === "plan" ? (
            <PlanPanel session={open} f5={flags.F5 !== false} />
          ) : null}
          {open && f4 && current === "homework" ? <HomeworkPanel classId={open.class_id} /> : null}
        </div>
      )}
    </Shell>
  );
}
