/**
 * Figures for the owner and managing-director dashboard: 90 days of daily revenue, collections and
 * activity (deterministic synthetic series ending on the demo day; Fridays are quiet), unbilled
 * consumption (charge leakage), deposits outstanding, revenue by department and safety KPIs.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Money in whole Iraqi dinars unless the field says USD.
 */
import { CENSUS_GROUPS, CURATED_PATIENTS, DEMO_NOW, demoDate } from '../index.ts';
import type { DepartmentId, Text3, WardId } from '../types.ts';
import { T, seeded } from './mi-common.ts';

export interface DayFigures {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** 0 Sunday … 5 Friday, 6 Saturday. */
  readonly weekday: number;
  readonly billedIqd: number;
  readonly collectedIqd: number;
  /** Receipts taken in dinars. */
  readonly cashIqd: number;
  /** Receipts taken in US dollars. */
  readonly cashUsd: number;
  readonly edVisits: number;
  readonly opdVisits: number;
  readonly admissions: number;
  readonly surgeries: number;
}

const DAYS_BACK = 90;

function buildDays(): readonly DayFigures[] {
  const rnd = seeded(20261019);
  const days: DayFigures[] = [];
  for (let back = DAYS_BACK - 1; back >= 0; back -= 1) {
    const date = demoDate(back);
    const weekday = new Date(`${date}T12:00:00+03:00`).getUTCDay();
    const friday = weekday === 5;
    const saturday = weekday === 6;
    const load = friday ? 0.28 : saturday ? 0.62 : 1;
    // A slow upward trend over the quarter, plus noise.
    const growth = 1 + (DAYS_BACK - back) * 0.0018;
    const today = back === 0 ? 0.32 : 1; // the demo day is at 09:30
    const billed = Math.round((52_000_000 + rnd() * 14_000_000) * load * growth * today);
    const collectedShare = 0.78 + rnd() * 0.16;
    const collected = Math.round(billed * collectedShare);
    const usdShare = 0.18 + rnd() * 0.08;
    const cashUsd = Math.round(((collected * usdShare) / 1310) * 100) / 100;
    days.push({
      date,
      weekday,
      billedIqd: billed,
      collectedIqd: collected,
      cashIqd: Math.round(collected * (1 - usdShare)),
      cashUsd,
      edVisits: Math.round((92 + rnd() * 30) * (friday ? 1.2 : 1) * today),
      opdVisits: Math.round((150 + rnd() * 25) * load * today),
      admissions: Math.round((18 + rnd() * 8) * (friday ? 0.6 : 1) * today),
      surgeries: Math.round((9 + rnd() * 6) * load * today),
    });
  }
  return days;
}

export const DAILY: readonly DayFigures[] = buildDays();

// ---------------------------------------------------------------------------------------------------------
// Unbilled consumption (leakage): items used on the ward or in theatre with no charge posted yet.
// ---------------------------------------------------------------------------------------------------------

export type LeakCategory = 'pharmacy' | 'supplies' | 'laboratory' | 'imaging' | 'procedure';

export interface UnbilledItem {
  readonly id: string;
  readonly patientId: string;
  readonly wardId: WardId;
  readonly category: LeakCategory;
  readonly item: Text3;
  /** Latin-script item code or drug name. */
  readonly code: string;
  readonly quantity: number;
  readonly amountIqd: number;
  readonly consumedIso: string;
  readonly source: Text3;
}

const WARD_STOCK = T('Ward stock issue', 'دەرکردن لە کۆگای قاوش', 'صرف من مخزون الردهة');
const THEATRE = T('Theatre consumables log', 'تۆماری کەرەستەی هۆڵی نەشتەرگەری', 'سجل مستهلكات العمليات');
const LAB_LIS = T('Lab result without an order charge', 'ئەنجامی تاقیگە بەبێ نرخی داواکاری', 'نتيجة مختبر دون رسم طلب');
const PACS = T('Imaging study without a charge', 'وێنەگرتن بەبێ نرخ', 'دراسة تصوير دون رسم');
const NURSING = T('Nursing procedure note', 'تێبینیی کرداری پەرستاری', 'ملاحظة إجراء تمريضي');

