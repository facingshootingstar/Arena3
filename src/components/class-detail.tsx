import { useEffect, useState } from "react";
import { Badge, Button, Modal, Skeleton, StatusBadge } from "@/components/ui";
import { hhmm, money, when } from "@/components/shell";
import { apiGet } from "@/lib/arena3/client";
import { formatDate, kindLabel, levelLabel, rruleLabel, sportLabel } from "@/lib/arena3/labels";

/** "Tue 21 Oct" in the centre's timezone. */
export function sessionDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type ClassDetail = {
  class: {
    id: string;
    code: string;
    sport: string;
    level: string;
    status: string;
    capacity: number;
    enrolled_count: number;
    rrule: string;
    start_on: string;
    end_on: string;
    court_code: string;
    coach_name: string;
    assistant_name: string | null;
  };
  sessions: Array<{
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    court_code: string;
    headcount: number;
  }>;
  roster: Array<{ id: string; full_name: string; member_code: string | null; phone: string; status: string }>;
};

/**
 * One class opened up: when it meets, where, who teaches it and who is in it.
 * Shared by the manager's class list and the desk, which see the same thing.
 */
export function ClassDetailModal({ classId, onClose }: { classId: string | null; onClose: () => void }) {
  const [data, setData] = useState<ClassDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setFailed(null);
    if (!classId) return;
    let live = true;
    apiGet<ClassDetail>(`/classes/${classId}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setFailed(e instanceof Error ? e.message : "Could not load this class"));
    return () => {
      live = false;
    };
  }, [classId]);

  const c = data?.class;
  const confirmed = data?.roster.filter((r) => r.status === "confirmed") ?? [];
  const waiting = data?.roster.filter((r) => r.status === "waitlisted") ?? [];
  const upcoming = data?.sessions.filter((s) => s.status === "scheduled") ?? [];
  const past = data?.sessions.filter((s) => s.status !== "scheduled") ?? [];

  return (
    <Modal
      open={!!classId}
      onClose={onClose}
      title={c ? `${sportLabel(c.sport)} · ${levelLabel(c.level)}` : "Class"}
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {failed ? (
        <p className="text-sm text-danger">{failed}</p>
      ) : !c || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums">{c.code}</span>
              <StatusBadge status={c.status} />
              <Badge tone="muted">
                {c.enrolled_count}/{c.capacity} enrolled
              </Badge>
            </div>
            <p className="text-muted">
              Coach {c.coach_name}
              {c.assistant_name ? ` · assisted by ${c.assistant_name}` : ""} · {c.court_code}
            </p>
            <p className="text-muted">
              {rruleLabel(c.rrule)} · {formatDate(c.start_on)} – {formatDate(c.end_on)}
            </p>
          </div>

          <section>
            <h3 className="text-2xs font-medium uppercase tracking-wider text-muted">
              Sessions · {upcoming.length} to come
            </h3>
            {data.sessions.length ? (
              <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto text-sm">
                {[...upcoming, ...past].map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-wood/60 px-3 py-2"
                  >
                    <span className="tabular-nums">
                      {sessionDay(s.start_at)} · {hhmm(s.start_at)}–{hhmm(s.end_at)}
                    </span>
                    <span className="flex items-center gap-2 text-muted">
                      {s.court_code} · <span className="tabular-nums">{s.headcount}</span>/{c.capacity}
                      {s.status !== "scheduled" ? <StatusBadge status={s.status} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {c.status === "draft"
                  ? "No sessions yet — they are created when the class is published."
                  : "No sessions on the calendar."}
              </p>
            )}
          </section>

          <section>
            <h3 className="text-2xs font-medium uppercase tracking-wider text-muted">
              Students · {confirmed.length}
            </h3>
            {confirmed.length ? (
              <ul className="mt-2 grid max-h-48 gap-1 overflow-y-auto text-sm">
                {confirmed.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 px-1">
                    <span className="font-medium">{r.full_name}</span>
                    <span className="tabular-nums text-muted">
                      {r.member_code ?? "—"} · {r.phone}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Nobody has enrolled yet.</p>
            )}
            {waiting.length ? (
              <p className="mt-2 text-sm text-muted">Waiting list: {waiting.map((r) => r.full_name).join(", ")}</p>
            ) : null}
          </section>
        </div>
      )}
    </Modal>
  );
}

type OccDetail =
  | {
      kind: "booking";
      booking: {
        id: string;
        code: string;
        status: string;
        channel: string;
        start_at: string;
        end_at: string;
        price_vnd: number;
        discount_pct: number;
        paid_vnd: number;
        hold_until: string | null;
        awaiting_transfer: boolean;
        court_code: string;
        sport: string;
      };
      customer: { type: "member" | "guest"; name: string | null; phone: string | null; member_code: string | null };
    }
  | {
      kind: "session";
      session: {
        id: string;
        class_id: string;
        start_at: string;
        end_at: string;
        status: string;
        court_code: string;
        sport: string;
        level: string;
        capacity: number;
        enrolled_count: number;
        coach_name: string;
      };
    }
  | { kind: "maintenance"; maintenance: { reason: string | null; court_code: string; start_at: string; end_at: string } };

/**
 * Whose hour is this? Opened from a taken cell on the court map.
 */
export function OccupancyDetailModal({
  target,
  onClose,
  onOpenClass,
}: {
  target: { kind: string; ref: string } | null;
  onClose: () => void;
  onOpenClass?: (classId: string) => void;
}) {
  const [data, setData] = useState<OccDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setFailed(null);
    if (!target) return;
    let live = true;
    apiGet<OccDetail>(`/occupancy/detail?kind=${encodeURIComponent(target.kind)}&ref=${encodeURIComponent(target.ref)}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setFailed(e instanceof Error ? e.message : "Could not load the details"));
    return () => {
      live = false;
    };
  }, [target]);

  const title =
    data?.kind === "booking"
      ? `Booking ${data.booking.code}`
      : data?.kind === "session"
        ? "Class session"
        : data?.kind === "maintenance"
          ? "Court out of service"
          : target
            ? kindLabel(target.kind)
            : "Details";

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          {data?.kind === "session" && onOpenClass ? (
            <Button variant="outline" onClick={() => onOpenClass(data.session.class_id)}>
              Open the class
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {failed ? (
        <p className="text-sm text-danger">{failed}</p>
      ) : !data ? (
        <Skeleton className="h-32" />
      ) : data.kind === "booking" ? (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Customer</dt>
          <dd className="font-medium">
            {data.customer.name ?? "—"}{" "}
            <Badge tone={data.customer.type === "member" ? "accent" : "muted"}>
              {data.customer.type === "member" ? "Member" : "Walk-in"}
            </Badge>
          </dd>
          <dt className="text-muted">Phone</dt>
          <dd className="tabular-nums">
            {data.customer.phone ?? "—"}
            {data.customer.member_code ? ` · ${data.customer.member_code}` : ""}
          </dd>
          <dt className="text-muted">Court</dt>
          <dd>
            {data.booking.court_code} · {sportLabel(data.booking.sport)}
          </dd>
          <dt className="text-muted">Time</dt>
          <dd className="tabular-nums">
            {sessionDay(data.booking.start_at)} · {hhmm(data.booking.start_at)}–{hhmm(data.booking.end_at)}
          </dd>
          <dt className="text-muted">Amount</dt>
          <dd className="tabular-nums">
            {money(data.booking.price_vnd)}
            {data.booking.discount_pct ? ` (−${data.booking.discount_pct}%)` : ""} · paid{" "}
            {money(data.booking.paid_vnd)}
          </dd>
          <dt className="text-muted">Status</dt>
          <dd>
            <StatusBadge status={data.booking.status} />
            {data.booking.status === "hold" && data.booking.hold_until ? (
              <span className="ml-2 text-muted">
                {data.booking.awaiting_transfer ? "waiting for the bank transfer · " : ""}held until{" "}
                {hhmm(data.booking.hold_until)}
              </span>
            ) : null}
          </dd>
          <dt className="text-muted">Booked via</dt>
          <dd className="capitalize">{data.booking.channel}</dd>
        </dl>
      ) : data.kind === "session" ? (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Class</dt>
          <dd className="font-medium">
            {sportLabel(data.session.sport)} · {levelLabel(data.session.level)}
          </dd>
          <dt className="text-muted">Coach</dt>
          <dd>{data.session.coach_name}</dd>
          <dt className="text-muted">Court</dt>
          <dd>{data.session.court_code}</dd>
          <dt className="text-muted">Time</dt>
          <dd className="tabular-nums">
            {sessionDay(data.session.start_at)} · {hhmm(data.session.start_at)}–{hhmm(data.session.end_at)}
          </dd>
          <dt className="text-muted">Students</dt>
          <dd className="tabular-nums">
            {data.session.enrolled_count}/{data.session.capacity}
          </dd>
        </dl>
      ) : (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Court</dt>
          <dd>{data.maintenance.court_code}</dd>
          <dt className="text-muted">Time</dt>
          <dd className="tabular-nums">
            {when(data.maintenance.start_at)} – {hhmm(data.maintenance.end_at)}
          </dd>
          <dt className="text-muted">Reason</dt>
          <dd>{data.maintenance.reason ?? "No reason recorded."}</dd>
        </dl>
      )}
    </Modal>
  );
}
