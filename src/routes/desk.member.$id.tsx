import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell, money, when } from "@/components/shell";
import { Button, Card, Skeleton, StatusBadge } from "@/components/ui";
import { apiGet, apiPost, openInvoice } from "@/lib/arena3/client";
import { formatViDate, sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/desk/member/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const [data, setData] = useState<{
    user: { full_name: string; phone: string; member_code: string | null };
    debt_vnd: number;
    subscriptions: Array<{
      id: string;
      status: string;
      plan_name: string;
      end_on: string;
      sport_scope: string;
      court_hours_left: number;
      frozen_days?: number;
    }>;
    today: {
      bookings: Array<{ id: string; code: string; start_at: string; status: string; court_code: string }>;
      classes: unknown[];
    };
  } | null>(null);
  const [plans, setPlans] = useState<Array<{ id: string; name: string; price_vnd: number }>>([]);

  async function load() {
    setData(await apiGet(`/members/${id}`));
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    void apiGet<{ items: Array<{ id: string; name: string; price_vnd: number }> }>("/plans").then((r) =>
      setPlans(r.items),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) {
    return (
      <Shell role="receptionist" title="Hồ sơ">
        <Skeleton className="h-40" />
      </Shell>
    );
  }

  return (
    <Shell role="receptionist" title={data.user.full_name} subtitle={`${data.user.member_code} · ${data.user.phone}`}>
      <p className="mb-4 text-sm">
        Công nợ <span className="tabular-nums font-medium">{money(data.debt_vnd)}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {data.subscriptions.map((s) => (
          <Card key={s.id}>
            <StatusBadge status={s.status} />
            <h2 className="mt-2 font-display text-2xl">{s.plan_name}</h2>
            <p className="text-sm text-muted">
              {sportLabel(s.sport_scope)} · đến {formatViDate(s.end_on)} · {Number(s.court_hours_left)} giờ sân
            </p>
            {s.status === "pending" || s.status === "active" ? (
              <Button
                className="mt-3"
                onClick={async () => {
                  const plan = plans.find((p) => p.name === s.plan_name);
                  const amt = plan?.price_vnd ?? 0;
                  try {
                    const res = await apiPost<{ invoice: { id: string } }>(
                      "/payments",
                      { ref_type: "subscription", ref_id: s.id, method: "cash", amount_vnd: amt },
                      true,
                    );
                    toast.success("Đã thu");
                    await load();
                    if (res.invoice?.id) await openInvoice(res.invoice.id);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                Thu tiền gói
              </Button>
            ) : null}
            {s.status === "active" ? (
              <Button
                className="mt-2"
                variant="outline"
                onClick={async () => {
                  try {
                    await apiPost(`/subscriptions/${s.id}/freeze`, { days: 7 });
                    toast.success("Đóng băng 7 ngày — hạn gói được cộng");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Không đóng băng được");
                  }
                }}
              >
                Đóng băng 7 ngày
              </Button>
            ) : null}
            {s.status === "frozen" ? (
              <Button
                className="mt-3"
                onClick={async () => {
                  try {
                    await apiPost(`/subscriptions/${s.id}/unfreeze`);
                    toast.success("Đã mở lại gói");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                Mở lại gói
              </Button>
            ) : null}
          </Card>
        ))}
      </div>

      <h2 className="mt-8 font-display text-2xl">Bán gói mới</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {plans.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            onClick={async () => {
              try {
                await apiPost("/subscriptions", { plan_id: p.id, user_id: id });
                toast.success("Đã tạo đơn pending");
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Lỗi");
              }
            }}
          >
            {p.name} · {money(p.price_vnd)}
          </Button>
        ))}
      </div>

      <h2 className="mt-8 font-display text-2xl">Lịch hôm nay</h2>
      <div className="mt-3 grid gap-2">
        {data.today.bookings.map((b) => (
          <Card key={b.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">
                {b.court_code} · {when(b.start_at)}
              </p>
              <p className="text-xs text-subtle">
                {b.code} · {b.status === "confirmed" ? "Đã chốt" : b.status}
              </p>
            </div>
            {b.status === "confirmed" ? (
              <Button
                onClick={async () => {
                  try {
                    await apiPost(`/bookings/${b.id}/check-in`);
                    toast.success("Đang chơi");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                Check-in
              </Button>
            ) : (
              <StatusBadge status={b.status} />
            )}
          </Card>
        ))}
        {!data.today.bookings.length ? <p className="text-sm text-muted">Không có booking hôm nay.</p> : null}
      </div>
    </Shell>
  );
}
