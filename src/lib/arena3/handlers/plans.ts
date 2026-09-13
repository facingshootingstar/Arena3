import type { Sql } from "@/lib/db";
import { err } from "../errors";
import { addDays, ictDateString } from "../time";
import { audit, bool, num, readJson, str } from "../helpers";
import { requireRole, type PublicUser } from "../session";
import { one } from "../tx";

export async function plansList(sql: Sql, user: PublicUser | null) {
  const all = user?.role === "manager";
  const items = await sql.query(
    `select id, name, sport_scope, duration_days, session_quota, court_hours,
            court_discount_pct, price_vnd, is_on_sale, carry_over_hours
       from membership_plans
      where $1 or is_on_sale = true
      order by price_vnd`,
    [all],
  );
  return { status: 200, body: { items } };
}

export async function plansCreate(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  const name = str(b.name);
  const sport_scope = str(b.sport_scope);
  const price_vnd = num(b.price_vnd);
  if (!name || !sport_scope || price_vnd == null) throw err.validation("Thiếu name/sport_scope/price_vnd.");
  const row = await one(
    sql,
    `insert into membership_plans
       (name, sport_scope, duration_days, session_quota, court_hours, court_discount_pct, price_vnd, is_on_sale, carry_over_hours)
     values ($1,$2,$3,$4,$5,$6,$7, coalesce($8,true), coalesce($9,false))
     returning *`,
    [
      name,
      sport_scope,
      num(b.duration_days) ?? null,
      num(b.session_quota) ?? null,
      num(b.court_hours) ?? 0,
      num(b.court_discount_pct) ?? 0,
      price_vnd,
      bool(b.is_on_sale),
      bool(b.carry_over_hours),
    ],
  );
  await audit(sql, user.id, "create_plan", "plan", (row as { id: string }).id);
  return { status: 201, body: row };
}

export async function plansPatch(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  const cur = await one(sql, `select * from membership_plans where id = $1`, [id]);
  if (!cur) throw err.notFound();
  await sql.query(
    `update membership_plans set
       name = coalesce($2, name),
       duration_days = coalesce($3, duration_days),
       session_quota = coalesce($4, session_quota),
       court_hours = coalesce($5, court_hours),
       court_discount_pct = coalesce($6, court_discount_pct),
       price_vnd = coalesce($7, price_vnd),
       is_on_sale = coalesce($8, is_on_sale),
       carry_over_hours = coalesce($9, carry_over_hours)
     where id = $1`,
    [
      id,
      str(b.name) ?? null,
      num(b.duration_days) ?? null,
      num(b.session_quota) ?? null,
      num(b.court_hours) ?? null,
      num(b.court_discount_pct) ?? null,
      num(b.price_vnd) ?? null,
      bool(b.is_on_sale) ?? null,
      bool(b.carry_over_hours) ?? null,
    ],
  );
  await audit(sql, user.id, "patch_plan", "plan", id, cur);
  const row = await one(sql, `select * from membership_plans where id = $1`, [id]);
  return { status: 200, body: row };
}

export async function subscriptionsCreate(sql: Sql, request: Request, user: PublicUser) {
  const b = await readJson(request);
  const planId = str(b.plan_id);
  if (!planId) throw err.validation("Thiếu plan_id.");
  let userId = user.id;
  if (user.role === "receptionist" || user.role === "manager") {
    userId = str(b.user_id) ?? user.id;
  } else if (user.role !== "member") {
    throw err.forbidden();
  }
  const plan = await one<{
    id: string;
    sport_scope: string;
    duration_days: number | null;
    session_quota: number | null;
    court_hours: number;
    price_vnd: number;
    is_on_sale: boolean;
  }>(sql, `select * from membership_plans where id = $1`, [planId]);
  if (!plan) throw err.notFound("Không có gói.");
  if (!plan.is_on_sale && user.role === "member") throw err.br("BR-65", "Gói không còn mở bán.");

  const today = ictDateString();
  const duration = plan.duration_days ?? 365;
  const live = await one<{
    id: string;
    status: string;
    end_on: string;
    plan_id: string;
  }>(
    sql,
    `select id, status, end_on::text, plan_id from subscriptions
      where user_id = $1 and sport_scope = $2 and status in ('active','frozen')
      limit 1`,
    [userId, plan.sport_scope],
  );
  if (live?.status === "frozen") throw err.br("BR-14", "Gói đang đóng băng — không mua thêm.");
  if (live?.status === "active") {
    const preview =
      live.end_on >= today ? addDays(live.end_on, duration) : addDays(today, duration);
    return {
      status: 201,
      body: {
        subscription: live,
        preview_end: preview,
        renewal: true,
        message: "Thanh toán để gia hạn trên hợp đồng hiện tại.",
      },
    };
  }
  const pending = await one<{ id: string }>(
    sql,
    `select id from subscriptions where user_id = $1 and sport_scope = $2 and status = 'pending'`,
    [userId, plan.sport_scope],
  );
  const start = today;
  const end = addDays(today, duration);
  if (pending) {
    await sql.query(
      `update subscriptions set plan_id = $2, start_on = $3, end_on = $4,
              court_hours_left = $5, session_left = $6
        where id = $1`,
      [pending.id, plan.id, start, end, plan.court_hours, plan.session_quota],
    );
    const row = await one(sql, `select * from subscriptions where id = $1`, [pending.id]);
    return { status: 201, body: { subscription: row, preview_end: end } };
  }
  const row = await one(
    sql,
    `insert into subscriptions
       (user_id, plan_id, sport_scope, start_on, end_on, status, court_hours_left, session_left)
     values ($1,$2,$3,$4,$5,'pending',$6,$7)
     returning *`,
    [userId, plan.id, plan.sport_scope, start, end, plan.court_hours, plan.session_quota],
  );
  return { status: 201, body: { subscription: row, preview_end: end } };
}
