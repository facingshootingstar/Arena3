import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, sportPhoto } from "@/components/media";
import { Guard, Shell, hhmm } from "@/components/shell";
import { Badge, Button, Card, Empty, Field, Select, Skeleton } from "@/components/ui";
import { Lift, Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import { GlareHover, SplitText, SpotlightCard } from "@/components/fx";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { levelLabel, sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/coach")({
  component: () => (
    <Guard roles={["coach", "manager"]}>
      <Page />
    </Guard>
  ),
});

type SessionRow = {
  id: string;
  start_at: string;
  end_at: string;
  level: string;
  sport: string;
  court_code: string;
  enrolled_count: number;
  capacity: number;
  class_id: string;
  status: string;
};

type AttRow = {
  id: string;
  full_name: string;
  member_code: string | null;
  health_notes: string | null;
  result: string | null;
};

const RESULTS = [
  { v: "present", l: "Present" },
  { v: "late", l: "Late" },
  { v: "absent", l: "Absent" },
  { v: "excused", l: "Excused" },
];

function Page() {
  const [items, setItems] = useState<SessionRow[] | null>(null);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<SessionRow | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [suggest, setSuggest] = useState<{
    sport: string;
    level: string;
    goal: string;
    payload: { blocks?: Array<{ title: string; minutes: number }>; note?: string; goal?: string } | null;
  }>({ sport: "badminton", level: "beginner", goal: "core technique", payload: null });

  useEffect(() => {
    void apiGet<{ items: SessionRow[] }>("/coach/schedule")
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(e.message));
    void apiGet<{ flags: Record<string, boolean> }>("/flags")
      .then((r) => setFlags(r.flags))
      .catch(() => undefined);
  }, []);

  async function openSession(s: SessionRow) {
    setOpen(s);
    setSuggest((g) => ({ ...g, sport: s.sport, level: s.level }));
    try {
      if (flags.F4 !== false) {
        const r = await apiGet<{ items: AttRow[] }>(`/sessions/${s.id}/attendance`);
        setAtt(r.items);
        setMarks(Object.fromEntries(r.items.map((u) => [u.id, u.result ?? "present"])));
      } else {
        const r = await apiGet<{ items: AttRow[] }>(`/classes/${s.class_id}/roster`);
        setAtt(r.items);
        setMarks({});
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <Shell role="coach" title="Teaching" subtitle="Take the register, then review an AI session plan before you hand it to the class.">
      {!items ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : (
        <Stagger className="grid gap-3 md:grid-cols-2" gap={0.07}>
          {items.map((s) => (
            <StaggerItem key={s.id}>
            <button type="button" className="w-full text-left" onClick={() => void openSession(s)}>
              <Lift>
              <SpotlightCard className="rounded-[var(--radius-xl)]" size={320} strength={0.11}>
              <Card interactive
                className={open?.id === s.id ? "relative z-[2] overflow-hidden p-0 ring-2 ring-accent/40" : "relative z-[2] overflow-hidden p-0"}>
                <GlareHover>
                  <Cover src={sportPhoto(s.sport)} alt="" className="h-28">
                    <div className="absolute bottom-3 left-4">
                      <Badge tone="accent" className="bg-surface text-fg">
                        {sportLabel(s.sport)}
                      </Badge>
                    </div>
                  </Cover>
                </GlareHover>
                <div className="p-5">
                  <h2 className="font-display text-2xl">{levelLabel(s.level)}</h2>
                  <p className="text-sm text-muted">
                    {hhmm(s.start_at)}–{hhmm(s.end_at)} · {s.court_code}
                  </p>
                  <p className="tabular-nums text-sm">
                    {s.enrolled_count}/{s.capacity} students
                  </p>
                </div>
              </Card>
              </SpotlightCard>
              </Lift>
            </button>
            </StaggerItem>
          ))}
          {!items.length ? <Empty title="No sessions coming up" /> : null}
        </Stagger>
      )}
      {open && att.length ? (
        <div className="mt-8">
          <SplitText as="h2" text={`Register · ${levelLabel(open.level)}`} className="font-display text-2xl" />
          <Stagger className="mt-3 grid gap-2" gap={0.04}>
            {att.map((u) => (
              <StaggerItem key={u.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted">{u.member_code}</p>
                  {u.health_notes ? (
                    <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-danger">{u.health_notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {RESULTS.map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [u.id]: r.v }))}
                      className={`relative min-h-9 rounded-[var(--radius-sm)] px-2 text-xs font-medium transition-colors duration-200 active:scale-95 ${
                        marks[u.id] === r.v ? "text-bg" : "bg-wood text-muted hover:bg-wood/70"
                      }`}
                    >
                      {marks[u.id] === r.v ? (
                        <motion.span
                          layoutId={`att-${u.id}`}
                          className="absolute inset-0 rounded-[var(--radius-sm)] bg-fg"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      ) : null}
                      <span className="relative">{r.l}</span>
                    </button>
                  ))}
                </div>
              </Card>
              </StaggerItem>
            ))}
          </Stagger>
          <Button
            className="mt-4"
            onClick={async () => {
              try {
                await apiPost(`/sessions/${open.id}/attendance`, {
                  items: Object.entries(marks).map(([user_id, result]) => ({ user_id, result })),
                });
                toast.success("Register saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Attendance is switched off (flag F4)");
              }
            }}
          >
            Save register
          </Button>
        </div>
      ) : null}

      {flags.F5 !== false ? (
        <div className="mt-10">
          <SplitText as="h2" text="Session plan" className="font-display text-2xl" />
          <p className="mt-1 text-sm text-muted">The AI only suggests. Publish it and your students see it under Train.</p>
          <Reveal><Card className="mt-3 grid gap-3 md:grid-cols-4">
            <Field label="Sport">
              <Select
                value={suggest.sport}
                onChange={(e) => setSuggest({ ...suggest, sport: e.target.value })}
              >
                <option value="badminton">Badminton</option>
                <option value="basketball">Basketball</option>
                <option value="volleyball">Volleyball</option>
              </Select>
            </Field>
            <Field label="Level">
              <Select
                value={suggest.level}
                onChange={(e) => setSuggest({ ...suggest, level: e.target.value })}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field label="Focus">
              <Select value={suggest.goal} onChange={(e) => setSuggest({ ...suggest, goal: e.target.value })}>
                <option value="core technique">Core technique</option>
                <option value="conditioning">Conditioning</option>
                <option value="match play">Match play</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await apiPost<{ payload: NonNullable<typeof suggest.payload> }>(
                      "/training-plans/suggest",
                      { sport: suggest.sport, level: suggest.level, goal: suggest.goal },
                    );
                    setSuggest((s) => ({ ...s, payload: r.payload }));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Plan suggestions are switched off (flag F5)");
                  }
                }}
              >
                Suggest a plan
              </Button>
            </div>
          </Card></Reveal>
          {suggest.payload ? (
            <Card className="mt-3">
              <ol className="grid gap-1 text-sm">
                {(suggest.payload.blocks ?? []).map((b, i) => (
                  <li key={i}>
                    {i + 1}. {b.title} <span className="tabular-nums text-muted">{b.minutes}′</span>
                  </li>
                ))}
              </ol>
              <Button
                className="mt-4"
                onClick={async () => {
                  try {
                    await apiPost("/training-plans", {
                      scope: open ? "class" : "center",
                      class_id: open?.class_id,
                      source: "ai",
                      published: true,
                      payload: { ...suggest.payload, goal: suggest.goal },
                    });
                    toast.success("Plan published to the class");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Something went wrong");
                  }
                }}
              >
                Publish to the class
              </Button>
            </Card>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}
