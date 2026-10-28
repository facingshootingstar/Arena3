// node scripts/tests/apple-overflow.mjs <role> <route>: at 390px, which elements stick out, and what fails to load?
import { chromium } from "playwright";
import { BASE, ROLES, loginApi } from "./test-helper.mjs";

const [role, route] = process.argv.slice(2);
const session = role === "guest" ? null : await loginApi(ROLES[role].phone, ROLES[role].password);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([s]) => {
  localStorage.setItem("arena3.lang", "en");
  if (s) {
    localStorage.setItem("arena3.token", s.token);
    localStorage.setItem("arena3.user", JSON.stringify(s.user));
  }
}, [session]);
const page = await ctx.newPage();
page.on("requestfailed", (r) => console.log("FAILED", r.url().slice(0, 140), r.failure()?.errorText));
page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url().slice(0, 140)));
await page.goto(BASE + route, { waitUntil: "load" });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const w = window.innerWidth;
  const res = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 && r.width > 0) {
      // skip things inside a horizontally scrolling box
      let scroller = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if ((o === "auto" || o === "scroll" || o === "hidden") && n.getBoundingClientRect().right <= w + 1) {
          scroller = true;
          break;
        }
      }
      if (!scroller) res.push(`${el.tagName}.${String(el.className).slice(0, 90)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
    }
  }
  return res.slice(0, 8);
});
console.log(out.join("\n") || "no overflowing element");
await browser.close();
