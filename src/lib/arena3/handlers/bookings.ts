import type { Sql } from "@/lib/db";
import { err, isConflictSlot } from "../errors";
import {
  audit,
  enqueue,
  getSettings,
  nextCode,
  num,
  readJson,
  str,
  userDebt,
} from "../helpers";
import { isValidVnPhone, normalizePhone } from "../phone";
import { applyDiscount, lookupPrice, memberDiscount } from "../pricing";
import { requireRole, type PublicUser } from "../session";
import { ictDateString, ictDateTime, ictHour, pad2, roundVnd } from "../time";
import { one } from "../tx";

async function courtById(sql: Sql, id: string) {
  const c = await one<{
    id: string;
    court_code: string;
    sport: string;
    status: string;
  }>(sql, `select id, court_code, sport, status from courts where id = $1`, [id]);
  if (!c) throw err.notFound("Không có sân.");
  return c;
}

function slotBounds(startAt: Date, slotMin: number) {
  const end = new Date(startAt.getTime() + slotMin * 60_000);
  return { start: startAt, end };
}

async function assertBookWindow(
  sql: Sql,
  start: Date,
  opts: { walkIn: boolean; settings: Awaited<ReturnType<typeof getSettings>> },
) {
  const now = new Date();
  if (!opts.walkIn && start < now) throw err.br("BR-66", "Không đặt sân quá khứ.");
  if (opts.walkIn && start < now) {
    const remain = (start.getTime() + opts.settings.slot_minutes * 60_000 - now.getTime()) / 60_000;
    if (remain < 20) throw err.br("BR-66", "Khách vãng lai chỉ khi còn ≥ 20 phút.");
  }
  const date = ictDateString(start);
  const open = ictDateTime(date, opts.settings.open_time.slice(0, 5));
  const close = ictDateTime(date, opts.settings.close_time.slice(0, 5));
  if (start < open || start >= close) throw err.br("BR-35", "Ngoài giờ mở cửa.");
  if (!opts.walkIn) {
    const ahead = opts.settings.book_ahead_days;
    const max = new Date(now.getTime() + ahead * 86400000);
    if (start > max) throw err.br("BR-32", `Chỉ đặt trước tối đa ${ahead} ngày.`);
  }
}

async function countSlotsToday(sql: Sql, userId: string, start: Date) {
  const date = ictDateString(start);
  const row = await one<{ n: number }>(
    sql,
    `select count(*)::int as n from court_bookings
      where user_id = $1
        and status in ('confirmed','in_use')
        and (start_at at time zone 'Asia/Ho_Chi_Minh')::date = $2::date`,
    [userId, date],
  );
  return row?.n ?? 0;
}

async function overlapClass(sql: Sql, userId: string, start: Date, end: Date) {
  return one(
    sql,
    `select s.id, s.start_at, cl.level, c.court_code
       from sessions s
       join classes cl on cl.id = s.class_id
       join enrollments e on e.class_id = cl.id and e.user_id = $1 and e.status = 'confirmed'
       join courts c on c.id = s.court_id
      where s.status = 'scheduled'
        and tstzrange(s.start_at, s.end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
      limit 1`,
    [userId, start.toISOString(), end.toISOString()],
  );
}

export async function occupancyGet(sql: Sql, request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? ictDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw err.validation("date YYYY-MM-DD.");
  const start = ictDateTime(date, "00:00");
  const end = new Date(ictDateTime(date, "23:59").getTime() + 60_000);
  const rows = await sql.query<{
    court_id: string;
    start_at: string;
    end_at: string;
    kind: string;
    ref_id: string;
    convert_group_id: string | null;
  }>(
    `select court_id, start_at, end_at, kind, ref_id, convert_group_id from occupancies
      where start_at < $2 and end_at > $1
      order by court_id, start_at`,
    [start.toISOString(), end.toISOString()],
  );
  const courts = await sql.query(
    `select id, court_code, sport, status, convertible, pair_court_id from courts order by court_code`,
  );
  return {
    status: 200,
    body: {
      date,
      courts,
      slots: rows.map((r) => ({
        court_id: r.court_id,
        start: r.start_at,
        end: r.end_at,
        kind: r.kind,
        ref: r.ref_id,
        convert_group_id: r.convert_group_id,
      })),
    },
  };
}

export async function courtsList(sql: Sql) {
  const items = await sql.query(`select id, court_code, sport, status, convertible, pair_court_id from courts order by court_code`);
  return { status: 200, body: { items } };
}

