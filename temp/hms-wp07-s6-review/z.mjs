import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.argv[2], 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto('http://127.0.0.1:4191/demo/banner?fixture=complete', { waitUntil: 'networkidle' });
await page.waitForSelector('section.hms-banner');
await page.keyboard.press('Control+k'); await page.waitForTimeout(600);
console.log(JSON.stringify(await page.evaluate(() => {
  const chain = (el) => { const a = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); a.push(`${e.tagName}.${String(e.className).slice(0,30)} z=${s.zIndex} pos=${s.position} iso=${s.isolation} tf=${s.transform} op=${s.opacity} ctn=${s.contain} wc=${s.willChange} ${e.hasAttribute('inert')?'INERT':''}`); } return a; };
  return { wm: chain(document.querySelector('[data-testid=demo-watermark]')), ov: chain(document.querySelector('.hms-modal-overlay')) };
}), null, 1));
await browser.close();
