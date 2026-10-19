// TEMPORARY smoke runner (deleted after the integration pass).
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:5200/',
  pretendToBeVisual: true,
});
const w = dom.window;
globalThis.window = w;
for (const key of Object.getOwnPropertyNames(w)) {
  if (!(key in globalThis)) {
    try {
      globalThis[key] = w[key];
    } catch {
      /* read-only */
    }
  }
}
globalThis.document = w.document;
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
w.matchMedia ??= (query) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
globalThis.matchMedia = w.matchMedia;
class RO { observe() {} unobserve() {} disconnect() {} }
w.ResizeObserver ??= RO; globalThis.ResizeObserver = w.ResizeObserver;
w.IntersectionObserver ??= RO; globalThis.IntersectionObserver = w.IntersectionObserver;
w.HTMLElement.prototype.scrollIntoView ??= function () {};
w.scrollTo = () => {}; globalThis.scrollTo = w.scrollTo; w.scroll = () => {}; globalThis.scroll = w.scroll;
const cssStub = { supports: () => false, escape: (v) => String(v) }; w.CSS ??= cssStub; globalThis.CSS = w.CSS;
w.HTMLDialogElement && (w.HTMLDialogElement.prototype.showModal ??= function () { this.open = true; });

const errors = [];
const origError = console.error;
console.error = (...args) => {
  const text = args.map((a) => (a instanceof Error ? `${a.message}\n${(a.stack ?? '').split('\n').slice(1, 4).join('\n')}` : String(a))).join(' ');
  if (/act\(|not wrapped in act|ReactDOMTestUtils/.test(text)) return;
  errors.push(text.slice(0, 600));
};
console.warn = () => {};
w.addEventListener('error', (event) => {
  errors.push(`window error: ${event.message}`);
});
process.on('unhandledRejection', (reason) => {
  errors.push(`unhandled rejection: ${String(reason?.stack ?? reason).slice(0, 400)}`);
});

const mod = await import('./dist/smoke-entry.js');

const SCREENS = {
  home: '/', patients: '/patients', outpatient: '/outpatient', ward: '/ward', admin: '/admin', appointments: '/appointments',
  emergency: '/emergency', nursing: '/nursing', theatre: '/theatre', icu: '/icu', maternity: '/maternity', labworklist: '/lab-worklist',
  radiology: '/radiology', pharmacy: '/pharmacy', bloodbank: '/blood-bank', inventory: '/inventory', cashier: '/cashier',
  insurance: '/insurance', dashboard: '/dashboard', quality: '/quality', staff: '/staff', reports: '/reports', messaging: '/messaging',
};
const CLINICAL = ['/chart', '/orders', '/emar', '/lab', '/billing'];
const PATIENTS = (process.env.SMOKE_PATIENTS ?? 'SYN-PAT-0101,SYN-PAT-0102,SYN-PAT-0103,SYN-PAT-0104,SYN-PAT-0105,SYN-PAT-0106,SYN-PAT-0107,SYN-PAT-0108,SYN-PAT-0109,SYN-PAT-0110,SYN-PAT-0111,SYN-PAT-0112,SYN-PAT-0113,SYN-PAT-0114,SYN-PAT-0201,SYN-PAT-0230,SYN-PAT-0236').split(',');
const ROLES = ['physician', 'nurse', 'cashier', 'admin'];
const LOCALES = (process.env.SMOKE_LOCALES ?? 'en,ckb,ar').split(',');
const mode = process.env.SMOKE_MODE ?? 'all';

const scenarios = [];
if (mode === 'all' || mode === 'hospital') {
  for (const locale of LOCALES) {
    for (const path of Object.values(SCREENS)) {
      for (const role of path === '/' ? ROLES : ['physician']) {
        scenarios.push({ url: `${path}?locale=${locale}`, role });
      }
    }
  }
  for (const role of ROLES.slice(1)) {
    for (const path of Object.values(SCREENS)) {
      if (path !== '/') scenarios.push({ url: `${path}?locale=en`, role });
    }
  }
}
if (mode === 'all' || mode === 'clinical') {
  for (const path of CLINICAL) {
    scenarios.push({ url: `${path}?locale=en`, role: 'physician' });
    for (const patient of PATIENTS) {
      for (const locale of LOCALES) {
        scenarios.push({ url: `${path}?locale=${locale}&patient=${patient}`, role: locale === 'ar' ? 'nurse' : locale === 'ckb' ? 'cashier' : 'physician' });
      }
    }
  }
}

let failures = 0;
const started = Date.now();
for (const scenario of scenarios) {
  errors.length = 0;
  let outcome;
  try {
    outcome = await mod.runScenario(scenario, errors);
  } catch (error) {
    outcome = { ...scenario, errors: [...errors, `THROWN: ${String(error?.stack ?? error).slice(0, 500)}`], textLength: 0, h1: '', hasBanner: false, hasRibbon: false, dir: '', snippet: '' };
  }
  const clinical = CLINICAL.some((p) => scenario.url.startsWith(p)) && scenario.url.includes('patient=');
  const problems = [];
  if (outcome.errors.length > 0) problems.push(...outcome.errors);
  if (!outcome.hasRibbon) problems.push('no ribbon');
  if (outcome.textLength < 200) problems.push(`little text (${outcome.textLength})`);
  if (clinical && !outcome.hasBanner) problems.push('no banner');
  if (outcome.snippet) problems.push(`suspicious text: ${outcome.snippet}`);
  if (problems.length > 0) {
    failures += 1;
    console.log(`FAIL ${scenario.role} ${scenario.url} h1=[${outcome.h1}]`);
    for (const p of [...new Set(problems)].slice(0, 4)) console.log(`   - ${p.replace(/\n/g, '\n     ')}`);
  } else if (process.env.SMOKE_VERBOSE) {
    console.log(`ok   ${scenario.role} ${scenario.url} h1=[${outcome.h1}] dir=${outcome.dir}`);
  }
}
console.log(`scenarios ${scenarios.length}, failures ${failures}, ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(0);
