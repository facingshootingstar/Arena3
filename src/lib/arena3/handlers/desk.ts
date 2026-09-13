import type { Sql } from "@/lib/db";
import { err } from "../errors";
import {
  audit,
  getSettings,
  nextCode,
  num,
  readJson,
  str,
  subscriptionDebt,
} from "../helpers";
import { invoicePdfLines, simplePdf } from "../pdf";
import { requireRole, type PublicUser } from "../session";
import { addDays, ictDateString } from "../time";
import { one } from "../tx";

export async function shiftOpen(sql: Sql, user: PublicUser) {
  requireRole(user, ["receptionist"]);
  const existing = await one(
    sql,
    `select id from cashier_shifts where receptionist_id = $1 and closed_at is null`,
    [user.id],
  );
  if (existing) throw err.conflictState("Đã có ca đang mở.");
  const row = await one(
    sql,
    `insert into cashier_shifts (receptionist_id) values ($1) returning *`,
    [user.id],
  );
  return { status: 201, body: { shift: row } };
}

export async function shiftCurrent(sql: Sql, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const row = await one(
    sql,
    `select * from cashier_shifts where receptionist_id = $1 and closed_at is null`,
    [user.id],
  );
  if (!row) throw err.notFound("Không có ca đang mở.");
  const totals = await one<{ cash: number; all: number }>(
    sql,
    `select coalesce(sum(amount_vnd) filter (where method = 'cash' and status = 'posted'),0)::int as cash,
            coalesce(sum(amount_vnd) filter (where status = 'posted' and method <> 'quota'),0)::int as all
       from payments where shift_id = $1`,
    [(row as { id: string }).id],
  );
  return { status: 200, body: { shift: row, totals } };
}

export async function shiftClose(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist"]);
  const b = await readJson(request);
  const cash = num(b.cash_declared_vnd);
  if (cash == null) throw err.validation("Thiếu cash_declared_vnd.");
  const sh = await one<{ id: string; receptionist_id: string; closed_at: string | null }>(
    sql,
    `select * from cashier_shifts where id = $1 for update`,
    [id],
  );
  if (!sh) throw err.notFound();
  if (sh.receptionist_id !== user.id) throw err.forbidden();
  if (sh.closed_at) throw err.conflictState("Ca đã đóng.");
  await sql.query(
    `update cashier_shifts set closed_at = now(), cash_declared_vnd = $2 where id = $1`,
    [id, cash],
  );
  const actual = await one<{ cash: number }>(
    sql,
    `select coalesce(sum(amount_vnd) filter (where method='cash' and status='posted'),0)::int as cash
       from payments where shift_id = $1`,
    [id],
  );
  await audit(sql, user.id, "close_shift", "shift", id, null, {
    declared: cash,
    actual: actual?.cash,
  });
  return {
    status: 200,
    body: { ok: true, cash_declared_vnd: cash, cash_system_vnd: actual?.cash ?? 0 },
  };
}

async function activateSubscription(sql: Sql, subId: string) {
  const sub = await one<{
    id: string;
    status: string;
    end_on: string;
    start_on: string;
    plan_id: string;
    user_id: string;
    court_hours_left: string | number;
    session_left: number | null;
  }>(sql, `select * from subscriptions where id = $1 for update`, [subId]);
  if (!sub) throw err.notFound();
  const plan = await one<{
    duration_days: number | null;
    court_hours: number;
    session_quota: number | null;
    carry_over_hours: boolean;
    price_vnd: number;
  }>(sql, `select * from membership_plans where id = $1`, [sub.plan_id]);
  if (!plan) throw err.notFound();
  const today = ictDateString();
  const duration = plan.duration_days ?? 365;
  if (sub.status === "active" && sub.end_on >= today) {
    const end = addDays(sub.end_on, duration);
    await sql.query(
      `update subscriptions
          set end_on = $2,
              court_hours_left = court_hours_left + $3,
              session_left = case when session_left is null and $4::int is null then null
                                  else coalesce(session_left,0) + coalesce($4,0) end
        where id = $1`,
      [sub.id, end, plan.court_hours, plan.session_quota],
    );
  } else {
    const end = addDays(today, duration);
    const hours = plan.carry_over_hours ? Number(sub.court_hours_left) + plan.court_hours : plan.court_hours;
    await sql.query(
      `update subscriptions
          set status = 'active', start_on = $2, end_on = $3,
              court_hours_left = $4, session_left = $5
        where id = $1`,
      [sub.id, today, end, hours, plan.session_quota],
    );
  }
}

