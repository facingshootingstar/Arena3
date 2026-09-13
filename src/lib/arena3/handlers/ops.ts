import type { Sql } from "@/lib/db";
import { err, isConflictSlot } from "../errors";
import { flagOn, flagsMap, requireFlag, type FlagKey } from "../flags";
import { audit, enqueue, getSettings, num, readJson, str } from "../helpers";
import { requireRole, type PublicUser } from "../session";
import { isValidVnPhone, normalizePhone } from "../phone";
import { generateAssistantReply, type ChatTurn } from "../gemini";
import { COACHES } from "../coaches";
import { addDays, ictDateString } from "../time";
import { one } from "../tx";

export async function flagsGet(sql: Sql) {
  return { status: 200, body: { flags: await flagsMap(sql) } };
}

export async function flagsPatch(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager"]);
  const b = await readJson(request);
  for (const key of ["F4", "F5", "F6", "SMS"] as FlagKey[]) {
    if (typeof b[key] === "boolean") {
      await sql.query(`insert into feature_flags (key, enabled) values ($1,$2)
        on conflict (key) do update set enabled = excluded.enabled`, [key, b[key]]);
    }
  }
  await audit(sql, user.id, "patch_flags", "flags", null, null, b);
  return flagsGet(sql);
}

export async function subscriptionFreeze(sql: Sql, id: string, request: Request, user: PublicUser) {
  requireRole(user, ["manager", "receptionist"]);
  const days = num((await readJson(request)).days) ?? 7;
  if (days < 1 || days > 90) throw err.validation("Số ngày đóng băng 1–90.");
  const settings = await getSettings(sql);
  const sub = await one<{
    id: string;
    status: string;
    frozen_days: number;
    end_on: string;
    user_id: string;
  }>(sql, `select id, status, frozen_days, end_on::text, user_id from subscriptions where id = $1 for update`, [id]);
  if (!sub) throw err.notFound();
  if (sub.status !== "active") throw err.br("BR-14", "Chỉ đóng băng gói đang active.");
  if (sub.frozen_days + days > settings.freeze_max_days_year) {
    throw err.br("BR-15", `Vượt trần ${settings.freeze_max_days_year} ngày/năm.`);
  }
  const end = addDays(sub.end_on, days);
  await sql.query(
    `update subscriptions set status = 'frozen', frozen_days = frozen_days + $2, end_on = $3 where id = $1`,
    [id, days, end],
  );
  await audit(sql, user.id, "freeze_sub", "subscription", id, sub, { days, end });
  return { status: 200, body: await one(sql, `select * from subscriptions where id = $1`, [id]) };
}

export async function subscriptionUnfreeze(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["manager", "receptionist"]);
  const sub = await one<{ status: string }>(sql, `select status from subscriptions where id = $1 for update`, [id]);
  if (!sub) throw err.notFound();
  if (sub.status !== "frozen") throw err.conflictState("Gói không ở trạng thái đóng băng.");
  await sql.query(`update subscriptions set status = 'active' where id = $1`, [id]);
  await audit(sql, user.id, "unfreeze_sub", "subscription", id);
  return { status: 200, body: await one(sql, `select * from subscriptions where id = $1`, [id]) };
}

