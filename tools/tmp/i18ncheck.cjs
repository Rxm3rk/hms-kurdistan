const fs = require('fs'), path = require('path'), vm = require('vm');
const root = 'C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto';
const files = [];
function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/messages\.ts$/.test(f)) files.push(p); } }
walk(root);
const ALLOW = /^(NEWS2|PEWS|MRN|DOB|eMAR|IQD|USD|CBC|CRP|HbA1c|ICU|ICD-10|SpO2|PIN|OTP|SMS|DNACPR|ACVPU|INR|PRN|ECG|MRI|DataMatrix|HL7|FHIR|PACS|AVPU|CSV|Excel|Asiacell|Korek|FastPay|ZainCash|WhatsApp|Viber|LASA|DHIS2|APACHE|SOFA|CRRT|RASS|Ctrl|HMS|Kurdistan|Code|DICOM|NEWS|STEMI|FEFO|STAT|SYN-[A-Z]+-|mmHg|I-PASS|DHIS|ICD-|OPD-|Apgar|amox|IMPRESSION|dataValueSets|Rh|HbsAg|eGFR|GCS|Hb)$/;
function texts(v) {
  let s = v.replace(/\{\s*\w+\s*\}/g, ' ');
  s = s.replace(/\{\s*\w+\s*,\s*(plural|select|selectordinal|number|date|time)\s*,?/g, ' ');
  s = s.replace(/(=\d+|\w+)\s*\{/g, ' ');
  return s.replace(/[{}#]/g, ' ');
}
let problems = 0;
const only = process.argv[2];
for (const f of files) {
  if (only && !f.includes(only)) continue;
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/^import[^;]*;\s*$/gm, '');
  s = s.replace(/^export type .*;\s*$/gm, '');
  s = s.replace(/\s+as const\s+satisfies [^;]*;/g, ';').replace(/\s+satisfies [^;]*;/g, ';').replace(/\bas const\b/g, '');
  s = s.replace(/export const (\w+)\s*=\s*defineMessages\(/g, 'exports.$1 = (');
  s = s.replace(/export const (\w+)\s*(:[^=]*)?=/g, 'exports.$1 =');
  s = s.replace(/^const (\w+)\s*:[^=]*=/gm, 'const $1 =');
  s = s.replace(/export /g, '');
  const mod = {};
  try { vm.runInNewContext(s, { exports: mod, module: {} }); } catch (e) { console.log('PARSE FAIL', path.relative(root, f), e.message.slice(0, 80)); continue; }
  for (const [, m] of Object.entries(mod)) {
    if (!m || typeof m !== 'object' || !m.en || typeof m.en !== 'object') continue;
    for (const loc of ['ckb', 'ar']) {
      const tbl = m[loc] || {};
      for (const k of Object.keys(m.en)) {
        const v = tbl[k];
        if (typeof v !== 'string') { if (typeof m.en[k] === 'string') { console.log('MISSING', path.relative(root, f), loc, k); problems++; } continue; }
        const plain = texts(v);
        const latinWords = (plain.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []).filter((w) => !ALLOW.test(w));
        if (latinWords.length > 0) {
          console.log('EN?', path.relative(root, f), loc, k, latinWords.slice(0, 4).join(','), '|', JSON.stringify(v).slice(0, 100)); problems++;
        }
      }
    }
  }
}
console.log('files', files.length, 'problems', problems);
