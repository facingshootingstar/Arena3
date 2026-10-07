import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, MapPin, Menu, Phone, X } from "lucide-react";
import { ArenaMark } from "@/components/mark";
import { SportIcon } from "@/components/arena-icons";
import { Cover, media } from "@/components/media";
import { Button, ButtonAnchor, ButtonLink, Card, Modal, Seg, Skeleton } from "@/components/ui";
import { CourtGrid, DateStrip, freeHours, useNowMinute, type Court as GridCourt } from "@/components/court-grid";
import { AnimatePresence, Reveal, motion, useReducedMotion } from "@/components/motion";
import { getStoredUser, getToken, homeFor } from "@/lib/arena3/client";
import { getPublicAvailability, getPublicCatalog, type CatalogPlan, type CatalogPrice } from "@/lib/arena3/catalog";
import { COACHES, type CoachCard } from "@/lib/arena3/coaches";
import { addDaysISO, levelLabel, rruleLabel, sportLabel, weekdayShort } from "@/lib/arena3/labels";
import { money } from "@/components/shell";
import { LangSwitch } from "@/components/lang-switch";
import { cn } from "@/lib/cn";
import { t, tk, tData } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  // Today's schedule loads with the page rather than behind a sign-in wall:
  // "is a court free tonight" is the question people arrive with.
  loader: async () => {
    const [catalog, availability] = await Promise.all([getPublicCatalog(), getPublicAvailability({ data: {} })]);
    return { ...catalog, availability };
  },
  component: Home,
});

/** Short weekday for display; `weekdayShort` keeps its English codes for the weekend check. */
const WD_SHORT: Record<string, string> = {
  Mon: tk("Mon"),
  Tue: tk("Tue"),
  Wed: tk("Wed"),
  Thu: tk("Thu"),
  Fri: tk("Fri"),
  Sat: tk("Sat"),
  Sun: tk("Sun"),
};
const wdLabel = (iso: string) => {
  const w = weekdayShort(iso);
  return t(WD_SHORT[w] ?? w);
};

function Home() {
  const token = getToken();
  const u = getStoredUser();
  if (token && u) return <Navigate to={homeFor(u.role)} />;
  return <Landing />;
}

const OPEN_HOUR = 6;
const CLOSE_HOUR = 22;

