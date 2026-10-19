import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.argv[2], 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:4191/demo/banner?fixture=complete', { waitUntil: 'networkidle' });
await page.waitForSelector('section.hms-banner');
await page.keyboard.press('Control+k'); await page.waitForTimeout(500);
await page.keyboard.type('Kerîm'); await page.waitForTimeout(500);
const opts = await page.$$eval('[role=option]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 80)));
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
const r = await page.evaluate(() => ({ url: location.href, alert: !!document.querySelector('[role=alertdialog]'), banner: !!document.querySelector('section.hms-banner'), status: document.querySelector('[data-testid=patient-context-status]')?.getAttribute('data-message') }));
console.log(JSON.stringify({ opts, r }, null, 1));
// chooser on demo page while patient open
await page.goto('http://127.0.0.1:4191/demo/banner?fixture=complete', { waitUntil: 'networkidle' });
await page.waitForSelector('section.hms-banner');
const items = await page.$$('.hms-patient-chooser__item');
await items[1].click(); await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(() => ({ url: location.href, alert: !!document.querySelector('[role=alertdialog]'), banner: !!document.querySelector('section.hms-banner') }))));
// back button after confirm
await page.click('[role=alertdialog] button:nth-of-type(2)').catch(e=>console.log('noclick', e.message.slice(0,80)));
await page.waitForTimeout(800);
console.log('after confirm', page.url());
await page.goBack(); await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(() => ({ url: location.href, alert: !!document.querySelector('[role=alertdialog]'), banner: !!document.querySelector('section.hms-banner') }))));
await browser.close();
