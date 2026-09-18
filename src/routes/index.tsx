import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Clock, MapPin, Phone, Quote, Sparkles } from "lucide-react";
import { ArenaMark } from "@/components/mark";
import { Cover, HeroVideo, MediaCaption, media, sportPhoto } from "@/components/media";
import { Button, Card, Seg } from "@/components/ui";
import {
  AnimatePresence,
  CountUp,
  Lift,
  Parallax,
  Reveal,
  ScrollProgress,
  Stagger,
  StaggerItem,
  Tilt,
  WordReveal,
  motion,
  useReducedMotion,
} from "@/components/motion";
import { getStoredUser, getToken, homeFor } from "@/lib/arena3/client";
import { getPublicCatalog } from "@/lib/arena3/catalog";
import { COACHES } from "@/lib/arena3/coaches";
import { levelLabel, rruleLabel, sportLabel } from "@/lib/arena3/labels";
import { money } from "@/components/shell";

export const Route = createFileRoute("/")({
  loader: () => getPublicCatalog(),
  component: Home,
});

function Home() {
  const t = getToken();
  const u = getStoredUser();
  if (t && u) return <Navigate to={homeFor(u.role)} />;
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
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            hour12: false,
          }).format(new Date()),
        ),
      );
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

function Landing() {
  const { plans, classes, prices } = Route.useLoaderData();
  const [coachSport, setCoachSport] = useState("");
  const reduced = useReducedMotion();
  const hour = useVenueHour();
  const isOpen = hour == null ? null : hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  const sports = [
    {
      id: "badminton",
      photo: media.badminton,
      courts: "8 courts · CL-01…08",
      peak: "140,000đ",
      note: "Feather-grade shuttles, 9m ceiling, wood sprung floor.",
    },
    {
      id: "basketball",
      photo: media.basketball,
      courts: "1 court · BR-01",
      peak: "500,000đ",
      note: "Full-size hardwood, breakaway rims, convertible to four badminton bays.",
    },
    {
      id: "volleyball",
      photo: media.volleyball,
      courts: "1 court · BC-01",
      peak: "400,000đ",
      note: "Competition net height, referee stand, ten-second reset between sets.",
    },
  ];

  const weekday = prices.filter((p) => p.day_kind === "weekday" && !p.court_id);
  const coaches = COACHES.filter((c) => !coachSport || c.sport === coachSport);

  // Named against the court codes and gear SKUs the schedule actually uses, so
  // the marketing page and the booking grid describe the same building.
  const facilities = [
    {
      code: "CL-01…08",
      name: "Badminton courts",
      photo: media.badmintonCourt,
      note: "Eight bays on sprung wood. Feather-grade shuttles are issued at the counter, not sold from a machine.",
    },
    {
      code: "BR-01",
      name: "Basketball court",
      photo: media.basketballCourt,
      note: "Full-size hardwood with breakaway rims — and it converts to four badminton bays when the schedule needs them.",
    },
    {
      code: "BC-01",
      name: "Volleyball court",
      photo: media.volleyballCourt,
      note: "Competition net height with a referee stand on the side and a ten-second reset between sets.",
    },
    {
      code: "Reception",
      name: "Front desk",
      photo: media.reception,
      note: "Staffed the whole time we are open. Rackets, shuttle tubes and match balls go out on your tab and settle with the court.",
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Pick your slot",
      body: "Live court map, hour by hour. What you see is what is actually free — holds expire in front of you.",
    },
    {
      n: "02",
      title: "Hold it for five minutes",
      body: "The slot is yours while you decide. No card up front, no deposit, no phone call.",
    },
    {
      n: "03",
      title: "Pay at the desk",
      body: "Cash, transfer or straight off your plan's hour balance. Three taps at reception and you are on court.",
    },
  ];

  return (
    <main className="min-h-dvh overflow-x-clip text-fg">
      <ScrollProgress />

      <header className="sticky top-0 z-30 border-b border-line/70 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <motion.span
              whileHover={reduced ? undefined : { rotate: -8, scale: 1.06 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="inline-flex"
            >
              <ArenaMark className="size-8" />
            </motion.span>
            <span className="font-display text-xl font-normal italic">Arena3</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ["#courts", "Courts"],
              ["#how", "How it works"],
              ["#coaches", "Coaches"],
              ["#facilities", "Facilities"],
              ["#plans", "Plans"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="link-underline kicker text-2xs text-muted transition-colors duration-200 hover:text-fg"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex gap-2">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button>Join</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[88dvh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroVideo src={media.hallVideo} poster={media.hallCourts} />
        </motion.div>
        <div className="hero-scrim pointer-events-none absolute inset-0" />

        <div className="relative mx-auto flex min-h-[88dvh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="max-w-2xl rounded-[var(--radius-xl)] bg-surface/95 p-6 text-fg shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-9"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative inline-flex size-2 text-accent">
                {isOpen ? <span className="ping-ring" /> : null}
                <span
                  className={`relative inline-flex size-2 rounded-full ${
                    isOpen === false ? "bg-line-strong" : "bg-accent"
                  }`}
                />
              </span>
              <p className="kicker text-2xs text-muted">
                {isOpen == null
                  ? "Indoor sports centre"
                  : isOpen
                    ? `Open now · until ${CLOSE_HOUR}:00`
                    : `Closed · opens ${String(OPEN_HOUR).padStart(2, "0")}:00`}
              </p>
            </div>

            <h1 className="mt-4 font-display text-5xl font-medium italic leading-[0.94] sm:text-7xl">
              <WordReveal text="Courts, classes, plans —" delay={0.35} />
              <br />
              <WordReveal text="one calendar." delay={0.75} className="text-gradient" />
            </h1>

            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.7 }}
              className="mt-5 max-w-lg text-muted"
            >
              Badminton, basketball, volleyball. Open 06:00–22:00, every day. Book a court in five
              minutes; the desk closes you out in three taps.
            </motion.p>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.35, duration: 0.6 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link to="/register">
                <Button size="lg" className="group">
                  Become a member
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#courts">
                <Button variant="outline" size="lg">
                  See courts &amp; pricing
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll cue */}
        {reduced ? null : (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
          >
            <motion.div
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
              className="grid h-10 w-6 place-items-start rounded-full border border-on-media/45 pt-2"
            >
              <span className="size-1 rounded-full bg-on-media/80" />
            </motion.div>
          </motion.div>
        )}
      </section>

      {/* ── Counters ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-fg text-on-media">
        <div className="wash wash-accent -left-24 -top-32 size-80 opacity-70" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-px bg-on-media/12 sm:grid-cols-4">
          {[
            { to: 10, label: "Courts & bays", suffix: "" },
            { to: 3, label: "Indoor sports", suffix: "" },
            { to: 4, label: "Head coaches", suffix: "" },
            { to: 16, label: "Hours open daily", suffix: "h" },
          ].map((s) => (
            <div key={s.label} className="bg-fg px-4 py-9 text-center sm:py-12">
              <p className="athletic text-5xl tabular-nums sm:text-6xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </p>
              <p className="kicker mt-3 text-2xs text-on-media-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Courts ───────────────────────────────────────────────── */}
      <section id="courts" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">Three sports</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">Courts open today</h2>
          <p className="mt-3 max-w-md text-muted">
            One hall, ten playing surfaces. The basketball floor converts to four badminton bays when
            the schedule asks for it.
          </p>
        </Reveal>

        <Stagger className="mt-8 grid gap-4 md:grid-cols-3" gap={0.1}>
          {sports.map((s) => (
            <StaggerItem key={s.id}>
              <Tilt>
                <Lift className="h-full">
                  <Cover
                    src={s.photo}
                    alt={sportLabel(s.id)}
                    scrim="none"
                    className="group aspect-[4/5] rounded-[var(--radius-xl)] shadow-[var(--shadow-border)]"
                    imgClassName="transition-transform duration-[900ms] ease-[var(--ease-smooth)] group-hover:scale-[1.07]"
                  >
                    <MediaCaption className="transition-[padding] duration-300 group-hover:pb-5">
                      <p className="athletic text-3xl sm:text-4xl">{sportLabel(s.id)}</p>
                      <p className="mt-1 text-sm text-on-media-muted">
                        {s.courts} · peak {s.peak}/hr
                      </p>
                      {/* Detail line unrolls on hover instead of crowding the card at rest. */}
                      <p className="mt-0 max-h-0 overflow-hidden text-sm text-on-media-muted opacity-0 transition-all duration-500 ease-[var(--ease-smooth)] group-hover:mt-2 group-hover:max-h-24 group-hover:opacity-100">
                        {s.note}
                      </p>
                    </MediaCaption>
                  </Cover>
                </Lift>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Class marquee ────────────────────────────────────────── */}
      {classes.length ? (
        <section
          aria-label="Classes running this week"
          className="relative z-0 overflow-hidden border-y border-line bg-surface/80 py-5"
        >
          <div className="marquee">
            <div className="marquee-track items-center">
              {[...classes, ...classes].map((c, i) => (
                <span
                  key={`${c.id}-${i}`}
                  className="inline-flex items-center gap-3 whitespace-nowrap text-sm"
                >
                  <span className="athletic text-xl sm:text-2xl">{sportLabel(c.sport)}</span>
                  <span className="kicker text-2xs text-muted">{levelLabel(c.level)}</span>
                  <span className="tabular-nums text-accent-2">{rruleLabel(c.rrule)}</span>
                  <span className="text-subtle">{c.court_code}</span>
                  <span aria-hidden className="size-1.5 rounded-full bg-accent/45" />
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">Booking</p>
          <h2 className="mt-2 max-w-xl font-display text-4xl sm:text-5xl">
            Three steps, no phone call.
          </h2>
        </Reveal>

        <div className="relative mt-10">
          {/* Connector line draws itself across the three steps. */}
          <motion.div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px origin-left bg-line-strong/60 md:block"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <Stagger className="grid gap-8 md:grid-cols-3" gap={0.14}>
            {steps.map((s) => (
              <StaggerItem key={s.n}>
                <div className="relative">
                  <span className="athletic relative z-[1] grid size-12 place-items-center rounded-full bg-accent pt-0.5 text-lg tabular-nums text-accent-fg shadow-[var(--shadow-accent)]">
                    {s.n}
                  </span>
                  <h3 className="mt-5 font-display text-2xl">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Coaches ──────────────────────────────────────────────── */}
      <section id="coaches" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">The team</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl sm:text-5xl">
            Coaches who actually take the session — not poster faces.
          </h2>
          <p className="mt-3 max-w-lg text-muted">
            One head coach per sport. Classes never sit on court time you already bought. Sessions
            show up in the app the moment you join.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-6">
          <Seg
            value={coachSport}
            onChange={setCoachSport}
            options={[
              { value: "", label: "All" },
              { value: "badminton", label: "Badminton" },
              { value: "basketball", label: "Basketball" },
              { value: "volleyball", label: "Volleyball" },
            ]}
          />
        </Reveal>

        {/* layout animation reflows the grid smoothly as the filter changes. */}
        <motion.div layout className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {coaches.map((c) => (
            <motion.div
              key={c.name}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card interactive className="group h-full overflow-hidden p-0">
                <Cover
                  src={c.photo}
                  alt={c.name}
                  scrim="none"
                  className="aspect-[3/4]"
                  imgClassName="transition-transform duration-[900ms] ease-[var(--ease-smooth)] group-hover:scale-105"
                >
                  <MediaCaption>
                    <p className="kicker text-2xs text-on-media-muted">
                      {sportLabel(c.sport)}
                    </p>
                    <p className="athletic mt-1 text-2xl">{c.name}</p>
                  </MediaCaption>
                </Cover>
                <div className="p-4">
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="mt-2 text-sm text-muted">{c.blurb}</p>
                  <ul className="mt-3 grid gap-1 text-xs text-muted">
                    {c.creds.map((x) => (
                      <li key={x} className="flex gap-1.5">
                        <span className="text-accent">·</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Facilities ───────────────────────────────────────────── */}
      <section id="facilities" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">The building</p>
          <h2 className="mt-2 max-w-xl font-display text-4xl sm:text-5xl">
            One roof, ten surfaces, one desk.
          </h2>
          <p className="mt-3 max-w-lg text-muted">
            Everything the schedule can sell you sits in the same hall — so a court, a class and a
            racket all close out on one tab at reception.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          <Lift>
            <Cover
              src={media.hallCourts}
              alt="The main hall at Arena3"
              className="group aspect-[16/9] rounded-[var(--radius-xl)] shadow-[var(--shadow-border)] sm:aspect-[16/7]"
              imgClassName="transition-transform duration-[1100ms] ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
            >
              <MediaCaption>
                <p className="kicker text-2xs text-on-media-muted">Main hall</p>
                <p className="athletic mt-1.5 text-4xl sm:text-5xl">Ten playing surfaces</p>
                <p className="mt-2 max-w-md text-sm text-on-media-muted">
                  A nine-metre ceiling, sprung wood underfoot and lighting rated for evening play
                  right through to close.
                </p>
              </MediaCaption>
            </Cover>
          </Lift>
        </Reveal>

        <Stagger className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.09}>
          {facilities.map((f) => (
            <StaggerItem key={f.name}>
              <Lift className="h-full">
                <Cover
                  src={f.photo}
                  alt={f.name}
                  scrim="media"
                  className="group aspect-[4/5] rounded-[var(--radius-xl)] shadow-[var(--shadow-border)]"
                  imgClassName="transition-transform duration-[900ms] ease-[var(--ease-smooth)] group-hover:scale-[1.07]"
                >
                  <MediaCaption>
                    <p className="kicker text-2xs text-on-media-muted">{f.code}</p>
                    <p className="athletic mt-1.5 text-2xl">{f.name}</p>
                    <p className="mt-0 max-h-0 overflow-hidden text-sm text-on-media-muted opacity-0 transition-all duration-500 ease-[var(--ease-smooth)] group-hover:mt-2 group-hover:max-h-32 group-hover:opacity-100">
                      {f.note}
                    </p>
                  </MediaCaption>
                </Cover>
              </Lift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal from="left">
              <p className="kicker text-2xs text-muted">Court rental</p>
              <h2 className="mt-2 font-display text-4xl">Peak / off-peak</h2>
              <p className="mt-3 text-muted">
                Mon–Fri is off-peak until 17:00. Weekends run on the weekend sheet. Members either
                draw down plan hours or take the percentage off.
              </p>
            </Reveal>

            <Reveal from="left" delay={0.12}>
              <div className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-border)]">
                <table className="w-full text-sm">
                  <thead className="kicker text-left text-2xs text-muted">
                    <tr className="border-b border-line">
                      <th className="px-4 py-3 font-medium">Sport</th>
                      <th className="px-4 py-3 font-medium">Off-peak</th>
                      <th className="px-4 py-3 font-medium">Peak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["badminton", "basketball", "volleyball"].map((sport) => {
                      const off = weekday.find((p) => p.sport === sport && !p.is_peak);
                      const peak = weekday.find((p) => p.sport === sport && p.is_peak);
                      return (
                        <tr
                          key={sport}
                          className="border-b border-line transition-colors duration-200 last:border-0 hover:bg-wood/60"
                        >
                          <td className="px-4 py-3.5 font-medium">{sportLabel(sport)}</td>
                          <td className="px-4 py-3.5 tabular-nums">
                            {off ? money(off.price_vnd) : "—"}
                          </td>
                          <td className="px-4 py-3.5 font-medium tabular-nums text-accent-2">
                            {peak ? money(peak.price_vnd) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>

          <Reveal from="right" delay={0.1}>
            <Cover
              src={media.courtDetail}
              alt=""
              className="min-h-64 rounded-[var(--radius-xl)] md:min-h-full"
            >
              <video
                className="absolute inset-0 size-full object-cover"
                src={media.smash}
                poster={media.courtDetail}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden
              />
            </Cover>
          </Reveal>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────────── */}
      <section id="plans" className="relative mx-auto max-w-6xl scroll-mt-20 overflow-hidden px-4 pb-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">Memberships</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">Buy in the app, settle at the desk</h2>
        </Reveal>

        <Stagger className="mt-8 grid gap-4 md:grid-cols-3" gap={0.1}>
          {plans.map((p, i) => (
            <StaggerItem key={p.id} className="h-full">
              <Lift className="h-full">
                <Card interactive className="group flex h-full flex-col overflow-hidden p-0">
                  <Cover
                    src={sportPhoto(p.sport_scope)}
                    alt=""
                    scrim="none"
                    className="h-36"
                    imgClassName="transition-transform duration-[900ms] ease-[var(--ease-smooth)] group-hover:scale-110"
                  >
                    <MediaCaption>
                      <p className="kicker text-2xs">
                        {sportLabel(p.sport_scope)}
                      </p>
                    </MediaCaption>
                  </Cover>
                  <div className="flex flex-1 flex-col p-5">
                    {i === 1 ? (
                      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-2xs font-medium uppercase tracking-wider text-accent-2">
                        <Sparkles className="size-3" /> Most picked
                      </span>
                    ) : null}
                    <h3 className="font-display text-2xl">{p.name}</h3>
                    <p className="mt-3 font-display text-3xl tabular-nums">{money(p.price_vnd)}</p>
                    <p className="mt-2 flex-1 text-sm text-muted">
                      {p.duration_days ? `${p.duration_days} days` : "Per session"} ·{" "}
                      {p.court_hours} court hours · {p.court_discount_pct}% off
                    </p>
                    <Link to="/register" className="mt-5 block">
                      <Button className="w-full">Join to buy</Button>
                    </Link>
                  </div>
                </Card>
              </Lift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Open classes ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Reveal>
          <p className="kicker text-2xs text-muted">Open classes</p>
          <h2 className="mt-2 font-display text-4xl">Enrol while seats last</h2>
        </Reveal>

        <Stagger className="mt-8 grid gap-4 md:grid-cols-2" gap={0.08}>
          {classes.slice(0, 4).map((c) => {
            const pct = c.capacity ? Math.min(100, (c.enrolled_count / c.capacity) * 100) : 0;
            const nearlyFull = pct >= 80;
            return (
              <StaggerItem key={c.id}>
                <Card interactive className="flex gap-4 p-3">
                  <Cover
                    src={sportPhoto(c.sport)}
                    alt=""
                    className="h-28 w-28 shrink-0 rounded-[var(--radius-lg)]"
                  />
                  <div className="min-w-0 flex-1 py-1">
                    <p className="kicker text-2xs text-muted">
                      {sportLabel(c.sport)}
                    </p>
                    <p className="font-display text-xl">{levelLabel(c.level)}</p>
                    <p className="truncate text-sm text-muted">
                      {c.coach_name} · {c.court_code} · {c.duration_min}′
                    </p>
                    <p className="text-sm">{rruleLabel(c.rrule)}</p>
                    {/* Seat meter fills as it scrolls in. */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-wood">
                        <motion.span
                          className={`block h-full rounded-full ${nearlyFull ? "bg-hold" : "bg-accent"}`}
                          initial={reduced ? false : { width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true, amount: 0.6 }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          style={reduced ? { width: `${pct}%` } : undefined}
                        />
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-subtle">
                        {c.enrolled_count}/{c.capacity}
                      </span>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
          {!classes.length ? (
            <p className="text-sm text-muted">No classes published yet.</p>
          ) : null}
        </Stagger>
      </section>

      <Testimonials />

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="relative mx-4 mb-16 overflow-hidden rounded-[var(--radius-xl)] md:mx-auto md:max-w-6xl">
        <Parallax speed={0.09} className="overflow-hidden rounded-[var(--radius-xl)]">
          <Cover
            src={media.exterior}
            alt="The Arena3 frontage at dusk"
            className="min-h-[26rem]"
            scrim="hero"
          >
            <div className="relative flex min-h-[26rem] flex-col justify-end p-6 sm:p-12">
              <Reveal>
                <p className="max-w-md font-display text-4xl text-on-media on-media sm:text-5xl">
                  06:00–22:00 · seven days
                </p>
                <p className="mt-3 max-w-sm text-on-media-muted on-media">
                  Reception is staffed the whole time we are open. Walk-ins never need an account.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/register">
                    <Button size="lg" className="bg-on-media text-fg hover:bg-surface">
                      Create an account
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-on-media/40 bg-transparent text-on-media hover:bg-on-media/10"
                    >
                      Sign in
                    </Button>
                  </Link>
                </div>
              </Reveal>
            </div>
          </Cover>
        </Parallax>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <ArenaMark className="size-8" />
              <span className="font-display text-xl italic">Arena3</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted">
              An indoor sports centre that runs courts, classes and memberships off a single
              calendar.
            </p>
          </div>

          <div>
            <p className="kicker text-2xs text-muted">Visit</p>
            <ul className="mt-4 grid gap-3 text-sm">
              <li className="flex gap-2.5 text-muted">
                <Clock className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
                06:00–22:00, seven days
              </li>
              <li className="flex gap-2.5 text-muted">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
                Ho Chi Minh City
              </li>
              <li className="flex gap-2.5 text-muted">
                <Phone className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
                Front desk, during opening hours
              </li>
            </ul>
          </div>

          <div>
            <p className="kicker text-2xs text-muted">Explore</p>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {[
                ["#courts", "Courts & pricing"],
                ["#how", "How booking works"],
                ["#coaches", "Coaches"],
                ["#plans", "Membership plans"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="link-underline text-muted hover:text-fg">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 kicker text-2xs text-subtle">
            <span>© {new Date().getFullYear()} Arena3</span>
            <span>Badminton · Basketball · Volleyball</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/** Demo member quotes, keyed to the seeded member profiles. */
const TESTIMONIALS = [
  {
    quote:
      "I book between meetings and the court is simply there when I arrive. The five-minute hold is the reason I stopped ringing ahead.",
    name: "Nguyễn Văn Nam",
    meta: "Badminton · A3-2026-0001",
  },
  {
    quote:
      "The beginner ladder moved me onto a real training plan without it ever feeling like a test — and my knee has been fine since the coach reworked my footwork.",
    name: "Trần Mỹ Linh",
    meta: "Badminton · A3-2026-0002",
  },
  {
    quote:
      "Plan hours come straight off at the desk. No cash, no working out what counts as peak, no arguing about the price on a Saturday morning.",
    name: "Phạm Hoàng Long",
    meta: "Badminton · A3-2026-0003",
  },
];

/**
 * Quote carousel. Advances itself so the section has a pulse, but stops the
 * moment a reader hovers it (they are mid-sentence) or has asked for reduced
 * motion — an auto-rotating block of text is the classic accessibility trap.
 */
function Testimonials() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduced) return;
    const id = setTimeout(() => setI((n) => (n + 1) % TESTIMONIALS.length), 6500);
    return () => clearTimeout(id);
  }, [i, paused, reduced]);

  const t = TESTIMONIALS[i]!;

  return (
    <section aria-label="What members say" className="mx-auto max-w-6xl px-4 pb-20">
      <Reveal>
        <p className="kicker text-2xs text-muted">Members</p>
        <h2 className="mt-2 font-display text-4xl sm:text-5xl">What the regulars say</h2>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <Card
          className="relative overflow-hidden p-0"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="wash wash-accent -right-24 -top-28 size-72 opacity-40" />
          <div className="relative p-6 sm:p-10">
            <Quote className="size-8 text-accent/45" strokeWidth={1.5} />
            {/* Fixed height keeps the dots still while quotes of different
                lengths cross-fade through. */}
            <div className="mt-5 min-h-[13rem] sm:min-h-[10rem]">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={i}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -14 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="max-w-3xl font-display text-2xl leading-snug sm:text-3xl">
                    “{t.quote}”
                  </p>
                  <footer className="mt-5">
                    <p className="athletic text-lg">{t.name}</p>
                    <p className="kicker mt-1.5 text-2xs text-muted">{t.meta}</p>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>
            </div>

            <div className="mt-6 flex gap-2">
              {TESTIMONIALS.map((x, n) => (
                <button
                  key={x.name}
                  type="button"
                  aria-label={`Show quote ${n + 1} of ${TESTIMONIALS.length}`}
                  aria-current={n === i}
                  onClick={() => setI(n)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    n === i ? "w-9 bg-accent" : "w-3.5 bg-line-strong hover:bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>
      </Reveal>
    </section>
  );
}
