// Screenshot every route for every role: node scripts/tests/apple-capture.mjs <outDir> [reduced]
// Output: <outDir>/<role>/<route>__<desktop|mobile>__<light|dark>.png plus report.json with
// console errors, horizontal overflow at 390px and the opacity of <main>'s first child.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, ROLES, loginApi } from "./test-helper.mjs";

const out = process.argv[2] ?? "test-output/apple/before";
const reducedMotion = process.argv[3] === "reduced" ? "reduce" : "no-preference";

const ROUTES = {
  guest: ["/", "/login", "/register", "/forgot", "/terms", "/privacy", "/credits"],
  member: ["/app", "/app/book", "/app/classes", "/app/plans", "/app/train", "/app/pass", "/app/points", "/app/assistant", "/app/notifications", "/chat", "/account", "/alerts"],
  receptionist: ["/desk", "/desk/courts", "/desk/gate", "/desk/payments", "/desk/classes", "/desk/gear", "/desk/maintenance", "/desk/at-risk", "/desk/series"],
  coach: ["/coach", "/coach/classes", "/coach/attendance", "/coach/earnings"],
  manager: ["/manager", "/manager/members", "/manager/classes", "/manager/courts", "/manager/sports", "/manager/media", "/manager/prices", "/manager/plans", "/manager/promos", "/manager/staff", "/manager/settings", "/manager/attendance", "/manager/audit", "/manager/commission", "/manager/invoices"],
};
const VPS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const only = process.env.ROLES?.split(",");
const routeOnly = process.env.ROUTES?.split(",");
const schemes = (process.env.SCHEMES ?? "light,dark").split(",");
const vpOnly = process.env.VPS?.split(",");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
for (const [role, routes] of Object.entries(ROUTES)) {
  if (only && !only.includes(role)) continue;
  const session = role === "guest" ? null : await loginApi(ROLES[role].phone, ROLES[role].password);
  for (const [vpName, vp] of Object.entries(VPS)) {
    if (vpOnly && !vpOnly.includes(vpName)) continue;
    for (const scheme of schemes) {
      const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, reducedMotion });
      await ctx.addInitScript(([s]) => {
        localStorage.setItem("arena3.lang", "en");
        if (s) {
          localStorage.setItem("arena3.token", s.token);
          localStorage.setItem("arena3.user", JSON.stringify(s.user));
        }
      }, [session]);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      for (const route of routes) {
        if (routeOnly && !routeOnly.includes(route)) continue;
        errors.length = 0;
        const name = route === "/" ? "index" : route.replace(/^\//, "").replace(/\//g, "_");
        try {
          await page.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
          await page.waitForTimeout(1800);
          mkdirSync(`${out}/${role}`, { recursive: true });
          await page.screenshot({ path: `${out}/${role}/${name}__${vpName}__${scheme}.png` });
          const m = await page.evaluate(() => ({
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            hiddenMain: (() => {
              const el = document.querySelector("main")?.firstElementChild;
              return el ? Number(getComputedStyle(el).opacity) : null;
            })(),
          }));
          report.push({ role, route, vp: vpName, scheme, ...m, errors: [...errors] });
        } catch (e) {
          report.push({ role, route, vp: vpName, scheme, fatal: String(e).slice(0, 200) });
        }
      }
      await ctx.close();
    }
  }
}
await browser.close();
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.fatal || r.errors?.length || r.overflowX > 0 || (r.hiddenMain !== null && r.hiddenMain < 1));
console.log(`captured ${report.length}, with issues ${bad.length}`);
