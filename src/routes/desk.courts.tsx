import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CourtGrid, DateStrip, sportLabel, type Court, type OccSlot } from "@/components/court-grid";
import { Shell, money } from "@/components/shell";
import { Button, Card, DateField, Field, Input, Select, Seg, Skeleton } from "@/components/ui";
import { apiGet, apiPost, openInvoice } from "@/lib/arena3/client";
import { todayISO } from "@/lib/arena3/labels";

export const Route = createFileRoute("/desk/courts")({
  component: Page,
});

function Page() {
  const [date, setDate] = useState(todayISO);
  const [sport, setSport] = useState("");
  const [mode, setMode] = useState("walkin");
  const [data, setData] = useState<{ courts: Court[]; slots: OccSlot[] } | null>(null);
  const [pick, setPick] = useState<{ court: Court; hour: number } | null>(null);
  const [form, setForm] = useState({ guest_name: "", guest_phone: "", method: "cash" });

  async function load() {
    setData(await apiGet(`/occupancy?date=${date}`));
  }
  useEffect(() => {
    setData(null);
    void load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function isoAt(hour: number) {
    return `${date}T${String(hour).padStart(2, "0")}:00:00+07:00`;
  }

  return (
    <Shell
      role="receptionist"
      title="Sơ đồ sân"
      subtitle="Khách vãng lai thu tại chỗ. Gộp tạm BR và BC khi cả hai sân trống."
    >
      <div className="mb-4 grid gap-3">
        <DateStrip value={date} onChange={setDate} />
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { value: "walkin", label: "Khách vãng lai" },
              { value: "convert", label: "Gộp tạm BR và BC" },
            ]}
          />
          <Seg
            value={sport}
            onChange={setSport}
            options={[
              { value: "", label: "Tất cả" },
              { value: "badminton", label: "Cầu lông" },
              { value: "basketball", label: "Bóng rổ" },
              { value: "volleyball", label: "Bóng chuyền" },
            ]}
          />
          <DateField value={date} onChange={setDate} />
        </div>
      </div>
      {pick && mode === "walkin" ? (
        <Card className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-4">
            <p className="text-sm text-muted">
              Khách vãng lai {pick.court.court_code} · {sportLabel(pick.court.sport)} · {String(pick.hour).padStart(2, "0")}
              :00
            </p>
          </div>
          <Field label="Họ tên">
            <Input
              value={form.guest_name}
              onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              placeholder="Tên khách"
            />
          </Field>
          <Field label="SĐT">
            <Input
              value={form.guest_phone}
              onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
              placeholder="0901…"
            />
          </Field>
          <Field label="Thanh toán">
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button
              onClick={async () => {
                try {
                  const res = await apiPost<{ payment: { amount_vnd: number; code: string }; invoice_id: string }>(
                    "/walk-in",
                    { court_id: pick.court.id, start_at: isoAt(pick.hour), ...form },
                    true,
                  );
                  toast.success(`Thu ${money(res.payment.amount_vnd)} · ${res.payment.code}`);
                  setPick(null);
                  setForm({ guest_name: "", guest_phone: "", method: "cash" });
                  await load();
                  if (res.invoice_id) await openInvoice(res.invoice_id);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Lỗi");
                }
              }}
            >
              Thu & giữ sân
            </Button>
            <Button variant="ghost" onClick={() => setPick(null)}>
              Hủy
            </Button>
          </div>
        </Card>
      ) : null}
      {pick && mode === "convert" ? (
        <Card className="mb-4">
          <p className="text-sm">
            Gộp tạm {pick.court.court_code} ({sportLabel(pick.court.sport)}) lúc {String(pick.hour).padStart(2, "0")}
            :00 — khóa cả cặp sân 60 phút.
          </p>
          {!pick.court.convertible ? (
            <p className="mt-2 text-sm text-danger">Sân này không gộp được. Chỉ BR-01 ↔ BC-01.</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              disabled={!pick.court.convertible}
              onClick={async () => {
                try {
                  await apiPost(
                    "/convert",
                    {
                      court_id: pick.court.id,
                      start_at: isoAt(pick.hour),
                      end_at: isoAt(pick.hour + 1),
                    },
                    true,
                  );
                  toast.success("Đã gộp cặp sân");
                  setPick(null);
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Không gộp được");
                }
              }}
            >
              Khóa cặp sân
            </Button>
            <Button variant="ghost" onClick={() => setPick(null)}>
              Hủy
            </Button>
          </div>
        </Card>
      ) : null}
      {data ? (
        <CourtGrid
          date={date}
          courts={data.courts}
          slots={data.slots}
          sport={sport || undefined}
          onPick={async (c, h) => {
            const occ = data.slots.find((s) => {
              if (s.court_id !== c.id) return false;
              const start = new Date(`${date}T${String(h).padStart(2, "0")}:00:00+07:00`).getTime();
              const a = new Date(s.start).getTime();
              const b = new Date(s.end).getTime();
              return a < start + 3600000 && b > start;
            });
            if (occ?.kind === "convert" && occ.convert_group_id) {
              try {
                await apiPost(`/convert/${occ.convert_group_id}/release`);
                toast.success("Đã mở lại cặp sân");
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Lỗi");
              }
              return;
            }
            setPick({ court: c, hour: h });
          }}
        />
      ) : (
        <Skeleton className="h-72" />
      )}
    </Shell>
  );
}
