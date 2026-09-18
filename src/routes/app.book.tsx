import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CourtGrid, DateStrip, type Court, type OccSlot } from "@/components/court-grid";
import { Cover, HoldTimer, MediaCaption, media, sportPhoto } from "@/components/media";
import { Shell, money } from "@/components/shell";
import { Button, Card, DateField, Seg, Skeleton } from "@/components/ui";
import { apiGet, apiPost, ApiClientError } from "@/lib/arena3/client";
import { todayISO, sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/app/book")({
  component: Page,
});

type Hold = {
  booking: { id: string; code: string; hold_until?: string };
  price: number;
  hold_until: string;
};

function Page() {
  const [date, setDate] = useState(todayISO);
  const [sport, setSport] = useState("badminton");
  const [data, setData] = useState<{ courts: Court[]; slots: OccSlot[] } | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [overlap, setOverlap] = useState<{ court: Court; hour: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(d = date) {
    const occ = await apiGet<{ courts: Court[]; slots: OccSlot[] }>(`/occupancy?date=${d}`);
    setData(occ);
  }
  useEffect(() => {
    setData(null);
    void load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function holdSlot(court: Court, hour: number, confirmOverlap = false) {
    const start = `${date}T${String(hour).padStart(2, "0")}:00:00+07:00`;
    setBusy(true);
    try {
      const res = await apiPost<Hold>(
        "/bookings",
        { court_id: court.id, start_at: start, ...(confirmOverlap ? { confirm_overlap: true } : {}) },
        true,
      );
      setHold(res);
      setOverlap(null);
      toast.success(`Holding ${court.court_code} · ${res.booking.code}`);
      await load();
    } catch (e) {
      if (e instanceof ApiClientError && e.body.requires_confirm && !confirmOverlap) {
        setOverlap({ court, hour, message: e.body.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not hold that slot");
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmPay(method: "quota" | "transfer") {
    if (!hold) return;
    setBusy(true);
    try {
      await apiPost(`/bookings/${hold.booking.id}/confirm`, { method }, true);
      toast.success(method === "quota" ? "One plan hour deducted" : "Booking confirmed");
      setHold(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm the booking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      role="member"
      title="Book a court"
      subtitle="Pick a date and sport, then tap a free slot — we hold it for five minutes."
    >
      <Cover
        src={sport ? sportPhoto(sport) : media.hallCourts}
        alt=""
        scrim="none"
        className="mb-4 h-36 rounded-[var(--radius-xl)] md:h-44"
      >
        <MediaCaption>
          <p className="font-display text-2xl">
            {sport ? sportLabel(sport) : "All 3 sports"} · 60′ slots
          </p>
        </MediaCaption>
      </Cover>
      <div className="mb-4 grid gap-3">
        <DateStrip value={date} onChange={setDate} />
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            value={sport}
            onChange={setSport}
            options={[
              { value: "", label: "All" },
              { value: "badminton", label: sportLabel("badminton") },
              { value: "basketball", label: sportLabel("basketball") },
              { value: "volleyball", label: sportLabel("volleyball") },
            ]}
          />
          <DateField value={date} onChange={setDate} aria-label="Pick another date" />
        </div>
      </div>
      <AnimatePresence>
        {overlap ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="mb-4 border border-hold/30 bg-hold/5">
              <p className="text-sm">{overlap.message}</p>
              <p className="mt-1 text-xs text-muted">
                Your class enrolment stays put — this is only a clash warning.
              </p>
              <div className="mt-3 flex gap-2">
                <Button disabled={busy} onClick={() => void holdSlot(overlap.court, overlap.hour, true)}>
                  Hold it anyway
                </Button>
                <Button variant="outline" onClick={() => setOverlap(null)}>
                  Never mind
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {hold ? (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-accent/30">
              <div>
                <p className="text-sm text-muted">
                  On hold ·{" "}
                  <HoldTimer until={hold.hold_until} onExpire={() => setHold(null)} /> left
                </p>
                <p className="font-display text-2xl tabular-nums">{money(hold.price)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void confirmPay("quota")}>
                  Use plan hours
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void confirmPay("transfer")}>
                  Bank transfer
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {data ? (
        <CourtGrid
          date={date}
          courts={data.courts}
          slots={data.slots}
          sport={sport || undefined}
          onPick={(c, h) => void holdSlot(c, h)}
        />
      ) : (
        <div className="grid gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-72" />
        </div>
      )}
    </Shell>
  );
}