export async function waitlistAccept(sql: Sql, offerId: string, user: PublicUser) {
  const offer = await one<{
    id: string;
    enrollment_id: string;
    status: string;
    expires_at: string;
  }>(sql, `select * from waitlist_offers where id = $1 for update`, [offerId]);
  if (!offer) throw err.notFound();
  if (offer.status !== "pending") throw err.conflictState();
  if (new Date(offer.expires_at) < new Date()) throw err.br("BR-25", "Hết hạn nhận chỗ.");
  const enr = await one<{ id: string; class_id: string; user_id: string; status: string }>(
    sql,
    `select * from enrollments where id = $1 for update`,
    [offer.enrollment_id],
  );
  if (!enr || enr.user_id !== user.id) throw err.forbidden();
  const cl = await one<{ enrolled_count: number; capacity: number }>(
    sql,
    `select enrolled_count, capacity from classes where id = $1 for update`,
    [enr.class_id],
  );
  if (!cl) throw err.notFound();
  if (cl.enrolled_count >= cl.capacity) throw err.br("BR-22", "Chỗ vừa kín.");
  await sql.query(
    `update enrollments set status = 'confirmed', waitlist_pos = null where id = $1`,
    [enr.id],
  );
  await sql.query(
    `update classes set enrolled_count = enrolled_count + 1 where id = $1 and enrolled_count < capacity`,
    [enr.class_id],
  );
  await sql.query(`update waitlist_offers set status = 'accepted' where id = $1`, [offerId]);
  return { status: 200, body: { ok: true } };
}

export async function inviteWaitlist(sql: Sql, classId: string) {
  const pending = await one(
    sql,
    `select o.id from waitlist_offers o
       join enrollments e on e.id = o.enrollment_id
      where e.class_id = $1 and o.status = 'pending' and o.expires_at > now()
      limit 1`,
    [classId],
  );
  if (pending) return;
  const next = await one<{ id: string; user_id: string }>(
    sql,
    `select id, user_id from enrollments
      where class_id = $1 and status = 'waitlisted'
      order by waitlist_pos nulls last, id
      limit 1`,
    [classId],
  );
  if (!next) return;
  const settings = await getSettings(sql);
  const hours = settings.waitlist_offer_hours || 2;
  const offer = await one<{ id: string }>(
    sql,
    `insert into waitlist_offers (enrollment_id, expires_at, status)
     values ($1, now() + ($2 * interval '1 hour'), 'pending')
     returning id`,
    [next.id, hours],
  );
  await enqueue(sql, "inapp", "waitlist_offer", next.user_id, { offer_id: offer!.id, class_id: classId }, `wl|${offer!.id}`);
  if (await flagOn(sql, "SMS")) {
    await enqueue(sql, "sms", "waitlist_offer", next.user_id, { offer_id: offer!.id }, `wl-sms|${offer!.id}`);
  }
}

export async function convertSlot(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["manager", "receptionist"]);
  const b = await readJson(request);
  const court_id = str(b.court_id);
  const start_at = str(b.start_at);
  const end_at = str(b.end_at);
  if (!court_id || !start_at || !end_at) throw err.validation("Thiếu court_id/start_at/end_at.");
  const ref = crypto.randomUUID();
  try {
    const occ = await one<{ occupancy_attach_convert: string }>(
      sql,
      `select occupancy_attach_convert($1::uuid, $2::timestamptz, $3::timestamptz, $4::uuid) as occupancy_attach_convert`,
      [court_id, start_at, end_at, ref],
    );
    await audit(sql, user.id, "convert_court", "occupancy", occ!.occupancy_attach_convert);
    return { status: 201, body: { occupancy_id: occ!.occupancy_attach_convert, ref } };
  } catch (e) {
    if (isConflictSlot(e)) throw err.conflictSlot("Không convert — sân cặp đang bận.");
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("COURT_NOT_CONVERTIBLE")) throw err.br("BR-39G", "Sân không convert được.");
    throw e;
  }
}

export async function convertRelease(sql: Sql, groupId: string, user: PublicUser) {
  requireRole(user, ["manager", "receptionist"]);
  await sql.query(`select occupancy_release_convert($1::uuid)`, [groupId]);
  await audit(sql, user.id, "convert_release", "occupancy", groupId);
  return { status: 200, body: { ok: true } };
}

export async function equipmentList(sql: Sql) {
  const items = await sql.query(`select * from equipment_items order by name`);
  return { status: 200, body: { items } };
}

