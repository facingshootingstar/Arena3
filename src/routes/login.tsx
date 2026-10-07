import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArenaMark } from "@/components/mark";
import { Cover, media } from "@/components/media";
import { Button, Card, Field, Input } from "@/components/ui";
import { ApiClientError, apiPost, homeFor, setSession, takeSessionNotice, type SessionUser } from "@/lib/arena3/client";
import { roleLabel } from "@/lib/arena3/labels";
import { LangSwitch } from "@/components/lang-switch";
import { t, tServer, tk } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: Login });

/**
 * The seeded demo password.
 *
 * It only ever travels with a tap on one of the buttons below, and it is not
 * written anywhere a visitor can read it. Printing it under the heading — next
 * to a password box that came pre-filled with it — meant the credential for
 * every seeded account, manager included, was published on the front page, and
 * anyone registering a real account was handed it as their default.
 *
 * Set `VITE_DEMO_LOGINS=off` to ship this app with no demo accounts on show.
 */
const DEMO_PASSWORD = "ChangeMe!a3";
const DEMO_LOGINS_ON = import.meta.env.PROD
  ? import.meta.env.VITE_DEMO_LOGINS === "on"
  : import.meta.env.VITE_DEMO_LOGINS !== "off";

const DEMOS: { role: SessionUser["role"]; phone: string; name: string; note: string }[] = [
  { role: "manager", phone: "0900000001", name: "Arena3 Manager", note: tk("Pricing · classes · reports") },
  { role: "receptionist", phone: "0900000002", name: "Front Desk", note: tk("Search · take payment · walk-ins") },
  { role: "coach", phone: "0901110011", name: "Coach Khoa", note: tk("Badminton classes") },
  { role: "member", phone: "0901230101", name: "Nam", note: tk("All-access plan · court booked today") },
  { role: "member", phone: "0901230102", name: "Linh", note: tk("Plan expires in ~4 days") },
  { role: "member", phone: "0901230106", name: "Ha", note: tk("Expired, needs a renewal") },
];

function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // Why the last attempt failed. Kept on the form until the next one: a toast fades after a few
  // seconds, and "wrong password" is the one message a person needs to be able to read twice.
  const [error, setError] = useState<{ message: string; credentials: boolean } | null>(null);
  // Why someone is here again: the session ran out while they were in the app. Read on the client
  // only, because session storage does not exist while the server renders this page.
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (takeSessionNotice()) setEnded(true);
  }, []);

  async function submit(e?: FormEvent, demo?: { phone: string }) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiPost<{ token: string; user: SessionUser }>("/auth/login", {
        login: demo?.phone ?? login,
        // The demo password rides along with the button that knows it rather
        // than sitting in the form where a visitor can read it back.
        password: demo ? DEMO_PASSWORD : password,
      });
      setSession(res.token, res.user);
      toast.success(t("Welcome, {name}", { name: res.user.full_name }), { id: "login-hello" });
      navigate({ to: homeFor(res.user.role) });
    } catch (err) {
      setError({
        message: err instanceof Error ? tServer(err.message) : t("Could not sign you in"),
        // Only a refused sign-in says anything about the two boxes; no signal or a busy server does not.
        credentials: err instanceof ApiClientError && (err.status === 400 || err.status === 401),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* A still photograph: the old looping video cost three megabytes before the form could be used. */}
      <div className="relative hidden min-h-dvh overflow-hidden lg:block">
        <Cover src={media.reception} alt="" scrim="none" className="absolute inset-0" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-10 text-on-media">
          <Link to="/" className="inline-flex items-center gap-2.5 self-start">
            <ArenaMark className="size-9" />
            <span className="text-xl font-bold tracking-tight">Arena3</span>
          </Link>
          <p className="max-w-sm text-3xl font-bold leading-tight tracking-tight on-media">
            {t("One schedule for courts, classes and cash.")}
          </p>
        </div>
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="flex min-h-11 items-center gap-2.5 lg:invisible">
            <ArenaMark className="size-8" />
            <span className="text-lg font-bold tracking-tight">Arena3</span>
          </Link>
          <LangSwitch />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Sign in")}</h1>
        <p className="mt-1 text-sm text-muted">
          {DEMO_LOGINS_ON
            ? t("Sign in with your phone or email, or tap a demo account below.")
            : t("Sign in with your phone number or email.")}
        </p>
        {/* The live region is always there, so the line is read out when it appears. */}
        <div role="status">
          {ended ? (
            <p className="mt-4 rounded-[var(--radius-lg)] border border-hold/30 bg-hold/5 px-4 py-3 text-sm">
              {t("Your session has ended. Please sign in again to continue.")}
            </p>
          ) : null}
        </div>
        <Card className="mt-6 p-5">
          <form className="grid gap-4" onSubmit={submit}>
            <Field label={t("Phone or email")}>
              <Input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                aria-invalid={error?.credentials ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </Field>
            <Field label={t("Password")}>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={error?.credentials ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 grid size-11 place-items-center text-muted hover:text-fg"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t("Hide password") : t("Show password")}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error ? (
              <p id="login-error" role="alert" className="text-sm text-danger">
                {error.message}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t("Signing in…") : t("Sign in")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <Link to="/register" className="hit text-accent-2 underline underline-offset-2">
              {t("Create an account")}
            </Link>
            {/*
              The reset flow existed on the server with nothing pointing at it,
              so a member who forgot their password had to ask the desk to do
              it for them.
            */}
            <Link to="/forgot" className="hit text-muted hover:underline">
              {t("Forgot your password?")}
            </Link>
          </div>
        </Card>
        {DEMO_LOGINS_ON ? (
        <>
        <p className="mt-8 text-2xs font-semibold text-muted">{t("Demo accounts")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.phone}
              type="button"
              title={t(d.note)}
              onClick={() => {
                setLogin(d.phone);
                void submit(undefined, d);
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3 py-2 text-left transition-colors duration-150 hover:border-accent"
            >
              <span className="text-2xs font-semibold text-accent">{roleLabel(d.role)}</span>
              <span className="ml-2 text-sm font-medium">{d.name}</span>
            </button>
          ))}
        </div>
        </>
        ) : null}
      </div>
    </main>
  );
}
