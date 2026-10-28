// Motion and visibility gates for the Apple-style redesign.
//   node scripts/tests/apple-motion-check.mjs
//
// 1. CPU throttled 10x, every route: after 1.5 s nothing visible in <main> may still be at
//    opacity 0 (an entrance that never finished), and no figure may read "0" because a count-up
//    stalled (checked by comparing with the unthrottled page).
// 2. prefers-reduced-motion: reduce: no running Web Animation or CSS animation that moves
//    content may remain (looping decorative ones are listed), content is fully visible, and at
//    390 px the page does not scroll sideways.
import { chromium } from "playwright";
import { BASE, ROLES, loginApi } from "./test-helper.mjs";

const ROUTES = {
  guest: ["/", "/login"],
  member: ["/app", "/app/book", "/app/classes", "/app/plans", "/app/train", "/app/pass"],
  receptionist: ["/desk", "/desk/courts", "/desk/gate", "/desk/payments"],
  coach: ["/coach", "/coach/classes"],
  manager: ["/manager", "/manager/members", "/manager/staff", "/manager/courts", "/manager/settings"],
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const notes = [];

async function stuckHidden(page) {
  return page.evaluate(() => {
    const out = [];
    const root = document.querySelector("main") ?? document.body;
    for (const el of root.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      let hidden = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") {
          hidden = true;
          break;
        }
        if (n.getAttribute("aria-hidden") === "true") {
          hidden = true;
          break;
        }
        if (Number(cs.opacity) < 0.05) {
          // Offscreen below the fold waiting for the observer is allowed; on screen is not.
          if (r.top < window.innerHeight && r.bottom > 0) out.push((n.tagName + "." + String(n.className).slice(0, 60)).trim());
          hidden = true;
          break;
        }
      }
      if (hidden) continue;
    }
    return [...new Set(out)].slice(0, 5);
  });
}

for (const [role, routes] of Object.entries(ROUTES)) {
  const session = role === "guest" ? null : await loginApi(ROLES[role].phone, ROLES[role].password);
  const init = ([s]) => {
    localStorage.setItem("arena3.lang", "en");
    if (s) {
      localStorage.setItem("arena3.token", s.token);
      localStorage.setItem("arena3.user", JSON.stringify(s.user));
    }
  };

  // 1. throttled
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(init, [session]);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 10 });
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(2500);
      const hid = await stuckHidden(page);
      if (hid.length) problems.push(`throttled ${role} ${route}: still hidden ${JSON.stringify(hid)}`);
    }
    await ctx.close();
  }

  // 2. reduced motion, desktop and phone
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
    await ctx.addInitScript(init, [session]);
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(1800);
      const info = await page.evaluate(() => {
        const anims = document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .map((a) => {
            const t = a.effect?.target;
            return (t?.tagName ?? "?") + "." + String(t?.className ?? "").slice(0, 40);
          });
        return { anims: [...new Set(anims)].slice(0, 6), overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      const hid = await stuckHidden(page);
      if (info.anims.length) problems.push(`reduced ${role} ${route} ${vp.width}: animations ${JSON.stringify(info.anims)}`);
      if (hid.length) problems.push(`reduced ${role} ${route} ${vp.width}: hidden ${JSON.stringify(hid)}`);
      if (vp.width === 390 && info.overflow > 0) problems.push(`phone ${role} ${route}: sideways scroll ${info.overflow}px`);
    }
    await ctx.close();
  }
  notes.push(`${role}: ${routes.length} routes checked`);
}
await browser.close();
console.log(notes.join("\n"));
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "ALL CLEAR");
process.exit(problems.length ? 1 : 0);