export async function equipmentLoan(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const b = await readJson(request);
  const item_id = str(b.item_id);
  const phone = normalizePhone(str(b.phone) ?? "");
  const qty = num(b.qty) ?? 1;
  if (!item_id || !isValidVnPhone(phone) || qty < 1) throw err.validation("Thiếu dụng cụ / SĐT / số lượng.");
  const item = await one<{ stock: number; rent_vnd: number; name: string }>(
    sql,
    `select stock, rent_vnd, name from equipment_items where id = $1 for update`,
    [item_id],
  );
  if (!item) throw err.notFound();
  if (item.stock < qty) throw err.br("BR-38", "Hết hàng cho thuê.");
  await sql.query(`update equipment_items set stock = stock - $2 where id = $1`, [item_id, qty]);
  const loan = await one(
    sql,
    `insert into equipment_loans (item_id, booking_id, phone, qty, due_at)
     values ($1,$2,$3,$4, now() + interval '3 hours')
     returning *`,
    [item_id, str(b.booking_id) ?? null, phone, qty],
  );
  await audit(sql, user.id, "loan_out", "equipment", item_id, null, loan);
  return { status: 201, body: { loan, rent_vnd: item.rent_vnd * qty } };
}

export async function equipmentReturn(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const loan = await one<{ id: string; item_id: string; qty: number; status: string }>(
    sql,
    `select * from equipment_loans where id = $1 for update`,
    [id],
  );
  if (!loan) throw err.notFound();
  if (loan.status !== "out") throw err.conflictState();
  await sql.query(
    `update equipment_loans set status = 'returned', returned_at = now() where id = $1`,
    [id],
  );
  await sql.query(`update equipment_items set stock = stock + $2 where id = $1`, [loan.item_id, loan.qty]);
  return { status: 200, body: { ok: true } };
}

export async function loansOpen(sql: Sql, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const items = await sql.query(
    `select l.*, i.name, i.sku from equipment_loans l
       join equipment_items i on i.id = l.item_id
      where l.status = 'out'
      order by l.due_at`,
  );
  return { status: 200, body: { items } };
}

export async function sessionAttendanceGet(sql: Sql, sessionId: string, user: PublicUser) {
  requireRole(user, ["coach", "manager"]);
  await requireFlag(sql, "F4");
  const session = await one<{ id: string; class_id: string; status: string }>(
    sql,
    `select id, class_id, status from sessions where id = $1`,
    [sessionId],
  );
  if (!session) throw err.notFound();
  const roster = await sql.query(
    `select u.id, u.full_name, u.member_code, u.health_notes,
            a.result, a.at
       from enrollments e
       join users u on u.id = e.user_id
       left join attendance a on a.session_id = $1 and a.user_id = u.id and a.kind = 'session'
      where e.class_id = $2 and e.status = 'confirmed'
      order by u.full_name`,
    [sessionId, session.class_id],
  );
  return { status: 200, body: { session, items: roster } };
}

export async function sessionAttendancePost(sql: Sql, sessionId: string, request: Request, user: PublicUser) {
  requireRole(user, ["coach", "manager"]);
  await requireFlag(sql, "F4");
  const session = await one<{ id: string; status: string; end_at: string }>(
    sql,
    `select id, status, end_at from sessions where id = $1`,
    [sessionId],
  );
  if (!session) throw err.notFound();
  if (session.status === "done") throw err.br("BR-27", "Buổi đã khóa điểm danh.");
  const b = await readJson(request);
  const items = Array.isArray(b.items) ? b.items : [];
  for (const it of items) {
    const uid = str(it.user_id);
    const result = str(it.result) ?? "present";
    if (!uid) continue;
    await sql.query(
      `delete from attendance where session_id = $1 and user_id = $2 and kind = 'session'`,
      [sessionId, uid],
    );
    await sql.query(
      `insert into attendance (kind, user_id, session_id, result)
       values ('session', $1, $2, $3::att_result)`,
      [uid, sessionId, result],
    );
  }
  await audit(sql, user.id, "attendance", "session", sessionId);
  return sessionAttendanceGet(sql, sessionId, user);
}