/** Current wall-clock hour at the centre (ICT), or null until the client mounts. */
function useVenueHour() {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const read = () =>
      setHour(
        Number(
          new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(
            new Date(),
          ),
        ),
      );
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

/** The public nav, in the order people decide: when, how much, then who teaches. */
const NAV: [string, string][] = [
  ["#schedule", tk("Court schedule")],
  ["#pricing", tk("Prices")],
  ["#classes", tk("Classes")],
  ["#coaches", tk("Coaches")],
];

function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2.5" onClick={() => setOpen(false)}>
          <ArenaMark className="size-8" />
          <span className="text-lg font-bold tracking-tight">Arena3</span>
        </Link>
        <nav aria-label={t("Main menu")} className="hidden items-center gap-1 lg:flex">
          {NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="flex h-9 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-wood hover:text-fg"
            >
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch className="hidden md:inline-flex" />
          <ButtonLink to="/login" variant="ghost" className="hidden md:inline-flex">
            {t("Sign in")}
          </ButtonLink>
          <ButtonAnchor href="#schedule" size="sm" className="sm:min-h-10 sm:px-4 sm:text-sm">
            {t("Book a court")}
          </ButtonAnchor>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("Close menu") : t("Open menu")}
            className="grid size-11 place-items-center rounded-[var(--radius-md)] text-fg transition-colors duration-150 hover:bg-wood lg:hidden"
          >
            {open ? <X className="size-5" strokeWidth={1.75} /> : <Menu className="size-5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="sheet"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-line bg-surface lg:hidden"
          >
            <nav className="mx-auto grid max-w-6xl gap-1 px-4 py-3">
              {NAV.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-[var(--radius-md)] px-3 py-3 text-base font-medium text-fg transition-colors duration-150 hover:bg-wood"
                >
                  {t(label)}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <ButtonLink to="/login" variant="outline" onClick={() => setOpen(false)} className="w-full">
                  {t("Sign in")}
                </ButtonLink>
                <ButtonLink to="/register" onClick={() => setOpen(false)} className="w-full">
                  {t("Create an account")}
                </ButtonLink>
              </div>
              <div className="flex justify-center pt-2 md:hidden">
                <LangSwitch />
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/** Weekend pricing runs on Saturday and Sunday; everything else is a weekday. */
function dayKindOf(iso: string) {
  const wd = weekdayShort(iso);
  return wd === "Sat" || wd === "Sun" ? "weekend" : "weekday";
}

/** What one hour on one sport costs on a given day, from the centre's own sheet. */
function priceFor(prices: CatalogPrice[], sport: string, date: string, hour: number) {
  const kind = dayKindOf(date);
  const rule = prices.find(
    (p) =>
      p.sport === sport &&
      p.day_kind === kind &&
      !p.court_id &&
      Number(p.start_local.slice(0, 2)) <= hour &&
      hour < Number(p.end_local.slice(0, 2)),
  );
  return rule?.price_vnd ?? null;
}

/** What a plan gives you, without the zeros ("0 court hours" is not a benefit). */
function planPerks(p: CatalogPlan): string[] {
  const out: string[] = [];
  if (p.duration_days) out.push(t("{n} days", { n: p.duration_days }));
  if (p.session_quota) out.push(t("{n} coached sessions", { n: p.session_quota }));
  if (p.court_hours > 0) out.push(t("{n} court hours", { n: p.court_hours }));
  if (p.court_discount_pct > 0) out.push(t("{n}% off court hire", { n: p.court_discount_pct }));
  return out;
}

type Sport = { id: string; photo: string; count: number; codes: string; note: string };

function SportTile({
  s,
  prices,
  freeCount,
  dayLabel,
  onShow,
  wide = false,
}: {
  s: Sport;
  prices: CatalogPrice[];
  freeCount: number;
  dayLabel: string;
  onShow: () => void;
  wide?: boolean;
}) {
  const weekday = prices.filter((p) => p.day_kind === "weekday" && !p.court_id && p.sport === s.id);
  const off = weekday.find((p) => !p.is_peak);
  const peak = weekday.find((p) => p.is_peak);
  return (
    <Card className={cn("flex h-full overflow-hidden p-0", wide ? "flex-col" : "flex-col sm:flex-row")}>
      <Cover
        src={s.photo}
        alt={sportLabel(s.id)}
        scrim="none"
        className={wide ? "aspect-[16/9]" : "aspect-[16/9] sm:aspect-auto sm:w-48 sm:shrink-0"}
      />
      <div className="flex flex-1 flex-col p-5">
        <div className={cn("flex gap-x-3 gap-y-0.5", wide ? "items-baseline justify-between" : "flex-col")}>
          <h3 className="text-xl font-bold">{sportLabel(s.id)}</h3>
          <p className="text-sm text-muted">
            {s.count === 1 ? t("1 court · {codes}", { codes: s.codes }) : t("{n} courts · {codes}", { n: s.count, codes: s.codes })}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted">{t("Off-peak")}</dt>
            <dd className="text-xl font-bold tabular-nums">{off ? money(off.price_vnd) : "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("Peak")}</dt>
            <dd className="text-xl font-bold tabular-nums text-accent-2">{peak ? money(peak.price_vnd) : "-"}</dd>
          </div>
        </dl>
        {wide ? <p className="mt-4 text-sm text-muted">{s.note}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <p className="text-sm tabular-nums text-muted">
            {freeCount ? t("{n} hours free {day}", { n: freeCount, day: dayLabel }) : t("Fully booked {day}", { day: dayLabel })}
          </p>
          <Button size="sm" variant="outline" onClick={onShow}>
            {t("See free times")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Landing() {
  const { plans, classes, prices, availability } = Route.useLoaderData();
  const [openCoach, setOpenCoach] = useState<CoachCard | null>(null);
  const reduced = useReducedMotion();
  const hour = useVenueHour();
  const isOpen = hour == null ? null : hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  // ── Today's schedule, live on the page ──────────────────────────────
  const [schedSport, setSchedSport] = useState("badminton");
  const [schedDate, setSchedDate] = useState(availability.date);
  const [sched, setSched] = useState(availability);
  const [schedBusy, setSchedBusy] = useState(false);
  const [picked, setPicked] = useState<{ court: GridCourt; hour: number } | null>(null);
  const now = useNowMinute();

  useEffect(() => {
    if (schedDate === sched.date) return;
    let alive = true;
    setSchedBusy(true);
    setPicked(null);
    getPublicAvailability({ data: { date: schedDate } })
      .then((r) => {
        if (alive) setSched(r);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setSchedBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [schedDate, sched.date]);

  const freeBySport = (s: string) =>
    freeHours(sched.courts.filter((c) => c.sport === s), sched.slots, sched.date, now).length;
  const schedFree = freeHours(sched.courts, sched.slots, sched.date, now).length;
  const schedDay =
    sched.date === availability.date
      ? t("today")
      : t("on {day}", { day: `${wdLabel(sched.date)} ${Number(sched.date.slice(8, 10))}` });
  const cheapestHour = Math.min(...prices.filter((p) => !p.court_id).map((p) => p.price_vnd));

  // After close, the first day worth showing is tomorrow: a page whose offer is "0 free hours" and
  // whose grid is a wall of finished hours tells the truth in the least useful way there is.
  useEffect(() => {
    if (!now) return;
    if (schedDate !== availability.date) return;
    if (freeHours(availability.courts, availability.slots, availability.date, now).length > 0) return;
    setSchedDate(addDaysISO(availability.date, 1));
  }, [now, schedDate, availability]);

  /** Jump to the schedule already filtered to the sport they tapped. */
  const showTimes = (s: string) => {
    setSchedSport(s);
    setPicked(null);
    document.getElementById("schedule")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  const sports: Sport[] = [
    {
      id: "badminton",
      photo: media.badminton,
      count: 12,
      codes: "CL-01…12",
      note: t("Feather-grade shuttles, 9m ceiling, wood sprung floor."),
    },
    {
      id: "basketball",
      photo: media.basketball,
      count: 2,
      codes: "BR-01, BR-02",
      note: t("Full-size hardwood with breakaway rims."),
    },
    {
      id: "volleyball",
      photo: media.volleyball,
      count: 2,
      codes: "BC-01, BC-02",
      note: t("Competition net height, referee stand, ten-second reset between sets."),
    },
  ];

  const scopes = ["badminton", "basketball", "volleyball", "all"].filter((s) => plans.some((p) => p.sport_scope === s));
  const [scope, setScope] = useState(scopes[0] ?? "badminton");
  const scopePlans = plans.filter((p) => p.sport_scope === scope);

  const [allClasses, setAllClasses] = useState(false);
  const shownClasses = allClasses ? classes : classes.slice(0, 6);

  const facts = [
    { label: t("Playing courts"), value: "16", note: t("12 badminton, 2 basketball, 2 volleyball") },
    { label: t("Open every day"), value: "06:00 - 22:00", note: t("No closing day") },
    { label: t("Head coaches"), value: "4", note: t("One per sport") },
    { label: t("Held while you pay"), value: t("5 minutes"), note: t("No card needed") },
  ];

  return (
    <main id="main-content" tabIndex={-1} className="min-h-dvh overflow-x-clip text-fg">
      <SiteHeader />

      {/* ── Hero: the offer on the left, the hall on the right ──────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.05fr_1fr] md:pt-16 lg:gap-14">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted">
            <span className="relative inline-flex size-2 text-accent">
              {isOpen ? <span className="ping-ring" /> : null}
              <span className={cn("relative inline-flex size-2 rounded-full", isOpen === false ? "bg-subtle" : "bg-accent")} />
            </span>
            {isOpen == null
              ? t("Indoor sports centre")
              : isOpen
                ? t("Open now · until {time}", { time: `${CLOSE_HOUR}:00` })
                : t("Closed · opens {time}", { time: `${String(OPEN_HOUR).padStart(2, "0")}:00` })}
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            {t("Find a free court, book it in five minutes.")}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            {t("Badminton, basketball and volleyball in Ho Chi Minh City. Open 06:00 to 22:00, every day.")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonAnchor href="#schedule" size="lg" className="group">
              {t("Book a court")}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </ButtonAnchor>
            <ButtonAnchor href="#pricing" size="lg" variant="outline">
              {t("See prices")}
            </ButtonAnchor>
          </div>
        </motion.div>

        <motion.div
          className="relative pb-6"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Cover
            src={media.hallCourts}
            alt={t("The main hall at Arena3")}
            scrim="none"
            eager
            className="aspect-[4/3] rounded-[var(--radius-xl)] shadow-[var(--shadow-soft)]"
          />
          {/* The live count is the one thing a photograph of a sports hall cannot say. */}
          <a
            href="#schedule"
            className="absolute bottom-0 left-4 right-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-soft)] ring-1 ring-line transition-colors duration-150 hover:ring-accent/50 sm:left-auto sm:right-5 sm:w-72"
          >
            <p className="text-sm text-muted">{t("Free court hours {day}", { day: schedDay })}</p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight">{schedFree}</p>
            <p className="text-sm text-muted">{t("from {price} an hour", { price: money(cheapestHour) })}</p>
          </a>
        </motion.div>
      </section>

      {/* ── Facts ───────────────────────────────────────────────────── */}
      <section aria-label={t("Arena3 at a glance")} className="border-y border-line bg-surface">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 md:grid-cols-4">
          {facts.map((f, i) => (
            <div key={f.label} className={cn("flex flex-col px-2 md:px-6", i > 0 && "md:border-l md:border-line")}>
              <dt className="order-1 text-sm text-muted">{f.label}</dt>
              <dd className="order-2 mt-1 whitespace-nowrap text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{f.value}</dd>
              <dd className="order-3 text-sm text-muted">{f.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Live schedule ────────────────────────────────────────────── */}
      <section id="schedule" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("When is a court free?")}</h2>
          <p className="mt-3 max-w-xl text-muted">
            {t("Tap a free hour to hold it for five minutes while you sign in. No card needed.")}
          </p>
        </Reveal>

        <div className="mt-7 grid justify-items-start gap-3">
          <DateStrip value={schedDate} onChange={setSchedDate} />
          <Seg
            value={schedSport}
            onChange={(v) => {
              setSchedSport(v);
              setPicked(null);
            }}
            options={[
              { value: "", label: t("All") },
              { value: "badminton", label: sportLabel("badminton") },
              { value: "basketball", label: sportLabel("basketball") },
              { value: "volleyball", label: sportLabel("volleyball") },
            ]}
          />
        </div>

        {/* What a tap on a free hour gets you, named and priced before anything is asked for. */}
        <AnimatePresence>
          {picked ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="mt-4 flex flex-wrap items-center gap-4 border border-accent/40">
                <div className="min-w-[13rem] flex-1">
                  <p className="text-sm text-muted">
                    {sportLabel(picked.court.sport)} · {picked.court.court_code}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {String(picked.hour).padStart(2, "0")}:00 - {String(picked.hour + 1).padStart(2, "0")}:00
                    <span className="ml-2 text-base font-medium text-muted">
                      {wdLabel(schedDate)} {Number(schedDate.slice(8, 10))}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {(() => {
                      const p = priceFor(prices, picked.court.sport, schedDate, picked.hour);
                      return p ? t("{price} for the hour", { price: money(p) }) : t("Priced at the desk");
                    })()}
                    , {t("held five minutes once you sign in")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink to="/login">{t("Sign in & hold it")}</ButtonLink>
                  <ButtonLink to="/register" variant="outline">
                    {t("Create an account")}
                  </ButtonLink>
                  <Button variant="ghost" onClick={() => setPicked(null)}>
                    {t("Pick another")}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-4">
          {schedBusy ? (
            <div className="grid gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-72" />
            </div>
          ) : (
            <CourtGrid
              date={sched.date}
              courts={sched.courts}
              slots={sched.slots}
              sport={schedSport || undefined}
              onPick={(court, h) => setPicked({ court, hour: h })}
              onPickSport={(s) => {
                setSchedSport(s);
                setPicked(null);
              }}
              onPickDate={setSchedDate}
              legendCompact
              selected={picked ? { courtId: picked.court.id, hour: picked.hour } : null}
            />
          )}
        </div>
      </section>

      {/* ── Courts and prices: one big tile, two small ───────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Courts and prices")}</h2>
          <p className="mt-3 max-w-xl text-muted">
            {t("Weekdays are off-peak until 17:00. Weekends follow the weekend price list.")}
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <SportTile
            s={sports[0]!}
            prices={prices}
            freeCount={freeBySport("badminton")}
            dayLabel={schedDay}
            onShow={() => showTimes("badminton")}
            wide
          />
          <div className="grid gap-4">
            {sports.slice(1).map((s) => (
              <SportTile
                key={s.id}
                s={s}
                prices={prices}
                freeCount={freeBySport(s.id)}
                dayLabel={schedDay}
                onShow={() => showTimes(s.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans, one sport at a time ────────────────────────────────── */}
      {plans.length ? (
        <section id="plans" className="scroll-mt-20 bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Membership plans")}</h2>
                <p className="mt-3 max-w-xl text-muted">
                  {t("Members draw court hours from their plan or take a discount on every booking.")}
                </p>
              </div>
              <Seg
                value={scope}
                onChange={setScope}
                options={scopes.map((s) => ({ value: s, label: sportLabel(s) }))}
              />
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {scopePlans.map((p) => (
                <Card key={p.id} className="flex flex-col gap-4 bg-bg shadow-none ring-1 ring-line">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{tData(p.name)}</h3>
                    <p className="text-2xl font-bold tabular-nums tracking-tight">{money(p.price_vnd)}</p>
                  </div>
                  <ul className="grid gap-1.5 text-sm text-muted">
                    {planPerks(p).map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <Check aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={2.25} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    to="/register"
                    variant="outline"
                    className="mt-auto w-full sm:w-fit"
                    aria-label={`${t("Create an account")}: ${tData(p.name)}`}
                  >
                    {t("Create an account")}
                  </ButtonLink>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Open classes ─────────────────────────────────────────────── */}
      <section id="classes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Open classes")}</h2>
          <p className="mt-3 max-w-xl text-muted">
            {t("Coached classes run on the same calendar as the courts. Seats go in the order people sign up.")}
          </p>
        </Reveal>
        {classes.length ? (
          <>
            <ul className="mt-8 grid gap-3 md:grid-cols-2">
              {shownClasses.map((c) => {
                const full = c.enrolled_count >= c.capacity;
                const left = Math.max(0, c.capacity - c.enrolled_count);
                return (
                  <li key={c.id} className="min-w-0">
                    <Card className="flex h-full items-center gap-4 p-4">
                      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-accent/10 text-accent-2">
                        <SportIcon sport={c.sport} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {sportLabel(c.sport)} · {levelLabel(c.level)}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {rruleLabel(c.rrule)} · {c.court_code} · {c.coach_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={cn("text-xs tabular-nums", left <= 2 ? "text-hold" : "text-muted")}>
                          {full ? t("Full, waitlist open") : left === 1 ? t("1 seat left") : t("{n} seats left", { n: left })}
                        </span>
                        <ButtonLink
                          to="/register"
                          size="sm"
                          variant={full ? "outline" : "primary"}
                          aria-label={`${full ? t("Join the waitlist") : t("Enrol")}: ${sportLabel(c.sport)} ${levelLabel(c.level)}`}
                        >
                          {full ? t("Join the waitlist") : t("Enrol")}
                        </ButtonLink>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {classes.length > 6 ? (
              <button
                type="button"
                onClick={() => setAllClasses((v) => !v)}
                className="hit mt-5 text-sm font-semibold text-accent-2 hover:underline"
              >
                {allClasses ? t("Show fewer") : t("Show all {n} classes", { n: classes.length })}
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">{t("No classes published yet.")}</p>
        )}
      </section>

      {/* ── Coaches ──────────────────────────────────────────────────── */}
      <section id="coaches" className="scroll-mt-20 border-t border-line py-16">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Coaches")}</h2>
            <p className="mt-3 max-w-xl text-muted">{t("One head coach per sport, and they teach the classes themselves.")}</p>
          </Reveal>
        </div>
        <ul className="mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-4 md:overflow-visible">
          {COACHES.map((c) => (
            <li key={c.name} className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-auto">
              <button
                type="button"
                onClick={() => setOpenCoach(c)}
                className="group block w-full text-left"
                aria-label={`${c.name}: ${t("View details")}`}
              >
                <Cover
                  src={c.photo}
                  alt={c.name}
                  scrim="none"
                  className="aspect-[4/5] rounded-[var(--radius-xl)]"
                  imgClassName="transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:scale-[1.03]"
                />
                <p className="mt-3 font-semibold">{c.name}</p>
                <p className="text-sm text-muted">{t(c.title)}</p>
              </button>
            </li>
          ))}
        </ul>

        <Modal
          open={!!openCoach}
          onClose={() => setOpenCoach(null)}
          title={openCoach?.name ?? ""}
          footer={
            <>
              <ButtonAnchor href="#classes" onClick={() => setOpenCoach(null)}>
                {t("See open classes")}
              </ButtonAnchor>
              <Button variant="ghost" onClick={() => setOpenCoach(null)}>
                {t("Close")}
              </Button>
            </>
          }
        >
          {openCoach ? (
            <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
              <Cover src={openCoach.photo} alt={openCoach.name} scrim="none" className="aspect-[3/4] rounded-[var(--radius-lg)]" />
              <div>
                <p className="text-sm text-muted">{sportLabel(openCoach.sport)}</p>
                <p className="mt-1 text-sm font-medium">{t(openCoach.title)}</p>
                <p className="mt-3 text-sm text-muted">{t(openCoach.blurb)}</p>
                <ul className="mt-4 grid gap-1.5 text-sm text-muted">
                  {openCoach.creds.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      {t(x)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </Modal>
      </section>

      <Testimonials />

      {/* ── Visit ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <div className="grid overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-border)] md:grid-cols-2">
            <Cover src={media.exterior} alt={t("The Arena3 frontage at dusk")} scrim="none" className="min-h-60" />
            <div className="p-6 sm:p-10">
              <h2 className="text-3xl font-bold tracking-tight">{t("Visit Arena3")}</h2>
              <ul className="mt-5 grid gap-3 text-muted">
                <li className="flex gap-3">
                  <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
                  {t("06:00 to 22:00, seven days a week")}
                </li>
                <li className="flex gap-3">
                  <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
                  {t("Ho Chi Minh City")}
                </li>
                <li className="flex gap-3">
                  <Phone aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
                  {t("Front desk, during opening hours")}
                </li>
              </ul>
              <p className="mt-5 text-sm text-muted">{t("Walk-in players do not need an account.")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink to="/register">{t("Create an account")}</ButtonLink>
                <ButtonLink to="/login" variant="outline">
                  {t("Sign in")}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <div className="flex items-center gap-2.5">
            <ArenaMark className="size-7" />
            <span className="font-semibold text-fg">Arena3</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <nav aria-label={t("Footer")} className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="hit hover:text-fg">
                {t(label)}
              </a>
            ))}
            <a href="#plans" className="hit hover:text-fg">
              {t("Membership plans")}
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/** Demo member quotes, keyed to the seeded member profiles. */
const TESTIMONIALS = [
  {
    quote: tk(
      "I book between meetings and the court is simply there when I arrive. The five-minute hold is the reason I stopped ringing ahead.",
    ),
    name: "Nguyễn Văn Nam",
    meta: tk("Badminton member"),
  },
  {
    quote: tk("The beginner ladder moved me onto a real training plan, and my knee has been fine since the coach reworked my footwork."),
    name: "Trần Mỹ Linh",
    meta: tk("Badminton member"),
  },
  {
    quote: tk(
      "Plan hours come straight off at the desk. No cash, no working out what counts as peak, no arguing about the price on a Saturday morning.",
    ),
    name: "Phạm Hoàng Long",
    meta: tk("Badminton member"),
  },
];

/** One quote at a time; the reader turns it, nothing moves on a timer. */
function Testimonials() {
  const [i, setI] = useState(0);
  const n = TESTIMONIALS.length;
  const q = TESTIMONIALS[i]!;
  const step = (d: number) => setI((prev) => (prev + d + n) % n);
  return (
    <section aria-label={t("What members say")} className="mx-auto max-w-4xl px-4 py-16">
      <figure>
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={q.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-[7.5rem] text-xl font-semibold leading-snug tracking-tight sm:min-h-[6rem] sm:text-2xl"
          >
            “{t(q.quote)}”
          </motion.blockquote>
        </AnimatePresence>
        <figcaption className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">{q.name}</span>
            <span className="block text-sm text-muted">{t(q.meta)}</span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("Previous quote")}
              onClick={() => step(-1)}
              className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg transition-colors duration-150 hover:bg-wood"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <span className="min-w-10 text-center text-sm tabular-nums text-muted">
              {i + 1}/{n}
            </span>
            <button
              type="button"
              aria-label={t("Next quote")}
              onClick={() => step(1)}
              className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg transition-colors duration-150 hover:bg-wood"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

