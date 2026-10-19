/**
 * Reports and statutory returns: the KRG Ministry of Health and Iraqi MOH returns with due dates and
 * submission status, the notifiable diseases register, birth and death registers, a DHIS2 aggregate export
 * preview and the report catalogue. Form numbers, data-element UIDs and figures are invented.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { daysAgoAt, demoDate } from '../clock.ts';
import type { Sex, Text3 } from '../types.ts';
import { T, patientAt, staffAt } from './mi-common.ts';

export type ReturnStatus = 'not-started' | 'draft' | 'ready' | 'submitted' | 'accepted' | 'overdue';
export type ReturnFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'event';

export interface StatutoryReturn {
  readonly id: string;
  /** The form number (invented). */
  readonly form: string;
  readonly name: Text3;
  readonly authority: Text3;
  readonly frequency: ReturnFrequency;
  readonly period: Text3;
  readonly due: string;
  readonly status: ReturnStatus;
  readonly submittedIso: string | null;
  readonly ownerId: string;
  readonly channel: 'dhis2' | 'portal' | 'email' | 'paper';
}

const KRG = T('KRG Ministry of Health', 'وەزارەتی تەندروستیی هەرێم', 'وزارة صحة الإقليم');
const DOH = T('Erbil Directorate of Health', 'بەڕێوەبەرایەتیی تەندروستیی هەولێر', 'مديرية صحة أربيل');
const FED = T('Federal MOH (Baghdad)', 'وەزارەتی تەندروستیی فیدراڵ (بەغدا)', 'وزارة الصحة الاتحادية (بغداد)');
const CDC = T('Communicable Disease Control, DoH', 'کۆنترۆڵی نەخۆشییە گوازراوەکان', 'السيطرة على الأمراض الانتقالية');
const CIVIL = T('Civil Status Directorate', 'بەڕێوەبەرایەتیی باری شارستانی', 'مديرية الأحوال المدنية');
const SEPT = T('September 2026', 'ئەیلوولی 2026', 'أيلول 2026');
const WEEK42 = T('Week 42 (11–17 Oct)', 'هەفتەی 42 (11–17 تشرینی یەکەم)', 'الأسبوع 42 (11–17 تشرين الأول)');
const Q3 = T('Q3 2026', 'چارەکی سێیەمی 2026', 'الربع الثالث 2026');
const TODAY = T('Yesterday', 'دوێنێ', 'أمس');

