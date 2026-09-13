import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, MediaCaption, sportPhoto } from "@/components/media";
import { Shell, money } from "@/components/shell";
import { Button, Card, Empty, Skeleton } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { sportLabel } from "@/lib/arena3/labels";

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
  const [items, setItems] = useState<Plan[] | null>(null);
  useEffect(() => {
    void apiGet<{ items: Plan[] }>("/plans")
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(e.message));
  }, []);

  return (
    <Shell role="member" title="Gói thành viên" subtitle="Thanh toán tại quầy sau khi đặt mua — hạn mới hiện trước khi chốt.">
      {!items ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden p-0">
              <Cover src={sportPhoto(p.sport_scope)} alt="" scrim="none" className="h-36">
                <MediaCaption>
                  <p className="text-2xs uppercase tracking-wider">{sportLabel(p.sport_scope)}</p>
                </MediaCaption>
              </Cover>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-2xl">{p.name}</h2>
                <p className="mt-3 font-display text-3xl tabular-nums">{money(p.price_vnd)}</p>
                <ul className="mt-4 grid gap-2 text-sm text-muted">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-accent" strokeWidth={1.75} />
                    {p.duration_days ? `${p.duration_days} ngày` : "Theo buổi"}
                  </li>
                  {p.session_quota ? (
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-accent" strokeWidth={1.75} />
                      {p.session_quota} buổi lớp
                    </li>
                  ) : null}
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-accent" strokeWidth={1.75} />
                    {p.court_hours} giờ thuê sân
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-accent" strokeWidth={1.75} />
                    Giảm {p.court_discount_pct}% giá sân
                  </li>
                </ul>
                <Button
                  className="mt-5"
                  onClick={async () => {
                    try {
                      const res = await apiPost<{ preview_end: string; renewal?: boolean }>("/subscriptions", {
                        plan_id: p.id,
                      });
                      toast.success(
                        res.renewal
                          ? `Gia hạn đến ${res.preview_end} — thanh toán tại quầy`
                          : `Đơn pending, hạn mới ${res.preview_end} — thanh toán tại quầy`,
                      );
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Lỗi");
                    }
                  }}
                >
                  Mua / gia hạn
                </Button>
              </div>
            </Card>
          ))}
          {!items.length ? <Empty title="Chưa có gói đang bán" /> : null}
        </div>
      )}
    </Shell>
  );
}
