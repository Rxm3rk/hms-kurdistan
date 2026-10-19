import { createRequire } from 'node:module';
import path from 'node:path';
const [appDir] = process.argv.slice(2);
const require = createRequire(path.join(appDir, 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = {};
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.__log = []; page.__ext = [];
  page.on('console', (m) => page.__log.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => page.__log.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:')) page.__ext.push(u); });
  return page;
}
const D = 'http://127.0.0.1:4191', P = 'http://127.0.0.1:4192';
// 1. ckb RTL
{
  const page = await newPage();
  await page.goto(`${D}/demo/banner?locale=ckb&fixture=complete`, { waitUntil: 'networkidle' });
  await page.waitForSelector('section.hms-banner');
  out.ckb = await page.evaluate(() => {
    const b = document.querySelector('section.hms-banner');
    const wm = document.querySelector('[data-testid=demo-watermark]');
    const r = wm.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { url: location.href, dir: document.documentElement.dir, lang: document.documentElement.lang,
      bodyDir: getComputedStyle(document.body).direction, bannerDir: getComputedStyle(b).direction,
      title: document.title, wm: wm.textContent, wmVisible: r.height > 0 && wm.contains(top), eastern: /[\u0660-\u0669\u06F0-\u06F9]/.test(document.body.innerText) };
  });
  out.ckbLog = page.__log; out.ckbExt = page.__ext;
  // open sign dialog and check watermark still on top
  const btns = await page.$$('section.hms-demo__section button, .hms-demo__actions button');
  out.signButtons = btns.length;
  if (btns.length) {
    await btns[0].click();
    await page.waitForTimeout(800);
    out.dialogOpen = await page.evaluate(() => {
      const dlg = document.querySelector('[role=dialog],[role=alertdialog]');
      const wm = document.querySelector('[data-testid=demo-watermark]');
      const r = wm.getBoundingClientRect();
      const pts = [0.1, 0.5, 0.9].map((f) => { const el = document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2); return wm.contains(el) ? 'wm' : (el && (el.className || el.tagName)); });
      return { dialog: !!dlg, wmTopAt: pts };
    });
  }
  await page.close();
}
// 2. history: open A, push B -> confirmation, banner hidden
{
  const page = await newPage();
  await page.goto(`${D}/demo/banner?fixture=complete`, { waitUntil: 'networkidle' });
  await page.waitForSelector('section.hms-banner');
  const urlA = page.url();
  await page.goto(`${D}/demo/banner?fixture=nka`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  out.deepLinkFresh = { url: page.url(), banner: !!(await page.$('section.hms-banner')), dialog: !!(await page.$('[role=alertdialog]')) };
  // within same document: use history
  await page.goto(urlA, { waitUntil: 'networkidle' });
  await page.waitForSelector('section.hms-banner');
  await page.evaluate(() => { history.pushState({}, '', location.pathname + '?patient=SYN-PAT-0002'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForTimeout(1000);
  out.inAppSwitch = { url: page.url(), banner: !!(await page.$('section.hms-banner')), dialog: !!(await page.$('[role=alertdialog]')) };
  // unknown patient id
  await page.goto(`${D}/demo/banner?patient=NOPE-1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  out.unknown = await page.evaluate(() => ({ url: location.href, banner: !!document.querySelector('section.hms-banner'), text: document.querySelector('section.hms-banner')?.innerText.slice(0, 200), chooser: !!document.querySelector('[data-testid=patient-chooser]') }));
  await page.close();
}
// 3. production
{
  const page = await newPage();
  await page.goto(`${P}/demo/banner?locale=ckb&fixture=complete`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  out.prod = await page.evaluate(() => ({ url: location.href, dir: document.documentElement.dir, banner: !!document.querySelector('section.hms-banner'), wm: !!document.querySelector('[data-testid=demo-watermark]'), h1: document.querySelector('h1')?.textContent }));
  out.prodLog = page.__log; out.prodExt = page.__ext;
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
