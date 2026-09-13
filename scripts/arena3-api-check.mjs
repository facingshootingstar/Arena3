#!/usr/bin/env node
/**
 * Live API check for Arena3. BASE=https://arena3-self.vercel.app npm run ... 
 * Exits 1 on the first failed assertion.
 */
const BASE = (process.env.BASE ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const PASS = "ChangeMe!a3";

function fail(msg, extra) {
  console.error("FAIL", msg, extra ?? "");
  process.exit(1);
}

async function req(path, { method = "GET", token, body, idem } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers["idempotency-key"] = crypto.randomUUID();
  const res = await fetch(`${BASE}/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function expect(cond, msg, extra) {
  if (!cond) fail(msg, extra);
}

async function login(phone) {
  const r = await req("/auth/login", { method: "POST", body: { login: phone, password: PASS } });
  expect(r.status === 200 && r.data?.token, `login ${phone}`, r);
  return r.data;
}

async function main() {
  const plans = await req("/plans");
  expect(plans.status === 200 && plans.data.items?.length > 0, "GET /plans", plans);
  const classes = await req("/classes");
  expect(classes.status === 200 && classes.data.items?.length > 0, "GET /classes", classes);
  const prices = await req("/price-rules");
  expect(prices.status === 200 && prices.data.items?.some((p) => p.day_kind === "weekday"), "GET /price-rules", prices);

  const mgr = await login("0900000001");
  expect(mgr.user.role === "manager", "manager role");
  const desk = await login("0900000002");
  expect(desk.user.role === "receptionist", "desk role");
  const coach = await login("0901110011");
  expect(coach.user.role === "coach", "coach role");
  const member = await login("0901230101");
  expect(member.user.role === "member", "member role");

  const me = await req("/me", { token: member.token });
  expect(me.status === 200 && me.data.user?.full_name, "GET /me", me);
  expect(Array.isArray(me.data.subscriptions), "me.subscriptions");
  expect(Array.isArray(me.data.inbox), "me.inbox");

  const occ = await req("/occupancy", { token: member.token });
  expect(occ.status === 200 && occ.data.courts?.length >= 10, "GET /occupancy", occ);

  const reports = await req("/reports/revenue", { token: mgr.token });
  expect(reports.status === 200 && reports.data.totals, "GET /reports/revenue", reports);

  const schedule = await req("/coach/schedule", { token: coach.token });
  expect(schedule.status === 200 && Array.isArray(schedule.data.items), "GET /coach/schedule", schedule);

  const flags = await req("/flags");
  expect(flags.status === 200 && flags.data.flags, "GET /flags", flags);

  const search = await req("/members?q=Nam", { token: desk.token });
  expect(search.status === 200 && search.data.items?.length >= 1, "GET /members?q=Nam", search);

  const forbidden = await req("/reports/revenue", { token: member.token });
  expect(forbidden.status === 403, "member cannot read revenue", forbidden);

  const badLogin = await req("/auth/login", { method: "POST", body: { login: "0900000001", password: "nope" } });
  expect(badLogin.status === 401, "bad password", badLogin);

  // Hold a far-enough empty badminton slot, then cancel — must not leave occupancy.
  const date = occ.data.date;
  const courts = occ.data.courts.filter((c) => c.sport === "badminton" && c.status === "ready");
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  let pick = null;
  for (const c of courts) {
    for (const h of hours) {
      const start = Date.parse(`${date}T${String(h).padStart(2, "0")}:00:00+07:00`);
      const busy = occ.data.slots.some((s) => {
        if (s.court_id !== c.id) return false;
        return Date.parse(s.start) < start + 3600000 && Date.parse(s.end) > start;
      });
      if (!busy) {
        pick = { court: c, hour: h };
        break;
      }
    }
    if (pick) break;
  }
  expect(pick, "a free badminton slot today");
  const startAt = `${date}T${String(pick.hour).padStart(2, "0")}:00:00+07:00`;
  const hold = await req("/bookings", {
    method: "POST",
    token: member.token,
    idem: true,
    body: { court_id: pick.court.id, start_at: startAt },
  });
  if (hold.status === 201 && hold.data.booking?.id) {
    expect(hold.data.price > 0, "hold has a price", hold);
    const cancel = await req(`/bookings/${hold.data.booking.id}/cancel`, {
      method: "POST",
      token: member.token,
    });
    expect(cancel.status === 200, "cancel hold", cancel);
  } else {
    expect(
      hold.status === 422 || hold.status === 409,
      "hold rejected by business rule (debt/quota/conflict)",
      hold,
    );
  }

  const assistant = await req("/assistant", {
    method: "POST",
    token: member.token,
    body: { message: "Giờ mở cửa?" },
  });
  expect(assistant.status === 200 && typeof assistant.data.reply === "string", "POST /assistant", assistant);

  console.log("OK", BASE, {
    plans: plans.data.items.length,
    classes: classes.data.items.length,
    prices: prices.data.items.length,
    occupancyCourts: occ.data.courts.length,
    coachSessions: schedule.data.items.length,
    assistant: assistant.data.source,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
