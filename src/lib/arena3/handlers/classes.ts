import type { Sql } from "@/lib/db";
import { err, isConflictSlot } from "../errors";
import { audit, classSubscription, enqueue, getSettings, num, readJson, str } from "../helpers";
import { expandWeekly } from "../rrule";
import { requireRole, type PublicUser } from "../session";
import { addDays, ictDateString } from "../time";
import { one } from "../tx";
import { inviteWaitlist } from "./ops";

export async function classesList(sql: Sql, request: Request, user: PublicUser | null) {
  const sport = new URL(request.url).searchParams.get("sport");
  const manager = user?.role === "manager";
  const items = await sql.query(
    `select cl.id, cl.sport, cl.level, cl.capacity, cl.enrolled_count, cl.rrule, cl.duration_min,
            cl.start_on::text, cl.end_on::text, cl.status, cl.court_id, c.court_code,
            cl.coach_id, u.full_name as coach_name
       from classes cl
       join courts c on c.id = cl.court_id
       join users u on u.id = cl.coach_id
      where ($1 or cl.status = 'open')
        and ($2::text is null or cl.sport::text = $2)
      order by cl.start_on, cl.level`,
    [manager, sport],
  );
  return { status: 200, body: { items } };
}

export async function classesCreate(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  const sport = str(b.sport);
  const level = str(b.level);
  const coach_id = str(b.coach_id);
  const court_id = str(b.court_id);
  const rrule = str(b.rrule);
  const start_on = str(b.start_on);
  const end_on = str(b.end_on);
  const capacity = num(b.capacity) ?? 12;
  const duration_min = num(b.duration_min) ?? 90;
  if (!sport || !level || !coach_id || !court_id || !rrule || !start_on || !end_on) {
    throw err.validation("Thiếu thông tin lớp.");
  }
  const coach = await one<{ role: string }>(sql, `select role from users where id = $1`, [coach_id]);
  if (!coach || coach.role !== "coach") throw err.br("BR-23", "HLV không hợp lệ.");
  const sportOk = await one(
    sql,
    `select 1 from coach_sports where user_id = $1 and (sport = $2 or sport = 'all')`,
    [coach_id, sport],
  );
  if (!sportOk) throw err.br("BR-23", "HLV chưa gắn môn này.");
  const row = await one(
    sql,
    `insert into classes
       (sport, level, coach_id, assistant_id, court_id, capacity, rrule, duration_min, start_on, end_on, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     returning *`,
    [
      sport,
      level,
      coach_id,
      str(b.assistant_id) ?? null,
      court_id,
      capacity,
      rrule,
      duration_min,
      start_on,
      end_on,
    ],
  );
  await audit(sql, user.id, "create_class", "class", (row as { id: string }).id);
  return { status: 201, body: row };
}

