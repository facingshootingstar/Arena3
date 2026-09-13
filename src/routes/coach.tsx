import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, sportPhoto } from "@/components/media";
import { Guard, Shell, hhmm } from "@/components/shell";
import { Badge, Button, Card, Empty, Field, Select, Skeleton } from "@/components/ui";
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
  { v: "present", l: "Có mặt" },
  { v: "late", l: "Muộn" },
  { v: "absent", l: "Vắng" },
  { v: "excused", l: "Phép" },
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
  }>({ sport: "badminton", level: "beginner", goal: "kỹ thuật nền", payload: null });

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
      toast.error(e instanceof Error ? e.message : "Lỗi");
    }
  }

  return (
    <Shell role="coach" title="Lịch dạy" subtitle="Điểm danh F4 · gợi ý giáo án F5 — HLV duyệt trước khi giao.">
      {!items ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((s) => (
            <button key={s.id} type="button" className="text-left" onClick={() => void openSession(s)}>
              <Card className={open?.id === s.id ? "overflow-hidden p-0 ring-2 ring-accent/40" : "overflow-hidden p-0"}>
                <Cover src={sportPhoto(s.sport)} alt="" className="h-28">
                  <div className="absolute bottom-3 left-4">
                    <Badge tone="accent" className="bg-surface text-fg">
                      {sportLabel(s.sport)}
                    </Badge>
                  </div>
                </Cover>
                <div className="p-5">
                  <h2 className="font-display text-2xl">{levelLabel(s.level)}</h2>
                  <p className="text-sm text-muted">
                    {hhmm(s.start_at)}–{hhmm(s.end_at)} · {s.court_code}
                  </p>
                  <p className="tabular-nums text-sm">
                    {s.enrolled_count}/{s.capacity} học viên
                  </p>
                </div>
              </Card>
            </button>
          ))}
          {!items.length ? <Empty title="Chưa có buổi dạy sắp tới" /> : null}
        </div>
      )}
      {open && att.length ? (
        <div className="mt-8">
          <h2 className="font-display text-2xl">Điểm danh · {levelLabel(open.level)}</h2>
          <div className="mt-3 grid gap-2">
            {att.map((u) => (
              <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted">{u.member_code}</p>
                  {u.health_notes ? <p className="mt-1 text-sm text-danger">{u.health_notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {RESULTS.map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [u.id]: r.v }))}
                      className={`min-h-9 rounded-[var(--radius-sm)] px-2 text-xs font-medium ${
                        marks[u.id] === r.v ? "bg-fg text-bg" : "bg-wood text-muted"
                      }`}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <Button
            className="mt-4"
            onClick={async () => {
              try {
                await apiPost(`/sessions/${open.id}/attendance`, {
                  items: Object.entries(marks).map(([user_id, result]) => ({ user_id, result })),
                });
                toast.success("Đã lưu điểm danh");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "F4 đang tắt");
              }
            }}
          >
            Lưu điểm danh
          </Button>
        </div>
      ) : null}

      {flags.F5 !== false ? (
        <div className="mt-10">
          <h2 className="font-display text-2xl">Gợi ý giáo án</h2>
          <p className="mt-1 text-sm text-muted">AI chỉ đề xuất. Bấm xuất bản để học viên thấy trên mục Tập.</p>
          <Card className="mt-3 grid gap-3 md:grid-cols-4">
            <Field label="Môn">
              <Select
                value={suggest.sport}
                onChange={(e) => setSuggest({ ...suggest, sport: e.target.value })}
              >
                <option value="badminton">Cầu lông</option>
                <option value="basketball">Bóng rổ</option>
                <option value="volleyball">Bóng chuyền</option>
              </Select>
            </Field>
            <Field label="Trình độ">
              <Select
                value={suggest.level}
                onChange={(e) => setSuggest({ ...suggest, level: e.target.value })}
              >
                <option value="beginner">Mới</option>
                <option value="intermediate">Trung bình</option>
                <option value="advanced">Nâng cao</option>
              </Select>
            </Field>
            <Field label="Mục tiêu">
              <Select value={suggest.goal} onChange={(e) => setSuggest({ ...suggest, goal: e.target.value })}>
                <option value="kỹ thuật nền">Kỹ thuật nền</option>
                <option value="thể lực">Thể lực</option>
                <option value="thi đấu">Thi đấu</option>
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
                    toast.error(e instanceof Error ? e.message : "F5 đang tắt");
                  }
                }}
              >
                Gợi ý
              </Button>
            </div>
          </Card>
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
                    toast.success("Đã giao giáo án");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                Xuất bản cho lớp
              </Button>
            </Card>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}
