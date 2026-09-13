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
    { to: "/app", label: "Lịch", icon: CalendarDays },
    { to: "/app/book", label: "Đặt sân", icon: Map },
    { to: "/app/classes", label: "Lớp", icon: Ticket },
    { to: "/app/plans", label: "Gói", icon: Wallet },
  ],
  receptionist: [
    { to: "/desk", label: "Quầy", icon: Users },
    { to: "/desk/courts", label: "Sân", icon: Map },
  ],
  coach: [{ to: "/coach", label: "Lịch dạy", icon: ClipboardList }],
  manager: [
    { to: "/manager", label: "Báo cáo", icon: LayoutGrid },
    { to: "/manager/classes", label: "Lớp", icon: Ticket },
    { to: "/manager/plans", label: "Gói", icon: Wallet },
    { to: "/manager/prices", label: "Giá", icon: Settings },
    { to: "/manager/settings", label: "Cài đặt", icon: Settings },
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
    try {
      await apiPost("/auth/logout");
    } catch {
      /* still clear */
    }
    clearSession();
    navigate({ to: "/" });
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
                    "flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm transition-colors duration-150",
                    active ? "bg-accent text-accent-fg" : "text-muted hover:bg-wood hover:text-fg",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {role === "member" ? (
              <Link
                to="/app/assistant"
                aria-label="Trợ lý"
                className={cn(
                  "grid size-11 place-items-center rounded-[var(--radius-sm)] transition-colors duration-150",
                  pathname.startsWith("/app/assistant") ? "bg-accent text-accent-fg" : "text-fg hover:bg-wood",
                )}
              >
                <MessageCircle className="size-4" strokeWidth={1.75} />
              </Link>
            ) : null}
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium leading-tight">{user?.full_name}</span>
              <span className="text-2xs uppercase tracking-wider text-muted">{roleLabel(role)}</span>
            </span>
            <Button variant="ghost" className="size-11 px-0" onClick={() => logout()} aria-label="Đăng xuất">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {title ? (
          <header className="mb-5">
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </header>
        ) : null}
        {children}
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

  useEffect(() => {
    const u = getStoredUser();
    const t = getToken();
    if (!t || !u) {
      navigate({ to: "/login" });
      return;
    }
    if (!roles.includes(u.role)) {
      navigate({ to: homeFor(u.role) });
      return;
    }
    setUser(u);
    setReady(true);
    void apiGet("/me").catch(() => {
      clearSession();
      navigate({ to: "/login" });
    });
  }, [navigate, roles]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <div className="flex flex-col items-center gap-3">
          <ArenaMark />
          <p className="font-display text-lg">Arena3</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}