export const RETURNS: readonly StatutoryReturn[] = [
  { id: 'R01', form: 'KRG-MOH-HS-01', name: T('Monthly hospital statistics (beds, admissions, deaths)', 'ئاماری مانگانەی نەخۆشخانە (جێگا، خەواندن، مردن)', 'الإحصاء الشهري للمستشفى (أسرّة، إدخالات، وفيات)'), authority: KRG, frequency: 'monthly', period: SEPT, due: demoDate(9), status: 'submitted', submittedIso: daysAgoAt(11, '13:20'), ownerId: 'SYN-STF-004', channel: 'dhis2' },
  { id: 'R02', form: 'KRG-CDC-W', name: T('Weekly notifiable diseases return', 'ڕاپۆرتی هەفتانەی نەخۆشییە ئاگادارکراوەکان', 'التقرير الأسبوعي للأمراض المبلغ عنها'), authority: CDC, frequency: 'weekly', period: WEEK42, due: demoDate(-1), status: 'ready', submittedIso: null, ownerId: 'SYN-STF-011', channel: 'dhis2' },
  { id: 'R03', form: 'KRG-MOH-BN', name: T('Birth notifications', 'ئاگادارکردنەوەی لەدایکبوون', 'إشعارات الولادة'), authority: CIVIL, frequency: 'event', period: TODAY, due: demoDate(0), status: 'draft', submittedIso: null, ownerId: 'SYN-STF-018', channel: 'portal' },
  { id: 'R04', form: 'KRG-MOH-DN', name: T('Death notifications and certificates', 'ئاگادارکردنەوە و بڕوانامەی مردن', 'إشعارات وشهادات الوفاة'), authority: CIVIL, frequency: 'event', period: TODAY, due: demoDate(0), status: 'ready', submittedIso: null, ownerId: 'SYN-STF-001', channel: 'portal' },
  { id: 'R05', form: 'MOH-IQ-OPD-12', name: T('Outpatient attendances by specialty', 'سەردانی نۆرینگە بەپێی پسپۆڕی', 'مراجعات العيادات حسب الاختصاص'), authority: FED, frequency: 'monthly', period: SEPT, due: demoDate(4), status: 'overdue', submittedIso: null, ownerId: 'SYN-STF-018', channel: 'email' },
  { id: 'R06', form: 'KRG-MOH-ED-03', name: T('Emergency attendances and trauma', 'سەردانی فریاکەوتن و برینداری', 'مراجعات الطوارئ والإصابات'), authority: DOH, frequency: 'monthly', period: SEPT, due: demoDate(-3), status: 'draft', submittedIso: null, ownerId: 'SYN-STF-022', channel: 'dhis2' },
  { id: 'R07', form: 'KRG-MOH-MAT-02', name: T('Maternal and neonatal indicators', 'پێوەرەکانی دایک و ساوا', 'مؤشرات الأمهات وحديثي الولادة'), authority: KRG, frequency: 'monthly', period: SEPT, due: demoDate(-6), status: 'not-started', submittedIso: null, ownerId: 'SYN-STF-006', channel: 'dhis2' },
  { id: 'R08', form: 'KRG-PCI-HAI', name: T('Healthcare-associated infections surveillance', 'چاودێریی هەوکردنی پەیوەست بە چاودێریی تەندروستی', 'ترصد العدوى المرتبطة بالرعاية الصحية'), authority: CDC, frequency: 'monthly', period: SEPT, due: demoDate(-11), status: 'not-started', submittedIso: null, ownerId: 'SYN-STF-007', channel: 'email' },
  { id: 'R09', form: 'KRG-MOH-SURG-04', name: T('Surgical activity and theatre utilisation', 'چالاکیی نەشتەرگەری و بەکارهێنانی هۆڵ', 'النشاط الجراحي واستخدام العمليات'), authority: DOH, frequency: 'quarterly', period: Q3, due: demoDate(-12), status: 'draft', submittedIso: null, ownerId: 'SYN-STF-005', channel: 'portal' },
  { id: 'R10', form: 'KRG-PHARM-NAR', name: T('Narcotics and psychotropics register', 'تۆماری ماددە هۆشبەر و دەروونییەکان', 'سجل المخدرات والمؤثرات العقلية'), authority: DOH, frequency: 'monthly', period: SEPT, due: demoDate(14), status: 'accepted', submittedIso: daysAgoAt(15, '10:05'), ownerId: 'SYN-STF-012', channel: 'paper' },
  { id: 'R11', form: 'KRG-MOH-HR-07', name: T('Health workforce return', 'ڕاپۆرتی هێزی کاری تەندروستی', 'تقرير القوى العاملة الصحية'), authority: KRG, frequency: 'quarterly', period: Q3, due: demoDate(-26), status: 'not-started', submittedIso: null, ownerId: 'SYN-STF-004', channel: 'portal' },
  { id: 'R12', form: 'KRG-EPI-VAC', name: T('Newborn vaccinations given (BCG, HepB, OPV)', 'کوتانی ساوایان (BCG، HepB، OPV)', 'لقاحات حديثي الولادة (BCG، HepB، OPV)'), authority: CDC, frequency: 'monthly', period: SEPT, due: demoDate(6), status: 'submitted', submittedIso: daysAgoAt(7, '12:40'), ownerId: 'SYN-STF-014', channel: 'dhis2' },
  { id: 'R13', form: 'KRG-MOH-LAB-05', name: T('Laboratory workload and external QA', 'بارى کاری تاقیگە و QA ی دەرەکی', 'عبء العمل المخبري وضبط الجودة الخارجي'), authority: DOH, frequency: 'quarterly', period: Q3, due: demoDate(-8), status: 'ready', submittedIso: null, ownerId: 'SYN-STF-011', channel: 'email' },
];

// ---------------------------------------------------------------------------------------------------------
// Notifiable diseases register
// ---------------------------------------------------------------------------------------------------------

