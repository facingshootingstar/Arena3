import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell, money } from "@/components/shell";
import { Button, Card, Input } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";
import { apiGet, apiPut } from "@/lib/arena3/client";
import { DAY_KIND_LABEL, sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/manager/prices")({
  component: Page,
});

type Rule = {
  id: string;
  sport: string;
  day_kind: string;
  start_local: string;
  end_local: string;
  price_vnd: number;
  is_peak: boolean;
  court_id: string | null;
};

function Page() {
  const [items, setItems] = useState<Rule[]>([]);
  async function load() {
    setItems((await apiGet<{ items: Rule[] }>("/price-rules")).items);
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  return (
    <Shell role="manager" title="Court pricing" subtitle="A new price only applies to new transactions — bookings already confirmed keep theirs.">
      <Stagger className="grid gap-2" gap={0.04}>
        {items.map((r, i) => (
          <StaggerItem key={r.id}>
          <Card className="grid grid-cols-2 items-center gap-2 p-3 md:grid-cols-6">
            <span className="text-sm font-medium">{sportLabel(r.sport)}</span>
            <span className="text-sm text-muted">{DAY_KIND_LABEL[r.day_kind] ?? r.day_kind}</span>
            <span className="text-sm tabular-nums">
              {r.start_local.slice(0, 5)}–{r.end_local.slice(0, 5)}
            </span>
            <span className="text-sm">{r.is_peak ? "Peak" : "Off-peak"}</span>
            <Input
              type="number"
              value={r.price_vnd}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...r, price_vnd: Number(e.target.value) };
                setItems(next);
              }}
            />
            <span className="text-right text-sm tabular-nums">{money(r.price_vnd)}</span>
          </Card>
          </StaggerItem>
        ))}
      </Stagger>
      <Button
        className="mt-4"
        onClick={async () => {
          try {
            await apiPut("/price-rules", { items });
            toast.success("Pricing saved");
            await load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Something went wrong");
          }
        }}
      >
        Save new prices
      </Button>
    </Shell>
  );
}
