import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cover, sportPhoto } from "@/components/media";
import { Shell, money } from "@/components/shell";
import { Badge, Button, Card, Field, Input, Modal, Select } from "@/components/ui";
import { apiGet, apiPatch, apiPost } from "@/lib/arena3/client";
import { sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/manager/plans")({
  component: Page,
});

type Plan = {
  id: string;
  name: string;
  sport_scope: string;
  price_vnd: number;
  is_on_sale: boolean;
  duration_days: number | null;
  session_quota: number | null;
  court_hours: number;
  court_discount_pct: number;
  carry_over_hours: boolean;
};

const emptyForm = {
  name: "",
  sport_scope: "badminton",
  price_vnd: "800000",
  duration_days: "30",
  session_quota: "",
  court_hours: "2",
  court_discount_pct: "10",
  is_on_sale: true,
  carry_over_hours: false,
};

function Page() {
  const [items, setItems] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setItems((await apiGet<{ items: Plan[] }>("/plans")).items);
  }
  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function create() {
    const price = Number(form.price_vnd);
    if (!form.name.trim() || !Number.isFinite(price)) {
      toast.error("Cần tên gói và giá.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/plans", {
        name: form.name.trim(),
        sport_scope: form.sport_scope,
        price_vnd: Math.round(price),
        duration_days: form.duration_days ? Number(form.duration_days) : null,
        session_quota: form.session_quota ? Number(form.session_quota) : null,
        court_hours: Number(form.court_hours) || 0,
        court_discount_pct: Number(form.court_discount_pct) || 0,
        is_on_sale: form.is_on_sale,
        carry_over_hours: form.carry_over_hours,
      });
      toast.success("Đã tạo gói");
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="manager" title="Gói thành viên" subtitle="Giá gói mới không sửa gói đã bán (BR-65).">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>Tạo gói mới</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id} className="overflow-hidden p-0">
            <Cover src={sportPhoto(p.sport_scope)} alt="" className="h-28">
              <p className="absolute bottom-3 left-4 text-2xs uppercase tracking-wider text-on-media on-media">
                {sportLabel(p.sport_scope)}
              </p>
            </Cover>
            <div className="p-5">
              <Badge tone={p.is_on_sale ? "accent" : "muted"}>{p.is_on_sale ? "Đang bán" : "Ngừng"}</Badge>
              <h2 className="mt-2 font-display text-2xl">{p.name}</h2>
              <p className="mt-2 font-display text-3xl tabular-nums">{money(p.price_vnd)}</p>
              <p className="mt-2 text-sm text-muted">
                {p.duration_days ? `${p.duration_days} ngày` : "Theo buổi"}
                {p.session_quota ? ` · ${p.session_quota} buổi` : ""}
                {` · ${p.court_hours} giờ sân · giảm ${p.court_discount_pct}%`}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={async () => {
                  try {
                    await apiPatch(`/plans/${p.id}`, { is_on_sale: !p.is_on_sale });
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  }
                }}
              >
                {p.is_on_sale ? "Ngừng bán" : "Mở bán"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo gói thành viên"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button disabled={busy} onClick={() => void create()}>
              {busy ? "Đang lưu…" : "Tạo gói"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Tên gói">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bóng rổ 30 ngày"
            />
          </Field>
          <Field label="Môn">
            <Select
              value={form.sport_scope}
              onChange={(e) => setForm({ ...form, sport_scope: e.target.value })}
            >
              <option value="badminton">Cầu lông</option>
              <option value="basketball">Bóng rổ</option>
              <option value="volleyball">Bóng chuyền</option>
              <option value="all">Cả ba môn</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá (đ)">
              <Input
                inputMode="numeric"
                value={form.price_vnd}
                onChange={(e) => setForm({ ...form, price_vnd: e.target.value })}
              />
            </Field>
            <Field label="Số ngày">
              <Input
                inputMode="numeric"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                placeholder="Để trống nếu theo buổi"
              />
            </Field>
            <Field label="Số buổi lớp">
              <Input
                inputMode="numeric"
                value={form.session_quota}
                onChange={(e) => setForm({ ...form, session_quota: e.target.value })}
              />
            </Field>
            <Field label="Giờ sân">
              <Input
                inputMode="numeric"
                value={form.court_hours}
                onChange={(e) => setForm({ ...form, court_hours: e.target.value })}
              />
            </Field>
            <Field label="Giảm giá sân %">
              <Input
                inputMode="numeric"
                value={form.court_discount_pct}
                onChange={(e) => setForm({ ...form, court_discount_pct: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_on_sale}
              onChange={(e) => setForm({ ...form, is_on_sale: e.target.checked })}
            />
            Đăng bán ngay (TV thấy trên app)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.carry_over_hours}
              onChange={(e) => setForm({ ...form, carry_over_hours: e.target.checked })}
            />
            Cộng dồn giờ sân khi gia hạn
          </label>
        </div>
      </Modal>
    </Shell>
  );
}
