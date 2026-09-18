import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import { apiGet, apiPatch } from "@/lib/arena3/client";

export const Route = createFileRoute("/manager/settings")({
  component: Page,
});

const FLAG_META: { key: string; label: string; hint: string }[] = [
  { key: "F4", label: "Register & session plans", hint: "Coaches take attendance and hand out drills." },
  { key: "F5", label: "Plan suggestions", hint: "Drill templates per sport — a coach still has to approve." },
  { key: "F6", label: "Member assistant", hint: "Gemini Q&A, grounded in the timetable, plans and coaches." },
  { key: "SMS", label: "SMS (outbox)", hint: "Logged only — no carrier is wired up yet." },
];

function Page() {
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void apiGet<Record<string, unknown>>("/settings")
      .then(setS)
      .catch((e) => toast.error(e.message));
    void apiGet<{ flags: Record<string, boolean> }>("/flags")
      .then((r) => setFlags(r.flags))
      .catch(() => undefined);
  }, []);
  if (!s) {
    return (
      <Shell role="manager" title="Centre settings">
        <Skeleton className="h-64" />
      </Shell>
    );
  }
  function f(key: string, label: string) {
    return (
      <Field label={label}>
        <Input value={String(s![key] ?? "")} onChange={(e) => setS({ ...s!, [key]: e.target.value })} />
      </Field>
    );
  }
  return (
    <Shell role="manager" title="Centre settings" subtitle="New transactions pick these up within a minute.">
      <h2 className="mb-3 font-display text-2xl">Features</h2>
      <Stagger className="mb-6 grid gap-2 md:grid-cols-2" gap={0.05}>
        {FLAG_META.map((fl) => (
          <StaggerItem key={fl.key}>
          <Card className="flex h-full items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {fl.key} · {fl.label}
              </p>
              <p className="text-xs text-muted">{fl.hint}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const next = !flags[fl.key];
                try {
                  const r = await apiPatch<{ flags: Record<string, boolean> }>("/flags", { [fl.key]: next });
                  setFlags(r.flags);
                  toast.success(next ? `${fl.key} switched on` : `${fl.key} switched off`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Something went wrong");
                }
              }}
              className={`h-8 w-14 rounded-full p-1 transition-colors ${flags[fl.key] ? "bg-accent" : "bg-wood"}`}
              aria-pressed={!!flags[fl.key]}
              aria-label={fl.label}
            >
              <motion.span
                layout
                className="block size-6 rounded-full bg-surface shadow"
                style={{ marginLeft: flags[fl.key] ? "1.5rem" : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            </button>
          </Card>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal>
      <Card className="grid gap-3 md:grid-cols-2">
        {f("legal_name", "Legal name")}
        {f("address", "Address")}
        {f("tax_code", "Tax code")}
        {f("hold_minutes", "Hold length (minutes)")}
        {f("book_ahead_days", "Book ahead (days)")}
        {f("cancel_court_hours", "Court cancellation window (hours)")}
        {f("debt_limit_vnd", "Debt ceiling (đ)")}
        {f("freeze_max_days_year", "Freeze cap (days per year)")}
        {f("waitlist_offer_hours", "Waitlist offer window (hours)")}
        <div className="md:col-span-2">
          <Button
            onClick={async () => {
              try {
                const body = {
                  legal_name: s.legal_name,
                  address: s.address,
                  tax_code: s.tax_code,
                  hold_minutes: Number(s.hold_minutes),
                  book_ahead_days: Number(s.book_ahead_days),
                  cancel_court_hours: Number(s.cancel_court_hours),
                  debt_limit_vnd: Number(s.debt_limit_vnd),
                  freeze_max_days_year: Number(s.freeze_max_days_year),
                  waitlist_offer_hours: Number(s.waitlist_offer_hours),
                };
                setS(await apiPatch("/settings", body));
                toast.success("Saved — new transactions use these now");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            Save
          </Button>
        </div>
      </Card>
      </Reveal>
    </Shell>
  );
}