export type NotifiableClass = 'immediate' | 'weekly';
export type NotifiableStatus = 'suspected' | 'confirmed' | 'discarded';

export interface NotifiableCase {
  readonly id: string;
  /** Disease name in Latin script (as on the CDC form). */
  readonly disease: string;
  readonly icd10: string;
  readonly patientId: string;
  readonly onset: string;
  readonly diagnosedIso: string;
  readonly cls: NotifiableClass;
  readonly status: NotifiableStatus;
  readonly notifiedIso: string | null;
  readonly reporterId: string;
}

const NOTIF: readonly [string, string, NotifiableClass, NotifiableStatus, number, string, boolean][] = [
  ['Measles', 'B05.9', 'immediate', 'suspected', 0, '08:15', false],
  ['Brucellosis', 'A23.9', 'weekly', 'confirmed', 1, '14:30', true],
  ['Typhoid fever', 'A01.0', 'weekly', 'confirmed', 2, '11:00', true],
  ['Cholera (suspected)', 'A00.9', 'immediate', 'discarded', 3, '19:40', true],
  ['Viral hepatitis A', 'B15.9', 'weekly', 'confirmed', 3, '10:20', true],
  ['Leishmaniasis, cutaneous', 'B55.1', 'weekly', 'confirmed', 4, '09:10', true],
  ['Tuberculosis, pulmonary', 'A15.0', 'weekly', 'confirmed', 5, '12:45', true],
  ['Crimean-Congo haemorrhagic fever', 'A98.0', 'immediate', 'suspected', 0, '06:50', false],
  ['Mumps', 'B26.9', 'weekly', 'confirmed', 6, '15:15', true],
  ['Acute flaccid paralysis', 'G83.9', 'immediate', 'suspected', 7, '16:05', true],
  ['Varicella', 'B01.9', 'weekly', 'confirmed', 8, '08:40', true],
  ['Viral hepatitis B', 'B16.9', 'weekly', 'confirmed', 9, '13:30', true],
  ['Meningococcal meningitis', 'A39.0', 'immediate', 'confirmed', 10, '22:10', true],
  ['Scabies (cluster)', 'B86', 'weekly', 'confirmed', 12, '10:00', true],
];

export const NOTIFIABLE: readonly NotifiableCase[] = NOTIF.map(([disease, icd10, cls, status, days, time, notified], index) => ({
  id: `SYN-NTF-${String(4410 + index)}`,
  disease,
  icd10,
  patientId: patientAt(index * 3 + 2).id,
  onset: demoDate(days + 2),
  diagnosedIso: daysAgoAt(days, time),
  cls,
  status,
  notifiedIso: notified ? daysAgoAt(days, time.replace(/^(\d\d)/u, (h) => String(Math.min(23, Number(h) + 1)).padStart(2, '0'))) : null,
  reporterId: staffAt(index % 2 === 0 ? 0 : 5).id,
}));

// ---------------------------------------------------------------------------------------------------------
// Birth and death registers
// ---------------------------------------------------------------------------------------------------------

export interface Birth {
  readonly id: string;
  readonly motherId: string;
  readonly bornIso: string;
  readonly sex: Sex;
  readonly weightG: number;
  readonly mode: 'vaginal' | 'caesarean' | 'assisted';
  readonly apgar5: number;
  readonly attendantId: string;
  readonly notified: boolean;
}

const BIRTH_SEEDS: readonly [number, string, Sex, number, Birth['mode'], number, boolean][] = [
  [0, '03:40', 'female', 3250, 'vaginal', 9, false],
  [0, '07:55', 'male', 3610, 'caesarean', 9, false],
  [1, '14:20', 'male', 2890, 'vaginal', 8, true],
  [1, '22:05', 'female', 3120, 'vaginal', 9, true],
  [2, '10:30', 'female', 2450, 'caesarean', 7, true],
  [3, '01:15', 'male', 3980, 'assisted', 8, true],
  [4, '16:45', 'male', 3330, 'vaginal', 9, true],
  [5, '09:00', 'female', 3075, 'caesarean', 9, true],
  [6, '18:30', 'female', 3410, 'vaginal', 10, true],
  [8, '12:10', 'male', 2950, 'vaginal', 9, true],
];