const inpatients = [...CURATED_PATIENTS.slice(0, 8).map((p) => p.id), ...CENSUS_GROUPS['med-a'], ...CENSUS_GROUPS['surg-b'], ...CENSUS_GROUPS.icu];
const pid = (i: number): string => inpatients[i % inpatients.length] ?? 'SYN-PAT-0101';

interface LeakSeed {
  readonly ward: WardId;
  readonly category: LeakCategory;
  readonly item: Text3;
  readonly code: string;
  readonly qty: number;
  readonly unit: number;
  readonly hoursAgo: number;
  readonly source: Text3;
}

const LEAK_SEEDS: readonly LeakSeed[] = [
  { ward: 'icu', category: 'pharmacy', item: T('Meropenem 1 g vial', 'Meropenem 1 g ڤایەڵ', 'Meropenem 1 g قارورة'), code: 'Meropenem 1 g', qty: 6, unit: 38_000, hoursAgo: 30, source: WARD_STOCK },
  { ward: 'surg-b', category: 'supplies', item: T('Laparoscopic trocar set', 'سێتی ترۆکاری لابرۆسکۆپی', 'طقم مبازل المنظار'), code: 'SUP-TRC-12', qty: 1, unit: 420_000, hoursAgo: 20, source: THEATRE },
  { ward: 'med-a', category: 'laboratory', item: T('Blood culture, 2 sets', 'چاندنی خوێن، 2 سێت', 'زرع دم، مجموعتان'), code: 'LAB-BCX', qty: 2, unit: 45_000, hoursAgo: 14, source: LAB_LIS },
  { ward: 'icu', category: 'supplies', item: T('Central venous catheter kit', 'کیتی کاتێتەری دەماری ناوەندی', 'طقم قسطرة وريدية مركزية'), code: 'SUP-CVC-3L', qty: 1, unit: 185_000, hoursAgo: 52, source: WARD_STOCK },
  { ward: 'med-a', category: 'pharmacy', item: T('Enoxaparin 40 mg syringe', 'Enoxaparin 40 mg سرنج', 'Enoxaparin 40 mg محقنة'), code: 'Enoxaparin 40 mg', qty: 5, unit: 9_500, hoursAgo: 40, source: WARD_STOCK },
  { ward: 'surg-b', category: 'imaging', item: T('Chest X-ray, portable', 'تیشکی سنگ، گوازراوە', 'أشعة صدر محمولة'), code: 'RAD-CXR-P', qty: 1, unit: 35_000, hoursAgo: 9, source: PACS },
  { ward: 'paeds', category: 'procedure', item: T('Peripheral IV cannulation', 'دانانی کانیولای دەمار', 'تركيب كانيولا وريدية'), code: 'NUR-IVC', qty: 2, unit: 12_000, hoursAgo: 6, source: NURSING },
  { ward: 'icu', category: 'pharmacy', item: T('Noradrenaline 4 mg ampoule', 'Noradrenaline 4 mg ئەمپوول', 'Noradrenaline 4 mg أمبولة'), code: 'Norepinephrine 4 mg', qty: 8, unit: 14_000, hoursAgo: 18, source: WARD_STOCK },
  { ward: 'surg-b', category: 'supplies', item: T('Negative-pressure wound dressing', 'پێچانی برینی پەستانی نەرێنی', 'ضماد جروح بالضغط السلبي'), code: 'SUP-NPWT', qty: 1, unit: 260_000, hoursAgo: 75, source: WARD_STOCK },
  { ward: 'med-a', category: 'laboratory', item: T('Arterial blood gas', 'گازی خوێنی خوێنبەر', 'غازات الدم الشرياني'), code: 'LAB-ABG', qty: 3, unit: 22_000, hoursAgo: 11, source: LAB_LIS },
  { ward: 'icu', category: 'imaging', item: T('CT head, non-contrast', 'CT ی سەر، بێ ڕەنگ', 'مقطعي للرأس دون مادة ظليلة'), code: 'RAD-CTH', qty: 1, unit: 140_000, hoursAgo: 28, source: PACS },
  { ward: 'paeds', category: 'pharmacy', item: T('Salbutamol nebules 2.5 mg', 'Salbutamol 2.5 mg نێبیول', 'Salbutamol 2.5 mg أمبولات إرذاذ'), code: 'Salbutamol 2.5 mg', qty: 12, unit: 2_500, hoursAgo: 8, source: WARD_STOCK },
  { ward: 'surg-b', category: 'procedure', item: T('Urinary catheterisation', 'دانانی کاتێتەری میز', 'تركيب قسطرة بولية'), code: 'NUR-UCATH', qty: 1, unit: 18_000, hoursAgo: 33, source: NURSING },
  { ward: 'med-a', category: 'supplies', item: T('Infusion pump set', 'سێتی پەمپی ڤیتامین', 'طقم مضخة التسريب'), code: 'SUP-INF-SET', qty: 4, unit: 16_000, hoursAgo: 22, source: WARD_STOCK },
  { ward: 'icu', category: 'procedure', item: T('Arterial line insertion', 'دانانی هێڵی خوێنبەر', 'تركيب خط شرياني'), code: 'PRC-ART', qty: 1, unit: 95_000, hoursAgo: 46, source: NURSING },
  { ward: 'surg-b', category: 'pharmacy', item: T('Ceftriaxone 1 g vial', 'Ceftriaxone 1 g ڤایەڵ', 'Ceftriaxone 1 g قارورة'), code: 'Ceftriaxone 1 g', qty: 4, unit: 6_500, hoursAgo: 15, source: WARD_STOCK },
  { ward: 'med-a', category: 'imaging', item: T('Abdominal ultrasound', 'سۆنەری سک', 'سونار البطن'), code: 'RAD-USA', qty: 1, unit: 40_000, hoursAgo: 26, source: PACS },
];