export async function trainingList(sql: Sql, request: Request, user: PublicUser) {
  await requireFlag(sql, "F4");
  const url = new URL(request.url);
  const classId = url.searchParams.get("class_id");
  const mine = url.searchParams.get("mine") === "1";
  const items = await sql.query(
    `select * from training_plans
      where published = true
        and ($1::uuid is null or class_id = $1)
        and (
          $2::boolean is false
          or user_id = $3
          or (user_id is null and class_id is null)
          or (user_id is null and class_id in (
                select class_id from enrollments where user_id = $3 and status = 'confirmed'
              ))
        )
      order by id desc
      limit 40`,
    [classId, mine || user.role === "member", user.id],
  );
  return { status: 200, body: { items } };
}

export async function trainingCreate(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["coach", "manager"]);
  await requireFlag(sql, "F4");
  const b = await readJson(request);
  const payload = b.payload ?? {};
  const row = await one(
    sql,
    `insert into training_plans (scope, class_id, user_id, source, published, payload)
     values ($1,$2,$3,$4, coalesce($5,true), $6::jsonb)
     returning *`,
    [
      str(b.scope) ?? "class",
      str(b.class_id) ?? null,
      str(b.user_id) ?? null,
      str(b.source) ?? "coach",
      b.published !== false,
      JSON.stringify(payload),
    ],
  );
  return { status: 201, body: row };
}

export async function trainingSuggest(sql: Sql, request: Request, user: PublicUser) {
  requireRole(user, ["coach", "manager"]);
  await requireFlag(sql, "F5");
  const b = await readJson(request);
  const sport = str(b.sport) ?? "badminton";
  const level = str(b.level) ?? "beginner";
  const goal = str(b.goal) ?? "kỹ thuật nền";
  const drills: Record<string, Record<string, string[]>> = {
    badminton: {
      beginner: ["Footwork 6 hướng 8′", "Clear cao sâu 12′", "Net shot 10′", "Game 11 điểm"],
      intermediate: ["Smash có đà 12′", "Drive đôi công 10′", "Phủ lưới 8′", "Set 21"],
      advanced: ["Jump smash 10′", "Tấn công góc chéo", "Phòng ngự thấp", "Thi đấu có trọng tài"],
    },
    basketball: {
      beginner: ["Form ném 10′", "Dẫn bóng 2 tay", "Lay-up 2 bên", "3v3 nửa sân"],
      intermediate: ["Pick and roll", "Ném 3 điểm chân", "Phòng 2-3 zone", "5v5"],
    },
    volleyball: {
      beginner: ["Đỡ bóng thấp", "Phát tay dưới", "Chuyền 2", "6 chạm xoay"],
      intermediate: ["Phát nhảy", "Chặn 2 người", "Tấn công biên", "Set thi đấu"],
    },
  };
  const list = drills[sport]?.[level] ?? drills.badminton.beginner;
  const payload = {
    sport,
    level,
    goal,
    source: "ai",
    generated_on: ictDateString(),
    blocks: list.map((title, i) => ({ order: i + 1, title, minutes: 10 + i })),
    note: "HLV duyệt trước khi giao. AI không thay giáo án đã publish.",
  };
  return { status: 200, body: { payload } };
}

