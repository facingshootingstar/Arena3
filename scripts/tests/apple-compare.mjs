// Build test-output/apple/compare.html: every screen, before and after, side by side.
//   node scripts/tests/apple-compare.mjs
import { readdirSync, writeFileSync, existsSync } from "node:fs";

const root = "test-output/apple";
const before = `${root}/before`;
const after = `${root}/after`;
const roles = readdirSync(before, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

const rows = [];
for (const role of roles) {
  const files = readdirSync(`${before}/${role}`).filter((f) => f.endsWith(".png")).sort();
  for (const f of files) {
    const [route, vp, scheme] = f.replace(".png", "").split("__");
    rows.push({ role, route, vp, scheme, f, hasAfter: existsSync(`${after}/${role}/${f}`) });
  }
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lê Long Sport: before and after</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 16px; background: Canvas; color: CanvasText; }
  header { position: sticky; top: 0; background: Canvas; padding: 8px 0 12px; z-index: 5; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid color-mix(in srgb, CanvasText 15%, transparent); }
  select, button { font: inherit; padding: 6px 10px; }
  .row { margin: 22px 0 6px; }
  .row h2 { font-size: 14px; margin: 0 0 6px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pair.phone { grid-template-columns: repeat(2, minmax(0, 390px)); justify-content: start; }
  figure { margin: 0; }
  figcaption { font-size: 12px; opacity: .7; margin-bottom: 4px; }
  img { width: 100%; height: auto; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 8px; display: block; }
  .missing { padding: 40px; text-align: center; opacity: .5; border: 1px dashed currentColor; border-radius: 8px; }
</style></head><body>
<header>
  <strong>Before / after</strong>
  <label>Role <select id="role"><option value="">all</option>${roles.map((r) => `<option>${r}</option>`).join("")}</select></label>
  <label>Viewport <select id="vp"><option value="">all</option><option>desktop</option><option>mobile</option></select></label>
  <label>Theme <select id="scheme"><option value="">all</option><option>light</option><option>dark</option></select></label>
  <span id="count"></span>
</header>
<main>
${rows
  .map(
    (r) => `<section class="row" data-role="${r.role}" data-vp="${r.vp}" data-scheme="${r.scheme}">
  <h2>${esc(r.role)} ${esc(r.route.replace(/_/g, "/"))} · ${r.vp} · ${r.scheme}</h2>
  <div class="pair ${r.vp === "mobile" ? "phone" : ""}">
    <figure><figcaption>Before</figcaption><img loading="lazy" src="before/${r.role}/${r.f}" alt="Before: ${esc(r.route)}"></figure>
    <figure><figcaption>After</figcaption>${r.hasAfter ? `<img loading="lazy" src="after/${r.role}/${r.f}" alt="After: ${esc(r.route)}">` : `<div class="missing">not captured</div>`}</figure>
  </div>
</section>`,
  )
  .join("\n")}
</main>
<script>
  const sel = ["role", "vp", "scheme"].map((id) => document.getElementById(id));
  const rows = [...document.querySelectorAll(".row")];
  function apply() {
    const [role, vp, scheme] = sel.map((s) => s.value);
    let n = 0;
    for (const r of rows) {
      const show = (!role || r.dataset.role === role) && (!vp || r.dataset.vp === vp) && (!scheme || r.dataset.scheme === scheme);
      r.hidden = !show;
      if (show) n++;
    }
    document.getElementById("count").textContent = n + " screens";
  }
  sel.forEach((s) => s.addEventListener("change", apply));
  apply();
</script>
</body></html>`;
writeFileSync(`${root}/compare.html`, html);
console.log(`compare.html: ${rows.length} screens, ${rows.filter((r) => r.hasAfter).length} with an after image`);
