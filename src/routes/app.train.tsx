import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Card, Empty, Skeleton } from "@/components/ui";
import { Stagger, StaggerItem, motion } from "@/components/motion";
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
    <Shell role="member" title="Train" subtitle="Your coach hands these out. AI only suggests — a coach approves before it reaches you.">
      {!items ? (
        <Skeleton className="h-40" />
      ) : items.length ? (
        <Stagger className="grid gap-3 md:grid-cols-2" gap={0.07}>
          {items.map((p) => (
            <StaggerItem key={p.id} className="h-full">
            <Card interactive className="h-full">
              <p className="text-2xs uppercase tracking-wider text-muted">
                {p.source === "ai" ? "AI draft, coach-approved" : "Written by your coach"} · {p.scope}
              </p>
              {p.payload.goal ? <h2 className="mt-2 font-display text-2xl">{p.payload.goal}</h2> : null}
              <ol className="mt-3 grid gap-1 text-sm">
                {(p.payload.blocks ?? []).map((b, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {i + 1}. {b.title} <span className="tabular-nums text-muted">{b.minutes}′</span>
                  </motion.li>
                ))}
              </ol>
              {p.payload.note ? <p className="mt-3 text-xs text-muted">{p.payload.note}</p> : null}
            </Card>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Empty title="No session plans yet" hint="Your coach assigns these after a class." />
      )}
    </Shell>
  );
}
