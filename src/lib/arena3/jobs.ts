import { withTx } from "./tx";
import { elapsedAtLeast, ictDateString } from "./time";
import { flagOn } from "./flags";

export async function expireHolds() {
  return withTx(async (sql) => {
    const rows = await sql.query<{ id: string }>(
      `select id from court_bookings where status = 'hold' and hold_until < now()`,
    );
    for (const r of rows) {
      try {
        await sql.query(`select occupancy_release_booking($1::uuid, 'cancelled'::booking_status)`, [r.id]);
      } catch (e) {
        console.error("[job expire_holds]", r.id, e);
      }
    }
    return rows.length;
  });
}

export async function markNoshow() {
  return withTx(async (sql) => {
    const rows = await sql.query<{ id: string }>(
      `select b.id
         from court_bookings b
         join center_settings s on s.id = 1
        where b.status = 'confirmed'
          and b.start_at + (s.noshow_grace_minutes * interval '1 minute') < now()`,
    );
    for (const r of rows) {
      try {
        await sql.query(`select occupancy_release_booking($1::uuid, 'no_show'::booking_status)`, [r.id]);
      } catch (e) {
        console.error("[job mark_noshow]", r.id, e);
      }
    }
    return rows.length;
  });
}

export async function completeBookings() {
  return withTx(async (sql) => {
    const rows = await sql.query<{ id: string }>(
      `select b.id
         from court_bookings b
         join center_settings s on s.id = 1
        where b.status = 'in_use'
          and b.end_at + interval '10 minutes' < now()`,
    );
    for (const r of rows) {
      try {
        await sql.query(`select occupancy_release_booking($1::uuid, 'completed'::booking_status)`, [r.id]);
      } catch (e) {
        console.error("[job complete_bookings]", r.id, e);
      }
    }
    return rows.length;
  });
}

export async function subscriptionStatus() {
  return withTx(async (sql) => {
    const rows = await sql.query(
      `update subscriptions
          set status = 'expired'
        where status = 'active'
          and end_on < (now() at time zone 'Asia/Ho_Chi_Minh')::date
        returning id`,
    );
    return rows.length;
  });
}

export async function expiryReminders() {
  return withTx(async (sql) => {
    const today = ictDateString();
    const targets = await sql.query<{ id: string; user_id: string; end_on: string }>(
      `select id, user_id, end_on::text
         from subscriptions
        where status = 'active'
          and end_on in (
            ($1::date + 7),
            ($1::date + 3),
            $1::date
          )`,
      [today],
    );
    for (const t of targets) {
      const days = Math.round(
        (new Date(t.end_on).getTime() - new Date(today).getTime()) / 86400000,
      );
      const key = `${t.user_id}|${days}|${today}`;
      await sql.query(
        `insert into outbox (channel, template, user_id, payload, dedupe_key, sent_at)
         values ('inapp', 'sub_expiring', $1, $2::jsonb, $3, now())
         on conflict (dedupe_key) do nothing`,
        [t.user_id, JSON.stringify({ days, end_on: t.end_on }), key],
      );
      if (await flagOn(sql, "SMS")) {
        await sql.query(
          `insert into outbox (channel, template, user_id, payload, dedupe_key)
           values ('sms', 'sub_expiring', $1, $2::jsonb, $3)
           on conflict (dedupe_key) do nothing`,
          [t.user_id, JSON.stringify({ days, end_on: t.end_on }), `sms|${key}`],
        );
      }
    }
    return targets.length;
  });
}

export async function notifyFlush() {
  return withTx(async (sql) => {
    const rows = await sql.query<{ id: string; channel: string; template: string }>(
      `select id, channel, template from outbox
        where sent_at is null and attempts < 5
        order by created_at
        limit 50`,
    );
    for (const r of rows) {
      if (r.channel === "sms") {
        console.info("[sms-stub]", r.template, r.id);
      }
      await sql.query(
        `update outbox set sent_at = now(), attempts = attempts + 1 where id = $1`,
        [r.id],
      );
    }
    return rows.length;
  });
}

export async function waitlistExpire() {
  return withTx(async (sql) => {
    const stale = await sql.query<{ id: string; enrollment_id: string; class_id: string }>(
      `select o.id, o.enrollment_id, e.class_id
         from waitlist_offers o
         join enrollments e on e.id = o.enrollment_id
        where o.status = 'pending' and o.expires_at < now()`,
    );
    for (const r of stale) {
      await sql.query(`update waitlist_offers set status = 'expired' where id = $1`, [r.id]);
      await sql.query(
        `update enrollments set status = 'cancelled', waitlist_pos = null where id = $1 and status = 'waitlisted'`,
        [r.enrollment_id],
      );
      const { inviteWaitlist } = await import("./handlers/ops");
      await inviteWaitlist(sql, r.class_id);
    }
    return stale.length;
  });
}

