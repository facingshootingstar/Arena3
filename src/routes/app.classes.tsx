import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, MediaCaption, sportPhoto } from "@/components/media";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, Empty, Seg, Skeleton } from "@/components/ui";
import { apiDelete, apiGet, apiPost } from "@/lib/arena3/client";
import { levelLabel, rruleLabel, sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/app/classes")({
  component: Page,
});

type Cl = {
  id: string;
  sport: string;
  level: string;
  capacity: number;
  enrolled_count: number;
  court_code: string;
  coach_name: string;
  rrule: string;
  duration_min: number;
  status: string;
};

type Enr = { id: string; class_id: string; status: string; waitlist_pos: number | null };
type Offer = { id: string; class_id: string; expires_at: string; sport: string; level: string };

function Page() {
  const [items, setItems] = useState<Cl[] | null>(null);
  const [mine, setMine] = useState<Enr[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sport, setSport] = useState("");
  async function load() {
    const [cls, me] = await Promise.all([
      apiGet<{ items: Cl[] }>("/classes"),
      apiGet<{ enrollments: Enr[]; offers: Offer[] }>("/me"),
    ]);
    setItems(cls.items);
    setMine(me.enrollments ?? []);
    setOffers(me.offers ?? []);
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  const shown = (items ?? []).filter((c) => !sport || c.sport === sport);
  const byClass = Object.fromEntries(mine.map((e) => [e.class_id, e]));

  return (
    <Shell role="member" title="Lớp học" subtitle="Ghi danh theo môn. Hết chỗ thì vào danh sách chờ FIFO.">
      {offers.length ? (
        <Card className="mb-4 border border-hold/30 bg-hold/5">
          <p className="text-sm font-medium">Có chỗ từ danh sách chờ</p>
          {offers.map((o) => (
            <div key={o.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {sportLabel(o.sport)} · {levelLabel(o.level)} — nhận trước{" "}
                {new Date(o.expires_at).toLocaleTimeString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await apiPost(`/waitlist/${o.id}/accept`);
                    toast.success("Đã nhận chỗ");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Hết hạn nhận chỗ");
                  }
                }}
              >
                Nhận chỗ
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
      <div className="mb-4">
        <Seg
          value={sport}
          onChange={setSport}
          options={[
            { value: "", label: "Tất cả" },
            { value: "badminton", label: "Cầu lông" },
            { value: "basketball", label: "Bóng rổ" },
            { value: "volleyball", label: "Bóng chuyền" },
          ]}
        />
      </div>
      {!items ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => {
            const full = c.enrolled_count >= c.capacity;
            const pct = Math.min(100, Math.round((c.enrolled_count / Math.max(1, c.capacity)) * 100));
            const enr = byClass[c.id];
            return (
              <Card key={c.id} className="flex flex-col overflow-hidden p-0">
                <Cover src={sportPhoto(c.sport)} alt="" scrim="none" className="h-36">
                  <MediaCaption className="flex items-end justify-between">
                    <Badge tone="accent" className="bg-surface text-fg">
                      {sportLabel(c.sport)}
                    </Badge>
                    <p className="tabular-nums text-sm">{c.enrolled_count}/{c.capacity}</p>
                  </MediaCaption>
                </Cover>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-2xl">{levelLabel(c.level)}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {c.coach_name} · {c.court_code} · {c.duration_min}′
                  </p>
                  <p className="text-sm">{rruleLabel(c.rrule)}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-wood">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  {enr?.status === "confirmed" ? (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await apiDelete(`/enrollments/${enr.id}`);
                          toast.success("Đã hủy ghi danh");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Không hủy được");
                        }
                      }}
                    >
                      Hủy ghi danh
                    </Button>
                  ) : enr?.status === "waitlisted" ? (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await apiDelete(`/enrollments/${enr.id}`);
                          toast.success("Đã rời danh sách chờ");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Lỗi");
                        }
                      }}
                    >
                      Đang chờ #{enr.waitlist_pos ?? "—"} · Rời
                    </Button>
                  ) : (
                    <Button
                      className="mt-4"
                      variant={full ? "outline" : "primary"}
                      onClick={async () => {
                        try {
                          const r = await apiPost<{ waitlisted?: boolean }>(`/classes/${c.id}/enroll`, {});
                          toast.success(r.waitlisted ? "Đã vào danh sách chờ" : "Đã ghi danh");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Không ghi danh được");
                        }
                      }}
                    >
                      {full ? "Vào danh sách chờ" : "Ghi danh"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {!shown.length ? <Empty title="Chưa có lớp mở" hint="Quản lý sẽ xuất bản lớp theo tuần." /> : null}
        </div>
      )}
    </Shell>
  );
}
