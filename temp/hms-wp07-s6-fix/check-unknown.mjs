// Hand check: an unknown patient in the address opens nothing (empty window) or is put back (open window).
// Usage: node check-unknown.mjs <apps/web dir> <base url>
import { createRequire } from 'node:module';
import path from 'node:path';

const [appDir, base] = process.argv.slice(2);
const require = createRequire(path.join(appDir, 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const out = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${base}/demo/banner?locale=ckb&patient=NOPE-1`, { waitUntil: 'networkidle' });
await page.locator('[data-testid="patient-chooser"]').waitFor({ timeout: 10000 });
out.push({
  case: 'empty window, unknown patient',
  url: page.url(),
  banner: await page.locator('section.hms-banner').count(),
  chooser: await page.locator('[data-testid="patient-chooser"]').count(),
  dir: await page.evaluate(() => document.documentElement.dir),
});
await page.goto(`${base}/demo/banner?locale=ckb&fixture=complete`, { waitUntil: 'networkidle' });
await page.locator('section.hms-banner').waitFor({ timeout: 10000 });
const opened = page.url();
await page.evaluate(() => {
  history.pushState(null, '', '/demo/banner?locale=ckb&patient=NOPE-2');
  dispatchEvent(new PopStateEvent('popstate'));
});
await page.waitForTimeout(1500);
out.push({
  case: 'open window, unknown patient',
  opened,
  url: page.url(),
  banner: await page.locator('section.hms-banner').count(),
  dialogs: await page.locator('[role=alertdialog]').count(),
  dir: await page.evaluate(() => document.documentElement.dir),
  bannerDirection: await page.evaluate(() => getComputedStyle(document.querySelector('section.hms-banner')).direction),
});
await browser.close();
console.log(JSON.stringify(out, null, 2));
