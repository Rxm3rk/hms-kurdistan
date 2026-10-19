// Screenshots of a running HMS preview with the system Edge (playwright-core, no browser download).
// Usage: node shots.mjs <baseUrl> <outDir> <jsonSpec>
//   jsonSpec: [{ "name": "banner-en", "path": "/demo/banner?patient=SYN-PAT-0001", "lang": "English", "click": ["text=..."], "width": 1366, "height": 800, "fullPage": false }]
import { pathToFileURL } from 'node:url';
const pw = await import(pathToFileURL('C:/Users/Surface/AppData/Local/Temp/hms-preview/snap2/frontend/node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core/index.mjs').href);
const [base, outDir, specJson] = process.argv.slice(2);
const specs = JSON.parse(specJson);
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
for (const s of specs) {
  const page = await browser.newPage({ viewport: { width: s.width ?? 1366, height: s.height ?? 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + s.path, { waitUntil: 'networkidle', timeout: 60000 });
  if (s.lang) await page.getByRole('radio', { name: s.lang, exact: true }).check({ force: true });
  for (const c of s.click ?? []) await page.locator(c).first().click({ timeout: 15000 });
  for (const k of s.keys ?? []) await page.keyboard.press(k);
  await page.waitForTimeout(s.wait ?? 600);
  await page.screenshot({ path: `${outDir}/${s.name}.png`, fullPage: !!s.fullPage });
  console.log(JSON.stringify({ name: s.name, url: page.url(), dir: await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction), errors }));
  await page.close();
}
await browser.close();
