import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell, money } from "@/components/shell";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { Lift, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SplitText, SpotlightCard } from "@/components/fx";
import { apiGet, apiPost } from "@/lib/arena3/client";
import { sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/desk/gear")({ component: Page });

type Item = { id: string; sku: string; name: string; sport: string | null; stock: number; rent_vnd: number };
type Loan = { id: string; name: string; sku: string; phone: string; qty: number; due_at: string };

function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState({ item_id: "", phone: "0901230101", qty: "1" });

  async function load() {
    const [eq, ln] = await Promise.all([
      apiGet<{ items: Item[] }>("/equipment"),
      apiGet<{ items: Loan[] }>("/equipment/loans"),
    ]);
    setItems(eq.items);
    setLoans(ln.items);
    if (!form.item_id && eq.items[0]) setForm((f) => ({ ...f, item_id: eq.items[0]!.id }));
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell role="receptionist" title="Gear" subtitle="Rent against a phone number — stock comes down on the way out, back up on return.">
      <Reveal from="down">
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <Field label="Item">
          <Select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.stock} left · {money(i.rent_vnd)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Guest phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Qty">
          <Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button
            className="w-full"
            onClick={async () => {
              try {
                const r = await apiPost<{ rent_vnd: number }>("/equipment/loans", {
                  item_id: form.item_id,
                  phone: form.phone,
                  qty: Number(form.qty),
                });
                toast.success(`Rented out · ${money(r.rent_vnd)}`);
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            Rent out
          </Button>
        </div>
      </Card>
      </Reveal>
      <Stagger className="grid gap-3 md:grid-cols-2" gap={0.05}>
        {items.map((i) => (
          <StaggerItem key={i.id} className="h-full">
          <Lift className="h-full">
          <SpotlightCard className="h-full rounded-[var(--radius-xl)]" size={280} strength={0.1}>
          <Card interactive className="relative z-[2] h-full p-4">
            <p className="text-2xs uppercase tracking-wider text-muted">{i.sport ? sportLabel(i.sport) : "General"}</p>
            <p className="font-medium">{i.name}</p>
            <p className="text-sm text-muted">
              {i.stock} in stock · {money(i.rent_vnd)} each
            </p>
          </Card>
          </SpotlightCard>
          </Lift>
          </StaggerItem>
        ))}
      </Stagger>
      <SplitText as="h2" text="Out on loan" className="mt-8 font-display text-2xl" />
      <Stagger className="mt-3 grid gap-2" gap={0.05}>
        {loans.map((l) => (
          <StaggerItem key={l.id}>
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">
                {l.name} × {l.qty}
              </p>
              <p className="text-xs text-muted">{l.phone}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await apiPost(`/equipment/loans/${l.id}/return`);
                  toast.success("Returned");
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Something went wrong");
                }
              }}
            >
              Take it back
            </Button>
          </Card>
          </StaggerItem>
        ))}
        {!loans.length ? <p className="text-sm text-muted">Nothing is out right now.</p> : null}
      </Stagger>
    </Shell>
  );
}