export async function paymentsCreate(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const b = await readJson(request);
  const ref_type = str(b.ref_type);
  const ref_id = str(b.ref_id);
  const method = str(b.method);
  const amount = num(b.amount_vnd);
  if (!ref_type || !ref_id || !method || amount == null) {
    throw err.validation("Thiếu ref_type/ref_id/method/amount_vnd.");
  }
  const settings = await getSettings(sql);
  let shiftId: string | null = str(b.shift_id) ?? null;
  if (user.role === "receptionist") {
    const sh = await one<{ id: string }>(
      sql,
      `select id from cashier_shifts where receptionist_id = $1 and closed_at is null`,
      [user.id],
    );
    if (!sh) throw err.br("BR-49", "Lễ tân cần ca đang mở.");
    shiftId = sh.id;
  }
  let buyer = user.full_name;
  let userId: string | null = null;
  if (ref_type === "subscription") {
    const sub = await one<{ user_id: string; plan_id: string }>(
      sql,
      `select user_id, plan_id from subscriptions where id = $1`,
      [ref_id],
    );
    if (!sub) throw err.notFound("Không có gói.");
    userId = sub.user_id;
    const u = await one<{ full_name: string }>(sql, `select full_name from users where id = $1`, [userId]);
    buyer = u?.full_name ?? buyer;
  }
  const payCode = await nextCode(sql, "PAY");
  const pay = await one<{ id: string }>(
    sql,
    `insert into payments (code, user_id, shift_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
     values ($1,$2,$3,$4,$5,$6,'posted',$7,$8,$9) returning id`,
    [payCode, userId, shiftId, method, amount, Number(settings.vat_rate), ref_type, ref_id, user.id],
  );
  if (ref_type === "subscription") {
    const plan = await one<{ price_vnd: number }>(
      sql,
      `select p.price_vnd from subscriptions s join membership_plans p on p.id = s.plan_id where s.id = $1`,
      [ref_id],
    );
    const debt = await subscriptionDebt(sql, ref_id);
    const deposit = settings.deposit_pct_activates;
    const paidEnough =
      deposit != null
        ? (plan!.price_vnd - debt) / plan!.price_vnd >= deposit / 100
        : debt <= 0;
    if (paidEnough) await activateSubscription(sql, ref_id);
  }
  const invCode = await nextCode(sql, "INV");
  const inv = await one<{ id: string }>(
    sql,
    `insert into invoices (code, payment_id, buyer_name) values ($1,$2,$3) returning id`,
    [invCode, pay!.id, buyer],
  );
  await sql.query(
    `insert into invoice_lines (invoice_id, description, qty, unit_vnd, amount_vnd)
     values ($1,$2,1,$3,$3)`,
    [inv!.id, ref_type === "subscription" ? "Goi thanh vien" : "Thu ngan", amount],
  );
  await enqueueReceipt(sql, userId, pay!.id);
  const payment = await one(sql, `select * from payments where id = $1`, [pay!.id]);
  const invoice = await one(sql, `select * from invoices where id = $1`, [inv!.id]);
  await audit(sql, user.id, "create_payment", "payment", pay!.id);
  return { status: 201, body: { payment, invoice } };
}

async function enqueueReceipt(sql: Sql, userId: string | null, payId: string) {
  if (!userId) return;
  await sql.query(
    `insert into outbox (channel, template, user_id, payload, dedupe_key, sent_at)
     values ('inapp','payment_receipt',$1,$2::jsonb,$3, now())
     on conflict (dedupe_key) do nothing`,
    [userId, JSON.stringify({ payment_id: payId }), `payment_receipt|${payId}`],
  );
}