export const BIRTHS: readonly Birth[] = BIRTH_SEEDS.map(([days, time, sex, weightG, mode, apgar5, notified], index) => ({
  id: `SYN-BRT-${String(26_0911 + index)}`,
  motherId: patientAt(index * 5 + 4).id,
  bornIso: daysAgoAt(days, time),
  sex,
  weightG,
  mode,
  apgar5,
  attendantId: staffAt(index % 2 === 0 ? 5 : 13).id,
  notified,
}));

export interface Death {
  readonly id: string;
  readonly patientId: string;
  readonly diedIso: string;
  readonly cause: Text3;
  readonly icd10: string;
  readonly certifiedById: string;
  readonly coroner: boolean;
  readonly notified: boolean;
}

export const DEATHS: readonly Death[] = [
  { id: 'SYN-DTH-2601', patientId: patientAt(31).id, diedIso: daysAgoAt(0, '04:20'), cause: T('Septic shock, community-acquired pneumonia', 'شۆکی سێپتیک، سییەپەتای کۆمەڵگە', 'صدمة إنتانية، ذات رئة مكتسبة'), icd10: 'A41.9', certifiedById: 'SYN-STF-007', coroner: false, notified: false },
  { id: 'SYN-DTH-2602', patientId: patientAt(28).id, diedIso: daysAgoAt(2, '17:45'), cause: T('Acute myocardial infarction', 'جەڵتەی دڵ', 'احتشاء عضلة القلب الحاد'), icd10: 'I21.9', certifiedById: 'SYN-STF-017', coroner: false, notified: true },
  { id: 'SYN-DTH-2603', patientId: patientAt(25).id, diedIso: daysAgoAt(5, '23:10'), cause: T('Multiple injuries, road traffic collision', 'برینی زۆر، ڕووداوی هاتووچۆ', 'إصابات متعددة، حادث سير'), icd10: 'V89.2', certifiedById: 'SYN-STF-022', coroner: true, notified: true },
  { id: 'SYN-DTH-2604', patientId: patientAt(34).id, diedIso: daysAgoAt(9, '08:30'), cause: T('End-stage renal disease', 'قۆناغی کۆتایی نەخۆشیی گورچیلە', 'المرحلة النهائية لمرض الكلى'), icd10: 'N18.6', certifiedById: 'SYN-STF-001', coroner: false, notified: true },
  { id: 'SYN-DTH-2605', patientId: patientAt(37).id, diedIso: daysAgoAt(13, '12:55'), cause: T('Intracerebral haemorrhage', 'خوێنبەربوونی ناو مێشک', 'نزف داخل المخ'), icd10: 'I61.9', certifiedById: 'SYN-STF-007', coroner: false, notified: true },
];

// ---------------------------------------------------------------------------------------------------------
// DHIS2 aggregate export (dataset of the monthly hospital return)
// ---------------------------------------------------------------------------------------------------------

export interface Dhis2Value {
  /** Data element UID (invented, 11 characters as DHIS2 uses). */
  readonly dataElement: string;
  readonly name: Text3;
  readonly categoryOptionCombo: string;
  readonly disaggregation: Text3;
  readonly value: number;
  /** Last month's value, for the validation rule (change above 50% is flagged). */
  readonly previous: number;
}

const ALL = T('Total', 'کۆ', 'المجموع');
const MALE = T('Male', 'نێر', 'ذكر');
const FEMALE = T('Female', 'مێ', 'أنثى');

export const DHIS2_ORG_UNIT = 'SYNorgErb01';
export const DHIS2_DATASET = 'SYNdsHosp01';
export const DHIS2_PERIOD = '202609';

