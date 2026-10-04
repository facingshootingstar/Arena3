import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, DateField, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { SplitText } from "@/components/fx";
import { hhmm } from "@/components/shell";
import { sessionDay } from "@/components/class-detail";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/arena3/client";
import { addDaysISO, formatDate } from "@/lib/arena3/labels";

type Msg = (e: unknown) => string;
const say: Msg = (e) => (e instanceof Error ? e.message : "Something went wrong");

export type TrainingSession = {
  id: string;
  class_id: string;
  start_at: string;
  sport: string;
  level: string;
  status: string;
};

const METRICS = [
  { key: "smash_count", label: "Smashes", hint: "count" },
  { key: "freethrow_pct", label: "Free throws %", hint: "0–100" },
  { key: "serve_pct", label: "Serves in %", hint: "0–100" },
] as const;

const PHASES = ["warm-up", "technique", "fitness", "match", "cool-down"] as const;

/* ------------------------------------------------------------------ *
 * Results — plan completion and numbers per student (FR-TRN-05)        *
 * ------------------------------------------------------------------ */

type ResultRow = {
  user_id: string;
  full_name: string;
  member_code: string | null;
  attendance: string | null;
  plan_pct: number | null;
  metrics: Record<string, number> | null;
  note: string | null;
};

type Draft = { pct: string; note: string } & Record<string, string>;

function toDraft(r: ResultRow): Draft {
  const d: Draft = { pct: r.plan_pct == null ? "" : String(r.plan_pct), note: r.note ?? "" };
  for (const m of METRICS) d[m.key] = r.metrics?.[m.key] == null ? "" : String(r.metrics[m.key]);
  return d;
}

