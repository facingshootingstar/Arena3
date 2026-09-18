import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, MediaCaption, sportPhoto } from "@/components/media";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, Empty, Seg, Skeleton } from "@/components/ui";
import { Stagger, StaggerItem, motion } from "@/components/motion";
import { cn } from "@/lib/cn";
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
    <Shell role="member" title="Classes" subtitle="Enrol by sport. When a class is full you join a first-come waitlist.">
      {offers.length ? (
        <Card className="mb-4 border border-hold/30 bg-hold/5">
          <p className="text-sm font-medium">A waitlist seat opened up</p>
          {offers.map((o) => (
            <div key={o.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {sportLabel(o.sport)} · {levelLabel(o.level)} — claim before{" "}
                {new Date(o.expires_at).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await apiPost(`/waitlist/${o.id}/accept`);
                    toast.success("Seat claimed");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "This offer has expired");
                  }
                }}
              >
                Claim seat
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
            { value: "", label: "All" },
            { value: "badminton", label: "Badminton" },
            { value: "basketball", label: "Basketball" },
            { value: "volleyball", label: "Volleyball" },
          ]}
        />
      </div>
      {!items ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <Stagger className="grid gap-3 md:grid-cols-2" gap={0.07}>
          {shown.map((c) => {
            const full = c.enrolled_count >= c.capacity;
            const pct = Math.min(100, Math.round((c.enrolled_count / Math.max(1, c.capacity)) * 100));
            const enr = byClass[c.id];
            return (
              <StaggerItem key={c.id} className="h-full">
              <Card interactive className="flex h-full flex-col overflow-hidden p-0">
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
                    <motion.div
                      className={cn("h-full rounded-full", full ? "bg-hold" : "bg-accent")}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  {enr?.status === "confirmed" ? (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await apiDelete(`/enrollments/${enr.id}`);
                          toast.success("Enrolment cancelled");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not cancel");
                        }
                      }}
                    >
                      Leave this class
                    </Button>
                  ) : enr?.status === "waitlisted" ? (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await apiDelete(`/enrollments/${enr.id}`);
                          toast.success("Left the waitlist");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Something went wrong");
                        }
                      }}
                    >
                      Waitlisted #{enr.waitlist_pos ?? "—"} · Leave
                    </Button>
                  ) : (
                    <Button
                      className="mt-4"
                      variant={full ? "outline" : "primary"}
                      onClick={async () => {
                        try {
                          const r = await apiPost<{ waitlisted?: boolean }>(`/classes/${c.id}/enroll`, {});
                          toast.success(r.waitlisted ? "Added to the waitlist" : "You are enrolled");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not enrol");
                        }
                      }}
                    >
                      {full ? "Join the waitlist" : "Enrol"}
                    </Button>
                  )}
                </div>
              </Card>
              </StaggerItem>
            );
          })}
          {!shown.length ? (
            <Empty title="No open classes" hint="The manager publishes the weekly timetable." />
          ) : null}
        </Stagger>
      )}
    </Shell>
  );
}
