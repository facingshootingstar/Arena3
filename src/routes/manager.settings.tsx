import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { apiGet, apiPatch } from "@/lib/arena3/client";

export const Route = createFileRoute("/manager/settings")({
  component: Page,
});

const FLAG_META: { key: string; label: string; hint: string }[] = [
  { key: "F4", label: "Điểm danh & giáo án", hint: "HLV điểm danh buổi, giao bài tập." },
  { key: "F5", label: "Gợi ý giáo án", hint: "Mẫu bài tập theo môn — HLV phải duyệt." },
  { key: "F6", label: "Trợ lý thành viên", hint: "Hỏi đáp Gemini, neo lịch/gói/HLV trong app." },
  { key: "SMS", label: "SMS (outbox)", hint: "Ghi log, chưa gắn nhà mạng." },
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
      <Shell role="manager" title="Cấu hình trung tâm">
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
    <Shell role="manager" title="Cấu hình trung tâm" subtitle="Áp dụng cho giao dịch mới trong vòng 1 phút.">
      <h2 className="mb-3 font-display text-2xl">Tính năng</h2>
      <div className="mb-6 grid gap-2 md:grid-cols-2">
        {FLAG_META.map((fl) => (
          <Card key={fl.key} className="flex items-center justify-between gap-3 p-4">
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
                  toast.success(next ? `Đã bật ${fl.key}` : `Đã tắt ${fl.key}`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Lỗi");
                }
              }}
              className={`h-8 w-14 rounded-full p-1 transition-colors ${flags[fl.key] ? "bg-accent" : "bg-wood"}`}
              aria-pressed={!!flags[fl.key]}
              aria-label={fl.label}
            >
              <span
                className={`block size-6 rounded-full bg-surface shadow transition-transform ${
                  flags[fl.key] ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </Card>
        ))}
      </div>
      <Card className="grid gap-3 md:grid-cols-2">
        {f("legal_name", "Tên pháp lý")}
        {f("address", "Địa chỉ")}
        {f("tax_code", "MST")}
        {f("hold_minutes", "TTL hold (phút)")}
        {f("book_ahead_days", "Đặt trước (ngày)")}
        {f("cancel_court_hours", "Hủy sân (giờ)")}
        {f("debt_limit_vnd", "Trần nợ")}
        {f("freeze_max_days_year", "Trần đóng băng (ngày/năm)")}
        {f("waitlist_offer_hours", "Thời hạn mời waitlist (giờ)")}
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
                toast.success("Đã lưu — áp dụng giao dịch mới");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Lỗi");
              }
            }}
          >
            Lưu
          </Button>
        </div>
      </Card>
    </Shell>
  );
}
