import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  Dumbbell,
  Ellipsis,
  FileText,
  HandCoins,
  Image,
  LandPlot,
  LayoutGrid,
  LogOut,
  Map,
  MessageSquare,
  QrCode,
  Repeat,
  Star,
  ScrollText,
  Settings,
  Tag,
  Coins,
  Ticket,
  Trophy,
  UserCog,
  UserMinus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { type FocusEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ArenaMark, AssistantMark } from "./mark";
import { AnimatePresence, PageIn, motion } from "./motion";
import { GradualBlur } from "./fx";
import { Spot, spotForPath } from "./illustrations";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/cn";
import { useLive } from "@/lib/use-live";
import {
  apiGet,
  apiPost,
  clearSession,
  getStoredUser,
  getToken,
  homeFor,
  onStoredUserChange,
  type SessionUser,
} from "@/lib/arena3/client";
import { roleLabel } from "@/lib/arena3/labels";
import { locale, t, tk } from "@/lib/i18n";
import { ConnectionBanner } from "./connection-banner";
import { LangSwitch } from "./lang-switch";
import { useDialog } from "./ui";

export function useSessionUser(): SessionUser | null {
  const [u, setU] = useState<SessionUser | null>(null);
  useEffect(() => {
    setU(getStoredUser());
    // A profile edit rewrites the cached copy; follow it so the header shows the new name without
    // reloading the page (a reload also threw away the "Saved" the person had just been shown).
    return onStoredUserChange(() => setU(getStoredUser()));
  }, []);
  return u;
}

/**
 * Every page sits in one `group`. A laptop shows one drop-down per group, and a phone lists the
 * pages under the same headings in its "More" sheet. `dock: false` keeps a page out of the phone's
 * bottom bar, so it goes in that sheet instead.
 */
type NavItem = { to: string; label: string; icon: typeof Map; group: string; dock?: boolean };
type NavGroup = { group: string; items: NavItem[] };

/** Group headings. Module scope, so they are marked with `tk` and translated where they are drawn. */
const G_PLAY = tk("Courts & classes");
const G_ACCOUNT = tk("My account");
const G_TEACHING = tk("Teaching");
const G_FRONT = tk("Front desk");
const G_CUSTOMERS = tk("Customers");
const G_EQUIPMENT = tk("Gear & upkeep");
const G_OVERVIEW = tk("Overview");
const G_BUSINESS = tk("Sales & pricing");
const G_OPS = tk("Operations");
const G_SYSTEM = tk("System");

