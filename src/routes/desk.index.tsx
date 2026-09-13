import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell, money } from "@/components/shell";
import { Badge, Button, Card, Field, Input, Modal, Select, StatusBadge } from "@/components/ui";
import { apiGet, apiPost, openInvoice } from "@/lib/arena3/client";
import { sportLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/desk/")({
  component: Page,
});

type Hit = {
  id: string;
  full_name: string;
  phone: string;
  member_code: string | null;
  status: string;
};

type Plan = {
  id: string;
  name: string;
  sport_scope: string;
  price_vnd: number;
  duration_days: number | null;
  court_hours: number;
};

function Page() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Hit[]>([]);
  const [shift, setShift] = useState<{ shift: { id: string; opened_at: string }; totals?: { cash: number } } | null>(
    null,
  );
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [closeOpen, setCloseOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [tickets, setTickets] = useState<
    Array<{ id: string; body: string; full_name: string | null; phone: string | null; created_at: string }>
  >([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [newUser, setNewUser] = useState<{ id: string; full_name: string; member_code?: string | null } | null>(null);
  const [picked, setPicked] = useState<Plan | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);

  async function loadShift() {
    try {
      setShift(await apiGet("/shifts/current"));
    } catch {
      setShift(null);
    }
  }
  useEffect(() => {
    void loadShift();
    void apiGet<{ items: typeof tickets }>("/tickets")
      .then((r) => setTickets(r.items))
      .catch(() => undefined);
    void apiGet<{ items: Plan[] }>("/plans")
      .then((r) => setPlans(r.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (q.trim().length < 3) {
      setItems([]);
      return;
    }
    const t = setTimeout(() => {
      void apiGet<{ items: Hit[] }>(`/members?q=${encodeURIComponent(q)}`)
        .then((r) => setItems(r.items))
        .catch((e) => toast.error(e.message));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function resetWizard() {
    setStep(1);
    setNewUser(null);
    setPicked(null);
    setForm({ full_name: "", phone: "" });
    setMethod("cash");
    setSubId(null);
  }

  return (
    <Shell role="receptionist" title="Quầy lễ tân" subtitle="Tìm hội viên, bán gói, thu — ba thao tác.">
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-3 shadow-[var(--shadow-border)]">
        {shift ? (
          <Badge tone="accent">Ca mở · tiền mặt {money(shift.totals?.cash ?? 0)}</Badge>
        ) : (
          <Button
            onClick={async () => {
              try {
                await apiPost("/shifts/open");
                await loadShift();
                toast.success("Đã mở ca");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Lỗi");
              }
            }}
          >
            Mở ca
          </Button>
        )}
        {shift ? (
          <Button
            variant="outline"
            onClick={() => {
              setCash(String(shift.totals?.cash ?? 0));
              setCloseOpen(true);
            }}
          >
            Đóng ca
          </Button>
        ) : null}
        <Link to="/desk/courts" className="ml-auto">
          <Button variant="ink">Sơ đồ sân</Button>
        </Link>
      </div>

      <Field label="Tìm hội viên">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tên, số điện thoại hoặc mã TV"
          autoFocus
        />
      </Field>
      <div className="mt-3 grid gap-2">
        {q.trim().length > 0 && q.trim().length < 3 ? (
          <p className="text-sm text-muted">Gõ ít nhất 3 ký tự.</p>
        ) : null}
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate({ to: "/desk/member/$id", params: { id: m.id } })}
            className="flex min-h-14 items-center justify-between rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] hover:bg-wood"
          >
            <div>
              <div className="font-medium">{m.full_name}</div>
              <div className="text-xs tabular-nums text-muted">
                {m.member_code} · {m.phone}
              </div>
            </div>
            <StatusBadge status={m.status} />
          </button>
        ))}
      </div>

      <h2 className="mt-8 font-display text-2xl">Tạo hội viên mới</h2>
      <p className="mt-1 text-sm text-muted">Ba bước: hồ sơ → gói → thu.</p>
      <ol className="mt-3 flex gap-2 text-2xs font-medium uppercase tracking-wider">
        {[
          [1, "Hồ sơ"],
          [2, "Gói"],
          [3, "Thu"],
        ].map(([n, l]) => (
          <li
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? "bg-accent text-accent-fg" : "bg-wood text-muted"}`}
          >
            {n}. {l}
          </li>
        ))}
      </ol>
      <Card className="mt-3">
        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Họ tên">
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nguyễn Văn A"
              />
            </Field>
            <Field label="Số điện thoại">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0901…"
              />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await apiPost<{
                      user: { id: string; full_name: string; member_code?: string | null };
                      existing?: boolean;
                    }>("/members", { ...form, pii_consent: true });
                    setNewUser(res.user);
                    setStep(2);
                    toast.success(res.existing ? "Đã có hồ sơ — chọn gói" : "Đã tạo hồ sơ — chọn gói");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Lỗi");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tiếp: chọn gói
              </Button>
            </div>
          </div>
        ) : null}
        {step === 2 && newUser ? (
          <div>
            <p className="mb-3 text-sm">
              {newUser.full_name}
              {newUser.member_code ? ` · ${newUser.member_code}` : ""}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked(p)}
                  className={`rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors ${
                    picked?.id === p.id ? "border-accent bg-accent/10" : "border-line hover:bg-wood"
                  }`}
                >
                  <p className="text-2xs uppercase tracking-wider text-muted">{sportLabel(p.sport_scope)}</p>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm tabular-nums text-muted">
                    {money(p.price_vnd)}
                    {p.duration_days ? ` · ${p.duration_days} ngày` : ""} · {p.court_hours} giờ sân
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Quay lại
              </Button>
              <Button
                disabled={!picked || busy}
                onClick={async () => {
                  if (!picked || !newUser) return;
                  setBusy(true);
                  try {
                    const res = await apiPost<{ subscription: { id: string } }>("/subscriptions", {
                      plan_id: picked.id,
                      user_id: newUser.id,
                    });
                    setSubId(res.subscription.id);
                    setStep(3);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Không tạo được gói");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tiếp: thu tiền
              </Button>
            </div>
          </div>
        ) : null}
        {step === 3 && newUser && picked ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3 text-sm">
              {newUser.full_name} · {picked.name} · {money(picked.price_vnd)}
            </div>
            <Field label="Thanh toán">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
                <option value="card">Thẻ</option>
              </Select>
            </Field>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button
                disabled={busy || !shift}
                onClick={async () => {
                  if (!subId) return;
                  setBusy(true);
                  try {
                    const res = await apiPost<{ invoice: { id: string } }>(
                      "/payments",
                      {
                        ref_type: "subscription",
                        ref_id: subId,
                        method,
                        amount_vnd: picked.price_vnd,
                      },
                      true,
                    );
                    toast.success("Đã thu · phiếu đã mở");
                    if (res.invoice?.id) await openInvoice(res.invoice.id);
                    const uid = newUser.id;
                    resetWizard();
                    navigate({ to: "/desk/member/$id", params: { id: uid } });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Không thu được");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {shift ? "Thu & in phiếu" : "Cần mở ca"}
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)}>
                Quay lại
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Đóng ca"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={async () => {
                if (!shift) return;
                try {
                  await apiPost(`/shifts/${shift.shift.id}/close`, { cash_declared_vnd: Number(cash) });
                  toast.success("Đã đóng ca");
                  setCloseOpen(false);
                  await loadShift();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Lỗi");
                }
              }}
            >
              Đối soát & đóng
            </Button>
          </>
        }
      >
        <Field label="Tiền mặt thực tế (VND)">
          <Input inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} />
        </Field>
        <p className="mt-2 text-sm text-muted">Sổ sách: {money(shift?.totals?.cash ?? 0)}</p>
      </Modal>

      {tickets.length ? (
        <div className="mt-8">
          <h2 className="font-display text-2xl">Phiếu từ app</h2>
          <div className="mt-3 grid gap-2">
            {tickets.map((t) => (
              <Card key={t.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm">{t.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t.full_name} · {t.phone}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await apiPost(`/tickets/${t.id}/close`);
                      setTickets((list) => list.filter((x) => x.id !== t.id));
                      toast.success("Đã đóng phiếu");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Lỗi");
                    }
                  }}
                >
                  Đóng
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
