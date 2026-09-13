import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArenaMark } from "@/components/mark";
import { Cover, HeroVideo, MediaCaption, media, sportPhoto } from "@/components/media";
import { Button, Card, Seg } from "@/components/ui";
import { getStoredUser, getToken, homeFor, apiGet } from "@/lib/arena3/client";
import { COACHES } from "@/lib/arena3/coaches";
import { levelLabel, rruleLabel, sportLabel } from "@/lib/arena3/labels";
import { money } from "@/components/shell";

export const Route = createFileRoute("/")({ component: Home });

type Plan = {
  id: string;
  name: string;
  sport_scope: string;
  duration_days: number | null;
  session_quota: number | null;
  court_hours: number;
  court_discount_pct: number;
  price_vnd: number;
};

type Cl = {
  id: string;
  sport: string;
  level: string;
  capacity: number;
  enrolled_count: number;
  court_code: string;
  coach_name: string;
  rrule: string;
  duration_min: number;
};

type Price = {
  sport: string;
  day_kind: string;
  start_local: string;
  end_local: string;
  price_vnd: number;
  is_peak: boolean;
  court_id?: string | null;
};

function Home() {
  const t = getToken();
  const u = getStoredUser();
  if (t && u) return <Navigate to={homeFor(u.role)} />;
  return <Landing />;
}