export async function paymentsRefund(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const b = await readJson(request);
  const amount = num(b.amount_vnd);
  const reason = str(b.reason) ?? "";
  if (amount == null || amount === 0) throw err.validation("amount_vnd phải âm hoặc dương hoàn.");
  const orig = await one<{
    id: string;
    amount_vnd: number;
    user_id: string | null;
    vat_rate: string | number;
    ref_type: string;
    ref_id: string;
  }>(sql, `select * from payments where id = $1`, [id]);
  if (!orig) throw err.notFound();
  const settings = await getSettings(sql);
  const signed = amount > 0 ? -amount : amount;
  if (Math.abs(signed) > orig.amount_vnd) throw err.validation("Hoàn vượt số đã thu.");
  const needMgr = Math.abs(signed) >= settings.refund_manager_vnd;
  if (needMgr && user.role !== "manager") {
    const payCode = await nextCode(sql, "PAY");
    const row = await one(
      sql,
      `insert into payments (code, user_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
       values ($1,$2,'cash',$3,$4,'refund_pending',$5,$6,$7) returning *`,
      [payCode, orig.user_id, signed, orig.vat_rate, orig.ref_type, orig.ref_id, user.id],
    );
    await audit(sql, user.id, "refund_pending", "payment", (row as { id: string }).id, null, { reason });
    return { status: 201, body: { payment: row } };
  }
  const payCode = await nextCode(sql, "PAY");
  const row = await one(
    sql,
    `insert into payments (code, user_id, method, amount_vnd, vat_rate, status, ref_type, ref_id, created_by)
     values ($1,$2,'cash',$3,$4,'posted',$5,$6,$7) returning *`,
    [payCode, orig.user_id, signed, orig.vat_rate, orig.ref_type, orig.ref_id, user.id],
  );
  await audit(sql, user.id, "refund", "payment", (row as { id: string }).id, null, { reason });
  return { status: 201, body: { payment: row } };
}

export async function paymentsApproveRefund(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["manager"]);
  const p = await one<{ id: string; status: string }>(
    sql,
    `select * from payments where id = $1 for update`,
    [id],
  );
  if (!p) throw err.notFound();
  if (p.status !== "refund_pending") throw err.conflictState();
  await sql.query(`update payments set status = 'posted' where id = $1`, [id]);
  return { status: 200, body: { status: "posted" } };
}

export async function paymentsRejectRefund(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["manager"]);
  const p = await one<{ id: string; status: string }>(
    sql,
    `select * from payments where id = $1 for update`,
    [id],
  );
  if (!p) throw err.notFound();
  if (p.status !== "refund_pending") throw err.conflictState();
  await sql.query(`update payments set status = 'refund_rejected' where id = $1`, [id]);
  return { status: 200, body: { status: "refund_rejected" } };
}

export async function invoicePdf(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["manager", "receptionist", "member"]);
  const format = new URL(request.url).searchParams.get("format") ?? "a5";
  const inv = await one<{
    id: string;
    code: string;
    payment_id: string;
    buyer_name: string;
    buyer_tax_code: string | null;
    issued_at: string;
  }>(sql, `select id, code, payment_id, buyer_name, buyer_tax_code, issued_at::text from invoices where id = $1`, [
    id,
  ]);
  if (!inv) throw err.notFound();
  const pay = await one<{ code: string; method: string; amount_vnd: number }>(
    sql,
    `select code, method, amount_vnd from payments where id = $1`,
    [inv.payment_id],
  );
  const lines = await sql.query<{
    description: string;
    qty: number;
    unit_vnd: number;
    amount_vnd: number;
  }>(`select description, qty, unit_vnd, amount_vnd from invoice_lines where invoice_id = $1`, [id]);
  const settings = await getSettings(sql);
  const bytes = simplePdf(
    invoicePdfLines({
      code: inv.code,
      issued_at: inv.issued_at,
      buyer_name: inv.buyer_name,
      buyer_tax_code: inv.buyer_tax_code,
      legal_name: settings.legal_name,
      tax_code: settings.tax_code,
      address: settings.address,
      pay_code: pay?.code ?? "",
      method: pay?.method ?? "",
      lines,
      total: pay?.amount_vnd ?? 0,
    }),
    format === "80mm" ? { width: 226, height: 600 } : { width: 420, height: 595 },
  );
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${inv.code}.pdf"`,
    },
  });
}

export async function reportsRevenue(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const sp = new URL(request.url).searchParams;
  const from = sp.get("from") ?? ictDateString();
  const to = sp.get("to") ?? from;
  const rows = await sql.query<{
    method: string;
    ref_type: string;
    total: number;
    refunded: number;
    cnt: number;
  }>(
    `select method::text, ref_type,
            coalesce(sum(amount_vnd) filter (where amount_vnd >= 0),0)::int as total,
            coalesce(sum(-amount_vnd) filter (where amount_vnd < 0),0)::int as refunded,
            count(*)::int as cnt
       from payments
      where status = 'posted'
        and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date
      group by method, ref_type`,
    [from, to],
  );
  const money = rows.filter((r) => r.method !== "quota");
  const quota = rows.filter((r) => r.method === "quota");
  const gross = money.reduce((s, r) => s + r.total, 0);
  const refund = money.reduce((s, r) => s + r.refunded, 0);
  const by_source: Record<string, number> = {};
  const by_method: Record<string, number> = {};
  for (const r of money) {
    by_source[r.ref_type] = (by_source[r.ref_type] ?? 0) + r.total;
    by_method[r.method] = (by_method[r.method] ?? 0) + r.total;
  }
  const quotaHours = await one<{ hours: string | number }>(
    sql,
    `select coalesce(sum(quota_hours),0) as hours
       from court_bookings
      where quota_hours > 0
        and (start_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date
        and status in ('confirmed','in_use','completed','no_show')`,
    [from, to],
  );
  return {
    status: 200,
    body: {
      from,
      to,
      totals: { revenue_vnd: gross - refund, gross_vnd: gross, refund_vnd: refund, quota_hours: Number(quotaHours?.hours ?? 0) },
      by_source,
      by_method,
      quota_payments: quota,
      lines: money,
    },
  };
}