export const UNBILLED: readonly UnbilledItem[] = LEAK_SEEDS.map((seed, index) => ({
  id: `SYN-LEAK-${String(index + 1).padStart(3, '0')}`,
  patientId: pid(index * 3),
  wardId: seed.ward,
  category: seed.category,
  item: seed.item,
  code: seed.code,
  quantity: seed.qty,
  amountIqd: seed.qty * seed.unit,
  consumedIso: new Date(DEMO_NOW.getTime() - seed.hoursAgo * 3_600_000).toISOString(),
  source: seed.source,
}));

// ---------------------------------------------------------------------------------------------------------
// Deposits outstanding (inpatients whose admission deposit is not yet covered)
// ---------------------------------------------------------------------------------------------------------

export interface DepositDue {
  readonly id: string;
  readonly patientId: string;
  readonly wardId: WardId;
  readonly requiredIqd: number;
  readonly paidIqd: number;
  readonly admittedOn: string;
}

const DEPOSIT_SEEDS: readonly [WardId, number, number, number][] = [
  ['icu', 3_000_000, 1_000_000, 2],
  ['surg-b', 1_500_000, 500_000, 1],
  ['med-a', 1_000_000, 0, 0],
  ['surg-b', 2_000_000, 1_500_000, 3],
  ['icu', 3_000_000, 2_000_000, 4],
  ['paeds', 750_000, 250_000, 1],
  ['med-a', 1_000_000, 600_000, 2],
  ['surg-b', 1_500_000, 0, 0],
  ['med-a', 1_000_000, 250_000, 5],
  ['icu', 3_000_000, 0, 1],
  ['paeds', 750_000, 500_000, 2],
  ['med-a', 1_000_000, 500_000, 6],
];

export const DEPOSITS: readonly DepositDue[] = DEPOSIT_SEEDS.map(([ward, required, paid, daysAgo], index) => ({
  id: `SYN-DEP-${String(index + 1).padStart(3, '0')}`,
  patientId: pid(index * 5 + 1),
  wardId: ward,
  requiredIqd: required,
  paidIqd: paid,
  admittedOn: demoDate(daysAgo),
}));

// ---------------------------------------------------------------------------------------------------------
// Revenue by department (share of billed) and safety KPIs
// ---------------------------------------------------------------------------------------------------------

export const DEPARTMENT_SHARE: readonly { readonly id: DepartmentId; readonly share: number }[] = [
  { id: 'general-surgery', share: 0.24 },
  { id: 'intensive-care', share: 0.17 },
  { id: 'internal-medicine', share: 0.15 },
  { id: 'cardiology', share: 0.12 },
  { id: 'emergency', share: 0.1 },
  { id: 'laboratory', share: 0.08 },
  { id: 'radiology', share: 0.07 },
  { id: 'paediatrics', share: 0.05 },
  { id: 'pharmacy', share: 0.02 },
];

