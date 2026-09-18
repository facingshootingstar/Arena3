import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArenaMark } from "@/components/mark";
import { Cover, media } from "@/components/media";
import { Button, Card, DateField, Field, Input } from "@/components/ui";
import { AnimatePresence, motion } from "motion/react";
import { Reveal } from "@/components/motion";
import { apiPost, homeFor, setSession, type SessionUser } from "@/lib/arena3/client";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    password: "ChangeMe!a3",
    dob: "1998-01-15",
    pii_consent: true,
  });

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<{ otp?: string }>("/auth/register", form);
      setShown(res.otp ?? "");
      setStep("otp");
      toast.message("OTP written to the staging log.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<{ token: string; user: SessionUser }>("/auth/otp/verify", {
        phone: form.phone,
        otp,
      });
      setSession(res.token, res.user);
      navigate({ to: homeFor(res.user.role) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That OTP is not right");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Cover src={media.athlete} alt="" className="h-full min-h-dvh" scrim="hero">
          <div className="relative flex h-full min-h-dvh flex-col justify-between p-10">
            <Link to="/" className="inline-flex items-center gap-2 self-start rounded-full bg-pass/90 px-3 py-1.5 text-pass-fg">
              <ArenaMark className="size-8" />
              <span className="font-display text-2xl">Arena3</span>
            </Link>
            <div className="max-w-sm rounded-[var(--radius-xl)] bg-pass/92 p-6 text-pass-fg">
              <p className="font-display text-4xl leading-tight">A live plan is your key to the courts and the classes.</p>
            </div>
          </div>
        </Cover>
      </div>
      <div className="grid min-h-dvh place-items-center px-4 py-10">
        <Reveal className="w-full max-w-md" from="up">
        <Card className="relative w-full p-6">
          <div className="flex items-center gap-2">
            <ArenaMark className="size-7" />
            <p className="text-2xs uppercase tracking-wider text-muted">Arena3</p>
          </div>
          <h1 className="mt-3 font-display text-3xl">Create an account</h1>
          <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 grid gap-4"
              onSubmit={send}
            >
              <Field label="Full name">
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field label="Phone number">
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0901…"
                />
              </Field>
              <Field label="Date of birth">
                <DateField value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} aria-label="Date of birth" />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <label className="flex items-start gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--color-accent)]"
                  checked={form.pii_consent}
                  onChange={(e) => setForm({ ...form, pii_consent: e.target.checked })}
                />
                I agree to the terms and to Decree 13/2023 on personal data protection.
              </label>
              <Button type="submit" disabled={busy} className="w-full">
                Send OTP
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 grid gap-4"
              onSubmit={verify}
            >
              {shown ? (
                <p className="rounded-[var(--radius-md)] bg-wood px-3 py-2 text-sm">
                  Test OTP: <span className="font-medium tabular-nums">{shown}</span>
                </p>
              ) : null}
              <Field label="6-digit OTP">
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
              </Field>
              <Button type="submit" disabled={busy} className="w-full">
                Verify
              </Button>
            </motion.form>
          )}
          </AnimatePresence>
          <p className="mt-4 text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-accent-2 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
        </Reveal>
      </div>
    </main>
  );
}
