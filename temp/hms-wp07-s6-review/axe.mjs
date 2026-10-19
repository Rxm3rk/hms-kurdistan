import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.argv[2], 'package.json'));
const { chromium } = require('playwright-core');
const { AxeBuilder } = require('@axe-core/playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (const [url, label] of [['http://127.0.0.1:4191/demo/banner?locale=ckb&fixture=complete','demo ckb'],['http://127.0.0.1:4191/demo/banner?locale=ar','demo ar chooser'],['http://127.0.0.1:4192/?locale=ar','prod ar']]) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  console.log(label, 'violations', r.violations.map((v) => `${v.id}(${v.nodes.length})`).join(',') || 'none');
}
await browser.close();
