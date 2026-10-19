// Hand check of the served demo build: headless Chrome (the installed browser) through playwright-core.
// Usage: node check-rtl.mjs <apps/web dir> <base url> <out dir> [demo|production]
import { createRequire } from 'node:module';
import path from 'node:path';

const [appDir, base, outDir, mode = 'demo'] = process.argv.slice(2);
const require = createRequire(path.join(appDir, 'package.json'));
const { chromium } = require('playwright-core');
const { AxeBuilder } = require('@axe-core/playwright');

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const origin = new URL(base).origin;
const results = [];
for (const locale of mode === 'demo' ? ['ckb', 'ar', 'en'] : ['ckb']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const external = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:')) external.push(url);
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__csp.push(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber} ${event.sample}`);
    });
  });
  const url = `${base}/demo/banner?locale=${locale}&fixture=complete`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const result = { locale, url, finalUrl: page.url() };
  if (mode === 'demo') {
    const banner = page.locator('section.hms-banner');
    await banner.waitFor({ timeout: 10000 });
    Object.assign(result, await page.evaluate(() => {
      const html = document.documentElement;
      const banner = document.querySelector('section.hms-banner');
      const names = [...document.querySelectorAll('section.hms-banner .hms-patient-name__text')].map((el) => ({
        text: el.textContent,
        dir: el.getAttribute('dir'),
        lang: el.getAttribute('lang'),
        tag: el.tagName.toLowerCase(),
      }));
      const watermark = document.querySelector('[data-testid="demo-watermark"]');
      const firstField = banner?.querySelector('.hms-patient-photo')?.getBoundingClientRect();
      return {
        htmlDir: html.dir,
        htmlLang: html.lang,
        bodyDirection: getComputedStyle(document.body).direction,
        bannerDirection: banner === null ? null : getComputedStyle(banner).direction,
        bannerLabel: banner?.getAttribute('aria-label'),
        names,
        photoStartsAtRightEdge: firstField === undefined ? null : Math.round(window.innerWidth - firstField.right),
        photoStartsAtLeftEdge: firstField === undefined ? null : Math.round(firstField.left),
        mrn: banner?.querySelector('.hms-patient-identity__mrn')?.outerHTML,
        watermark: watermark?.textContent,
        title: document.title,
        easternDigits: /[\u0660-\u0669\u06F0-\u06F9]/.test(document.body.innerText),
        csp: window.__csp,
      };
    }));
    result.cspBeforeAxe = await page.evaluate(() => [...window.__csp]);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    result.axeViolations = axe.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
    await page.screenshot({ path: path.join(outDir, `demo-banner-${locale}.png`), fullPage: false });
  } else {
    Object.assign(result, await page.evaluate(() => ({
      htmlDir: document.documentElement.dir,
      bannerPresent: document.querySelector('section.hms-banner') !== null,
      watermarkPresent: document.querySelector('[data-testid="demo-watermark"]') !== null,
      h1: document.querySelector('h1')?.textContent,
      csp: window.__csp,
    })));
  }
  result.consoleErrors = consoleErrors;
  result.externalRequests = external;
  results.push(result);
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
