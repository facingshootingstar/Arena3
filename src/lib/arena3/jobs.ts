import { withTx } from "./tx";
import { ictDateString } from "./time";
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

export async function runDueJobs() {
  try {
    await expireHolds();
    await markNoshow();
    await completeBookings();
    await notifyFlush();
    await waitlistExpire();
    await lockAttendance();
    const hour = new Date().getUTCHours();
    if (hour === 17) await subscriptionStatus();
    if (hour === 1) await expiryReminders();
    await generateSessions();
  } catch (e) {
    console.error("[jobs]", e);
  }
}

const g = globalThis as typeof globalThis & { __arena3Jobs__?: boolean };
export function startJobLoop() {
  if (g.__arena3Jobs__) return;
  g.__arena3Jobs__ = true;
  void runDueJobs();
  setInterval(() => void runDueJobs(), 15_000);
}