export async function bookingsHold(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["member"]);
  const b = await readJson(request);
  const courtId = str(b.court_id);
  const startAt = str(b.start_at);
  if (!courtId || !startAt) throw err.validation("Thiếu court_id/start_at.");
  const settings = await getSettings(sql);
  const start = new Date(startAt);
  const { end } = slotBounds(start, settings.slot_minutes);
  await assertBookWindow(sql, start, { walkIn: false, settings });
  const court = await courtById(sql, courtId);
  if (court.status !== "ready") throw err.br("BR-35", "Sân không sẵn sàng.");
  const debt = await userDebt(sql, user.id);
  if (debt > settings.debt_limit_vnd) throw err.br("BR-44", "Công nợ vượt trần — thanh toán tại quầy.");
  const n = await countSlotsToday(sql, user.id, start);
  if (n >= settings.max_slots_per_day) throw err.br("BR-32", "Tối đa 2 slot/ngày.");
  const overlap = await overlapClass(sql, user.id, start, end);
  if (overlap && b.confirm_overlap !== true) {
    throw err.br("BR-39C", "Khung giờ trùng lớp của bạn. Xác nhận để giữ chỗ.", {
      requires_confirm: true,
    });
  }
  const disc = await memberDiscount(sql, user.id, court.sport);
  const list = await lookupPrice(sql, { sport: court.sport, courtId, start });
  const price = applyDiscount(list.price_vnd, disc.pct, settings.round_vnd);
  const bookingIdRow = await one<{ id: string }>(sql, `select gen_random_uuid() as id`);
  const bookingId = bookingIdRow!.id;
  const holdUntil = new Date(Date.now() + settings.hold_minutes * 60_000);
  let occId: string;
  try {
    const occ = await one<{ booking_replace_hold: string }>(
      sql,
      `select booking_replace_hold($1::uuid, null, $2::uuid, $3::timestamptz, $4::timestamptz, $5::uuid) as booking_replace_hold`,
      [user.id, courtId, start.toISOString(), end.toISOString(), bookingId],
    );
    occId = occ!.booking_replace_hold;
  } catch (e) {
    if (isConflictSlot(e)) throw err.conflictSlot("Khung giờ vừa được giữ.");
    throw e;
  }
  const code = await nextCode(sql, "CRT");
  await sql.query(
    `insert into court_bookings
       (id, code, court_id, user_id, start_at, end_at, status, channel, price_vnd, discount_pct, vat_rate, hold_until, occupancy_id)
     values ($1,$2,$3,$4,$5,$6,'hold','app',$7,$8,$9,$10,$11)`,
    [
      bookingId,
      code,
      courtId,
      user.id,
      start.toISOString(),
      end.toISOString(),
      price,
      disc.pct,
      Number(settings.vat_rate),
      holdUntil.toISOString(),
      occId,
    ],
  );
  const booking = await one(sql, `select * from court_bookings where id = $1`, [bookingId]);
  return {
    status: 201,
    body: { booking, hold_until: holdUntil.toISOString(), price, list_price: list.price_vnd },
  };
}

export async function bookingsConfirm(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["member"]);
  const b = await readJson(request);
  const method = str(b.method) ?? "transfer";
  const settings = await getSettings(sql);
  const booking = await one<{
    id: string;
    user_id: string;
    status: string;
    hold_until: string | null;
    occupancy_id: string | null;
    court_id: string;
    start_at: string;
    end_at: string;
    price_vnd: number;
    discount_pct: number;
    vat_rate: string | number;
    quota_hours: string | number;
  }>(
    sql,
    `select * from court_bookings where id = $1 for update`,
    [id],
  );
  if (!booking) throw err.notFound();
  if (booking.user_id !== user.id) throw err.forbidden();
  if (booking.status !== "hold") throw err.conflictState("Booking không còn hold.");
  if (!booking.hold_until || new Date(booking.hold_until) < new Date()) {
    throw err.holdExpired();
  }
  const court = await courtById(sql, booking.court_id);
  let payAmount = booking.price_vnd;
  let quotaHours = 0;
  let subId: string | null = null;
  if (method === "quota") {
    const disc = await memberDiscount(sql, user.id, court.sport);
    if (disc.court_hours_left < 1) throw err.br("BR-17", "Hết quota giờ thuê sân.");
    payAmount = 0;
    quotaHours = 1;
    subId = disc.sub_id;
    await sql.query(
      `update subscriptions set court_hours_left = court_hours_left - 1 where id = $1 and court_hours_left >= 1`,
      [subId],
    );
  }
  const payCode = await nextCode(sql, "PAY");
  const pay = await one<{ id: string }>(
    sql,
    `insert into payments (code, user_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
     values ($1,$2,$3,$4,$5,'posted','booking',$6,$7) returning id`,
    [payCode, user.id, method, payAmount, Number(booking.vat_rate), booking.id, user.id],
  );
  try {
    await sql.query(`select occupancy_confirm_hold($1::uuid)`, [booking.occupancy_id]);
  } catch {
    throw err.holdExpired();
  }
  await sql.query(
    `update court_bookings set status = 'confirmed', quota_hours = $2, price_vnd = $3 where id = $1`,
    [booking.id, quotaHours, payAmount],
  );
  const invCode = await nextCode(sql, "INV");
  const inv = await one<{ id: string }>(
    sql,
    `insert into invoices (code, payment_id, buyer_name) values ($1,$2,$3) returning id`,
    [invCode, pay!.id, user.full_name],
  );
  await sql.query(
    `insert into invoice_lines (invoice_id, description, qty, unit_vnd, amount_vnd)
     values ($1,$2,1,$3,$3)`,
    [inv!.id, `Thue san ${court.court_code}`, payAmount],
  );
  await enqueue(
    sql,
    "inapp",
    "booking_confirmed",
    user.id,
    { booking_id: booking.id, code: (booking as { code?: string }).code },
    `booking_confirmed|${booking.id}`,
  );
  const fresh = await one(sql, `select * from court_bookings where id = $1`, [id]);
  const payment = await one(sql, `select * from payments where id = $1`, [pay!.id]);
  void settings;
  return { status: 200, body: { booking: fresh, payment, invoice_id: inv!.id } };
}

