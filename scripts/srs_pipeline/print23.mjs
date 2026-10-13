// node print23.mjs <in.html> <out.pdf>
// Prints an HTML page to an A4 PDF with the CSS page size and no browser header or footer;
// merge23.py stamps the running header and "Page N of M" afterwards.
import { chromium } from "playwright";
import path from "node:path";

const [inHtml, outPdf] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.goto("file:///" + path.resolve(inHtml).replace(/\\/g, "/"), { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  if (broken.length) {
    console.error("broken images:", broken);
    process.exit(1);
  }
  await page.pdf({ path: outPdf, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log("wrote", outPdf);
})();
