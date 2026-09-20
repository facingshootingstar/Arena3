import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell, money, when } from "@/components/shell";
import { Button, Card, Skeleton, StatusBadge } from "@/components/ui";
import { Lift, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SplitText, SpotlightCard } from "@/components/fx";
import { apiGet, apiPost, openInvoice } from "@/lib/arena3/client";
import { formatDate, sportLabel } from "@/lib/arena3/labels";

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
      <Shell role="receptionist" title="Member">
        <Skeleton className="h-40" />
      </Shell>
    );
  }

  return (
    <Shell role="receptionist" title={data.user.full_name} subtitle={`${data.user.member_code} · ${data.user.phone}`}>
      <p className="mb-4 text-sm">
        Outstanding balance <span className="tabular-nums font-medium">{money(data.debt_vnd)}</span>
      </p>
      <Stagger className="grid gap-3 md:grid-cols-2" gap={0.07}>
        {data.subscriptions.map((s) => (
          <StaggerItem key={s.id} className="h-full">
          <Lift className="h-full">
          <SpotlightCard className="h-full rounded-[var(--radius-xl)]" size={320} strength={0.1}>
          <Card interactive className="relative z-[2] h-full">
            <StatusBadge status={s.status} />
            <h2 className="mt-2 font-display text-2xl">{s.plan_name}</h2>
            <p className="text-sm text-muted">
              {sportLabel(s.sport_scope)} · through {formatDate(s.end_on)} · {Number(s.court_hours_left)} court hours
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
                    toast.success("Payment recorded");
                    await load();
                    if (res.invoice?.id) await openInvoice(res.invoice.id);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Something went wrong");
                  }
                }}
              >
                Take payment
              </Button>
            ) : null}
            {s.status === "active" ? (
              <Button
                className="mt-2"
                variant="outline"
                onClick={async () => {
                  try {
                    await apiPost(`/subscriptions/${s.id}/freeze`, { days: 7 });
                    toast.success("Frozen for 7 days — the end date moves out to match");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not freeze the plan");
                  }
                }}
              >
                Freeze for 7 days
              </Button>
            ) : null}
            {s.status === "frozen" ? (
              <Button
                className="mt-3"
                onClick={async () => {
                  try {
                    await apiPost(`/subscriptions/${s.id}/unfreeze`);
                    toast.success("Plan resumed");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Something went wrong");
                  }
                }}
              >
                Resume plan
              </Button>
            ) : null}
          </Card>
          </SpotlightCard>
          </Lift>
          </StaggerItem>
        ))}
      </Stagger>

      <SplitText as="h2" text="Sell another plan" className="mt-8 font-display text-2xl" />
      <Reveal className="mt-3 flex flex-wrap gap-2">
        {plans.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            onClick={async () => {
              try {
                await apiPost("/subscriptions", { plan_id: p.id, user_id: id });
                toast.success("Order created — take payment to activate");
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            {p.name} · {money(p.price_vnd)}
          </Button>
        ))}
      </Reveal>

      <SplitText as="h2" text="Today" className="mt-8 font-display text-2xl" />
      <Stagger className="mt-3 grid gap-2" gap={0.05}>
        {data.today.bookings.map((b) => (
          <StaggerItem key={b.id}>
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">
                {b.court_code} · {when(b.start_at)}
              </p>
              <p className="text-xs text-subtle">
                {b.code} · {b.status === "confirmed" ? "Confirmed" : b.status}
              </p>
            </div>
            {b.status === "confirmed" ? (
              <Button
                onClick={async () => {
                  try {
                    await apiPost(`/bookings/${b.id}/check-in`);
                    toast.success("Checked in — on court");
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Something went wrong");
                  }
                }}
              >
                Check-in
              </Button>
            ) : (
              <StatusBadge status={b.status} />
            )}
          </Card>
          </StaggerItem>
        ))}
        {!data.today.bookings.length ? (
          <p className="text-sm text-muted">No bookings today.</p>
        ) : null}
      </Stagger>
    </Shell>
  );
}