const NAV: Record<string, NavItem[]> = {
  member: [
    { to: "/app", label: tk("Schedule"), icon: CalendarDays, group: G_PLAY },
    { to: "/app/book", label: tk("Book"), icon: Map, group: G_PLAY },
    { to: "/app/classes", label: tk("Classes"), icon: Ticket, group: G_PLAY },
    // A phone's bottom bar holds five: the four things a member does on the way to court, then More.
    { to: "/app/train", label: tk("Progress"), icon: Activity, group: G_ACCOUNT, dock: false },
    { to: "/app/plans", label: tk("Plans"), icon: Wallet, group: G_ACCOUNT, dock: false },
    { to: "/app/points", label: tk("Points"), icon: Star, group: G_ACCOUNT, dock: false },
    { to: "/chat", label: tk("Messages"), icon: MessageSquare, group: G_ACCOUNT, dock: false },
    { to: "/app/pass", label: tk("Pass"), icon: QrCode, group: G_ACCOUNT },
  ],
  receptionist: [
    { to: "/desk", label: tk("Desk"), icon: Users, group: G_FRONT },
    { to: "/desk/gate", label: tk("Gate"), icon: DoorOpen, group: G_FRONT },
    // The court map is open all shift long, so it is in the phone's bottom bar.
    { to: "/desk/courts", label: tk("Courts"), icon: Map, group: G_FRONT },
    { to: "/desk/classes", label: tk("Classes"), icon: Ticket, group: G_FRONT, dock: false },
    // Setting up a regular booking is a front-desk job done regularly.
    { to: "/desk/series", label: tk("Fixed bookings"), icon: Repeat, group: G_FRONT, dock: false },
    { to: "/desk/payments", label: tk("Payments"), icon: Wallet, group: G_CUSTOMERS },
    { to: "/desk/at-risk", label: tk("At risk"), icon: UserMinus, group: G_CUSTOMERS, dock: false },
    { to: "/chat", label: tk("Messages"), icon: MessageSquare, group: G_CUSTOMERS, dock: false },
    // `/desk/gear` is a complete equipment-hire screen that nothing linked to,
    // so reception could only reach it by typing the URL.
    { to: "/desk/gear", label: tk("Gear"), icon: Dumbbell, group: G_EQUIPMENT, dock: false },
    { to: "/desk/maintenance", label: tk("Maintenance"), icon: Wrench, group: G_EQUIPMENT, dock: false },
  ],
  // The coach had one tab, which `showNav` hides, so the screen had no menu at
  // all (B-10). Schedule, register and profile are three different jobs.
  coach: [
    { to: "/coach", label: tk("Schedule"), icon: CalendarDays, group: G_TEACHING },
    { to: "/coach/classes", label: tk("Classes"), icon: Ticket, group: G_TEACHING },
    { to: "/coach/attendance", label: tk("Attendance"), icon: ClipboardList, group: G_TEACHING },
    { to: "/chat", label: tk("Messages"), icon: MessageSquare, group: G_TEACHING },
    { to: "/coach/earnings", label: tk("Earnings"), icon: HandCoins, group: G_ACCOUNT },
    { to: "/account", label: tk("Profile"), icon: UserCog, group: G_ACCOUNT },
  ],
  manager: [
    { to: "/manager", label: tk("Reports"), icon: LayoutGrid, group: G_OVERVIEW },
    { to: "/manager/members", label: tk("Members"), icon: Users, group: G_OVERVIEW },
    { to: "/manager/attendance", label: tk("Attendance"), icon: ClipboardList, group: G_OVERVIEW },
    // Refund sign-off lives on the payments screen, which has always taken a
    // manager — nothing in this menu pointed at it (B-02).
    { to: "/desk/payments", label: tk("Payments"), icon: Wallet, group: G_BUSINESS },
    { to: "/manager/plans", label: tk("Plans"), icon: Wallet, group: G_BUSINESS, dock: false },
    { to: "/manager/promos", label: tk("Promos"), icon: Tag, group: G_BUSINESS, dock: false },
    { to: "/manager/prices", label: tk("Pricing"), icon: Coins, group: G_BUSINESS, dock: false },
    { to: "/manager/commission", label: tk("Commission"), icon: HandCoins, group: G_BUSINESS, dock: false },
    { to: "/manager/invoices", label: tk("E-invoices"), icon: FileText, group: G_BUSINESS, dock: false },
    { to: "/manager/classes", label: tk("Classes"), icon: Ticket, group: G_OPS, dock: false },
    { to: "/desk/series", label: tk("Fixed bookings"), icon: Repeat, group: G_OPS, dock: false },
    { to: "/manager/courts", label: tk("Courts"), icon: LandPlot, group: G_OPS, dock: false },
    { to: "/manager/sports", label: tk("Sports"), icon: Trophy, group: G_OPS, dock: false },
    { to: "/desk/maintenance", label: tk("Maintenance"), icon: Wrench, group: G_OPS, dock: false },
    { to: "/chat", label: tk("Messages"), icon: MessageSquare, group: G_OPS, dock: false },
    { to: "/manager/staff", label: tk("Staff"), icon: UserCog, group: G_SYSTEM, dock: false },
    { to: "/manager/media", label: tk("Media"), icon: Image, group: G_SYSTEM, dock: false },
    { to: "/manager/audit", label: tk("Audit"), icon: ScrollText, group: G_SYSTEM, dock: false },
    { to: "/manager/settings", label: tk("Settings"), icon: Settings, group: G_SYSTEM, dock: false },
  ],
};

function navActive(pathname: string, to: string, items: { to: string }[]) {
  const list = Array.isArray(items) ? items : [];
  // A student's profile is reached from the register, so that is the tab it belongs to.
  if (pathname.startsWith("/coach/student/")) pathname = "/coach/attendance";
  // These have their own header buttons, not tabs; "/app" must not claim them as Schedule.
  if (/^\/(app\/(assistant|notifications)|alerts|chat)(\/|$)/.test(pathname) && to === "/app") return false;
  const matches = list.filter((it) => pathname === it.to || pathname.startsWith(`${it.to}/`));
  const best = [...matches].sort((a, b) => b.to.length - a.to.length)[0];
  return best?.to === to;
}

export { initials } from "@/lib/initials";

/**
 * The member's notifications, on their own button beside the account menu
 * (G-08): what is new is not an account setting, and an unread count on the
 * avatar menu is somewhere nobody looks. The count is re-read on every page
 * change, which is cheap and keeps it honest after a notification is opened.
 */