function Landing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [classes, setClasses] = useState<Cl[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [coachSport, setCoachSport] = useState("");

  useEffect(() => {
    void apiGet<{ items: Plan[] }>("/plans").then((r) => setPlans(r.items)).catch(() => {});
    void apiGet<{ items: Cl[] }>("/classes").then((r) => setClasses(r.items)).catch(() => {});
    void apiGet<{ items: Price[] }>("/price-rules").then((r) => setPrices(r.items)).catch(() => {});
  }, []);

  const sports = [
    { id: "badminton", photo: media.badminton, courts: "8 sân CL-01…08", peak: "140.000đ" },
    { id: "basketball", photo: media.basketball, courts: "1 sân BR-01", peak: "500.000đ" },
    { id: "volleyball", photo: media.volleyball, courts: "1 sân BC-01", peak: "400.000đ" },
  ];

  const weekday = prices.filter((p) => p.day_kind === "weekday" && !p.court_id);
  const coaches = COACHES.filter((c) => !coachSport || c.sport === coachSport);

  return (
    <main className="min-h-dvh text-fg">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <ArenaMark className="size-8" />
            <span className="font-display text-xl font-normal italic">Arena3</span>
          </Link>
          <div className="flex gap-2">
            <a href="#hlv" className="hidden sm:block">
              <Button variant="ghost">Huấn luyện viên</Button>
            </a>
            <Link to="/login">
              <Button variant="ghost">Đăng nhập</Button>
            </Link>
            <Link to="/register">
              <Button>Đăng ký</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-[82dvh] overflow-hidden">
        <HeroVideo src={media.hallVideo} poster={media.hallCourts} />
        <div className="hero-scrim pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-end px-4 pb-16 pt-16">
          <div className="max-w-xl rounded-[var(--radius-xl)] bg-surface p-6 text-fg shadow-[var(--shadow-soft)] sm:p-8">
            <p className="text-2xs font-medium uppercase tracking-wider text-muted">
              Trung tâm thể thao trong nhà
            </p>
            <h1 className="mt-3 font-display text-5xl font-medium italic leading-[0.95] sm:text-7xl">
              Sân, lớp, gói — một lịch.
            </h1>
            <p className="mt-4 text-muted">
              Cầu lông, bóng rổ, bóng chuyền. 06:00–22:00 mỗi ngày. Đặt sân 5 phút, quầy 3 thao tác.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="md">Trở thành thành viên</Button>
              </Link>
              <a href="#san">
                <Button variant="outline">Xem sân & giá</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="san" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-2xs uppercase tracking-wider text-muted">Ba môn</p>
        <h2 className="mt-2 font-display text-4xl">Sân đang mở</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {sports.map((s) => (
            <Cover key={s.id} src={s.photo} alt={sportLabel(s.id)} scrim="none" className="aspect-[4/5] rounded-[var(--radius-xl)]">
              <MediaCaption>
                <p className="font-display text-3xl">{sportLabel(s.id)}</p>
                <p className="mt-1 text-sm text-on-media-muted">
                  {s.courts} · cao điểm {s.peak}/giờ
                </p>
              </MediaCaption>
            </Cover>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["10", "Sân / khu"],
            ["3", "Môn trong nhà"],
            ["4", "Huấn luyện viên"],
            ["16h", "Mở cửa / ngày"],
          ].map(([n, l]) => (
            <Card key={l} className="p-4 text-center sm:p-5">
              <p className="font-display text-3xl tabular-nums">{n}</p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-muted">{l}</p>
            </Card>
          ))}
        </div>
      </section>

      {classes.length ? (
        <section aria-label="Lịch tuần này" className="relative z-0 overflow-hidden border-y border-line bg-surface/80 py-4">
          <div className="marquee">
            <div className="marquee-track">
              {[...classes, ...classes].map((c, i) => (
                <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                  <span className="font-medium">{sportLabel(c.sport)}</span>
                  <span className="text-muted">{levelLabel(c.level)}</span>
                  <span className="tabular-nums text-accent-2">{rruleLabel(c.rrule)}</span>
                  <span className="text-subtle">{c.court_code}</span>
                  <span className="text-line-strong">·</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section id="hlv" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-2xs uppercase tracking-wider text-muted">Đội ngũ</p>
        <h2 className="mt-2 max-w-xl font-display text-4xl">Huấn luyện viên đứng lớp — không phải poster.</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Mỗi môn một HLV trưởng. Lớp không đè giờ sân đã bán. Xem buổi trên app sau khi đăng ký.
        </p>
        <div className="mt-5">
          <Seg
            value={coachSport}
            onChange={setCoachSport}
            options={[
              { value: "", label: "Tất cả" },
              { value: "badminton", label: "Cầu lông" },
              { value: "basketball", label: "Bóng rổ" },
              { value: "volleyball", label: "Bóng chuyền" },
            ]}
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {coaches.map((c) => (
            <Card key={c.name} className="overflow-hidden p-0">
              <Cover src={c.photo} alt={c.name} scrim="none" className="aspect-[3/4]">
                <MediaCaption>
                  <p className="text-2xs uppercase tracking-wider text-on-media-muted">{sportLabel(c.sport)}</p>
                  <p className="font-display text-2xl leading-tight">{c.name}</p>
                </MediaCaption>
              </Cover>
              <div className="p-4">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="mt-2 text-sm text-muted">{c.blurb}</p>
                <ul className="mt-3 grid gap-1 text-xs text-muted">
                  {c.creds.map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-2xs uppercase tracking-wider text-muted">Giá thuê sân</p>
            <h2 className="mt-2 font-display text-3xl">Cao điểm / thấp điểm</h2>
            <p className="mt-2 text-sm text-muted">T2–T6 thấp điểm đến 17:00. Cuối tuần theo bảng weekend. Thành viên trừ quota hoặc giảm %.</p>
            <div className="mt-5 overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-border)]">
              <table className="w-full text-sm">
                <thead className="text-left text-2xs uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 font-medium">Môn</th>
                    <th className="px-4 py-3 font-medium">Thấp điểm</th>
                    <th className="px-4 py-3 font-medium">Cao điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {["badminton", "basketball", "volleyball"].map((sport) => {
                    const off = weekday.find((p) => p.sport === sport && !p.is_peak);
                    const peak = weekday.find((p) => p.sport === sport && p.is_peak);
                    return (
                      <tr key={sport} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-medium">{sportLabel(sport)}</td>
                        <td className="px-4 py-3 tabular-nums">{off ? money(off.price_vnd) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{peak ? money(peak.price_vnd) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Cover src={media.courtDetail} alt="" className="min-h-64 rounded-[var(--radius-xl)] md:min-h-full">
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <p className="text-2xs uppercase tracking-wider text-muted">Gói</p>
        <h2 className="mt-2 font-display text-3xl">Mua trên app, thu tại quầy</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="overflow-hidden p-0">
              <Cover src={sportPhoto(p.sport_scope)} alt="" scrim="none" className="h-36">
                <MediaCaption>
                  <p className="text-2xs uppercase tracking-wider">{sportLabel(p.sport_scope)}</p>
                </MediaCaption>
              </Cover>
              <div className="p-5">
                <p className="text-2xs uppercase tracking-wider text-muted">{sportLabel(p.sport_scope)}</p>
                <h3 className="mt-1 font-display text-2xl">{p.name}</h3>
                <p className="mt-3 font-display text-3xl tabular-nums">{money(p.price_vnd)}</p>
                <p className="mt-2 text-sm text-muted">
                  {p.duration_days ? `${p.duration_days} ngày` : "Theo buổi"} · {p.court_hours} giờ sân · giảm {p.court_discount_pct}%
                </p>
                <Link to="/register" className="mt-4 block">
                  <Button className="w-full">Đăng ký để mua</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <p className="text-2xs uppercase tracking-wider text-muted">Lớp đang mở</p>
        <h2 className="mt-2 font-display text-3xl">Ghi danh khi còn chỗ</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {classes.slice(0, 4).map((c) => (
            <Card key={c.id} className="flex gap-4 p-3">
              <Cover src={sportPhoto(c.sport)} alt="" className="h-24 w-24 shrink-0 rounded-[var(--radius-lg)]" />
              <div className="min-w-0 py-1">
                <p className="text-2xs uppercase tracking-wider text-muted">{sportLabel(c.sport)}</p>
                <p className="font-display text-xl">{levelLabel(c.level)}</p>
                <p className="truncate text-sm text-muted">
                  {c.coach_name} · {c.court_code} · {c.duration_min}′
                </p>
                <p className="text-sm">{rruleLabel(c.rrule)}</p>
                <p className="text-xs tabular-nums text-subtle">
                  {c.enrolled_count}/{c.capacity} chỗ
                </p>
              </div>
            </Card>
          ))}
          {!classes.length ? <p className="text-sm text-muted">Chưa có lớp xuất bản.</p> : null}
        </div>
      </section>

      <section className="relative mx-4 mb-10 overflow-hidden rounded-[var(--radius-xl)] md:mx-auto md:max-w-6xl">
        <Cover src={media.exterior} alt="Mặt tiền Arena3 lúc chạng vạng" className="min-h-[22rem]" scrim="hero">
          <div className="relative flex min-h-[22rem] flex-col justify-end p-6 sm:p-10">
            <p className="max-w-md font-display text-3xl text-on-media on-media sm:text-4xl">06:00–22:00 · 7 ngày</p>
            <p className="mt-2 max-w-sm text-sm text-on-media-muted on-media">
              Quầy lễ tân trong giờ mở cửa. Khách vãng lai không cần tài khoản.
            </p>
            <div className="mt-5 flex gap-2">
              <Link to="/login">
                <Button className="bg-on-media text-fg hover:bg-surface">Vào trung tâm</Button>
              </Link>
            </div>
          </div>
        </Cover>
      </section>
    </main>
  );
}
