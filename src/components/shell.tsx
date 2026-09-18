import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Map,
  MessageCircle,
  Settings,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ArenaMark } from "./mark";
import { PageIn, motion } from "./motion";
import { Button } from "./ui";
import { cn } from "@/lib/cn";
import {
  apiGet,
  apiPost,
  clearSession,
  getStoredUser,
  getToken,
  homeFor,
  type SessionUser,
} from "@/lib/arena3/client";
import { roleLabel } from "@/lib/arena3/labels";

export function useSessionUser(): SessionUser | null {
  const [u, setU] = useState<SessionUser | null>(null);
  useEffect(() => {
    setU(getStoredUser());
  }, []);
  return u;
}

const NAV: Record<string, { to: string; label: string; icon: typeof Map }[]> = {
  member: [
    { to: "/app", label: "Schedule", icon: CalendarDays },
    { to: "/app/book", label: "Book", icon: Map },
    { to: "/app/classes", label: "Classes", icon: Ticket },
    { to: "/app/plans", label: "Plans", icon: Wallet },
  ],
  receptionist: [
    { to: "/desk", label: "Desk", icon: Users },
    { to: "/desk/courts", label: "Courts", icon: Map },
  ],
  coach: [{ to: "/coach", label: "Teaching", icon: ClipboardList }],
  manager: [
    { to: "/manager", label: "Reports", icon: LayoutGrid },
    { to: "/manager/classes", label: "Classes", icon: Ticket },
    { to: "/manager/plans", label: "Plans", icon: Wallet },
    { to: "/manager/prices", label: "Pricing", icon: Settings },
    { to: "/manager/settings", label: "Settings", icon: Settings },
  ],
};

function navActive(pathname: string, to: string, items: { to: string }[]) {
  const list = Array.isArray(items) ? items : [];
  const matches = list.filter((it) => pathname === it.to || pathname.startsWith(`${it.to}/`));
  const best = [...matches].sort((a, b) => b.to.length - a.to.length)[0];
  return best?.to === to;
}

export { roleLabel };

export function Shell({
  children,
  title,
  subtitle,
  role,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  role: SessionUser["role"];
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useSessionUser();
  const items = NAV[role] ?? [];
  const home = homeFor(role);

  async function logout() {
    // Drop the local session immediately, before awaiting the server call.
    // `api()` reads the token synchronously, so the logout request still carries
    // it — but any fetch a page fires while that request is in flight would
    // otherwise go out with a token the server has already deleted and pop an
    // alarming "That session is not valid." toast on a *successful* sign-out.
    const done = apiPost("/auth/logout").catch(() => undefined);
    clearSession();
    navigate({ to: "/" });
    await done;
  }

  return (
    <div className="min-h-dvh text-fg">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to={home} className="flex items-center gap-2">
            <ArenaMark className="size-8" />
            <span className="hidden font-display text-2xl font-normal italic tracking-tight sm:inline">Arena3</span>
          </Link>
          <nav className="ml-3 hidden items-center gap-1 md:flex">
            {items.map((it) => {
              const active = navActive(pathname, it.to, items);
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  activeOptions={{ exact: true }}
                  className={cn(
                    "relative flex h-9 items-center gap-2 rounded-[var(--radius-pill)] px-3.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-200",
                    active ? "text-accent-fg" : "text-muted hover:bg-wood hover:text-fg",
                  )}
                >
                  {/* Highlight slides between tabs rather than cutting. */}
                  {active ? (
                    <motion.span
                      layoutId="shell-nav-active"
                      className="absolute inset-0 rounded-[var(--radius-pill)] bg-accent shadow-[var(--shadow-accent)]"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  ) : null}
                  <Icon className="relative z-[1] size-4" strokeWidth={1.75} />
                  <span className="relative z-[1]">{it.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {role === "member" ? (
              <Link
                to="/app/assistant"
                aria-label="Assistant"
                className={cn(
                  "grid size-11 place-items-center rounded-[var(--radius-pill)] transition-colors duration-150",
                  pathname.startsWith("/app/assistant")
                    ? "bg-accent text-accent-fg shadow-[var(--shadow-accent)]"
                    : "text-fg hover:bg-wood",
                )}
              >
                <MessageCircle className="size-4" strokeWidth={1.75} />
              </Link>
            ) : null}
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium leading-tight">{user?.full_name}</span>
              <span className="kicker text-2xs text-muted">{roleLabel(role)}</span>
            </span>
            <Button variant="ghost" className="size-11 px-0" onClick={() => logout()} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <PageIn key={pathname}>
          {title ? (
            <header className="mb-5">
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
            </header>
          ) : null}
          {children}
        </PageIn>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid auto-cols-fr grid-flow-col">
          {items.map((it) => {
            const active = navActive(pathname, it.to, items);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                activeOptions={{ exact: true }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] uppercase tracking-wider",
                  active ? "font-semibold text-accent" : "font-medium text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Guard({
  roles,
  children,
}: {
  roles: SessionUser["role"][];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Callers pass `roles` as an inline array literal, so its identity changes on
  // every render. Depend on the contents instead — otherwise this effect re-runs
  // forever (each run stores a freshly parsed user object, forcing a re-render)
  // and fires a /me request per cycle.
  const roleKey = roles.join(",");

  useEffect(() => {
    const allowed = roleKey.split(",") as SessionUser["role"][];
    const u = getStoredUser();
    const t = getToken();
    if (!t || !u) {
      navigate({ to: "/login" });
      return;
    }
    if (!allowed.includes(u.role)) {
      navigate({ to: homeFor(u.role) });
      return;
    }
    setUser(u);
    setReady(true);
    void apiGet("/me").catch(() => {
      clearSession();
      navigate({ to: "/login" });
    });
  }, [navigate, roleKey]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArenaMark />
          </motion.span>
          <p className="font-display text-lg">Arena3</p>
        </motion.div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Prices stay in dong; grouping follows the English UI (140,000đ). */
export function money(n: number) {
  return new Intl.NumberFormat("en-US").format(n) + "đ";
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    hour12: false,
  });
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
