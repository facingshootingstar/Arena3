import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArenaMark } from "@/components/mark";
import { Cover, HeroVideo, MediaCaption, media } from "@/components/media";
import { Button, Card, Field, Input } from "@/components/ui";
import { apiPost, homeFor, setSession, type SessionUser } from "@/lib/arena3/client";
import { roleLabel } from "@/lib/arena3/labels";

export const Route = createFileRoute("/login")({ component: Login });

const DEMOS: { role: SessionUser["role"]; phone: string; name: string; note: string }[] = [
  { role: "manager", phone: "0900000001", name: "Quản lý Arena3", note: "Giá · lớp · báo cáo" },
  { role: "receptionist", phone: "0900000002", name: "Lễ tân ca 1", note: "Tìm TV · thu · walk-in" },
  { role: "coach", phone: "0901110011", name: "HLV Nguyễn Minh Khoa", note: "Lớp cầu lông" },
  { role: "member", phone: "0901230101", name: "Nguyễn Văn Nam", note: "Gói tất cả môn · đặt sân hôm nay" },
  { role: "member", phone: "0901230102", name: "Trần Mỹ Linh", note: "Gói còn ~4 ngày" },
  { role: "member", phone: "0901230106", name: "Võ Thanh Hà", note: "Hết hạn — gia hạn" },
];

function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("0900000002");
  const [password, setPassword] = useState("ChangeMe!a3");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent, override?: string) {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<{ token: string; user: SessionUser }>("/auth/login", {
        login: override ?? login,
        password,
      });
      setSession(res.token, res.user);
      toast.success(`Xin chào ${res.user.full_name}`, { id: "login-hello" });
      navigate({ to: homeFor(res.user.role) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-dvh overflow-hidden lg:block">
        <HeroVideo src={media.receptionVideo} poster={media.reception} />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" className="inline-flex items-center gap-2 self-start rounded-full bg-pass/90 px-3 py-1.5 text-pass-fg">
            <ArenaMark className="size-8" />
            <span className="font-display text-2xl">Arena3</span>
          </Link>
          <div className="max-w-sm rounded-[var(--radius-xl)] bg-pass/92 p-6 text-pass-fg">
            <p className="text-2xs uppercase tracking-wider text-pass-muted">Quầy đang mở</p>
            <p className="mt-2 font-display text-4xl leading-tight">Một lịch cho sân, lớp và tiền.</p>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <Cover src={media.hallCourts} alt="" scrim="none" className="mb-6 h-36 rounded-[var(--radius-xl)] lg:hidden">
          <MediaCaption>
            <span className="font-display text-2xl">Arena3</span>
          </MediaCaption>
        </Cover>
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <ArenaMark />
          <p className="text-2xs font-medium uppercase tracking-wider text-muted">Trung tâm thể thao</p>
        </div>
        <h1 className="font-display text-4xl">Đăng nhập</h1>
        <p className="mt-1 text-sm text-muted">SĐT hoặc email · mật khẩu demo ChangeMe!a3</p>
        <Card className="mt-6 p-5">
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Số điện thoại / email">
              <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Mật khẩu">
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-9 place-items-center text-muted hover:text-fg"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Đang vào…" : "Vào sân"}
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <Link to="/register" className="text-accent-2 hover:underline">
              Đăng ký thành viên
            </Link>
            <span className="text-subtle">OTP hiện trên màn hình</span>
          </div>
        </Card>
        <p className="mt-8 text-2xs font-semibold uppercase tracking-widest text-muted">Tài khoản thử nghiệm</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.phone}
              type="button"
              onClick={() => {
                setLogin(d.phone);
                void submit(undefined, d.phone);
              }}
              className="rounded-full border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent"
            >
              <span className="text-2xs font-semibold uppercase tracking-wider text-accent">{roleLabel(d.role)}</span>
              <span className="ml-2 text-sm font-medium">{d.name.split(" ").slice(-1)[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
