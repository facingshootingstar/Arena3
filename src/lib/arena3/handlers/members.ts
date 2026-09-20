import type { Sql } from "@/lib/db";
import { hashPassword } from "../crypto";
import { err } from "../errors";
import { ageYears, audit, getSettings, readJson, str, userDebt } from "../helpers";
import { isValidVnPhone, normalizePhone, phoneLast9, unaccentVi } from "../phone";
import { requireRole, toPublic, type PublicUser } from "../session";
import { one } from "../tx";

export async function membersSearch(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager", "receptionist", "coach"]);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return { status: 200, body: { items: [] } };
  const nq = unaccentVi(q);
  const phone = q.replace(/[\s-]/g, "");
  const tail = phoneLast9(q);
  const items = await sql.query(
    `select id, member_code, full_name, phone, email, role, status, date_of_birth
       from users
      where role = 'member'
        and (
          name_normalized like '%' || $1 || '%'
          or phone like '%' || $2 || '%'
          or coalesce(member_code,'') ilike '%' || $3 || '%'
          or ($4::text is not null and right(phone, 9) = $4)
        )
      order by name_normalized
      limit 20`,
    [nq, phone, q, tail],
  );
  return { status: 200, body: { items } };
}

export async function membersCreate(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const body = await readJson(request);
  const full_name = str(body.full_name);
  const phone = normalizePhone(str(body.phone) ?? "");
  const dob = str(body.dob) ?? str(body.date_of_birth);
  const pii = body.pii_consent === true;
  if (!full_name) throw err.validation("Full name is required.");
  if (!isValidVnPhone(phone)) throw err.validation("That phone number is not valid.");
  if (!pii) throw err.br("BR-08", "You must accept the terms and the data-privacy notice.");
  const existing = await one<Record<string, unknown>>(
    sql,
    `select id, member_code, full_name, phone, email, role, status, date_of_birth, health_notes, must_change_password
       from users where phone = $1`,
    [phone],
  );
  if (existing) {
    return { status: 200, body: { user: toPublic(existing), existing: true } };
  }
  const settings = await getSettings(sql);
  if (dob && ageYears(dob) < settings.minor_age) {
    if (!str(body.guardian_name) || !str(body.guardian_phone)) {
      throw err.br("BR-07", "A minor needs guardian details.");
    }
  }
  const tmp = `A3tmp${Math.floor(1000 + Math.random() * 9000)}a`;
  const code = await one<{ next_member_code: string }>(sql, `select next_member_code() as next_member_code`);
  const inserted = await one<{ id: string }>(
    sql,
    `insert into users
       (full_name, name_normalized, phone, email, role, status, password_hash,
        date_of_birth, guardian_name, guardian_phone, pii_consent_at, member_code, must_change_password)
     values ($1,$2,$3,$4,'member','active',$5,$6,$7,$8, now(), $9, true)
     returning id`,
    [
      full_name,
      unaccentVi(full_name),
      phone,
      str(body.email) ?? null,
      hashPassword(tmp),
      dob ?? null,
      str(body.guardian_name) ?? null,
      str(body.guardian_phone) ? normalizePhone(String(body.guardian_phone)) : null,
      code?.next_member_code,
    ],
  );
  await audit(sql, user.id, "create_member", "user", inserted!.id);
  const created = await one<Record<string, unknown>>(
    sql,
    `select id, member_code, full_name, phone, email, role, status, date_of_birth, health_notes, must_change_password
       from users where id = $1`,
    [inserted!.id],
  );
  return { status: 201, body: { user: toPublic(created!), temp_password: tmp } };
}

export async function memberGet(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["manager", "receptionist", "coach"]);
  const m = await one<Record<string, unknown>>(
    sql,
    `select id, member_code, full_name, phone, email, role, status, date_of_birth, health_notes, must_change_password
       from users where id = $1`,
    [id],
  );
  if (!m) throw err.notFound();
  if (user.role === "coach" && m.role === "member") {
    const taught = await one(
      sql,
      `select 1 from enrollments e
         join classes c on c.id = e.class_id
        where e.user_id = $1 and (c.coach_id = $2 or c.assistant_id = $2)
        limit 1`,
      [id, user.id],
    );
    if (!taught) throw err.forbidden("Coaches can only view members in their own classes.");
  }
  const subs = await sql.query(
    `select s.id, s.status, s.start_on::text, s.end_on::text, s.sport_scope, s.court_hours_left, s.session_left,
            s.frozen_days, p.name as plan_name, p.price_vnd
       from subscriptions s join membership_plans p on p.id = s.plan_id
      where s.user_id = $1 order by s.end_on desc`,
    [id],
  );
  const debt = await userDebt(sql, id);
  const bookings = await sql.query(
    `select b.id, b.code, b.start_at, b.end_at, b.status, c.court_code
       from court_bookings b join courts c on c.id = b.court_id
      where b.user_id = $1
        and (b.start_at at time zone 'Asia/Ho_Chi_Minh')::date
            = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      order by b.start_at`,
    [id],
  );
  const classes = await sql.query(
    `select s.id, s.start_at, s.end_at, cl.level, cl.sport, ct.court_code
       from sessions s
       join classes cl on cl.id = s.class_id
       join enrollments e on e.class_id = cl.id and e.user_id = $1 and e.status = 'confirmed'
       join courts ct on ct.id = s.court_id
      where s.status = 'scheduled'
        and (s.start_at at time zone 'Asia/Ho_Chi_Minh')::date
            = (now() at time zone 'Asia/Ho_Chi_Minh')::date`,
    [id],
  );
  /*
   * What this member has paid, and how much of it is still the centre's to
   * give back.
   *
   * `refundable_vnd` is computed here rather than left to the screen because
   * the screen cannot see it: refunds are separate rows that carry no link to
   * the payment they undo, so "how much of this is left" is a question about
   * the whole ledger for that booking or subscription, not about one row. The
   * same arithmetic guards the refund endpoint — this is the desk being shown
   * the answer before it presses the button rather than after.
   */
  const payments = await sql.query(
    `select p.id, p.code, p.method, p.amount_vnd, p.status, p.created_at,
            p.ref_type, p.ref_id, i.id as invoice_id,
            least(p.amount_vnd, greatest((
              select coalesce(sum(q.amount_vnd) filter (where q.amount_vnd > 0 and q.status = 'posted'), 0)
                   - coalesce(sum(-q.amount_vnd) filter (where q.amount_vnd < 0 and q.status in ('posted','refund_pending')), 0)
                from payments q
               where q.ref_type = p.ref_type and q.ref_id = p.ref_id
            ), 0))::int as refundable_vnd
       from payments p
       left join invoices i on i.payment_id = p.id
      where p.user_id = $1
      order by p.created_at desc
      limit 20`,
    [id],
  );
  return {
    status: 200,
    body: {
      user: toPublic(m),
      subscriptions: subs,
      debt_vnd: debt,
      payments,
      today: { bookings, classes },
    },
  };
}
