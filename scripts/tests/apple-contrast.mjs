// WCAG contrast of the design tokens, resolved by the browser (so color-mix tints are real).
//   node scripts/tests/apple-contrast.mjs   (needs the dev server on 8080)
import { chromium } from "playwright";
import { BASE } from "./test-helper.mjs";

// [label, foreground token, [background layers, bottom first]]
const PAIRS = [
  ["label on page", "fg", ["bg"]],
  ["label on card", "fg", ["surface"]],
  ["secondary on page", "muted", ["bg"]],
  ["secondary on card", "muted", ["surface"]],
  ["tertiary on page", "subtle", ["bg"]],
  ["tertiary on card", "subtle", ["surface"]],
  ["secondary on gray fill", "muted", ["bg", "fill-strong"]],
  ["tertiary on field fill", "subtle", ["surface", "fill"]],
  ["action text on card", "accent-text", ["surface"]],
  ["action text on tint", "accent-text", ["surface", "accent-tint"]],
  ["filled button label", "accent-fg", ["accent"]],
  ["success on tint", "success", ["success-tint"]],
  ["success on card", "success", ["surface"]],
  ["warning text on tint", "hold-text", ["warning-tint"]],
  ["danger on tint", "danger", ["danger-tint"]],
  ["danger on card", "danger", ["surface"]],
  ["info on tint", "info", ["info-tint"]],
  ["filled danger label", "accent-fg", ["danger"]],
  ["on-media on night", "on-media", ["night"]],
  ["on-media muted on night", "on-media-muted", ["night"]],
  ["court: booked", "success", ["success-tint"]],
  ["court: in use", "accent-fg", ["success"]],
  ["court: held", "hold-text", ["warning-tint"]],
  ["court: class", "on-media", ["slot-class"]],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "load" });
  const rows = await page.evaluate((pairs) => {
    const root = getComputedStyle(document.documentElement);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const g = cv.getContext("2d", { willReadFrequently: true });
    const token = (n) => root.getPropertyValue("--color-" + n).trim();
    // Let the browser resolve var()/color-mix() by putting the value on a probe element.
    const probe = document.createElement("i");
    document.body.appendChild(probe);
    const resolve = (n) => {
      probe.style.color = "";
      probe.style.color = `var(--color-${n})`;
      return getComputedStyle(probe).color;
    };
    const paint = (layers) => {
      g.clearRect(0, 0, 1, 1);
      for (const l of layers) {
        g.fillStyle = resolve(l);
        g.fillRect(0, 0, 1, 1);
      }
      const d = g.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = ([r, gg, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    return pairs.map(([label, fgTok, bgLayers]) => {
      const bg = paint(bgLayers);
      const fg = paint([...bgLayers, fgTok]);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return { label, ratio: (a + 0.05) / (b + 0.05), fg, bg, tok: token(fgTok) };
    });
  }, PAIRS);
  console.log(`\n${scheme}`);
  for (const r of rows) {
    const ok = r.ratio >= 4.5;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${r.ratio.toFixed(2).padStart(5)}  ${r.label}`);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} pair(s) under 4.5:1` : "\nAll pairs at or above 4.5:1");
process.exit(failures ? 1 : 0);