export interface SafetyKpi {
  readonly id: string;
  readonly label: Text3;
  /** What the number counts. */
  readonly unit: Text3;
  readonly value: number;
  readonly target: number;
  readonly better: 'lower' | 'higher';
  /** Eight weeks, oldest first. */
  readonly weeks: readonly number[];
  readonly decimals: number;
}

export const SAFETY_KPIS: readonly SafetyKpi[] = [
  { id: 'falls', label: T('Inpatient falls', 'کەوتنی نەخۆشی خەوێنراو', 'سقوط المرضى المنومين'), unit: T('per 1,000 bed-days', 'بۆ هەر 1,000 ڕۆژ-جێگا', 'لكل 1,000 يوم سرير'), value: 1.8, target: 2.0, better: 'lower', weeks: [2.6, 2.4, 2.1, 2.3, 1.9, 2.0, 1.7, 1.8], decimals: 1 },
  { id: 'clabsi', label: T('CLABSI', 'CLABSI', 'CLABSI'), unit: T('per 1,000 line-days', 'بۆ هەر 1,000 ڕۆژی هێڵ', 'لكل 1,000 يوم قسطرة'), value: 2.9, target: 2.0, better: 'lower', weeks: [1.8, 2.1, 2.0, 2.4, 2.6, 2.8, 3.1, 2.9], decimals: 1 },
  { id: 'hand', label: T('Hand hygiene compliance', 'پابەندبوون بە پاکیی دەست', 'الالتزام بنظافة اليدين'), unit: T('% of observations', '% ی چاودێرییەکان', '% من الملاحظات'), value: 86, target: 90, better: 'higher', weeks: [81, 82, 84, 83, 85, 87, 86, 86], decimals: 0 },
  { id: 'med', label: T('Medication errors reported', 'هەڵەی دەرمان کە ڕاپۆرت کراون', 'أخطاء الأدوية المبلغ عنها'), unit: T('this week', 'ئەم هەفتەیە', 'هذا الأسبوع'), value: 7, target: 5, better: 'lower', weeks: [4, 6, 5, 3, 6, 8, 5, 7], decimals: 0 },
  { id: 'pu', label: T('Hospital-acquired pressure injuries', 'برینی پەستان لە نەخۆشخانە', 'قرح الضغط المكتسبة'), unit: T('stage 2+, this month', 'پلەی 2+، ئەم مانگە', 'الدرجة 2+، هذا الشهر'), value: 3, target: 4, better: 'lower', weeks: [5, 4, 4, 3, 4, 3, 2, 3], decimals: 0 },
  { id: 'readmit', label: T('30-day readmissions', 'گەڕانەوەی 30 ڕۆژە', 'إعادة الإدخال خلال 30 يوماً'), unit: T('% of discharges', '% ی دەرچووان', '% من حالات الخروج'), value: 6.4, target: 8, better: 'lower', weeks: [7.9, 7.4, 7.1, 6.9, 7.2, 6.6, 6.5, 6.4], decimals: 1 },
  { id: 'door', label: T('ED door-to-doctor ≤ 30 min', 'فریاکەوتن: لە دەرگاوە بۆ پزیشک ≤ 30 خولەک', 'الطوارئ: من الباب إلى الطبيب ≤ 30 دقيقة'), unit: T('% of attendances', '% ی سەردانەکان', '% من المراجعات'), value: 78, target: 85, better: 'higher', weeks: [71, 73, 76, 74, 77, 79, 80, 78], decimals: 0 },
  { id: 'sepsis', label: T('Sepsis antibiotics within 1 h', 'دژەبەکتریای سێپسیس لە ماوەی 1 کاتژمێر', 'مضادات الإنتان خلال ساعة'), unit: T('% of cases', '% ی حاڵەتەکان', '% من الحالات'), value: 91, target: 90, better: 'higher', weeks: [84, 86, 88, 87, 90, 89, 92, 91], decimals: 0 },
];
