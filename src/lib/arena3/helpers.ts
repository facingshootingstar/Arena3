import type { Sql } from "@/lib/db";
import { sha256 } from "./crypto";
import { err } from "./errors";
import type { PublicUser } from "./session";
import { one } from "./tx";

export type Settings = {
  timezone: string;
  currency: string;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  hold_minutes: number;
  /** How long a slot is held while the centre waits for a bank transfer. */
  transfer_hold_minutes: number;
  book_ahead_days: number;
  max_slots_per_day: number;
  cancel_court_hours: number;
  cancel_class_hours: number;
  noshow_grace_minutes: number;
  checkin_before_minutes: number;
  debt_limit_vnd: number;
  refund_manager_vnd: number;
  freeze_max_days_year: number;
  minor_age: number;
  vat_rate: string | number;
  round_vnd: number;
  waitlist_offer_hours: number;
  deposit_pct_activates: number | null;
  tax_code: string | null;
  legal_name: string | null;
  address: string | null;
};

export async function getSettings(sql: Sql): Promise<Settings> {
  const row = await one<Settings>(
    sql,
    `select timezone, currency, open_time::text, close_time::text, slot_minutes, hold_minutes,
            transfer_hold_minutes,
            book_ahead_days, max_slots_per_day, cancel_court_hours, cancel_class_hours,
            noshow_grace_minutes, checkin_before_minutes, debt_limit_vnd, refund_manager_vnd,
            freeze_max_days_year, minor_age, vat_rate, round_vnd, waitlist_offer_hours,
            deposit_pct_activates, tax_code, legal_name, address
       from center_settings where id = 1`,
  );
  if (!row) throw err.validation("center_settings is missing.");
  return row;
}

export async function audit(
  sql: Sql,
  actor: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown = null,
  after: unknown = null,
) {
  await sql.query(
    `insert into audit_logs (actor_id, action, entity, entity_id, before, after)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
    [
      actor,
      action,
      entity,
      entityId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ],
  );
}

export async function nextCode(sql: Sql, kind: string): Promise<string> {
  const row = await one<{ next_doc_code: string }>(sql, `select next_doc_code($1) as next_doc_code`, [
    kind,
  ]);
  return row?.next_doc_code ?? `${kind}-0000`;
}

export async function enqueue(
  sql: Sql,
  channel: "inapp" | "sms",
  template: string,
  userId: string | null,
  payload: unknown,
  dedupe: string,
) {
  await sql.query(
    `insert into outbox (channel, template, user_id, payload, dedupe_key, sent_at)
     values ($1,$2,$3,$4::jsonb,$5, now())
     on conflict (dedupe_key) do nothing`,
    [channel, template, userId, JSON.stringify(payload), dedupe],
  );
}

export async function withIdempotency(
  sql: Sql,
  request: Request,
  userId: string | null,
  required: boolean,
  handler: () => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown; replay?: boolean }> {
  const key = request.headers.get("idempotency-key");
  if (required && !key) throw err.validation("Idempotency-Key is required.");
  if (!key) return handler();
  const raw = await request.clone().text();
  const hash = sha256(`${request.method}:${new URL(request.url).pathname}:${raw}`);
  const existing = await one<{
    request_hash: string;
    response_code: number;
    response_body: unknown;
    expires_at: string;
  }>(
    sql,
    `select request_hash, response_code, response_body, expires_at::text
       from idempotency_keys where key = $1`,
    [key],
  );
  if (existing && new Date(existing.expires_at) > new Date()) {
    if (existing.request_hash !== hash) {
      throw err.validation("Idempotency-Key was already used for a different request.");
    }
    return { status: existing.response_code, body: existing.response_body, replay: true };
  }
  const result = await handler();
  await sql.query(
    `insert into idempotency_keys
       (key, user_id, method, path, request_hash, response_code, response_body, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb, now() + interval '24 hours')
     on conflict (key) do nothing`,
    [
      key,
      userId,
      request.method,
      new URL(request.url).pathname,
      hash,
      result.status,
      JSON.stringify(result.body),
    ],
  );
  return result;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw err.validation("Invalid JSON body.");
  }
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}
export function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
export function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

export function ageYears(dob: string): number {
  const today = new Date();
  const d = new Date(dob + "T00:00:00+07:00");
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export async function subscriptionDebt(sql: Sql, subId: string): Promise<number> {
  const row = await one<{ debt_vnd: string | number }>(
    sql,
    `select debt_vnd from v_subscription_debt where subscription_id = $1`,
    [subId],
  );
  return Number(row?.debt_vnd ?? 0);
}

/** Active sub covering `sport`. Unlimited (session_left null) wins over quota. */
export async function classSubscription(
  sql: Sql,
  userId: string,
  sport: string,
): Promise<{ id: string; session_left: number | null } | undefined> {
  return one<{ id: string; session_left: number | null }>(
    sql,
    `select id, session_left from subscriptions
      where user_id = $1 and status = 'active'
        and end_on >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
        and (sport_scope = $2 or sport_scope = 'all')
      order by (session_left is null) desc, (sport_scope = $2) desc
      limit 1`,
    [userId, sport],
  );
}

export async function userDebt(sql: Sql, userId: string): Promise<number> {
  const row = await one<{ debt: string | number }>(
    sql,
    `select coalesce(sum(d.debt_vnd),0) as debt
       from v_subscription_debt d
       join subscriptions s on s.id = d.subscription_id
      where s.user_id = $1 and d.debt_vnd > 0`,
    [userId],
  );
  return Number(row?.debt ?? 0);
}

export type Ctx = { sql: Sql; request: Request; user: PublicUser | null };