export async function assistantChat(sql: Sql, request: Request, user: PublicUser) {
  await requireFlag(sql, "F6");
  const body = await readJson(request);
  const message = (str(body.message) ?? "").trim().slice(0, 800);
  if (message.length < 2) throw err.validation("Nhập câu hỏi.");
  const q = message.toLowerCase();

  if (/ticket:|khiếu nại|góp ý/.test(q) || q.startsWith("ticket:")) {
    const t = await one<{ id: string }>(
      sql,
      `insert into tickets (user_id, body) values ($1,$2) returning id`,
      [user.id, message],
    );
    await audit(sql, user.id, "assistant", "chat", user.id, null, { q: message.slice(0, 200), source: "ticket" });
    return {
      status: 200,
      body: {
        reply: `Đã mở phiếu ${t!.id.slice(0, 8)} cho quầy. Lễ tân trả lời trong giờ mở cửa.`,
        source: "rules" as const,
      },
    };
  }

  const settings = await getSettings(sql);
  const plans = await sql.query<{ name: string; price_vnd: number; sport_scope: string; court_hours: number }>(
    `select name, price_vnd, sport_scope, court_hours from membership_plans where is_on_sale = true order by price_vnd`,
  );
  const classes = await sql.query<{
    sport: string;
    level: string;
    rrule: string;
    enrolled_count: number;
    capacity: number;
    coach_name: string | null;
  }>(
    `select cl.sport, cl.level, cl.rrule, cl.enrolled_count, cl.capacity, u.full_name as coach_name
       from classes cl
       left join users u on u.id = cl.coach_id
      where cl.status = 'open'`,
  );
  const subs = await sql.query<{ plan_name: string; status: string; end_on: string; court_hours_left: string | number }>(
    `select p.name as plan_name, s.status, s.end_on::text, s.court_hours_left
       from subscriptions s join membership_plans p on p.id = s.plan_id
      where s.user_id = $1 and s.status in ('active','frozen','pending')
      order by s.end_on desc limit 3`,
    [user.id],
  );
  const todayBookings = await sql.query<{ court_code: string; start_at: string; status: string }>(
    `select c.court_code, b.start_at::text, b.status
       from court_bookings b join courts c on c.id = b.court_id
      where b.user_id = $1
        and b.status in ('hold','confirmed')
        and b.start_at >= now() - interval '12 hours'
        and b.start_at < now() + interval '24 hours'
      order by b.start_at`,
    [user.id],
  );

  const facts = [
    `Trung tâm: Arena3. Mở cửa ${settings.open_time.slice(0, 5)}–${settings.close_time.slice(0, 5)} ICT mỗi ngày.`,
    `Hold sân ${settings.hold_minutes} phút. Hủy sân ≥ ${settings.cancel_court_hours} giờ. Hủy lớp ≥ ${settings.cancel_class_hours} giờ. No-show không hoàn.`,
    `Waitlist FIFO; mời trong ${settings.waitlist_offer_hours} giờ. Vị thành niên (<${settings.minor_age}) không tự đặt sân / ghi danh.`,
    `Gói đang bán:\n${plans.map((p) => `• ${p.name} (${p.sport_scope}): ${p.price_vnd.toLocaleString("vi-VN")}đ · ${p.court_hours} giờ sân`).join("\n") || "—"}`,
    `Lớp đang mở:\n${classes.map((c) => `• ${c.sport} ${c.level} · HLV ${c.coach_name ?? "—"} · ${c.enrolled_count}/${c.capacity}`).join("\n") || "Chưa có lớp mở."}`,
    `HLV:\n${COACHES.map((c) => `• ${c.name} — ${c.title}. ${c.blurb}`).join("\n")}`,
    `Hội viên đang hỏi: ${user.full_name} (${user.member_code ?? "chưa có mã"}).`,
    `Gói của họ:\n${subs.map((s) => `• ${s.plan_name} · ${s.status} · hạn ${s.end_on.slice(0, 10)} · còn ${s.court_hours_left} giờ`).join("\n") || "Chưa có gói."}`,
    `Hôm nay / 24h tới:\n${todayBookings.map((b) => `• ${b.court_code} ${b.start_at} (${b.status})`).join("\n") || "Trống."}`,
  ].join("\n\n");

  const system = `Bạn là trợ lý lễ tân Arena3 (app hội viên). Trả lời tiếng Việt, ngắn (2–8 câu), đúng sự thật trong KHỐI DỮ LIỆU.
Không tư vấn y khoa, không hứa giảm giá ngoài gói, không bịa slot trống.
Chỉ nêu HLV / gói / lớp có trong khối dữ liệu — không bịa tên.
Nếu không biết: bảo hỏi quầy hoặc gõ «ticket: …».
Có thể hướng dẫn: Đặt sân / Lớp / Gói trong app. Thu tiền tại quầy sau khi đặt trên app.

KHỐI DỮ LIỆU:
${facts}`;

  const history = parseHistory(body.history);
  const turns: ChatTurn[] = [...history, { role: "user", text: message }];

  const ai = await generateAssistantReply(system, turns);
  const reply = ai?.text ?? ruleReply(q, settings, plans, classes);
  const source = ai?.source ?? "rules";

  await audit(sql, user.id, "assistant", "chat", user.id, null, {
    q: message.slice(0, 200),
    source,
  });
  return { status: 200, body: { reply, source } };
}