export async function bookingsCancel(sql: Sql, id: string, user: PublicUser) {
  const booking = await one<{
    id: string;
    user_id: string | null;
    status: string;
    start_at: string;
    price_vnd: number;
    quota_hours: string | number;
    court_id: string;
  }>(sql, `select * from court_bookings where id = $1 for update`, [id]);
  if (!booking) throw err.notFound();
  if (user.role === "member" && booking.user_id !== user.id) throw err.forbidden();
  if (!["hold", "confirmed"].includes(booking.status)) {
    throw err.conflictState("Không hủy được trạng thái này.");
  }
  const settings = await getSettings(sql);
  if (booking.status === "hold") {
    await sql.query(`select occupancy_release_booking($1::uuid, 'cancelled'::booking_status)`, [id]);
    return { status: 200, body: { refund: null, booking_id: id } };
  }
  const hoursLeft = (new Date(booking.start_at).getTime() - Date.now()) / 3600000;
  const refundable = hoursLeft >= settings.cancel_court_hours;
  await sql.query(`select occupancy_release_booking($1::uuid, 'cancelled'::booking_status)`, [id]);
  let refund = null;
  if (refundable) {
    const qh = Number(booking.quota_hours) || 0;
    if (qh > 0 && booking.user_id) {
      const court = await courtById(sql, booking.court_id);
      const disc = await memberDiscount(sql, booking.user_id, court.sport);
      if (disc.sub_id) {
        await sql.query(`update subscriptions set court_hours_left = court_hours_left + $2 where id = $1`, [
          disc.sub_id,
          qh,
        ]);
      }
      refund = { kind: "quota", hours: qh };
    } else if (booking.price_vnd > 0) {
      const payCode = await nextCode(sql, "PAY");
      const amount = -booking.price_vnd;
      const needMgr = Math.abs(amount) >= settings.refund_manager_vnd;
      const st = needMgr ? "refund_pending" : "posted";
      refund = await one(
        sql,
        `insert into payments (code, user_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
         values ($1,$2,'cash',$3,0,$4,'booking',$5,$6) returning *`,
        [payCode, booking.user_id, amount, st, id, user.id],
      );
    }
  }
  await enqueue(sql, "inapp", "booking_cancelled", booking.user_id, { id }, `booking_cancelled|${id}`);
  await audit(sql, user.id, "cancel_booking", "booking", id);
  return { status: 200, body: { refund, refundable } };
}

export async function bookingsCheckIn(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const settings = await getSettings(sql);
  const booking = await one<{
    id: string;
    status: string;
    start_at: string;
  }>(sql, `select * from court_bookings where id = $1 for update`, [id]);
  if (!booking) throw err.notFound();
  if (booking.status !== "confirmed") throw err.conflictState("Chỉ check-in booking confirmed.");
  const start = new Date(booking.start_at).getTime();
  const now = Date.now();
  const min = start - settings.checkin_before_minutes * 60_000;
  const max = start + settings.noshow_grace_minutes * 60_000;
  if (now < min || now > max) {
    throw err.br("BR-39B", "Ngoài cửa sổ check-in −15/+10 phút.");
  }
  await sql.query(`update court_bookings set status = 'in_use' where id = $1`, [id]);
  return { status: 200, body: { status: "in_use" } };
}

