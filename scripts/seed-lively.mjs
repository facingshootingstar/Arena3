#!/usr/bin/env node
/**
 * Isolated demo snapshot. No dotenv loading and no network side effects (mail/payOS).
 * Preview: DATABASE_URL="" PGLITE_DATA_DIR=.cache/lively-demo node scripts/seed-lively.mjs --apply
 * PostgreSQL: DATABASE_URL=... node scripts/seed-lively.mjs (read-only impact plan).
 * Writes to remote PostgreSQL, including ALL Neon branches, are deliberately blocked.
 * Local writes require --apply. Only a fresh PGlite directory, or a database already
 * owned by this script, may be rebuilt. Existing users/logins and catalogues survive.
 * Re-running rebuilds the same deterministic snapshot relative to --as-of (or now).
 * Stop the app before reseeding its PGlite directory; then restart the app with it.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, chmod } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pendingMigrations } from './migration-plan.mjs';
import { isMainModule } from './with-app-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const VERSION = 'lively-v1';
// Explicit list, never CASCADE: an unexpected new FK aborts the transaction.
export const ACTIVITY = ['membership_extensions', 'class_certificates', 'coach_certifications',
  'homework_recipients', 'homework', 'training_plan_versions', 'training_plans',
  'session_results', 'session_charges', 'progress_reviews', 'coach_notes', 'member_levels',
  'training_profiles', 'attendance', 'checkin_tokens', 'equipment_loans', 'waitlist_offers',
  'enrollments', 'coach_occupancies', 'sessions', 'court_bookings', 'occupancies', 'classes',
  'invoice_lines', 'invoices', 'promotion_redemptions', 'payments', 'cashier_shifts',
  'subscriptions', 'booking_series', 'coach_payouts', 'contact_log', 'loyalty_adjustments',
  'messages', 'conversations', 'tickets', 'outbox', 'audit_logs', 'work_orders',
  'sessions_auth', 'otp_challenges', 'idempotency_keys', 'rtc_signals', 'rtc_peers'];

export function id(key) {
  const h = createHash('sha256').update(`${VERSION}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function normalize(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
export function protectedLogin(u) {
  return /@arena3\.local$/i.test(u.email || '') || /^\+8490000000[123]$/.test(u.phone);
}
export function suspiciousUser(u) {
  return !protectedLogin(u) && (/\b(coach|test|dummy|seed|check)\b/i.test(u.full_name)
    || /\d{4,}|[�ÃÄ]/u.test(u.full_name) || /^(Rô Văn Lộc|Nguyễn Văn Bát Môn)$/u.test(u.full_name));
}
export function writableTarget(databaseUrl, dataDir, replaceRemote) {
  if (databaseUrl && replaceRemote) {
    // Deliberate production reseed: the operator must type the exact host they mean.
    if (new URL(databaseUrl).hostname !== replaceRemote)
      throw new Error('--replace-remote must equal the DATABASE_URL hostname.');
    return;
  }
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    if (['host', 'hostaddr', 'service'].some(k => parsed.searchParams.has(k)))
      throw new Error('Connection host overrides are blocked for seed writes.');
    const host = parsed.hostname;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host))
      throw new Error('Remote PostgreSQL/Neon writes are blocked. Use the read-only plan and a backup branch.');
  } else if (!dataDir || dataDir === 'memory') {
    throw new Error('Set PGLITE_DATA_DIR to a fresh, dedicated local directory.');
  }
}

async function connect(databaseUrl, dataDir) {
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const db = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
    await db.connect();
    return { query: (s, p = []) => db.query(s, p), exec: s => db.query(s), close: () => db.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite({ dataDir, parsers: { 1082: s => s, 20: Number } });
  await db.waitReady;
  return db;
}

// Windows may mark newly created directories ReadOnly. Emscripten's NODEFS
// interprets that attribute as Unix permissions and cannot reopen Postgres.
// Only touch this seed's explicitly validated, dedicated directory; no symlinks.
export async function prepareLocalDirectory(dataDir) {
  await mkdir(dataDir, { recursive: true });
  if (process.platform !== 'win32') return;
  const visit = async dir => {
    await chmod(dir, 0o700);
    for (const entry of await readdir(dir, { withFileTypes: true }))
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(resolve(dir, entry.name));
  };
  await visit(resolve(dataDir));
}

export async function migrate(db) {
  await db.exec('create table if not exists _migrations(name text primary key, applied_at timestamptz not null default now())');
  const applied = (await db.query('select name from _migrations')).rows.map(r => r.name);
  for (const { name } of pendingMigrations(await readdir(resolve(ROOT, 'migrations')), applied)) {
    await db.exec('begin');
    try {
      await db.exec(await readFile(resolve(ROOT, 'migrations', name), 'utf8'));
      await db.query('insert into _migrations(name) values ($1)', [name]);
      await db.exec('commit');
    } catch (err) { await db.exec('rollback'); throw new Error(`Migration ${name}: ${err.message}`); }
  }
}

async function impact(db) {
  const users = (await db.query('select id, full_name, role, email, phone from users order by role, full_name')).rows;
  const tables = (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(r => r.tablename);
  const existingActivity = {};
  for (const t of ACTIVITY.filter(t => tables.includes(t)))
    existingActivity[t] = Number((await db.query(`select count(*) as n from ${t}`)).rows[0].n);
  return { existingActivity, protectedLogins: users.filter(protectedLogin),
    reviewOnlyJunkCandidates: users.filter(suspiciousUser),
    deletionPolicy: 'No users are deleted. Activity replacement is local-only in an owned demo DB. Junk candidates require manual review on a Neon backup branch.' };
}

async function insertRows(db, table, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  for (let offset = 0; offset < rows.length; offset += 150) {
    const params = [];
    const values = rows.slice(offset, offset + 150).map(row => `(${keys.map(k => {
      const v = row[k]; params.push(v != null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);
      return `$${params.length}`;
    }).join(',')})`);
    await db.query(`insert into ${table} (${keys.map(k => `"${k}"`).join(',')}) values ${values.join(',')}`, params);
  }
}

export async function populate(db, asOf) {
  const now = new Date(asOf);
  if (!Number.isFinite(+now)) throw new Error('Invalid --as-of timestamp');
  const today = new Date(+now + 7 * 3600000).toISOString().slice(0, 10);
  const day = n => new Date(Date.parse(`${today}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
  const at = (n, h, m = 0) => new Date(`${day(n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`);
  const rows = {};
  const add = (table, row) => { (rows[table] ??= []).push(row); return row; };
  const settings = (await db.query('select * from center_settings where id=1')).rows[0];
  const courts = (await db.query("select * from courts where status='ready' and retired_at is null order by court_code")).rows;
  const plans = (await db.query('select * from membership_plans where is_on_sale and duration_months in (1,3,6,12) order by duration_months')).rows;
  if (plans.length !== 4 || Number(settings.member_court_fee_vnd) !== 30000) throw new Error('Expected four current membership plans and 30,000 VND member court fee');
  const rules = (await db.query('select * from price_rules')).rows;
  const users = (await db.query("select * from users order by id")).rows;
  const manager = users.find(u => u.role === 'manager' && protectedLogin(u));
  const desk = users.find(u => u.role === 'receptionist' && protectedLogin(u));
  const coaches = users.filter(u => u.role === 'coach' && protectedLogin(u));
  if (!manager || !desk || !coaches.length || !courts.length) throw new Error('Missing demo staff/courts');
  const coachSports = (await db.query('select * from coach_sports')).rows;
  const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const given = ['Minh Châu', 'Thu Trang', 'Quang Huy', 'Bảo Ngọc', 'Đức Duy', 'Thanh Trúc', 'Gia Hân', 'Tuấn Kiệt'];
  const hash = manager.password_hash;
  // Synthetic contact details only; existing protected accounts retain their credentials.
  for (let i = 0; i < 96; i++) {
    const uid = id(`member:${i}`);
    if (users.some(u => u.id === uid)) continue;
    const name = `${surnames[i % 12]} ${given[Math.floor(i / 12)]}`;
    const u = add('users', { id: uid, member_code: `LV-${String(i + 1).padStart(4, '0')}`,
      full_name: name, name_normalized: normalize(name), phone: `+84988${String(i).padStart(6, '0')}`,
      email: `lively.${i + 1}@example.invalid`, role: 'member', status: 'active', password_hash: hash,
      date_of_birth: `${1985 + i % 20}-${String(1 + i % 12).padStart(2, '0')}-15`,
      pii_consent_at: at(-96, 8), created_at: at(-96, 8) });
    users.push(u);
  }
  const members = users.filter(u => u.role === 'member' && u.status === 'active' && !suspiciousUser(u)).sort((a,b) => a.id.localeCompare(b.id));
  const subs = new Map();
  const shifts = new Map();
  let payN = 0;
  function payment(refType, refId, user, amount, time, label, status = 'posted') {
    const n = ++payN;
    const localDay = new Date(+time + 7 * 3600000).toISOString().slice(0, 10);
    const shiftStart = new Date(`${localDay}T05:00:00+07:00`);
    const shiftEnd = new Date(`${localDay}T22:30:00+07:00`);
    const atDesk = +time >= +shiftStart && +time <= +shiftEnd;
    if (atDesk && !shifts.has(localDay)) shifts.set(localDay, add('cashier_shifts', {
      id: id(`shift:${localDay}`), receptionist_id: desk.id, opened_at: shiftStart,
      closed_at: +shiftEnd <= +now ? shiftEnd : null, cash_declared_vnd: 0 }));
    const shift = atDesk ? shifts.get(localDay) : null;
    const method = shift ? ['cash', 'transfer', 'card'][n % 3] : 'transfer';
    if (shift && method === 'cash') shift.cash_declared_vnd += amount;
    const p = add('payments', { id: id(`payment:${n}`), code: `PAY-LV-${String(n).padStart(6, '0')}`,
      user_id: user?.id ?? null, shift_id: shift?.id ?? null, method, amount_vnd: amount,
      vat_rate: Number(settings.vat_rate), status, ref_type: refType, ref_id: refId,
      created_by: shift ? desk.id : manager.id, created_at: time, paid_at: status === 'posted' ? time : null });
    if (status !== 'posted') return p;
    const net = Math.floor(amount / (1 + Number(settings.vat_rate) / 100));
    const inv = add('invoices', { id: id(`invoice:${n}`), code: `INV-LV-${String(n).padStart(6, '0')}`,
      payment_id: p.id, buyer_name: user?.full_name ?? 'Khách vãng lai', issued_at: time,
      form_no: '1', serial_no: `A3${today.slice(2, 4)}E`, seller_legal_name: settings.legal_name,
      seller_tax_code: settings.tax_code, seller_address: settings.address,
      subtotal_vnd: net, vat_rate: Number(settings.vat_rate), vat_vnd: amount - net, total_vnd: amount });
    add('invoice_lines', { id: id(`line:${n}`), invoice_id: inv.id, description: label,
      qty: 1, unit: refType === 'booking' ? 'giờ' : 'gói', unit_vnd: amount, amount_vnd: amount });
    add('audit_logs', { at: time, actor_id: desk.id, action: 'payment_posted', entity: 'payment', entity_id: p.id,
      after: { source: VERSION, ref_type: refType, amount_vnd: amount } });
    return p;
  }
  for (const [i, user] of members.entries()) {
    const plan = plans[i % plans.length];
    const start = day(-89 + i % 12);
    // Calendar months, clamped on short months, matching the product's duration model.
    const d = new Date(`${start}T00:00:00Z`);
    const targetMonth = d.getUTCMonth() + plan.duration_months;
    const last = new Date(Date.UTC(d.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    const end = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, Math.min(d.getUTCDate(), last)) - DAY).toISOString().slice(0, 10);
    const s = add('subscriptions', { id: id(`sub:${user.id}`), user_id: user.id, plan_id: plan.id,
      sport_scope: 'all', start_on: start, end_on: end, status: end < today ? 'expired' : 'active', price_vnd: plan.price_vnd });
    subs.set(user.id, s);
    payment('subscription', s.id, user, plan.price_vnd, new Date(`${start}T06:00:00+07:00`), `Hội viên ${plan.duration_months} tháng`);
    add('training_profiles', { user_id: user.id, goal: ['technique', 'fun', 'weight', 'compete'][i % 4], updated_at: at(-60, 8) });
  }
  const busy = new Set();
  const courtBusy = new Set();
  const userDays = new Map();
  const key = (who, date) => `${who}:${+date}`;
  const eligible = members.filter(u => subs.get(u.id).end_on > day(28) && subs.get(u.id).start_on <= day(-85));
  if (eligible.length < 8) throw new Error('Not enough members with membership covering the full class period');
  for (const [ci, coach] of coaches.entries()) {
    const sport = coachSports.find(s => s.user_id === coach.id)?.sport;
    const court = courts.find(c => c.sport === sport);
    if (!court) continue;
    for (let phase = 0; phase < 2; phase++) {
      const from = phase ? -14 : -84;
      const to = phase ? 28 : -29;
      const hour = 17 + ci % 3;
      const weekday = 1 + ci % 5;
      const klass = add('classes', { id: id(`class:${ci}:${phase}`), sport, level: phase ? 'intermediate' : 'beginner',
        coach_id: coach.id, court_id: court.id, capacity: 10, enrolled_count: 8,
        rrule: `FREQ=WEEKLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][weekday]};BYHOUR=${hour}`,
        duration_min: 60, start_on: day(from), end_on: day(to), status: phase ? 'open' : 'closed',
        price_vnd: 800000 + ci * 100000, min_enrolled: 4,
        description: 'Rèn kỹ thuật, phối hợp đồng đội và duy trì thói quen vận động cùng huấn luyện viên.',
        syllabus: 'Khởi động; kỹ thuật nền tảng; bài tập phối hợp; thi đấu thực hành; giãn cơ.',
        who_for: 'Hội viên muốn luyện tập đều đặn và cải thiện kỹ thuật.', bring: 'Giày thể thao, nước uống và khăn cá nhân.' });
      const roster = Array.from({ length: 8 }, (_, j) => eligible[(ci * 8 + j) % eligible.length]);
      for (const u of roster) {
        const e = add('enrollments', { id: id(`enroll:${klass.id}:${u.id}`), class_id: klass.id,
          user_id: u.id, status: 'confirmed', waitlist_pos: null, prepaid_sessions: 0, price_vnd: klass.price_vnd });
        payment('enrollment', e.id, u, klass.price_vnd, at(from - 1, 9), `Học phí ${sport} — ${klass.level}`);
      }
      for (let n = from; n <= to; n++) {
        if (new Date(`${day(n)}T12:00:00Z`).getUTCDay() !== weekday) continue;
        const start = at(n, hour), end = at(n, hour + 1);
        if (+start <= +now && +end > +now) continue;
        const scheduled = +start > +now;
        const sid = id(`session:${klass.id}:${day(n)}`);
        const oid = scheduled ? id(`occ:${sid}`) : null;
        courtBusy.add(key(court.id, start));
        for (const u of roster) busy.add(key(u.id, start));
        if (scheduled) add('occupancies', { id: oid, court_id: court.id, start_at: start, end_at: end, kind: 'session', ref_id: sid });
        add('sessions', { id: sid, class_id: klass.id, court_id: court.id, start_at: start, end_at: end,
          status: scheduled ? 'scheduled' : 'done', occupancy_id: oid });
        if (scheduled) add('coach_occupancies', { id: id(`coach-occ:${sid}`), coach_id: coach.id, session_id: sid, start_at: start, end_at: end });
        else for (const [j, u] of roster.entries()) {
          const absent = (n + 100 + j) % 11 === 0;
          add('attendance', { id: id(`att:${sid}:${u.id}`), kind: 'session', user_id: u.id, session_id: sid,
            result: absent ? 'absent' : j % 7 === 0 ? 'late' : 'present', at: start, method: 'staff', checked_by: coach.id });
          if (!absent) add('session_results', { id: id(`result:${sid}:${u.id}`), session_id: sid, user_id: u.id,
            plan_pct: 70 + j * 3, metrics: { practice_minutes: 45 }, note: 'Di chuyển chủ động hơn, cần giữ nhịp thở đều.', recorded_by: coach.id, recorded_at: end });
        }
      }
      if (phase) {
        const hw = add('homework', { id: id(`hw:${ci}`), coach_id: coach.id, class_id: klass.id,
          title: 'Luyện bước chân và sức bền', body: 'Tập 3 hiệp bước chân, mỗi hiệp 5 phút. Giãn cơ sau tập.',
          checklist: ['Khởi động 5 phút', 'Tập bước chân', 'Giãn cơ'], due_on: day(5), created_at: at(-2, 9) });
        for (const u of roster) add('homework_recipients', { homework_id: hw.id, user_id: u.id, done_items: [] });
        add('coach_notes', { id: id(`note:${ci}`), user_id: roster[0].id, coach_id: coach.id, body: 'Thể lực tiến bộ, tiếp tục tăng cường độ từng bước.', created_at: at(-3, 10) });
        add('progress_reviews', { id: id(`review:${ci}`), user_id: roster[0].id, sport, coach_id: coach.id,
          period_weeks: 4, technique: 4, fitness: 3, attitude: 5, comment: 'Duy trì lịch tập tốt, phối hợp đồng đội tiến bộ.', created_at: at(-1, 10) });
      }
    }
  }
  let bn = 0;
  const horizon = Math.min(Number(settings.book_ahead_days), 7);
  for (let n = -89; n <= horizon; n++) {
    for (const [ci, court] of courts.entries()) {
      for (const hour of [7, 10, 16, 18, 19, 20]) {
        const start = at(n, hour), end = at(n, hour + 1);
        if (+start <= +now && +end > +now) continue;
        if (courtBusy.has(key(court.id, start))) continue;
        // Quiet weekday mornings, busy evenings/weekends; deterministic gaps remain bookable.
        const weekend = [0, 6].includes(start.getUTCDay());
        const roll = (n + 100 + ci * 7 + hour * 3) % 10;
        if (roll >= (hour >= 18 ? 8 : weekend ? 6 : 3)) continue;
        const future = +start > +now;
        const guest = (bn + 1) % 7 === 0;
        const user = guest ? null : Array.from({ length: members.length }, (_, j) => members[(bn * 7 + j) % members.length])
          .find(candidate => !busy.has(key(candidate.id, start)) && (userDays.get(`${candidate.id}:${day(n)}`) || 0) < 2);
        if (!guest && !user) continue;
        const sub = user && subs.get(user.id);
        const covered = sub && sub.start_on <= day(n) && sub.end_on >= day(n);
        const dayKind = weekend ? 'weekend' : 'weekday';
        const rule = rules.filter(r => r.sport === court.sport && (!r.court_id || r.court_id === court.id)
          && r.day_kind === dayKind && r.start_min <= hour * 60 && r.end_min >= (hour + 1) * 60)
          .sort((a, b) => Number(Boolean(b.court_id)) - Number(Boolean(a.court_id)) || a.id.localeCompare(b.id))[0];
        if (!rule) throw new Error(`Missing price rule for ${court.court_code}/${dayKind}/${hour}`);
        const amount = covered ? Number(settings.member_court_fee_vnd) : rule.price_vnd;
        const number = ++bn, bid = id(`booking:${number}`), oid = future ? id(`occ:${bid}`) : null;
        const status = future ? 'confirmed' : number % 23 === 0 ? 'cancelled' : number % 29 === 0 ? 'no_show' : 'completed';
        if (future) add('occupancies', { id: oid, court_id: court.id, start_at: start, end_at: end, kind: 'booking', ref_id: bid });
        add('court_bookings', { id: bid, code: `CRT-LV-${String(number).padStart(6, '0')}`, court_id: court.id,
          user_id: user?.id ?? null, guest_name: guest ? `${surnames[number % 12]} ${given[number % 8]}` : null,
          guest_phone: guest ? `+84977${String(number).padStart(6, '0')}` : null,
          start_at: start, end_at: end, status, channel: guest ? 'desk' : 'app', price_vnd: amount,
          vat_rate: Number(settings.vat_rate), occupancy_id: oid, paid_vnd: amount, deposit_vnd: 0,
          cancel_refund_pct: status === 'cancelled' ? 100 : null, cancel_fee_vnd: status === 'cancelled' ? 0 : null });
        const paidAt = new Date(Math.min(+start - 2 * 3600000, +now - 60000, +at(0, 20)));
        payment('booking', bid, user, amount, paidAt, `Thuê sân ${court.court_code} — ${day(n)} ${hour}:00`);
        if (status === 'cancelled') payment('booking', bid, user, -amount, new Date(+start - 3600000), 'Hoàn tiền hủy sân');
        if (user) {
          busy.add(key(user.id, start));
          const uk = `${user.id}:${day(n)}`; userDays.set(uk, (userDays.get(uk) || 0) + 1);
          if (status === 'completed' && number % 3 === 0) add('attendance', { id: id(`gate:${bid}`), kind: 'gate', user_id: user.id,
            session_id: null, result: null, at: start, method: 'staff', checked_by: desk.id });
        }
      }
    }
  }
  const ticketTexts = ['Nhờ kiểm tra đèn sân cầu lông buổi tối.', 'Tôi muốn đổi giờ tập sang cuối tuần, nhờ tư vấn.',
    'Xin hướng dẫn gia hạn hội viên trước khi hết hạn.', 'Nhờ hỗ trợ lấy lại hóa đơn buổi đặt sân hôm qua.',
    'Tôi muốn đăng ký lớp nâng cao vào tháng tới.'];
  for (let i = 0; i < 100; i++) {
    const user = members[i % members.length], days = -89 + Math.floor(i * 89 / 100);
    const closed = i % 5 !== 0;
    add('tickets', { id: id(`ticket:${i}`), user_id: user.id, body: ticketTexts[i % 5], status: closed ? 'closed' : 'open',
      created_at: at(days, 9), reply: closed ? 'Trung tâm đã tiếp nhận và hỗ trợ yêu cầu của anh/chị. Cảm ơn anh/chị!' : null,
      replied_at: closed ? at(days, 14) : null, replied_by: closed ? desk.id : null });
    add('outbox', { id: id(`notice:${i}`), channel: 'inapp', template: 'booking_confirmed', user_id: user.id,
      payload: { title: 'Lịch tập tại Arena3', body: 'Cảm ơn bạn đã duy trì thói quen luyện tập. Hẹn gặp bạn tại sân!' },
      dedupe_key: `lively:notice:${i}`, sent_at: at(days, 10), created_at: at(days, 10) });
  }
  // FK order, with deferred coach-session FK left enabled.
  const order = ['users', 'subscriptions', 'training_profiles', 'classes', 'enrollments', 'occupancies', 'sessions',
    'coach_occupancies', 'court_bookings', 'cashier_shifts', 'payments', 'invoices', 'invoice_lines', 'attendance', 'session_results',
    'homework', 'homework_recipients', 'coach_notes', 'progress_reviews', 'tickets', 'outbox', 'audit_logs'];
  for (const table of order) await insertRows(db, table, rows[table] || []);
  return { asOf: now.toISOString(), from: day(-89), through: day(horizon),
    added: Object.fromEntries(order.map(t => [t, rows[t]?.length || 0])) };
}

export async function verify(db, asOf) {
  const failures = {};
  const checks = {
    staleBookings: "select count(*) n from court_bookings where status in ('hold','confirmed','in_use') and start_at <= $1",
    futureCompletedBookings: "select count(*) n from court_bookings where status in ('completed','no_show') and end_at > $1",
    staleSessions: "select count(*) n from sessions where status='scheduled' and start_at <= $1",
    duplicateLiveMemberships: "select count(*) n from (select user_id from subscriptions where status in ('active','frozen') group by user_id having count(*)>1) q",
    bookingOverlaps: "select count(*) n from court_bookings a join court_bookings b on a.id<b.id and a.court_id=b.court_id and a.start_at<b.end_at and b.start_at<a.end_at where a.status<>'cancelled' and b.status<>'cancelled'",
    coachOverlaps: "select count(*) n from sessions a join classes ca on ca.id=a.class_id join sessions b on a.id<b.id and a.start_at<b.end_at and b.start_at<a.end_at join classes cb on cb.id=b.class_id where ca.coach_id=cb.coach_id and a.status<>'cancelled' and b.status<>'cancelled'",
    courtSessionOverlaps: "select count(*) n from sessions s join court_bookings b on b.court_id=s.court_id and s.start_at<b.end_at and b.start_at<s.end_at where s.status<>'cancelled' and b.status<>'cancelled'",
    classCoverage: "select count(*) n from enrollments e join classes c on c.id=e.class_id where e.status='confirmed' and not exists(select 1 from subscriptions s where s.user_id=e.user_id and s.start_on<=c.start_on and s.end_on>c.end_on)",
    unpaidBookings: "select count(*) n from court_bookings b where b.paid_vnd<>b.price_vnd or not exists(select 1 from payments p where p.ref_type='booking' and p.ref_id=b.id and p.status='posted' and p.amount_vnd=b.price_vnd and p.paid_at<b.start_at)",
    unpaidEnrollments: "select count(*) n from enrollments e where e.status='confirmed' and not exists(select 1 from payments p where p.ref_type='enrollment' and p.ref_id=e.id and p.status='posted' and p.amount_vnd=e.price_vnd)",
    unpaidMemberships: "select count(*) n from subscriptions s where not exists(select 1 from payments p where p.ref_type='subscription' and p.ref_id=s.id and p.status='posted' and p.amount_vnd=s.price_vnd)",
    memberPricing: "select count(*) n from court_bookings b where exists(select 1 from subscriptions s where s.user_id=b.user_id and (b.start_at at time zone 'Asia/Ho_Chi_Minh')::date between s.start_on and s.end_on) and b.price_vnd<>30000",
    missingInvoices: "select count(*) n from payments p left join invoices i on i.payment_id=p.id where p.status='posted' and (i.id is null or i.total_vnd<>p.amount_vnd or i.subtotal_vnd+i.vat_vnd<>i.total_vnd)",
    missingLines: "select count(*) n from invoices i where i.total_vnd<>(select sum(l.amount_vnd) from invoice_lines l where l.invoice_id=i.id) or not exists(select 1 from invoice_lines l where l.invoice_id=i.id)",
    enrollmentCounts: "select count(*) n from classes c where c.enrolled_count<>(select count(*) from enrollments e where e.class_id=c.id and e.status in ('confirmed','hold'))",
    futurePayments: "select count(*) n from payments where created_at>$1",
    refundSigns: "select count(*) n from payments where (ref_type like 'refund_%' or status in ('refund_pending','refund_rejected')) and amount_vnd>=0",
    memberOverlaps: "select count(*) n from court_bookings a join court_bookings b on a.id<b.id and a.user_id=b.user_id and a.start_at<b.end_at and b.start_at<a.end_at where a.status<>'cancelled' and b.status<>'cancelled'",
    memberClassOverlaps: "select count(*) n from court_bookings b join enrollments e on e.user_id=b.user_id and e.status='confirmed' join sessions s on s.class_id=e.class_id and b.start_at<s.end_at and s.start_at<b.end_at where b.status<>'cancelled' and s.status<>'cancelled'",
    wrongOccupancies: "select count(*) n from court_bookings b left join occupancies o on o.id=b.occupancy_id where (b.status in ('confirmed','in_use','hold') and (o.id is null or o.ref_id<>b.id or o.court_id<>b.court_id or o.start_at<>b.start_at or o.end_at<>b.end_at)) or (b.status in ('completed','cancelled','no_show') and b.occupancy_id is not null)",
    wrongSessionOccupancies: "select count(*) n from sessions s left join occupancies o on o.id=s.occupancy_id where (s.status='scheduled' and (o.id is null or o.ref_id<>s.id or o.court_id<>s.court_id or o.start_at<>s.start_at or o.end_at<>s.end_at or not exists(select 1 from coach_occupancies co join classes c on c.id=s.class_id where co.session_id=s.id and co.coach_id=c.coach_id and co.start_at=s.start_at and co.end_at=s.end_at))) or (s.status<>'scheduled' and s.occupancy_id is not null)",
    listPricing: "select count(*) n from court_bookings b join courts c on c.id=b.court_id where not exists(select 1 from subscriptions s where s.user_id=b.user_id and (b.start_at at time zone 'Asia/Ho_Chi_Minh')::date between s.start_on and s.end_on) and not exists(select 1 from price_rules r where r.sport=c.sport and (r.court_id is null or r.court_id=c.id) and r.day_kind=case when extract(isodow from b.start_at at time zone 'Asia/Ho_Chi_Minh') in (6,7) then 'weekend' else 'weekday' end and r.start_local<=(b.start_at at time zone 'Asia/Ho_Chi_Minh')::time and r.end_local>=(b.end_at at time zone 'Asia/Ho_Chi_Minh')::time and r.price_vnd=b.price_vnd)",
    dailyLimit: "select count(*) n from (select user_id,(start_at at time zone 'Asia/Ho_Chi_Minh')::date from court_bookings where user_id is not null group by 1,2 having count(*)>2) q",
    refundBalances: "select count(*) n from court_bookings b where (select sum(p.amount_vnd) from payments p where p.ref_type='booking' and p.ref_id=b.id and p.status='posted')<>case when b.status='cancelled' then 0 else b.price_vnd end",
    shiftBalances: "select count(*) n from cashier_shifts s where s.cash_declared_vnd<>coalesce((select sum(p.amount_vnd) from payments p where p.shift_id=s.id and p.status='posted' and p.method='cash'),0)",
  };
  for (const [name, sql] of Object.entries(checks)) {
    const n = Number((await db.query(sql, sql.includes('$1') ? [asOf] : [])).rows[0].n);
    if (n) failures[name] = n;
  }
  if (Object.keys(failures).length) throw new Error(`Seed invariant violations: ${JSON.stringify(failures)}`);
  return { checks: Object.keys(checks).length, failures };
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { apply: { type: 'boolean', default: false },
    'as-of': { type: 'string' }, 'data-dir': { type: 'string' }, help: { type: 'boolean' }, 'replace-remote': { type: 'string' } } });
  if (values.help) { console.log('node scripts/seed-lively.mjs [--apply] [--data-dir FRESH_DIR] [--as-of ISO_TIMESTAMP]\nDATABASE_URL selects pg; otherwise PGLITE_DATA_DIR selects PGlite. Remote targets: read-only plan only.'); return; }
  const url = process.env.DATABASE_URL?.trim();
  const dataDir = values['data-dir'] || process.env.PGLITE_DATA_DIR;
  const asOf = values['as-of'] || new Date().toISOString();
  if (!Number.isFinite(+new Date(asOf))) throw new Error('Invalid --as-of timestamp');
  if (values.apply) writableTarget(url, dataDir, values['replace-remote']);
  if (!url && !dataDir) throw new Error('Supply a dedicated PGLITE_DATA_DIR or DATABASE_URL. No implicit .pglite or dotenv fallback.');
  if (values.apply && !url) {
    // Do not even open an unrelated PGlite database. Ownership is a sidecar file.
    const entries = await readdir(dataDir).catch(err => { if (err.code === 'ENOENT') return []; throw err; });
    if (entries.length && !entries.includes('.arena3-lively-owner')) throw new Error('Refusing existing PGlite directory without lively ownership marker. Choose a fresh directory.');
    await prepareLocalDirectory(dataDir);
  }
  const db = await connect(url, dataDir);
  try {
    if (!values.apply) {
      await db.exec('begin read only');
      try { console.log(JSON.stringify({ mode: 'read-only-plan', ...await impact(db), proposed: '96 synthetic Vietnamese member accounts; regenerate ~90 days of local activity plus future court bookings within book-ahead limit. Production cleanup is not implemented or executed.' }, null, 2)); }
      finally { await db.exec('rollback'); }
      return;
    }
    if (url) {
      const owned = (await db.query("select to_regclass('public._lively_seed_state') as t")).rows[0].t;
      if (!owned) {
        const tables = (await db.query("select count(*) n from pg_tables where schemaname='public'")).rows[0].n;
        if (Number(tables) && !values['replace-remote']) throw new Error('Refusing existing PostgreSQL database without lively ownership. Use an empty local database or a read-only plan.');
        await migrate(db);
      }
    } else {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(resolve(dataDir, '.arena3-lively-owner'), VERSION);
      await migrate(db);
    }
    await db.exec('begin');
    try {
      const before = await impact(db);
      // Take every lock in one statement so live app traffic cannot interleave into a deadlock.
      await db.exec(`lock table ${ACTIVITY.join(', ')}, users in access exclusive mode`);
      await db.exec(`truncate table ${ACTIVITY.join(', ')} restart identity`);
      const result = await populate(db, asOf);
      const verification = await verify(db, asOf);
      await db.exec('create table if not exists _lively_seed_state(id int primary key check(id=1), as_of timestamptz not null)');
      await db.query('insert into _lively_seed_state values(1,$1) on conflict(id) do update set as_of=excluded.as_of', [asOf]);
      await db.exec('commit');
      console.log(JSON.stringify({ mode: 'local-demo-applied', ...result, verification,
        replacedLocalActivity: before.existingActivity, preservedUsers: true, deletedUsers: 0,
        junkCandidatesForManualReview: before.reviewOnlyJunkCandidates }, null, 2));
    } catch (err) { await db.exec('rollback'); throw err; }
  } finally { await db.close(); }
}
if (isMainModule(import.meta.url)) main().catch(err => { console.error(`[seed-lively] ${err.message}`); process.exitCode = 1; });
