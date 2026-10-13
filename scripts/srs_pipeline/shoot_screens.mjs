// Screen Layout shots for SRS v2.3: one clean desktop screenshot of each of the 44 routed screens.
//   node scripts/srs_pipeline/shoot_screens.mjs     (needs the app on http://127.0.0.1:8080 with seed data)
// Signs in with the seed accounts through the API and only opens pages: it never presses a button that
// writes. Shots are in English, like the labels quoted in the use case specifications.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE ?? "http://127.0.0.1:8080";
const OUT = "docs/srs-v2.3/screens";
mkdirSync(OUT, { recursive: true });

const PHONES = { member: "0901230107", receptionist: "0900000002", coach: "0901110011", manager: "0900000001" };

// [number in table 3.1.2, role, route]
const SCREENS = [
  [1, "public", "/"], [2, "public", "/login"], [3, "public", "/register"], [4, "public", "/forgot"],
  [5, "member", "/account"], [6, "receptionist", "/alerts"], [7, "member", "/pay/return"],
  [8, "member", "/app"], [9, "member", "/app/book"], [10, "member", "/app/classes"], [11, "member", "/app/train"],
  [12, "member", "/app/plans"], [13, "member", "/app/points"], [14, "member", "/app/pass"],
  [15, "member", "/app/assistant"], [16, "member", "/app/notifications"],
  [17, "receptionist", "/desk"], [18, "receptionist", "/desk/member/$ID"], [19, "receptionist", "/desk/gate"],
  [20, "receptionist", "/desk/courts"], [21, "receptionist", "/desk/classes"], [22, "receptionist", "/desk/payments"],
  [23, "receptionist", "/desk/day-passes"], [24, "receptionist", "/desk/series"], [25, "receptionist", "/desk/at-risk"],
  [26, "receptionist", "/desk/gear"], [27, "receptionist", "/desk/maintenance"],
  [28, "coach", "/coach"], [29, "coach", "/coach/attendance"], [30, "coach", "/coach/student/$ID"],
  [31, "coach", "/coach/classes"], [32, "coach", "/coach/earnings"],
  [33, "manager", "/manager"], [34, "manager", "/manager/classes"], [35, "manager", "/manager/members"],
  [36, "manager", "/manager/plans"], [37, "manager", "/manager/promos"], [38, "manager", "/manager/attendance"],
  [39, "manager", "/manager/staff"], [40, "manager", "/manager/prices"], [41, "manager", "/manager/commission"],
  [42, "manager", "/manager/invoices"], [43, "manager", "/manager/audit"], [44, "manager", "/manager/settings"],
];

const login = async (phone) =>
  (await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, password: "ChangeMe!a3" }),
  })).json();

const sessions = {};
for (const [role, phone] of Object.entries(PHONES)) sessions[role] = await login(phone);
const demoId = sessions.member.user.id;

const browser = await chromium.launch({ channel: "chrome" });
const contexts = {};
const ctxFor = async (role) => {
  if (contexts[role]) return contexts[role];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1.25 });
  const s = sessions[role];
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem("arena3.lang", "en");
    if (t) {
      localStorage.setItem("arena3.token", t);
      localStorage.setItem("arena3.user", JSON.stringify(u));
    }
  }, [s?.token ?? null, s?.user ?? null]);
  contexts[role] = ctx;
  return ctx;
};

for (const [n, role, route] of SCREENS) {
  const page = await (await ctxFor(role)).newPage();
  const url = base + route.replace("$ID", demoId);
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => undefined);
  await page.waitForTimeout(route === "/" ? 4000 : 1800);
  const file = `${OUT}/s${String(n).padStart(2, "0")}.png`;
  await page.screenshot({ path: file });
  console.log(file, page.url().replace(base, ""));
  await page.close();
}
await browser.close();