export async function lockAttendance() {
  return withTx(async (sql) => {
    const rows = await sql.query<{ id: string }>(
      `select id from sessions
        where status = 'scheduled' and end_at + interval '2 hours' < now()`,
    );
    for (const r of rows) {
      try {
        await sql.query(`select occupancy_release_session($1::uuid, 'done'::session_status)`, [r.id]);
      } catch (e) {
        console.error("[job lock_attendance]", r.id, e);
      }
    }
    return rows.length;
  });
}

export async function generateSessions() {
  const ids = await withTx(async (sql) =>
    sql.query<{ id: string }>(`select id from classes where status = 'open'`),
  );
  let n = 0;
  for (const r of ids) {
    try {
      await withTx(async (sql) => {
        const { materializeClassSessions } = await import("./handlers/classes");
        await materializeClassSessions(sql, r.id, null);
      });
      n += 1;
    } catch (e) {
      console.error("[job generate_sessions]", r.id, e);
    }
  }
  return n;
}

export const GENERATE_SESSIONS_EVERY_MS = 10 * 60 * 1000;

const g = globalThis as typeof globalThis & {
  __arena3Jobs__?: boolean;
  __arena3GenAt__?: number;
};

/**
 * One read that answers "does any job have work?" for all eight at once.
 *
 * Almost every pass has nothing to do, and the naive loop still paid full price
 * for that answer: eight `withTx` calls, each a BEGIN + scan + COMMIT. Against
 * Neon that is ~24 network round trips every 15 seconds — measured at ~7
 * seconds of chatter per pass, which every user request then queued behind.
 * One transaction-free `select` of eight `exists()` subqueries costs a single
 * round trip, and any job that does have work still runs in its own
 * transaction, so a failure in one can't roll back another.
 *
 * Each clause mirrors its job's own `where` exactly. Change one and you must
 * change the other, or the job will be skipped while it still has rows.
 */
const DUE_PROBE = `
  select
    exists(select 1 from court_bookings
            where status = 'hold' and hold_until < now())                              as expire_holds,
    exists(select 1 from court_bookings b join center_settings s on s.id = 1
            where b.status = 'confirmed'
              and b.start_at + (s.noshow_grace_minutes * interval '1 minute') < now())  as mark_noshow,
    exists(select 1 from court_bookings b join center_settings s on s.id = 1
            where b.status = 'in_use' and b.end_at + interval '10 minutes' < now())     as complete_bookings,
    exists(select 1 from outbox
            where sent_at is null and attempts < 5)                                     as notify_flush,
    exists(select 1 from waitlist_offers
            where status = 'pending' and expires_at < now())                            as waitlist_expire,
    exists(select 1 from sessions
            where status = 'scheduled' and end_at + interval '2 hours' < now())         as lock_attendance,
    exists(select 1 from subscriptions
            where status = 'active'
              and end_on < (now() at time zone 'Asia/Ho_Chi_Minh')::date)               as subscription_status,
    exists(select 1 from subscriptions
            where status = 'active'
              and end_on in ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 7,
                             (now() at time zone 'Asia/Ho_Chi_Minh')::date + 3,
                             (now() at time zone 'Asia/Ho_Chi_Minh')::date))            as expiry_reminders
`;

type DueFlags = {
  expire_holds: boolean;
  mark_noshow: boolean;
  complete_bookings: boolean;
  notify_flush: boolean;
  waitlist_expire: boolean;
  lock_attendance: boolean;
  subscription_status: boolean;
  expiry_reminders: boolean;
};

export async function runDueJobs() {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const [due] = await sql.query<DueFlags>(DUE_PROBE);
    if (!due) return;
    if (due.expire_holds) await expireHolds();
    if (due.mark_noshow) await markNoshow();
    if (due.complete_bookings) await completeBookings();
    if (due.notify_flush) await notifyFlush();
    if (due.waitlist_expire) await waitlistExpire();
    if (due.lock_attendance) await lockAttendance();
    if (due.subscription_status) await subscriptionStatus();
    if (due.expiry_reminders) await expiryReminders();
    const now = Date.now();
    if (elapsedAtLeast(g.__arena3GenAt__, now, GENERATE_SESSIONS_EVERY_MS)) {
      g.__arena3GenAt__ = now;
      await generateSessions();
    }
  } catch (e) {
    console.error("[jobs]", e);
  }
}

export function startJobLoop() {
  if (g.__arena3Jobs__) return;
  g.__arena3Jobs__ = true;
  void runDueJobs();
  setInterval(() => void runDueJobs(), 15_000);
}
