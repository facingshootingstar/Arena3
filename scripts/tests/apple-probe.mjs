// node scripts/tests/apple-probe.mjs <role> <route> [cpuRate]: when does hidden content show up?
import { chromium } from "playwright";
import { BASE, ROLES, loginApi } from "./test-helper.mjs";

const [role, route, rate = "10"] = process.argv.slice(2);
const session = role === "guest" ? null : await loginApi(ROLES[role].phone, ROLES[role].password);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(([s]) => {
  localStorage.setItem("arena3.lang", "en");
  if (s) {
    localStorage.setItem("arena3.token", s.token);
    localStorage.setItem("arena3.user", JSON.stringify(s.user));
  }
}, [session]);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(rate) });
const t0 = Date.now();
await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 16; i++) {
  const hid = await page.evaluate(() => {
    const out = [];
    for (const el of (document.querySelector("main") ?? document.body).querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top > innerHeight || r.bottom < 0) continue;
      const cs = getComputedStyle(el);
      if (Number(cs.opacity) < 0.05 && el.getAttribute("aria-hidden") !== "true") {
        out.push(`${el.tagName}.${String(el.className).slice(0, 50)} parent=${String(el.parentElement?.className).slice(0, 40)} op=${cs.opacity} tf=${cs.transform.slice(0, 30)} top=${Math.round(r.top)} inline="${el.getAttribute("style") ?? ""}"`);
      }
    }
    return out.slice(0, 4);
  });
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s hidden=${hid.length}`, hid.length ? hid : "");
  if (!hid.length && i > 2) break;
  await page.waitForTimeout(700);
}
await browser.close();