export function ResultsPanel({ sessionId, cancelled }: { sessionId: string; cancelled: boolean }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ items: ResultRow[] }>(`/sessions/${sessionId}/results`);
      setRows(r.items);
      setDraft(Object.fromEntries(r.items.map((x) => [x.user_id, toDraft(x)])));
    } catch (e) {
      toast.error(say(e));
      setRows([]);
    }
  }, [sessionId]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const items = (rows ?? []).map((r) => {
        const d = draft[r.user_id]!;
        const metrics: Record<string, number> = {};
        for (const m of METRICS) if (d[m.key] !== "") metrics[m.key] = Number(d[m.key]);
        return {
          user_id: r.user_id,
          plan_pct: d.pct === "" ? null : Number(d.pct),
          metrics,
          note: d.note,
        };
      });
      const res = await apiPut<{ items: ResultRow[] }>(`/sessions/${sessionId}/results`, { items });
      setRows(res.items);
      setDraft(Object.fromEntries(res.items.map((x) => [x.user_id, toDraft(x)])));
      toast.success("Results saved");
    } catch (e) {
      toast.error(say(e));
    } finally {
      setSaving(false);
    }
  }

  const set = (id: string, k: string, v: string) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id]!, [k]: v } as Draft }));

  return (
    <div className="mt-10">
      <SplitText as="h2" text="Results" className="font-display text-2xl" />
      <p className="mt-1 text-sm text-muted">
        How much of the plan each student got through, and any numbers worth tracking. Leave a row blank to record nothing.
      </p>
      {!rows ? (
        <Skeleton className="mt-3 h-24" />
      ) : cancelled ? (
        <p className="mt-3 text-sm text-muted">This session was cancelled, so there is nothing to record.</p>
      ) : !rows.length ? (
        <p className="mt-3 text-sm text-muted">Nobody is enrolled in this class yet.</p>
      ) : (
        <>
          <div className="mt-3 grid gap-2">
            {rows.map((r) => {
              const d = draft[r.user_id];
              if (!d) return null;
              return (
                <Card key={r.user_id} className="grid gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.full_name} <span className="text-xs text-muted">{r.member_code}</span>
                    </p>
                    {r.attendance ? <Badge tone={r.attendance === "absent" ? "danger" : "muted"}>{r.attendance}</Badge> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Field label="Plan done %">
                      <Input
                        inputMode="numeric"
                        placeholder="0–100"
                        value={d.pct}
                        onChange={(e) => set(r.user_id, "pct", e.target.value)}
                      />
                    </Field>
                    {METRICS.map((m) => (
                      <Field key={m.key} label={m.label}>
                        <Input
                          inputMode="numeric"
                          placeholder={m.hint}
                          value={d[m.key]}
                          onChange={(e) => set(r.user_id, m.key, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label="Note">
                    <Input
                      maxLength={1000}
                      placeholder="What stood out today"
                      value={d.note}
                      onChange={(e) => set(r.user_id, "note", e.target.value)}
                    />
                  </Field>
                </Card>
              );
            })}
          </div>
          <Button className="mt-4" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save results"}
          </Button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Plans — build, publish, copy last week (FR-TRN-04)                   *
 * Blocks carry intensity, a description, equipment and a target so a   *
 * plan can be run by someone other than its author (BR-74). A published *
 * plan that changes keeps its earlier versions (BR-75).                *
 * ------------------------------------------------------------------ */

type Block = {
  title: string;
  minutes: string;
  phase: string;
  intensity: string;
  description: string;
  equipment: string;
  target: string;
};
type PlanBlock = {
  title: string;
  minutes: number;
  phase?: string;
  intensity?: string;
  description?: string;
  equipment?: string;
  target?: string;
};
type PlanPayload = {
  blocks?: PlanBlock[];
  note?: string;
  goal?: string;
  sport?: string;
  level?: string;
};
type PlanRow = {
  id: string;
  title: string | null;
  published: boolean;
  source: string;
  version?: number;
  session_id: string | null;
  session_start: string | null;
  payload: PlanPayload;
};
type Template = { id: string; title: string | null; payload: PlanPayload };
type Version = { version: number; title: string | null; payload: PlanPayload; created_at: string };
type PlanWarning = { message: string };

const INTENSITIES = ["light", "medium", "hard"] as const;
const MAX_BLOCKS = 12;

const blank = (): Block => ({
  title: "",
  minutes: "10",
  phase: "technique",
  intensity: "medium",
  description: "",
  equipment: "",
  target: "",
});

const fromPlanBlocks = (list: PlanBlock[] | undefined): Block[] =>
  list?.length
    ? list.map((b) => ({
        title: b.title.replace(/\s*\d+\s*[′']$/, ""),
        minutes: String(b.minutes),
        phase: b.phase ?? "",
        intensity: b.intensity ?? "",
        description: b.description ?? "",
        equipment: b.equipment ?? "",
        target: b.target ?? "",
      }))
    : [blank()];

/** Only what the coach filled in goes to the server — empty strings would fail its checks. */
const toPlanBlocks = (list: Block[]): PlanBlock[] =>
  list.map((b) => ({
    title: b.title,
    minutes: Number(b.minutes),
    ...(b.phase ? { phase: b.phase } : {}),
    ...(b.intensity ? { intensity: b.intensity } : {}),
    ...(b.description.trim() ? { description: b.description.trim() } : {}),
    ...(b.equipment.trim() ? { equipment: b.equipment.trim() } : {}),
    ...(b.target.trim() ? { target: b.target.trim() } : {}),
  }));

const planMinutes = (list: Block[]) => list.reduce((n, b) => n + (Number.isFinite(Number(b.minutes)) ? Number(b.minutes) : 0), 0);

/** Monday of the week before the one holding `iso` (the centre's calendar). */
function lastWeekMonday(iso: string) {
  const day = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return addDaysISO(day, -((dow + 6) % 7) - 7);
}

export function PlanPanel({ session, f5 }: { session: TrainingSession; f5: boolean }) {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([blank()]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState("core technique");
  const [busy, setBusy] = useState(false);
  // The plan being changed. Its payload is carried so goal / sport / level survive an edit.
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [history, setHistory] = useState<{ plan: PlanRow; items: Version[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ items: PlanRow[] }>(`/training-plans?class_id=${session.class_id}`);
      setPlans(r.items);
    } catch (e) {
      toast.error(say(e));
      setPlans([]);
    }
  }, [session.class_id]);

  useEffect(() => {
    setPlans(null);
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ items: Template[] }>(`/training-plans/templates?sport=${session.sport}&level=${session.level}`)
      .then((r) => setTemplates(r.items))
      .catch(() => setTemplates([]));
  }, [session.sport, session.level]);

  function reset() {
    setBlocks([blank()]);
    setTitle("");
    setNote("");
    setEditing(null);
    setTemplateId("");
    setOpen({ 0: true });
  }

  function warn(warnings: PlanWarning[] | undefined) {
    for (const w of warnings ?? []) toast.warning(w.message);
  }

  async function suggest() {
    try {
      const r = await apiPost<{ payload: PlanPayload }>("/training-plans/suggest", {
        sport: session.sport,
        level: session.level,
        goal: focus,
      });
      // The suggestion writes its length into the title ("Net shots 10′"); the minutes box already says it.
      const next = fromPlanBlocks(r.payload.blocks);
      if (r.payload.blocks?.length) setBlocks(next);
      toast.success("Suggestion added. Edit anything before you publish.");
    } catch (e) {
      toast.error(say(e));
    }
  }

  async function loadTemplate() {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setBlocks(fromPlanBlocks(t.payload.blocks));
    if (!title && t.title) setTitle(t.title);
    if (!note && t.payload.note) setNote(t.payload.note);
    setEditing(null);
    toast.success("Template loaded. Change anything, then save or publish.");
  }

  async function submit(published: boolean) {
    setBusy(true);
    try {
      const payload = {
        ...(editing?.payload ?? {}),
        goal: title || editing?.payload.goal || focus,
        note,
        blocks: toPlanBlocks(blocks),
      };
      if (editing) {
        const r = await apiPatch<{ warnings?: PlanWarning[] }>(`/training-plans/${editing.id}`, {
          title,
          payload,
          published,
        });
        toast.success(published ? "Plan updated for the class" : "Draft updated");
        warn(r.warnings);
      } else {
        const r = await apiPost<{ warnings?: PlanWarning[] }>("/training-plans", {
          class_id: session.class_id,
          session_id: session.id,
          title,
          published,
          source: "coach",
          payload,
        });
        toast.success(published ? "Plan published to the class" : "Draft saved");
        warn(r.warnings);
      }
      reset();
      await load();
    } catch (e) {
      toast.error(say(e));
    } finally {
      setBusy(false);
    }
  }

  function edit(p: PlanRow) {
    setEditing(p);
    setTitle(p.title ?? "");
    setNote(p.payload.note ?? "");
    setBlocks(fromPlanBlocks(p.payload.blocks));
    setOpen({ 0: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(p: PlanRow) {
    try {
      await apiPatch(`/training-plans/${p.id}`, { published: !p.published });
      setPlans((l) => l?.map((x) => (x.id === p.id ? { ...x, published: !p.published } : x)) ?? l);
    } catch (e) {
      toast.error(say(e));
    }
  }

  async function saveTemplate(p: PlanRow) {
    try {
      await apiPost(`/training-plans/${p.id}/save-template`, {
        title: p.title ?? undefined,
        sport: p.payload.sport ?? session.sport,
        level: p.payload.level ?? session.level,
      });
      toast.success("Saved as a template for this sport and level");
      const r = await apiGet<{ items: Template[] }>(`/training-plans/templates?sport=${session.sport}&level=${session.level}`);
      setTemplates(r.items);
    } catch (e) {
      toast.error(say(e));
    }
  }

  async function showHistory(p: PlanRow) {
    if (history?.plan.id === p.id) {
      setHistory(null);
      return;
    }
    try {
      const r = await apiGet<{ items: Version[] }>(`/training-plans/${p.id}/versions`);
      setHistory({ plan: p, items: r.items });
    } catch (e) {
      toast.error(say(e));
    }
  }

  async function copyLastWeek() {
    try {
      const r = await apiPost<{ copied: number; skipped: unknown[] }>(
        `/classes/${session.class_id}/plans/duplicate-week`,
        { from: lastWeekMonday(session.start_at) },
      );
      toast.success(
        r.copied
          ? `Copied ${r.copied} plan${r.copied === 1 ? "" : "s"} as drafts${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}.`
          : r.skipped.length
            ? `Nothing copied — ${r.skipped.length} session${r.skipped.length === 1 ? "" : "s"} already planned, past or missing.`
            : "Last week had no plans to copy.",
      );
      await load();
    } catch (e) {
      toast.error(say(e));
    }
  }

  const setBlock = (i: number, patch: Partial<Block>) =>
    setBlocks((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, by: -1 | 1) =>
    setBlocks((l) => {
      const j = i + by;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <div className="mt-10">
      <SplitText as="h2" text="Session plan" className="font-display text-2xl" />
      <p className="mt-1 text-sm text-muted">
        Plan this session block by block — what to do, how hard, with what, and what good looks like.{" "}
        {f5 ? "The AI only suggests — you decide what students see. " : ""}
        Published plans appear under My progress for everyone in the class.
      </p>
      <Reveal>
        <Card className="mt-3 grid gap-4">
          {editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-hold/10 px-3 py-2 text-sm">
              <span>
                Editing “{editing.title || "plan"}”
                {editing.published ? " — students will be told it changed and the old version is kept." : "."}
              </span>
              <Button size="sm" variant="ghost" onClick={reset}>
                Cancel edit
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <Input maxLength={120} placeholder="Footwork and net play" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {f5 ? (
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <Field label="Focus">
                  <Select value={focus} onChange={(e) => setFocus(e.target.value)}>
                    <option value="core technique">Core technique</option>
                    <option value="conditioning">Conditioning</option>
                    <option value="match play">Match play</option>
                  </Select>
                </Field>
                <Button variant="outline" onClick={suggest}>
                  Suggest
                </Button>
              </div>
            ) : null}
          </div>

          {templates.length && !editing ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-2 md:max-w-md">
              <Field label="Start from a template">
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Choose…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || "Untitled template"} · {(t.payload.blocks ?? []).length === 1 ? "1 block" : `${(t.payload.blocks ?? []).length} blocks`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="outline" disabled={!templateId} onClick={() => void loadTemplate()}>
                Use
              </Button>
            </div>
          ) : null}

          <div className="grid gap-2">
            {blocks.map((b, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-line p-3">
                <div className="grid grid-cols-[1fr_5rem] gap-2 md:grid-cols-[1fr_8rem_7rem_5rem]">
                  <Input
                    aria-label={`Block ${i + 1} title`}
                    maxLength={120}
                    placeholder={`Block ${i + 1}`}
                    value={b.title}
                    onChange={(e) => setBlock(i, { title: e.target.value })}
                  />
                  <Input
                    aria-label={`Block ${i + 1} minutes`}
                    inputMode="numeric"
                    className="md:order-4"
                    value={b.minutes}
                    onChange={(e) => setBlock(i, { minutes: e.target.value })}
                  />
                  <Select
                    aria-label={`Block ${i + 1} phase`}
                    className="md:order-2"
                    value={b.phase}
                    onChange={(e) => setBlock(i, { phase: e.target.value })}
                  >
                    <option value="">Phase</option>
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Block ${i + 1} intensity`}
                    className="md:order-3"
                    value={b.intensity}
                    onChange={(e) => setBlock(i, { intensity: e.target.value })}
                  >
                    <option value="">Intensity</option>
                    {INTENSITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                {open[i] ? (
                  <div className="grid gap-2">
                    <Textarea
                      rows={2}
                      maxLength={600}
                      aria-label={`Block ${i + 1} description`}
                      placeholder="How it runs: drill set-up, reps, rotation…"
                      value={b.description}
                      onChange={(e) => setBlock(i, { description: e.target.value })}
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        aria-label={`Block ${i + 1} equipment`}
                        maxLength={200}
                        placeholder="Equipment: shuttles, cones, ladder…"
                        value={b.equipment}
                        onChange={(e) => setBlock(i, { equipment: e.target.value })}
                      />
                      <Input
                        aria-label={`Block ${i + 1} target`}
                        maxLength={200}
                        placeholder="Target: 8 of 10 clears past the line…"
                        value={b.target}
                        onChange={(e) => setBlock(i, { target: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
                    {open[i] ? "Hide details" : "Details"}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move block ${i + 1} up`}>
                    Up
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={i === blocks.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move block ${i + 1} down`}
                  >
                    Down
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={blocks.length === 1}
                    onClick={() => setBlocks((l) => l.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" disabled={blocks.length >= MAX_BLOCKS} onClick={() => setBlocks((l) => [...l, blank()])}>
                Add block
              </Button>
              <span className="text-xs text-muted">
                {blocks.length} of {MAX_BLOCKS} blocks · {planMinutes(blocks)} min in total
              </span>
            </div>
          </div>

          <Field label="Note for students">
            <Input maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || session.status === "cancelled"} onClick={() => submit(true)}>
              {editing ? "Save and publish" : "Publish to the class"}
            </Button>
            <Button variant="outline" disabled={busy || session.status === "cancelled"} onClick={() => submit(false)}>
              {editing ? "Save as draft" : "Save as draft"}
            </Button>
            {!editing ? (
              <Button variant="ghost" onClick={copyLastWeek}>
                Copy plans from last week
              </Button>
            ) : null}
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid gap-2">
        {!plans ? (
          <Skeleton className="h-16" />
        ) : !plans.length ? (
          <EmptyState title="No plans for this class yet" hint="Build one above, or copy last week's." />
        ) : (
          plans.map((p) => (
            <Card key={p.id} className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.title || (p.payload.blocks?.[0]?.title ?? "Plan")}</p>
                  <p className="text-xs text-muted">
                    {p.session_start ? `${sessionDay(p.session_start)} · ${hhmm(p.session_start)}` : "Whole class"} ·{" "}
                    {(p.payload.blocks ?? []).length === 1 ? "1 block" : `${(p.payload.blocks ?? []).length} blocks`} ·{" "}
                    {(p.payload.blocks ?? []).reduce((n, b) => n + b.minutes, 0)} min
                    {p.version && p.version > 1 ? ` · v${p.version}` : ""}
                    {p.source === "ai" ? " · AI draft" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.published ? "accent" : "muted"}>{p.published ? "Published" : "Draft"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => edit(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(p)}>
                    {p.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void saveTemplate(p)}>
                    Save as template
                  </Button>
                  {p.version && p.version > 1 ? (
                    <Button size="sm" variant="ghost" onClick={() => void showHistory(p)}>
                      {history?.plan.id === p.id ? "Hide history" : "History"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {history?.plan.id === p.id ? (
                <ul className="grid gap-1 border-t border-line pt-2 text-xs text-muted">
                  {history.items.map((v) => (
                    <li key={v.version}>
                      v{v.version} · {formatDate(v.created_at)} · {(v.payload.blocks ?? []).length === 1 ? "1 block" : `${(v.payload.blocks ?? []).length} blocks`},{" "}
                      {(v.payload.blocks ?? []).reduce((n, b) => n + b.minutes, 0)} min
                      {v.title ? ` · ${v.title}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Homework (FR-TRN-07)                                                 *
 * ------------------------------------------------------------------ */

type HwRow = {
  id: string;
  title: string;
  due_on: string | null;
  checklist: string[];
  recipients: number;
  completed: number;
  student_name: string | null;
};

export function HomeworkPanel({ classId }: { classId: string }) {
  const [items, setItems] = useState<HwRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lines, setLines] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ items: HwRow[] }>(`/homework?class_id=${classId}`);
      setItems(r.items);
    } catch (e) {
      toast.error(say(e));
      setItems([]);
    }
  }, [classId]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  async function assign() {
    setBusy(true);
    try {
      const r = await apiPost<{ recipients: number }>("/homework", {
        class_id: classId,
        title,
        body,
        due_on: due || null,
        checklist: lines
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      });
      toast.success(`Homework sent to ${r.recipients} student${r.recipients === 1 ? "" : "s"}`);
      setTitle("");
      setBody("");
      setLines("");
      setDue("");
      await load();
    } catch (e) {
      toast.error(say(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10">
      <SplitText as="h2" text="Homework" className="font-display text-2xl" />
      <p className="mt-1 text-sm text-muted">Something to practise before the next class. Students tick items off as they go.</p>
      <Card className="mt-3 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
          <Field label="Title">
            <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Due">
            <DateField aria-label="Due date" value={due} onChange={setDue} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Checklist" hint="One item per line, up to 20." tone="muted">
          <Textarea rows={3} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"50 wall shots\n10 minutes of footwork"} />
        </Field>
        <div>
          <Button onClick={assign} disabled={busy || !title.trim()}>
            Assign to the class
          </Button>
        </div>
      </Card>
      <div className="mt-3 grid gap-2">
        {!items ? (
          <Skeleton className="h-16" />
        ) : (
          items.map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{h.title}</p>
                <p className="text-xs text-muted">
                  {h.due_on ? `Due ${formatDate(h.due_on)}` : "No due date"} · {h.checklist.length} item
                  {h.checklist.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={h.completed === h.recipients ? "accent" : "muted"}>
                {h.completed}/{h.recipients} done
              </Badge>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