export async function walkIn(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const b = await readJson(request);
  const courtId = str(b.court_id);
  const startAt = str(b.start_at);
  const guest_name = str(b.guest_name);
  const guest_phone_raw = str(b.guest_phone);
  const method = str(b.method) ?? "cash";
  if (!courtId || !startAt || !guest_name || !guest_phone_raw) {
    throw err.validation("Thiếu sân, giờ, tên hoặc SĐT.");
  }
  const guest_phone = normalizePhone(guest_phone_raw);
  if (!isValidVnPhone(guest_phone)) throw err.validation("SĐT không hợp lệ.");
  const settings = await getSettings(sql);
  const start = new Date(startAt);
  const { end } = slotBounds(start, settings.slot_minutes);
  await assertBookWindow(sql, start, { walkIn: true, settings });
  const court = await courtById(sql, courtId);
  if (court.status !== "ready") throw err.br("BR-35", "Sân không sẵn sàng.");
  if (user.role === "receptionist") {
    const shift = await one<{ id: string }>(
      sql,
      `select id from cashier_shifts where receptionist_id = $1 and closed_at is null`,
      [user.id],
    );
    if (!shift) throw err.br("BR-49", "Cần mở ca trước khi thu tiền.");
    (b as { _shift?: string })._shift = shift.id;
  }
  const member = await one<{ id: string; full_name: string }>(
    sql,
    `select id, full_name from users where phone = $1`,
    [guest_phone],
  );
  const list = await lookupPrice(sql, { sport: court.sport, courtId, start });
  let price = list.price_vnd;
  let discount = 0;
  if (member) {
    const disc = await memberDiscount(sql, member.id, court.sport);
    discount = disc.pct;
    price = applyDiscount(list.price_vnd, disc.pct, settings.round_vnd);
  }
  price = roundVnd(price, settings.round_vnd);
  const bookingId = (await one<{ id: string }>(sql, `select gen_random_uuid() as id`))!.id;
  let occId: string;
  try {
    const occ = await one<{ booking_replace_hold: string }>(
      sql,
      `select booking_replace_hold($1::uuid, $2, $3::uuid, $4::timestamptz, $5::timestamptz, $6::uuid) as booking_replace_hold`,
      [member?.id ?? null, guest_phone, courtId, start.toISOString(), end.toISOString(), bookingId],
    );
    occId = occ!.booking_replace_hold;
  } catch (e) {
    if (isConflictSlot(e)) throw err.conflictSlot();
    throw e;
  }
  const code = await nextCode(sql, "CRT");
  await sql.query(
    `insert into court_bookings
       (id, code, court_id, user_id, guest_name, guest_phone, start_at, end_at, status, channel,
        price_vnd, discount_pct, vat_rate, occupancy_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'hold','walkin',$9,$10,$11,$12)`,
    [
      bookingId,
      code,
      courtId,
      member?.id ?? null,
      guest_name,
      guest_phone,
      start.toISOString(),
      end.toISOString(),
      price,
      discount,
      Number(settings.vat_rate),
      occId,
    ],
  );
  await sql.query(`select occupancy_confirm_hold($1::uuid)`, [occId]);
  await sql.query(`update court_bookings set status = 'confirmed', hold_until = null where id = $1`, [
    bookingId,
  ]);
  const payCode = await nextCode(sql, "PAY");
  const shiftId = user.role === "receptionist" ? (b as { _shift?: string })._shift : str(b.shift_id);
  const pay = await one<{ id: string }>(
    sql,
    `insert into payments (code, user_id, shift_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
     values ($1,$2,$3,$4,$5,$6,'posted','booking',$7,$8) returning id`,
    [
      payCode,
      member?.id ?? null,
      shiftId ?? null,
      method,
      price,
      Number(settings.vat_rate),
      bookingId,
      user.id,
    ],
  );
  const invCode = await nextCode(sql, "INV");
  const inv = await one<{ id: string }>(
    sql,
    `insert into invoices (code, payment_id, buyer_name) values ($1,$2,$3) returning id`,
    [invCode, pay!.id, guest_name],
  );
  await sql.query(
    `insert into invoice_lines (invoice_id, description, qty, unit_vnd, amount_vnd) values ($1,$2,1,$3,$3)`,
    [inv!.id, `Khach vang lai ${court.court_code} ${pad2(ictHour(start))}:00`, price],
  );
  await audit(sql, user.id, "walk_in", "booking", bookingId);
  const booking = await one(sql, `select * from court_bookings where id = $1`, [bookingId]);
  const payment = await one(sql, `select * from payments where id = $1`, [pay!.id]);
  return { status: 201, body: { booking, payment, invoice_id: inv!.id } };
}

export async function bookingGet(sql: Sql, id: string, user: PublicUser) {
  const b = await one(sql, `select * from court_bookings where id = $1`, [id]);
  if (!b) throw err.notFound();
  const row = b as { user_id: string | null };
  if (user.role === "member" && row.user_id !== user.id) throw err.forbidden();
  return { status: 200, body: b };
}