function NotificationBell({ active, to }: { active: boolean; to: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  const fetchUnread = () => {
    void apiGet<{ unread: number }>("/me/notifications?limit=1", { background: true })
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnread();
  }, [pathname]);

  useLive("notifications", fetchUnread);

  return (
    <Link
      to={to}
      aria-label={unread ? t("Notifications, {n} unread", { n: unread }) : t("Notifications")}
      className={cn(
        "relative grid size-11 place-items-center rounded-[var(--radius-pill)] transition-colors duration-150",
        active ? "bg-accent text-accent-fg shadow-[var(--shadow-accent)]" : "text-fg hover:bg-wood",
      )}
    >
      <Bell className="size-4" strokeWidth={1.9} />
      {unread ? (
        <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-xs font-bold leading-5 text-on-media tabular-nums motion-safe:animate-pulse">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

function ChatBell({ active }: { active: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  const fetchUnread = () => {
    void apiGet<{ conversations: Array<{ unread_count: number }> }>("/conversations", { background: true })
      .then((r) => {
        const total = (r.conversations ?? []).reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0);
        setUnread(total);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnread();
  }, [pathname]);

  useLive("chat", fetchUnread);
  useLive("notifications", fetchUnread);

  return (
    <Link
      to="/chat"
      search={{}}
      aria-label={unread ? t("Messages, {n} unread", { n: unread }) : t("Messages")}
      className={cn(
        "relative grid size-11 place-items-center rounded-[var(--radius-pill)] transition-colors duration-150",
        active ? "bg-accent text-accent-fg shadow-[var(--shadow-accent)]" : "text-fg hover:bg-wood",
      )}
    >
      <MessageSquare className="size-4" strokeWidth={1.9} />
      {unread ? (
        <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-xs font-bold leading-5 text-on-media tabular-nums motion-safe:animate-pulse">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Open/close state shared by the header's two drop-downs. They are disclosure widgets (a button
 * that reveals a list of links), not ARIA menus, which would promise arrow-key navigation we do
 * not provide. So it is a plain list of links: Tab walks through it, Escape closes it and hands
 * focus back to the button, and tabbing out of it closes it instead of leaving it hanging open.
 */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  // Only a Tab that lands somewhere else counts: some browsers report no target when a mouse
  // press moves focus onto a link, and closing then would swallow the click.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (open && next instanceof Node && !e.currentTarget.contains(next)) setOpen(false);
  };
  return { open, setOpen, ref, button, panelId, onBlur };
}

/** Avatar button that opens the account menu. */
function AccountMenu({
  user,
  role,
  onLogout,
}: {
  user: SessionUser | null;
  role: SessionUser["role"];
  onLogout: () => void;
}) {
  const { open, setOpen, ref, button, panelId, onBlur } = useDropdown();

  return (
    <div ref={ref} onBlur={onBlur} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex items-center gap-2 rounded-[var(--radius-pill)] py-1 pl-1 pr-1 transition-colors duration-150 hover:bg-wood sm:pr-3"
        aria-label={t("Account menu: {name}", { name: user?.full_name ?? "" })}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold tracking-wide text-accent-fg">
          <UserAvatar
            url={user?.avatar_url}
            name={user?.full_name}
            className="size-full bg-accent"
            initialsClassName="text-xs font-bold tracking-wide text-accent-fg"
          />
        </span>
        <span className="hidden text-left xl:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight">{user?.full_name ?? "-"}</span>
          <span className="kicker text-2xs text-muted">{roleLabel(role)}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("hidden size-4 text-muted transition-transform duration-200 sm:block", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 origin-top-right overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-1.5 shadow-[0_24px_50px_-28px_rgba(11,18,48,0.8)]"
          >
            <div className="border-b border-line/70 px-3 pb-2.5 pt-2 xl:hidden">
              <p className="truncate text-sm font-medium">{user?.full_name ?? "-"}</p>
              <p className="kicker text-2xs text-muted">{roleLabel(role)}</p>
            </div>
            <ul>
              <li>
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm transition-colors duration-150 hover:bg-wood"
                >
                  <UserCog aria-hidden="true" className="size-4 text-muted" strokeWidth={1.75} />
                  {t("Account settings")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-left text-sm text-danger transition-colors duration-150 hover:bg-danger/10"
                >
                  <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
                  {t("Sign out")}
                </button>
              </li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Items split into their groups, in the order each group first appears in the role's list. */
function grouped(items: NavItem[]): NavGroup[] {
  const out: NavGroup[] = [];
  for (const it of items) {
    const bucket = out.find((g) => g.group === it.group);
    if (bucket) bucket.items.push(it);
    else out.push({ group: it.group, items: [it] });
  }
  return out;
}

/** Laptop: one drop-down per group, each a plain list of its pages. The button lights up when the page you are on is in it. */
function NavGroupMenu({ group, pathname, all }: { group: NavGroup; pathname: string; all: NavItem[] }) {
  const { open, setOpen, ref, button, panelId, onBlur } = useDropdown();
  const inside = group.items.some((it) => navActive(pathname, it.to, all));
  return (
    <div ref={ref} onBlur={onBlur} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors duration-150",
          inside ? "bg-accent/10 text-accent-2" : "text-muted hover:bg-wood hover:text-fg",
        )}
      >
        {t(group.group)}
        <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={panelId} className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-[var(--radius-lg)] border border-line bg-surface p-1.5 shadow-[0_24px_50px_-28px_rgba(11,18,48,0.8)]">
          <ul>
            {group.items.map((it) => {
              const Icon = it.icon;
              const active = navActive(pathname, it.to, all);
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm transition-colors duration-150 hover:bg-wood",
                      active && "bg-wood font-semibold",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 text-muted" strokeWidth={1.75} />
                    {t(it.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Phone: a slide-up sheet with the tabs that do not fit in the bottom bar. */
function MoreSheet({
  items,
  pathname,
  all,
  open,
  onClose,
}: {
  items: NavItem[];
  pathname: string;
  all: NavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Focus moves into the sheet, Tab stays in it, Escape closes it, focus returns to "More".
  useDialog(open, panel, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div role="presentation" aria-hidden="true" className="absolute inset-0 bg-fg/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t("More pages")}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-xl)] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-soft)] outline-none"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong/60" />
        {grouped(items).map((g, gi) => (
          <div key={g.group} className={cn(gi > 0 && "mt-3")}>
            <p className="mb-1.5 px-1 text-xs font-semibold text-subtle">{t(g.group)}</p>
            <ul className="grid grid-cols-3 gap-2">
              {g.items.map((it) => {
                const Icon = it.icon;
                const active = navActive(pathname, it.to, all);
                return (
                  <li key={it.to} className="grid">
                    <Link
                      to={it.to}
                      aria-current={active ? "page" : undefined}
                      onClick={onClose}
                      className={cn(
                        "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] px-1 text-center text-xs font-medium transition-colors duration-150",
                        active ? "bg-accent text-accent-fg" : "bg-wood text-fg",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      {t(it.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
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
  // A single tab is not a choice — it just repeats the page heading back at
  // you, which is why the coach screen read "Teaching / Teaching". Roles with
  // one destination get a plain wordmark and no nav at all.
  const showNav = items.length > 1;
  const groups = grouped(items);
  const dockItems = items.filter((it) => it.dock !== false);
  const sheetItems = items.filter((it) => it.dock === false);
  const [sheet, setSheet] = useState(false);
  // Moving to another page closes the sheet.
  useEffect(() => setSheet(false), [pathname]);

  // The browser tab and history say which screen this is, not just "Lê Long Sport" on every one.
  const navLabel = [...items]
    .filter((it) => pathname === it.to || pathname.startsWith(`${it.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.label;
  const pageName = title ?? (navLabel ? t(navLabel) : undefined);
  useEffect(() => {
    document.title = pageName ? `${pageName} · Lê Long Sport` : "Lê Long Sport";
  }, [pageName]);

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
    // `isolate` gives the page its own stacking context, so a background field at `-z-[1]` (the
    // desk's dot grid) paints above the body's own background instead of disappearing behind it.
    <div className="isolate min-h-dvh text-fg">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to={home} aria-label={t("Lê Long Sport home")} className="-ml-1.5 flex min-h-11 min-w-11 items-center justify-center gap-2 sm:ml-0 sm:justify-start">
            <ArenaMark className="size-8" />
            {/* At most four group buttons sit beside it, so the wordmark always has room. */}
            <span className="hidden whitespace-nowrap font-display text-xl font-bold tracking-tight sm:inline">Lê Long Sport</span>
          </Link>
          {/* Laptop and wider. A tablet gets the bottom bar, like a phone: it is the thumb-friendly one. */}
          <nav aria-label={t("Main menu")} className={cn("ml-3 items-center gap-1", showNav ? "hidden lg:flex" : "hidden")}>
            {groups.map((g) => (
              <NavGroupMenu key={g.group} group={g} pathname={pathname} all={items} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LangSwitch />
            <ChatBell active={pathname.startsWith("/chat")} />
            <NotificationBell
              to={role === "member" ? "/app/notifications" : "/alerts"}
              active={pathname.startsWith("/app/notifications") || pathname.startsWith("/alerts")}
            />
            {role === "member" ? (
              <Link
                to="/app/assistant"
                aria-label={t("Assistant")}
                className={cn(
                  "grid size-11 place-items-center rounded-[var(--radius-pill)] transition-colors duration-150",
                  pathname.startsWith("/app/assistant")
                    ? "bg-accent text-accent-fg shadow-[var(--shadow-accent)]"
                    : "text-fg hover:bg-wood",
                )}
              >
                <AssistantMark className="size-4" strokeWidth={1.9} />
              </Link>
            ) : null}
            <AccountMenu user={user} role={role} onLogout={() => void logout()} />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto max-w-6xl px-4 py-6 lg:pb-10",
          // Only reserve room for the dock when there is a dock.
          showNav ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-10",
        )}
      >
        <ConnectionBanner />
        <PageIn key={pathname}>
          {title ? (
            <header className="mb-6 flex items-center justify-between gap-4 px-1">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold text-balance sm:text-3xl">{title}</h1>
                {subtitle ? <p className="mt-1.5 max-w-2xl text-[0.95rem] leading-snug text-muted">{subtitle}</p> : null}
              </div>
              <Spot name={spotForPath(pathname)} className="hidden sm:block sm:h-20 sm:w-24" />
            </header>
          ) : null}
          {children}
        </PageIn>
      </main>
      {showNav ? (
        <>
      {/* The page fades out under the floating bar instead of being cut by it. */}
      <GradualBlur side="bottom" position="fixed" height="5.5rem" strength={1.6} className="z-[19] lg:hidden" />
      {/* A dock rather than a bar: it floats clear of the page, but every item is
          still a real <Link>, so prefetch, long-press and "open in new tab" work
          the way a tab bar should on a touch device. */}
      <nav aria-label={t("Main menu")} className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid max-w-md auto-cols-fr grid-flow-col rounded-[var(--radius-xl)] border border-line bg-surface p-1.5 shadow-[0_8px_30px_-12px_rgba(11,18,48,0.28)]">
          {dockItems.map((it) => {
            const active = navActive(pathname, it.to, items);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                activeOptions={{ exact: true }}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-lg)] px-0.5 text-xs transition-colors duration-200",
                  active ? "font-semibold text-accent-2" : "font-medium text-muted",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="shell-dock-active"
                    className="absolute inset-0 rounded-[var(--radius-lg)] bg-accent/10"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                ) : null}
                <motion.span
                  className="relative z-[1]"
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </motion.span>
                <span className="relative z-[1] whitespace-nowrap">{t(it.label)}</span>
              </Link>
            );
          })}
          {sheetItems.length ? (
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-lg)] px-0.5 text-xs",
                sheetItems.some((it) => navActive(pathname, it.to, items))
                  ? "bg-accent/10 font-semibold text-accent-2"
                  : "font-medium text-muted",
              )}
            >
              <Ellipsis className="size-5" strokeWidth={1.75} />
              {t("More")}
            </button>
          ) : null}
        </div>
      </nav>
      <MoreSheet items={sheetItems} pathname={pathname} all={items} open={sheet} onClose={() => setSheet(false)} />
        </>
      ) : null}
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
    const tok = getToken();
    if (!tok || !u) {
      navigate({ to: "/login" });
      return;
    }
    if (!allowed.includes(u.role)) {
      navigate({ to: homeFor(u.role) });
      return;
    }
    setUser(u);
    setReady(true);
    // Checks in the background that the session is still good. A 401 is handled inside the client
    // (it ends the session and sends the person to sign in); any other failure is a network or
    // server problem, which the connection banner explains. Signing out on every failed request
    // threw a till operator out of a working session whenever the signal dipped.
    void apiGet("/me", { background: true }).catch(() => {});
  }, [navigate, roleKey]);

  if (!ready || !user) {
    return (
      // Visible in the server render (no initial opacity: 0), so the first frame is the brand
      // rather than a white page; the mark keeps its bounce while the session is checked.
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <div className="flex flex-col items-center gap-3" role="status" aria-label={t("Loading")}>
          <motion.span
            initial={false}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArenaMark />
          </motion.span>
          <p className="font-display text-lg">Lê Long Sport</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Prices stay in dong; grouping follows the UI language (140,000đ / 140.000đ). */
export function money(n: number) {
  return new Intl.NumberFormat(locale()).format(n) + "đ";
}

export function when(iso: string) {
  return new Date(iso).toLocaleString(locale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    hour12: false,
  });
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString(locale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