export const DHIS2_VALUES: readonly Dhis2Value[] = [
  { dataElement: 'SYNdeAdm001', name: T('Inpatient admissions', 'خەواندنی نەخۆش', 'إدخالات المرضى'), categoryOptionCombo: 'SYNcocMale1', disaggregation: MALE, value: 318, previous: 301 },
  { dataElement: 'SYNdeAdm001', name: T('Inpatient admissions', 'خەواندنی نەخۆش', 'إدخالات المرضى'), categoryOptionCombo: 'SYNcocFem01', disaggregation: FEMALE, value: 342, previous: 329 },
  { dataElement: 'SYNdeBdy002', name: T('Inpatient bed-days', 'ڕۆژ-جێگای خەوێنراو', 'أيام الأسرّة'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 1423, previous: 1388 },
  { dataElement: 'SYNdeDth003', name: T('Inpatient deaths', 'مردنی خەوێنراو', 'وفيات المنومين'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 14, previous: 9 },
  { dataElement: 'SYNdeOpd004', name: T('Outpatient visits', 'سەردانی نۆرینگە', 'زيارات العيادات الخارجية'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 3962, previous: 3841 },
  { dataElement: 'SYNdeEmg005', name: T('Emergency attendances', 'سەردانی فریاکەوتن', 'مراجعات الطوارئ'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 3107, previous: 2954 },
  { dataElement: 'SYNdeSrg006', name: T('Major operations', 'نەشتەرگەریی گەورە', 'العمليات الكبرى'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 214, previous: 206 },
  { dataElement: 'SYNdeBir007', name: T('Live births', 'لەدایکبوونی زیندوو', 'الولادات الحية'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 96, previous: 101 },
  { dataElement: 'SYNdeCsr008', name: T('Caesarean sections', 'نەشتەرگەریی قەیسەری', 'العمليات القيصرية'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 41, previous: 39 },
  { dataElement: 'SYNdeHai009', name: T('Healthcare-associated infections', 'هەوکردنی پەیوەست بە چاودێری', 'العدوى المرتبطة بالرعاية'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 9, previous: 5 },
  { dataElement: 'SYNdeLab010', name: T('Laboratory tests performed', 'تاقیکردنەوەی ئەنجامدراو', 'الفحوص المخبرية المنجزة'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 28_470, previous: 27_115 },
  { dataElement: 'SYNdeRad011', name: T('Imaging examinations', 'پشکنینی وێنەگرتن', 'فحوص التصوير'), categoryOptionCombo: 'SYNcocTot01', disaggregation: ALL, value: 2_316, previous: 2_281 },
];

// ---------------------------------------------------------------------------------------------------------
// Report catalogue
// ---------------------------------------------------------------------------------------------------------

export type ReportArea = 'clinical' | 'finance' | 'operations' | 'quality' | 'statutory';

export interface CatalogueReport {
  readonly id: string;
  readonly name: Text3;
  readonly area: ReportArea;
  readonly schedule: Text3;
  readonly lastRunIso: string;
  readonly format: 'PDF' | 'XLSX' | 'CSV';
  readonly favourite: boolean;
}

const DAILY_0700 = T('Daily at 07:00', 'ڕۆژانە کاتژمێر 07:00', 'يومياً الساعة 07:00');
const WEEKLY_SAT = T('Weekly, Saturday', 'هەفتانە، شەممە', 'أسبوعياً، السبت');
const MONTHLY_1 = T('Monthly, 1st', 'مانگانە، یەکەمی مانگ', 'شهرياً، اليوم الأول');
const ON_DEMAND = T('On demand', 'بە داواکاری', 'عند الطلب');

export const CATALOGUE: readonly CatalogueReport[] = [
  { id: 'C01', name: T('Daily census and bed state', 'سەرژمێری ڕۆژانە و دۆخی جێگاکان', 'التعداد اليومي وحالة الأسرّة'), area: 'operations', schedule: DAILY_0700, lastRunIso: daysAgoAt(0, '07:00'), format: 'PDF', favourite: true },
  { id: 'C02', name: T('Cash and card receipts by cashier', 'وەرگیراوی نەختینە و کارت بەپێی خەزنەدار', 'المقبوضات النقدية والبطاقات حسب أمين الصندوق'), area: 'finance', schedule: DAILY_0700, lastRunIso: daysAgoAt(0, '07:00'), format: 'XLSX', favourite: true },
  { id: 'C03', name: T('Unbilled consumption by ward', 'بەکاربردنی بێ پسوولە بەپێی قاوش', 'الاستهلاك غير المفوتر حسب الردهة'), area: 'finance', schedule: DAILY_0700, lastRunIso: daysAgoAt(0, '07:00'), format: 'XLSX', favourite: false },
  { id: 'C04', name: T('Payer ageing and statements', 'تەمەنی قەرزی لایەنەکان و کەشف', 'أعمار ذمم الجهات وكشوفها'), area: 'finance', schedule: WEEKLY_SAT, lastRunIso: daysAgoAt(2, '06:00'), format: 'PDF', favourite: false },
  { id: 'C05', name: T('Length of stay by consultant', 'ماوەی مانەوە بەپێی ڕاوێژکار', 'مدة الإقامة حسب الاستشاري'), area: 'clinical', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'PDF', favourite: false },
  { id: 'C06', name: T('Critical results and acknowledgement times', 'ئەنجامی مەترسیدار و کاتی پشتڕاستکردنەوە', 'النتائج الحرجة وأزمنة الإقرار'), area: 'quality', schedule: WEEKLY_SAT, lastRunIso: daysAgoAt(2, '06:00'), format: 'PDF', favourite: true },
  { id: 'C07', name: T('Antibiotic use (DDD per 100 bed-days)', 'بەکارهێنانی دژەبەکتریا (DDD بۆ 100 ڕۆژ-جێگا)', 'استخدام المضادات الحيوية (DDD لكل 100 يوم سرير)'), area: 'clinical', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'XLSX', favourite: false },
  { id: 'C08', name: T('Theatre utilisation and late starts', 'بەکارهێنانی هۆڵ و دەستپێکی دواکەوتوو', 'استخدام العمليات والبدايات المتأخرة'), area: 'operations', schedule: WEEKLY_SAT, lastRunIso: daysAgoAt(2, '06:00'), format: 'PDF', favourite: false },
  { id: 'C09', name: T('Outpatient no-shows by clinic', 'نەهاتنی نەخۆش بەپێی نۆرینگە', 'عدم الحضور حسب العيادة'), area: 'operations', schedule: WEEKLY_SAT, lastRunIso: daysAgoAt(2, '06:00'), format: 'CSV', favourite: false },
  { id: 'C10', name: T('Incidents by category and harm', 'ڕووداو بەپێی پۆل و زیان', 'الحوادث حسب الفئة والضرر'), area: 'quality', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'PDF', favourite: false },
  { id: 'C11', name: T('Revenue by department and payer', 'داهات بەپێی بەش و لایەن', 'الإيرادات حسب القسم والجهة'), area: 'finance', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'XLSX', favourite: true },
  { id: 'C12', name: T('Audit log: emergency access', 'تۆماری وردبینی: دەستگەیشتنی فریاکەوتن', 'سجل التدقيق: الوصول الطارئ'), area: 'quality', schedule: ON_DEMAND, lastRunIso: daysAgoAt(4, '11:20'), format: 'CSV', favourite: false },
  { id: 'C13', name: T('Monthly hospital statistics (KRG-MOH-HS-01)', 'ئاماری مانگانەی نەخۆشخانە (KRG-MOH-HS-01)', 'الإحصاء الشهري للمستشفى (KRG-MOH-HS-01)'), area: 'statutory', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'PDF', favourite: false },
  { id: 'C14', name: T('Medication errors and near misses', 'هەڵە و نزیکەی هەڵەی دەرمان', 'أخطاء الأدوية والحوادث الوشيكة'), area: 'quality', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'PDF', favourite: false },
  { id: 'C15', name: T('Readmissions within 30 days', 'گەڕانەوە لە ماوەی 30 ڕۆژ', 'إعادة الإدخال خلال 30 يوماً'), area: 'clinical', schedule: MONTHLY_1, lastRunIso: daysAgoAt(18, '06:00'), format: 'XLSX', favourite: false },
  { id: 'C16', name: T('Deposits and refunds', 'بارمتە و گەڕاندنەوەی پارە', 'التأمينات والمبالغ المستردة'), area: 'finance', schedule: ON_DEMAND, lastRunIso: daysAgoAt(1, '15:40'), format: 'XLSX', favourite: false },
];
