import { createFileRoute, Link } from "@tanstack/react-router";
import { Map, MessageCircle, Ticket, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PassCard } from "@/components/media";
import { Shell, hhmm, when } from "@/components/shell";
import { Button, Card, Empty, Skeleton, StatusBadge } from "@/components/ui";
import { apiGet, apiPost, getStoredUser } from "@/lib/arena3/client";
import { formatViDate, levelLabel, sportLabel, todayISO } from "@/lib/arena3/labels";

export const Route = createFileRoute("/app/")({
  component: Page,
});

type Me = {
  user: { full_name: string; member_code: string | null };
  subscriptions: Array<{
    id: string;
    status: string;
    end_on: string;
    plan_name: string;
    court_hours_left: string | number;
    sport_scope: string;
  }>;
  inbox: Array<{ id: string; template: string; payload: unknown; sent_at: string }>;
  offers?: Array<{ id: string; expires_at: string; sport: string; level: string }>;
  enrollments?: Array<{ id: string; status: string; waitlist_pos: number | null; sport: string; level: string }>;
  today: {
    bookings: Array<{
      id: string;
      code: string;
      start_at: string;
      end_at: string;
      status: string;
      court_code: string;
    }>;
    classes: Array<{
      id: string;
      start_at: string;
      end_at: string;
      level: string;
      sport: string;
      court_code: string;
      coach_name: string;
    }>;
  };
};

