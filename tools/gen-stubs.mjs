import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const S = [
  ['home', 'HomeScreen', 'home', false,
    ['Home', 'سەرەکی', 'الرئيسية'],
    ['Today at Demo Teaching Hospital – Erbil', 'ئەمڕۆ لە نەخۆشخانەی فێرکاریی نموونەیی – هەولێر', 'اليوم في المستشفى التعليمي التجريبي – أربيل']],
  ['patients', 'PatientsScreen', 'users', false,
    ['Patients', 'نەخۆشەکان', 'المرضى'],
    ['Find, register and open patients', 'دۆزینەوە، تۆمارکردن و کردنەوەی نەخۆشەکان', 'البحث عن المرضى وتسجيلهم وفتح ملفاتهم']],
  ['outpatient', 'OutpatientScreen', 'stethoscope', false,
    ['Outpatient', 'نۆرینگەی دەرەکی', 'العيادات الخارجية'],
    ["Today's clinics, arrivals and waiting times", 'نۆرینگەکانی ئەمڕۆ، هاتنەکان و کاتی چاوەڕوانی', 'عيادات اليوم والوصول وأوقات الانتظار']],
  ['ward', 'WardScreen', 'bed', false,
    ['Ward & beds', 'قاوش و جێگاکان', 'الردهات والأسرّة'],
    ['Bed board of the four wards', 'تەختەی جێگاکانی چوار قاوشەکە', 'لوحة الأسرّة للردهات الأربع']],
  ['chart', 'ChartScreen', 'chart', true,
    ['Patient chart', 'دۆسیەی نەخۆش', 'ملف المريض'],
    ['Summary, problems, vital signs and notes', 'پوختە، کێشەکان، نیشانە ژیانییەکان و تێبینییەکان', 'الملخص والمشكلات والعلامات الحيوية والملاحظات']],
  ['orders', 'OrdersScreen', 'clipboard', true,
    ['Orders', 'داواکارییەکان', 'الطلبات'],
    ['Active and new orders, with safety checks', 'داواکارییە چالاک و نوێیەکان، لەگەڵ پشکنینی سەلامەتی', 'الطلبات النشطة والجديدة مع فحوص السلامة']],
  ['emar', 'EmarScreen', 'pill', true,
    ['Medication (eMAR)', 'دەرمان (eMAR)', 'الأدوية (eMAR)'],
    ["Today's medicines: due, given and held", 'دەرمانەکانی ئەمڕۆ: کاتی هاتووە، دراوە و ڕاگیراوە', 'أدوية اليوم: المستحقة والمعطاة والموقوفة']],
  ['lab', 'LabScreen', 'flask', true,
    ['Laboratory', 'تاقیگە', 'المختبر'],
    ['Specimens and results, with critical values', 'نموونەکان و ئەنجامەکان، لەگەڵ بەها مەترسیدارەکان', 'العينات والنتائج مع القيم الحرجة']],
  ['billing', 'BillingScreen', 'receipt', true,
    ['Billing', 'پسوولە و پارەدان', 'الفوترة'],
    ['Charges, payments and balance in IQD and USD', 'تێچوون، پارەدان و بڕی ماوە بە دینار و دۆلار', 'الرسوم والمدفوعات والرصيد بالدينار والدولار']],
  ['admin', 'AdminScreen', 'settings', false,
    ['Administration', 'بەڕێوەبردن', 'الإدارة'],
    ['Users, roles, settings and the audit log', 'بەکارهێنەران، ڕۆڵەکان، ڕێکخستنەکان و تۆماری چاودێری', 'المستخدمون والأدوار والإعدادات وسجل التدقيق']],
];
const PLACE = ['This screen is being built.', 'ئەم پەڕەیە لە دروستکردندایە.', 'هذه الشاشة قيد الإنشاء.'];
const PLACE_BODY = [
  'The prototype shell, data and helpers are ready; the screen builder fills this in.',
  'چوارچێوە، داتا و یارمەتیدەرەکانی نموونەکە ئامادەن؛ دروستکەری پەڕەکە ئەمە پڕ دەکاتەوە.',
  'إطار النموذج والبيانات والأدوات جاهزة؛ سيكمل منشئ الشاشة هذا الجزء.',
];
const q = (s) => JSON.stringify(s);
for (const [id, comp, icon, clinical, title, subtitle] of S) {
  const dir = path.join(root, id);
  mkdirSync(dir, { recursive: true });
  const block = (i) => `    title: ${q(title[i])},\n    subtitle: ${q(subtitle[i])},\n    placeholder: ${q(PLACE[i])},\n    placeholderBody: ${q(PLACE_BODY[i])},\n`;
  writeFileSync(path.join(dir, 'messages.ts'), `/** Texts of the ${id} screen (en, ckb, ar). AI-drafted ckb and ar, unreviewed. */
import { defineMessages } from '../../i18n/use-t.ts';

export const messages = defineMessages({
  en: {
${block(0)}  },
  ckb: {
${block(1)}  },
  ar: {
${block(2)}  },
});
`);
  writeFileSync(path.join(dir, `${id}.css`), `/* The ${id} screen. Prefix: ${id}-. Logical properties and design-system tokens only. */
.${id}-screen {
  display: flex;
  flex-direction: column;
  gap: var(--hms-space-5);
}
`);
  const clinicalImport = clinical ? `import { useClinicalPatient } from '../../shell/index.ts';\n` : '';
  const clinicalLine = clinical ? `  const { patient } = useClinicalPatient();\n` : '';
  const dataAttr = clinical ? ` data-patient-id={patient.id}` : '';
  writeFileSync(path.join(dir, 'index.tsx'), `/**
 * The ${id} screen${clinical ? ' (patient-scoped: rendered under the PatientBanner by the clinical layout)' : ''}. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
${clinicalImport}import { EmptyState, PageHeader } from '../../ui/index.ts';
import './${id}.css';
import { messages } from './messages.ts';

export function ${comp}(): ReactNode {
  const t = useT(messages);
${clinicalLine}  return (
    <div className="${id}-screen"${dataAttr}>
      <PageHeader icon="${icon}" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="${icon}" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
`);
}
console.log('ok');
