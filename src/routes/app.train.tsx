import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Card, Empty, Skeleton } from "@/components/ui";
import { apiGet } from "@/lib/arena3/client";

export const Route = createFileRoute("/app/train")({ component: Page });

type Plan = {
  id: string;
  scope: string;
  source: string;
  payload: { goal?: string; blocks?: Array<{ title: string; minutes: number }>; note?: string };
};

function Page() {
  const [items, setItems] = useState<Plan[] | null>(null);
  useEffect(() => {
    void apiGet<{ items: Plan[] }>("/training-plans?mine=1")
      .then((r) => setItems(r.items))
      .catch((e) => {
        toast.error(e.message);
        setItems([]);
      });
  }, []);

  return (
    <Shell role="member" title="Giáo án của tôi" subtitle="F4 — HLV giao bài; AI chỉ gợi ý sau khi HLV duyệt.">
      {!items ? (
        <Skeleton className="h-40" />
      ) : items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id}>
              <p className="text-2xs uppercase tracking-wider text-muted">
                {p.source === "ai" ? "Gợi ý đã duyệt" : "HLV soạn"} · {p.scope}
              </p>
              {p.payload.goal ? <h2 className="mt-2 font-display text-2xl">{p.payload.goal}</h2> : null}
              <ol className="mt-3 grid gap-1 text-sm">
                {(p.payload.blocks ?? []).map((b, i) => (
                  <li key={i}>
                    {i + 1}. {b.title}{" "}
                    <span className="tabular-nums text-muted">{b.minutes}′</span>
                  </li>
                ))}
              </ol>
              {p.payload.note ? <p className="mt-3 text-xs text-muted">{p.payload.note}</p> : null}
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="Chưa có giáo án" hint="HLV sẽ giao bài sau buổi điểm danh." />
      )}
    </Shell>
  );
}