function Page() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    void apiGet<Me>("/me")
      .then(setMe)
      .catch((e) => toast.error(e.message));
  }, []);
  const u = getStoredUser();
  const live = me?.subscriptions.filter((s) => s.status === "active") ?? [];
  const frozen = me?.subscriptions.filter((s) => s.status === "frozen") ?? [];
  const first = live[0];
  const greet = u?.full_name.split(" ").slice(-1)[0] ?? "";
  const expiring = live.filter((s) => {
    const d = daysUntil(s.end_on);
    return Number.isFinite(d) && d >= 0 && d <= 7;
  });

  const events = [
    ...(me?.today.classes ?? []).map((c) => ({
      id: `c-${c.id}`,
      start: c.start_at,
      kind: "Lớp" as const,
      title: `${sportLabel(c.sport)} · ${c.court_code}`,
      meta: c.coach_name,
      bookingId: null as string | null,
      status: "confirmed",
    })),
    ...(me?.today.bookings ?? []).map((b) => ({
      id: `b-${b.id}`,
      start: b.start_at,
      kind: "Sân" as const,
      title: b.court_code,
      meta: b.code,
      bookingId: b.id,
      status: b.status,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Shell role="member">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Hội viên</p>
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Xin chào, {greet}</h1>
        </div>
        {u?.member_code ? (
          <span className="rounded-[var(--radius-sm)] border border-line bg-surface px-2.5 py-1 font-mono text-xs font-semibold text-muted">
            {u.member_code}
          </span>
        ) : null}
      </div>
      {(me?.offers ?? []).length ? (
        <Card className="mb-4 border border-hold/30 bg-hold/5">
          <p className="text-sm font-medium">Mời vào lớp từ danh sách chờ</p>
          {(me?.offers ?? []).map((o) => (
            <div key={o.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {sportLabel(o.sport)} · {levelLabel(o.level)}
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await apiPost(`/waitlist/${o.id}/accept`);
                    toast.success("Đã nhận chỗ");
                    setMe(await apiGet("/me"));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Hết hạn");
                  }
                }}
              >
                Nhận chỗ
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
      {frozen.length ? (
        <Card className="mb-4">
          <p className="text-sm font-medium">Gói đang đóng băng</p>
          <p className="mt-1 text-sm text-muted">
            {frozen.map((s) => `${s.plan_name} · hạn mới ${formatViDate(s.end_on)}`).join(" · ")} — liên hệ quầy để mở
            lại.
          </p>
        </Card>
      ) : null}
      {expiring.length ? (
        <Card className="mb-4 border border-hold/30 bg-hold/5">
          <p className="text-sm font-medium text-fg">Gói sắp hết hạn</p>
          <p className="mt-1 text-sm text-muted">
            {expiring.map((s) => `${s.plan_name} còn ${daysUntil(s.end_on)} ngày (đến ${formatViDate(s.end_on)})`).join(" · ")}{" "}
            — gia hạn để không mất chỗ lớp.
          </p>
          <Link to="/app/plans" className="mt-3 inline-block">
            <Button size="sm">Gia hạn</Button>
          </Link>
        </Card>
      ) : null}
      {!me ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="order-1">
          {first ? (
            <PassCard
              plan={first.plan_name}
              sport={sportLabel(first.sport_scope)}
              endOn={formatViDate(first.end_on)}
              hours={Number(first.court_hours_left)}
              code={u?.member_code}
            />
          ) : (
            <Empty title="Chưa có gói đang dùng" hint="Mua gói để ghi danh lớp và đặt sân.">
              <Link to="/app/plans">
                <Button>Mua gói</Button>
              </Link>
            </Empty>
          )}
          </div>

          <div className="order-2 md:order-3 md:col-span-2">
      <h2 className="font-display text-lg tracking-tight">Dịch vụ nhanh</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { to: "/app/book" as const, label: "Đặt sân", Icon: Map },
            { to: "/app/classes" as const, label: "Lớp", Icon: Ticket },
            { to: "/app/plans" as const, label: "Gói", Icon: Wallet },
            { to: "/app/assistant" as const, label: "Hỏi AI", Icon: MessageCircle },
          ] as const
        ).map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface px-2 py-4 text-center"
          >
            <span className="mb-2.5 grid size-12 place-items-center rounded-[var(--radius-sm)] bg-wood text-accent">
              <a.Icon className="size-6" strokeWidth={1.75} />
            </span>
            <span className="text-xs font-semibold tracking-tight text-fg">{a.label}</span>
          </Link>
        ))}
      </div>
          </div>

          <div className="order-3 md:order-2">
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-xl">Hôm nay</p>
              <span className="text-xs text-muted">{events.length} phiên đã xếp</span>
            </div>
            {events.length ? (
              <ol className="grid gap-3">
                {events.map((ev) => (
                  <li key={ev.id} className="rounded-[var(--radius-md)] bg-wood/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-2xs font-semibold text-accent-fg">
                        {ev.kind}
                      </span>
                      <StatusBadge status={ev.status} />
                    </div>
                    <p className="mt-2 font-display text-xl tracking-tight">
                      {hhmm(ev.start)} · {ev.title}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted">{ev.meta}</p>
                    {ev.bookingId && (ev.status === "hold" || ev.status === "confirmed") ? (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await apiPost(`/bookings/${ev.bookingId}/cancel`);
                              toast.success("Đã hủy");
                              setMe(await apiGet("/me"));
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Lỗi");
                            }
                          }}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-2">
                <p className="text-sm text-muted">Trống lịch.</p>
                <div className="mt-3 flex gap-2">
                  <Link to="/app/book">
                    <Button size="sm">Đặt sân</Button>
                  </Link>
                  <Link to="/app/classes">
                    <Button size="sm" variant="outline">
                      Ghi danh lớp
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
          </div>
        </div>
      )}

      {live.length > 1 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {live.slice(1).map((s) => (
            <Card key={s.id}>
              <p className="text-2xs uppercase tracking-wider text-muted">{sportLabel(s.sport_scope)}</p>
              <p className="mt-1 font-medium text-fg">{s.plan_name}</p>
              <p className="text-sm text-muted">
                Đến {formatViDate(s.end_on)} · {Number(s.court_hours_left)} giờ sân
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <h2 className="mt-8 font-display text-2xl">Thông báo</h2>
      <div className="mt-3 grid gap-2">
        {(me?.inbox ?? []).slice(0, 8).map((n) => (
          <Card key={n.id} className="p-4">
            <p className="text-sm font-medium text-fg">{inboxLabel(n.template)}</p>
            <p className="text-xs text-muted">{when(n.sent_at)}</p>
          </Card>
        ))}
        {me && !me.inbox.length ? <p className="text-sm text-muted">Chưa có thông báo.</p> : null}
      </div>
    </Shell>
  );
}

function daysUntil(iso: string) {
  const a = Date.parse(`${todayISO()}T00:00:00+07:00`);
  const b = Date.parse(`${iso.slice(0, 10)}T00:00:00+07:00`);
  return Math.round((b - a) / 86400000);
}

function inboxLabel(t: string) {
  return (
    {
      booking_confirmed: "Đã xác nhận đặt sân",
      booking_cancelled: "Đã hủy sân",
      hold_expiring: "Giữ chỗ sắp hết hạn",
      class_changed: "Lịch lớp thay đổi",
      sub_expiring: "Gói sắp hết hạn",
      waitlist_offer: "Có chỗ lớp — nhận trên app",
      payment_receipt: "Phiếu thu",
    } as Record<string, string>
  )[t] ?? t;
}