export async function materializeClassSessions(
  sql: Sql,
  id: string,
  actorId: string | null,
) {
  const cl = await one<{
    id: string;
    status: string;
    court_id: string;
    coach_id: string;
    assistant_id: string | null;
    rrule: string;
    duration_min: number;
    start_on: string;
    end_on: string;
  }>(sql, `select * from classes where id = $1 for update`, [id]);
  if (!cl) throw err.notFound();
  if (cl.status === "cancelled") throw err.conflictState("Lớp đã hủy.");
  const from = new Date();
  const until = new Date(Date.now() + 14 * 86400000);
  const windowStart = cl.start_on > ictDateString(from) ? new Date(cl.start_on + "T00:00:00+07:00") : from;
  const windowEnd = cl.end_on < ictDateString(until) ? new Date(cl.end_on + "T23:59:00+07:00") : until;
  const occs = expandWeekly(cl.rrule, cl.duration_min, windowStart, windowEnd);
  const created: unknown[] = [];
  const skipped: unknown[] = [];
  for (const o of occs) {
    const exists = await one(
      sql,
      `select id from sessions where class_id = $1 and start_at = $2`,
      [id, o.start.toISOString()],
    );
    if (exists) continue;
    const sid = (await one<{ id: string }>(sql, `select gen_random_uuid() as id`))!.id;
    const courtBusy = await one(
      sql,
      `select 1 from occupancies
        where court_id = $1
          and tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        limit 1`,
      [cl.court_id, o.start.toISOString(), o.end.toISOString()],
    );
    const coaches = [cl.coach_id, cl.assistant_id].filter(Boolean);
    let coachBusy = false;
    for (const cid of coaches) {
      const hit = await one(
        sql,
        `select 1 from coach_occupancies
          where coach_id = $1
            and tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
          limit 1`,
        [cid, o.start.toISOString(), o.end.toISOString()],
      );
      if (hit) {
        coachBusy = true;
        break;
      }
    }
    if (courtBusy || coachBusy) {
      skipped.push({ start_at: o.start.toISOString(), reason: courtBusy ? "court" : "coach" });
      if (actorId) {
        await enqueue(
          sql,
          "inapp",
          "class_changed",
          actorId,
          { class_id: id, reason: "conflict", start: o.start.toISOString() },
          `class_conflict|${id}|${o.start.toISOString()}`,
        );
      }
      continue;
    }
    try {
      await sql.query("savepoint sp_occ");
      const occ = await one<{ occupancy_attach: string }>(
        sql,
        `select occupancy_attach($1::uuid, $2::timestamptz, $3::timestamptz, 'session'::occ_kind, $4::uuid, null) as occupancy_attach`,
        [cl.court_id, o.start.toISOString(), o.end.toISOString(), sid],
      );
      await sql.query(
        `insert into sessions (id, class_id, court_id, start_at, end_at, status, occupancy_id)
         values ($1,$2,$3,$4,$5,'scheduled',$6)`,
        [sid, id, cl.court_id, o.start.toISOString(), o.end.toISOString(), occ!.occupancy_attach],
      );
      await sql.query(
        `insert into coach_occupancies (coach_id, session_id, start_at, end_at) values ($1,$2,$3,$4)`,
        [cl.coach_id, sid, o.start.toISOString(), o.end.toISOString()],
      );
      if (cl.assistant_id) {
        await sql.query(
          `insert into coach_occupancies (coach_id, session_id, start_at, end_at) values ($1,$2,$3,$4)`,
          [cl.assistant_id, sid, o.start.toISOString(), o.end.toISOString()],
        );
      }
      await sql.query("release savepoint sp_occ");
      created.push({ id: sid, start_at: o.start.toISOString() });
    } catch (e) {
      try {
        await sql.query("rollback to savepoint sp_occ");
      } catch {
        /* ignore */
      }
      if (isConflictSlot(e) || (e instanceof Error && /CONFLICT_SLOT/.test(e.message))) {
        skipped.push({ start_at: o.start.toISOString() });
        if (actorId) {
          await enqueue(
            sql,
            "inapp",
            "class_changed",
            actorId,
            { class_id: id, reason: "conflict", start: o.start.toISOString() },
            `class_conflict|${id}|${o.start.toISOString()}`,
          );
        }
        continue;
      }
      throw e;
    }
  }
  return { created, skipped };
}

export async function classesPublish(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["manager"]);
  const result = await materializeClassSessions(sql, id, user.id);
  await sql.query(`update classes set status = 'open' where id = $1`, [id]);
  return { status: 200, body: { sessions: result.created, skipped: result.skipped } };
}

export async function classesEnroll(sql: Sql, id: string, request: Request, user: PublicUser) {
  if (!["member", "receptionist", "manager"].includes(user.role)) throw err.forbidden();
  const b = await request.headers.get("content-type") ? await readJson(request) : {};
  const userId =
    user.role === "member" ? user.id : (str(b.user_id) ?? user.id);
  if (user.role === "member" && str(b.user_id) && str(b.user_id) !== user.id) {
    throw err.forbidden();
  }
  const cl = await one<{
    id: string;
    status: string;
    sport: string;
    capacity: number;
    enrolled_count: number;
  }>(sql, `select * from classes where id = $1`, [id]);
  if (!cl) throw err.notFound();
  if (cl.status !== "open") throw err.br("BR-67", "Lớp chưa mở.");
  const sub = await classSubscription(sql, userId, cl.sport);
  if (!sub) throw err.br("BR-12", "Cần gói active đúng môn.");
  if (sub.session_left != null && sub.session_left <= 0) throw err.br("BR-18", "Hết buổi.");
  const overlap = await one(
    sql,
    `select 1
       from sessions s
       join enrollments e on e.class_id = s.class_id and e.user_id = $1 and e.status = 'confirmed'
      where e.class_id <> $2
        and s.status = 'scheduled'
        and exists (
          select 1 from sessions s2
           where s2.class_id = $2 and s2.status = 'scheduled'
             and tstzrange(s.start_at, s.end_at, '[)') && tstzrange(s2.start_at, s2.end_at, '[)')
        )
      limit 1`,
    [userId, id],
  );
  if (overlap) throw err.br("BR-24", "Trùng lịch lớp khác.");
  await sql.query("savepoint sp_enroll");
  try {
    const row = await one<{ enrollment_confirm: string }>(
      sql,
      `select enrollment_confirm($1::uuid, $2::uuid) as enrollment_confirm`,
      [id, userId],
    );
    await sql.query("release savepoint sp_enroll");
    if (sub.session_left != null) {
      await sql.query(
        `update subscriptions set session_left = session_left - 1
          where id = $1 and session_left > 0`,
        [sub.id],
      );
    }
    const enr = await one(sql, `select * from enrollments where id = $1`, [row!.enrollment_confirm]);
    return { status: 201, body: { enrollment: enr } };
  } catch (e) {
    try {
      await sql.query("rollback to savepoint sp_enroll");
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CLASS_FULL")) {
      const wl = await one<{ enrollment_waitlist: string }>(
        sql,
        `select enrollment_waitlist($1::uuid, $2::uuid) as enrollment_waitlist`,
        [id, userId],
      );
      const enr = await one(sql, `select * from enrollments where id = $1`, [wl!.enrollment_waitlist]);
      return { status: 201, body: { enrollment: enr, waitlisted: true } };
    }
    if (msg.includes("ALREADY_ENROLLED")) throw err.br("BR-24", "Đã ghi danh.");
    throw e;
  }
}

