import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, money } from "@/components/shell";
import { Button, Card, EmptyState, Input, LoadError, Skeleton } from "@/components/ui";
import { apiPost } from "@/lib/arena3/client";
import { sportLabel } from "@/lib/arena3/labels";
import { t, tData } from "@/lib/i18n";
import { useRead } from "@/lib/use-read";

export const Route = createFileRoute("/app/plans")({
  component: Page,
});

type Plan = {
  id: string;
  name: string;
  sport_scope: string;
  duration_days: number | null;
  session_quota: number | null;
  court_hours: number;
  court_discount_pct: number;
  price_vnd: number;
};

function Page() {
  const { data, error, reload } = useRead<{ items: Plan[] }>("/plans");
  const items = data?.items ?? null;
  // Which plan is mid-request. One at a time: the server refuses a second live
  // subscription on the same sport anyway, and letting two buttons spin at once
  // only makes it look as though both worked.
  const [busy, setBusy] = useState<string | null>(null);
  // Plans already ordered this visit. The desk has not taken the money yet, so
  // pressing the button again does nothing useful — say so instead of firing a
  // request the rate limiter will reject.
  const [ordered, setOrdered] = useState<Record<string, string>>({});
  const [promoCode, setPromoCode] = useState("");

  async function order(p: Plan) {
    if (busy) return;
    setBusy(p.id);
    try {
      const res = await apiPost<{
        preview_end: string;
        renewal?: boolean;
        amount_due_vnd: number;
        promo?: { code: string; discount_vnd: number } | null;
      }>("/subscriptions", {
        plan_id: p.id,
        ...(promoCode.trim() ? { promo_code: promoCode.trim() } : {}),
      });
      setOrdered((o) => ({ ...o, [p.id]: res.preview_end }));
      toast.success(
        res.renewal
          ? t("Renewed through {date}, pay at the desk", { date: res.preview_end })
          : t("Order placed, valid through {date}, pay at the desk", { date: res.preview_end }),
        {
          description: res.promo
            ? t("{code} takes {off} off, you pay {total}.", {
                code: res.promo.code,
                off: money(res.promo.discount_vnd),
                total: money(res.amount_due_vnd),
              })
            : t("You pay {total}.", { total: money(res.amount_due_vnd) }),
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell
      role="member"
      title={t("Membership plans")}
      subtitle={t("Order here, pay at the desk, you see the new end date before anything is charged.")}
    >
      {error ? (
        <LoadError message={error.message} onRetry={error.refused ? undefined : reload} />
      ) : !items ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
        <div className="mb-4 flex max-w-sm items-center gap-2">
          <Input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder={t("Promo code (optional)")}
            aria-label={t("Promo code")}
            autoCapitalize="characters"
            maxLength={32}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            // Only what the plan actually gives: "0 court hours" with a tick is not a benefit.
            const perks = [
              p.duration_days ? t("{n} days", { n: p.duration_days }) : t("Per session"),
              p.session_quota ? t("{n} class sessions", { n: p.session_quota }) : null,
              p.court_hours > 0 ? t("{n} court hours", { n: p.court_hours }) : null,
              p.court_discount_pct > 0 ? t("{n}% off court rental", { n: p.court_discount_pct }) : null,
            ].filter((x): x is string => Boolean(x));
            return (
              <Card key={p.id} className="flex h-full flex-col">
                <p className="text-xs font-medium text-muted">{sportLabel(p.sport_scope)}</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{tData(p.name)}</h2>
                  <p className="shrink-0 text-xl font-bold tabular-nums tracking-tight">{money(p.price_vnd)}</p>
                </div>
                <ul className="mt-4 grid gap-2 text-sm text-muted">
                  {perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-accent" strokeWidth={2} />
                      {perk}
                    </li>
                  ))}
                </ul>
                {/* Pinned to the bottom of the card, so buttons line up across a row. */}
                <div className="mt-auto pt-5">
                  <Button
                    className="w-full"
                    disabled={busy !== null || ordered[p.id] !== undefined}
                    onClick={() => void order(p)}
                  >
                    {busy === p.id
                      ? t("Placing order…")
                      : ordered[p.id]
                        ? t("Ordered, pay at the desk")
                        : t("Buy or renew")}
                  </Button>
                  {ordered[p.id] ? (
                    <p className="mt-2 text-center text-xs text-muted">{t("Valid through {date}", { date: ordered[p.id] })}</p>
                  ) : null}
                </div>
              </Card>
            );
          })}
          {!items.length ? <EmptyState title={t("No plans on sale right now")} /> : null}
        </div>
        </>
      )}
    </Shell>
  );
}
