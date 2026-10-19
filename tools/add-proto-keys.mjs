// Adds the prototype's navigation keys to the @hms/i18n catalogues (en, ckb, ar) and their review files.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const KEYS = {
  'proto.nav.home': ['Home', 'سەرەکی', 'الرئيسية'],
  'proto.nav.patients': ['Patients', 'نەخۆشەکان', 'المرضى'],
  'proto.nav.outpatient': ['Outpatient', 'نۆرینگەی دەرەکی', 'العيادات الخارجية'],
  'proto.nav.ward': ['Ward & beds', 'قاوش و جێگاکان', 'الردهات والأسرّة'],
  'proto.nav.chart': ['Patient chart', 'دۆسیەی نەخۆش', 'ملف المريض'],
  'proto.nav.orders': ['Orders', 'داواکارییەکان', 'الطلبات'],
  'proto.nav.emar': ['Medication (eMAR)', 'دەرمان (eMAR)', 'الأدوية (eMAR)'],
  'proto.nav.lab': ['Laboratory', 'تاقیگە', 'المختبر'],
  'proto.nav.billing': ['Billing', 'پسوولە و پارەدان', 'الفوترة'],
  'proto.nav.admin': ['Administration', 'بەڕێوەبردن', 'الإدارة'],
};

function update(file, valueOf) {
  const full = path.join(dir, file);
  const data = JSON.parse(readFileSync(full, 'utf8'));
  for (const [key, values] of Object.entries(KEYS)) {
    data[key] = valueOf(values);
  }
  const sorted = Object.fromEntries(Object.keys(data).sort().map((key) => [key, data[key]]));
  writeFileSync(full, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

update('en.json', (v) => v[0]);
update('ckb.json', (v) => v[1]);
update('ar.json', (v) => v[2]);
update('review/ckb.json', () => 'unreviewed');
update('review/ar.json', () => 'unreviewed');
console.log('ok');