export async function enrollmentDelete(sql: Sql, id: string, user: PublicUser) {
  const enr = await one<{
    id: string;
    class_id: string;
    user_id: string;
    status: string;
  }>(sql, `select * from enrollments where id = $1 for update`, [id]);
  if (!enr) throw err.notFound();
  if (user.role === "member" && enr.user_id !== user.id) throw err.forbidden();
  if (enr.status === "waitlisted") {
    await sql.query(`update enrollments set status = 'cancelled', waitlist_pos = null where id = $1`, [id]);
    return { status: 200, body: { ok: true } };
  }
  if (enr.status !== "confirmed") throw err.conflictState();
  const settings = await getSettings(sql);
  const next = await one<{ start_at: string }>(
    sql,
    `select start_at from sessions
      where class_id = $1 and status = 'scheduled' and start_at > now()
      order by start_at limit 1`,
    [enr.class_id],
  );
  if (next) {
    const hours = (new Date(next.start_at).getTime() - Date.now()) / 3600000;
    if (hours < settings.cancel_class_hours) {
      throw err.br("BR-20", "Hủy lớp cần ≥ 4 giờ trước buổi kế.");
    }
  }
  await sql.query(`update enrollments set status = 'cancelled', waitlist_pos = null where id = $1`, [id]);
  await sql.query(
    `update classes set enrolled_count = greatest(enrolled_count - 1, 0) where id = $1`,
    [enr.class_id],
  );
  const cl = await one<{ sport: string }>(sql, `select sport from classes where id = $1`, [enr.class_id]);
  if (cl) {
    const sub = await classSubscription(sql, enr.user_id, cl.sport);
    if (sub?.session_left != null) {
      await sql.query(`update subscriptions set session_left = session_left + 1 where id = $1`, [sub.id]);
    }
  }
  await inviteWaitlist(sql, enr.class_id);
  return { status: 200, body: { ok: true } };
}

export async function coachSchedule(sql: Sql, user: PublicUser) {
  requireRole(user, ["coach", "manager"]);
  const items = await sql.query(
    `select s.id, s.start_at, s.end_at, s.status, cl.level, cl.sport, cl.id as class_id,
            cl.capacity, cl.enrolled_count, c.court_code
       from sessions s
       join classes cl on cl.id = s.class_id
       join courts c on c.id = s.court_id
      where ($2::boolean or cl.coach_id = $1 or cl.assistant_id = $1)
        and s.start_at > now() - interval '1 day'
      order by s.start_at
      limit 80`,
    [user.id, user.role === "manager"],
  );
  return { status: 200, body: { items } };
}

export async function classRoster(sql: Sql, classId: string, user: PublicUser) {
  requireRole(user, ["coach", "manager", "receptionist"]);
  const cl = await one<{ coach_id: string; assistant_id: string | null }>(
    sql,
    `select coach_id, assistant_id from classes where id = $1`,
    [classId],
  );
  if (!cl) throw err.notFound();
  if (user.role === "coach" && cl.coach_id !== user.id && cl.assistant_id !== user.id) {
    throw err.forbidden();
  }
  const items = await sql.query(
    `select u.id, u.full_name, u.member_code, u.health_notes, e.status, e.id as enrollment_id
       from enrollments e
       join users u on u.id = e.user_id
      where e.class_id = $1 and e.status = 'confirmed'
      order by u.full_name`,
    [classId],
  );
  return { status: 200, body: { items } };
}

void addDays;