export async function reportsOccupancy(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const date = new URL(request.url).searchParams.get("date") ?? ictDateString();
  const rows = await sql.query<{ court_id: string; court_code: string; minutes: number }>(
    `select c.id as court_id, c.court_code,
            coalesce(sum(
              case when o.start_at is null then 0
                   else extract(epoch from (least(o.end_at, $2::timestamptz) - greatest(o.start_at, $1::timestamptz))) / 60
              end
            ),0)::int as minutes
       from courts c
       left join occupancies o
         on o.court_id = c.id and o.start_at < $2 and o.end_at > $1
      group by c.id, c.court_code
      order by c.court_code`,
    [`${date}T06:00:00+07:00`, `${date}T22:00:00+07:00`],
  );
  const openMin = 16 * 60;
  return {
    status: 200,
    body: {
      date,
      items: rows.map((r) => ({
        ...r,
        pct: Math.round((r.minutes / openMin) * 1000) / 10,
      })),
    },
  };
}

export async function settingsGet(sql: Sql, user: PublicUser) {
  requireRole(user, ["manager", "receptionist", "coach"]);
  const row = await one(sql, `select * from center_settings where id = 1`);
  return { status: 200, body: row };
}

export async function settingsPatch(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  const allowed = [
    "open_time",
    "close_time",
    "hold_minutes",
    "book_ahead_days",
    "max_slots_per_day",
    "cancel_court_hours",
    "cancel_class_hours",
    "noshow_grace_minutes",
    "checkin_before_minutes",
    "debt_limit_vnd",
    "refund_manager_vnd",
    "minor_age",
    "vat_rate",
    "legal_name",
    "tax_code",
    "address",
    "freeze_max_days_year",
    "waitlist_offer_hours",
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const k of allowed) {
    if (b[k] !== undefined) {
      sets.push(`${k} = $${i}`);
      vals.push(b[k]);
      i += 1;
    }
  }
  if (!sets.length) return { status: 200, body: await one(sql, `select * from center_settings where id = 1`) };
  await sql.query(`update center_settings set ${sets.join(", ")} where id = 1`, vals);
  await audit(sql, user.id, "patch_settings", "settings", "1", null, b);
  return { status: 200, body: await one(sql, `select * from center_settings where id = 1`) };
}

export async function priceRulesGet(sql: Sql) {
  const items = await sql.query(
    `select id, sport, court_id, day_kind, start_local::text, end_local::text, price_vnd, is_peak
       from price_rules order by sport, day_kind, start_local`,
  );
  return { status: 200, body: { items } };
}

export async function priceRulesPut(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  const items = Array.isArray(b.items) ? b.items : Array.isArray(b) ? b : null;
  if (!items) throw err.validation("Cần items[].");
  await sql.query(`delete from price_rules`);
  for (const it of items as Record<string, unknown>[]) {
    await sql.query(
      `insert into price_rules (sport, court_id, day_kind, start_local, end_local, price_vnd, is_peak)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        str(it.sport),
        str(it.court_id) ?? null,
        str(it.day_kind),
        str(it.start_local),
        str(it.end_local),
        num(it.price_vnd),
        Boolean(it.is_peak),
      ],
    );
  }
  await audit(sql, user.id, "replace_prices", "price_rules", null);
  return priceRulesGet(sql);
}

export async function auditList(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const sp = new URL(request.url).searchParams;
  const items = await sql.query(
    `select id, at, actor_id, action, entity, entity_id, before, after
       from audit_logs
      where ($1::text is null or action = $1)
      order by at desc
      limit 100`,
    [sp.get("action")],
  );
  return { status: 200, body: { items } };
}