function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const item of raw.slice(-8)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { role?: unknown; text?: unknown };
    const role =
      rec.role === "me" || rec.role === "user" ? "user" : rec.role === "bot" || rec.role === "model" ? "model" : null;
    const text = typeof rec.text === "string" ? rec.text.trim().slice(0, 800) : "";
    if (!role || text.length < 1) continue;
    out.push({ role, text });
  }
  return out;
}

function ruleReply(
  q: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
  plans: Array<{ name: string; price_vnd: number }>,
  classes: Array<{ sport: string; level: string; enrolled_count: number; capacity: number }>,
): string {
  if (/giá|bao nhiêu|gói/.test(q)) {
    return `Gói đang bán:\n${plans.map((p) => `• ${p.name}: ${p.price_vnd.toLocaleString("vi-VN")}đ`).join("\n")}\nThu tại quầy sau khi đặt trên app.`;
  }
  if (/giờ|mở cửa|mấy giờ/.test(q)) {
    return `Arena3 mở ${settings.open_time.slice(0, 5)}–${settings.close_time.slice(0, 5)} mỗi ngày (ICT). Hold sân ${settings.hold_minutes} phút, hủy sân ≥ ${settings.cancel_court_hours} giờ.`;
  }
  if (/lớp|học|hlv/.test(q)) {
    return classes.length
      ? `Lớp đang mở:\n${classes.map((c) => `• ${c.sport} ${c.level} (${c.enrolled_count}/${c.capacity})`).join("\n")}`
      : "Chưa có lớp mở. Liên hệ quầy.";
  }
  if (/hủy|đặt sân|hold/.test(q)) {
    return `Đặt sân trên app: giữ chỗ ${settings.hold_minutes} phút. Hủy sân ≥ ${settings.cancel_court_hours} giờ trước giờ chơi. Hủy lớp ≥ ${settings.cancel_class_hours} giờ. No-show không hoàn.`;
  }
  if (/waitlist|chờ|đầy/.test(q)) {
    return `Lớp đầy thì vào danh sách chờ FIFO. Có chỗ, hệ thống mời trong ${settings.waitlist_offer_hours} giờ — nhận trên app.`;
  }
  return "Mình trả lời lịch, gói, HLV, hủy/đặt, waitlist trong phạm vi Arena3. Gõ «ticket: …» để gửi quầy. Không tư vấn y khoa.";
}

export async function ticketsCreate(sql: Sql, request: Request, user: PublicUser) {
  const body = str((await readJson(request)).body);
  if (!body) throw err.validation("Thiếu nội dung.");
  const row = await one(sql, `insert into tickets (user_id, body) values ($1,$2) returning *`, [user.id, body]);
  return { status: 201, body: row };
}

export async function ticketsList(sql: Sql, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  const items = await sql.query(
    `select t.*, u.full_name, u.phone from tickets t
       left join users u on u.id = t.user_id
      where t.status = 'open'
      order by t.created_at desc
      limit 50`,
  );
  return { status: 200, body: { items } };
}

export async function ticketClose(sql: Sql, id: string, user: PublicUser) {
  requireRole(user, ["receptionist", "manager"]);
  await sql.query(`update tickets set status = 'closed' where id = $1`, [id]);
  return { status: 200, body: { ok: true } };
}
