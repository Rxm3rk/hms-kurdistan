/**
 * Insurance, corporate and NGO payers of the demo hospital: contracts and credit limits, pre-approval
 * requests, claims with their document packs and deductions, and receivables by ageing bucket. Every payer,
 * contract and amount is invented. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Money in whole Iraqi dinars.
 */
import { daysAgoAt, demoDate } from '../clock.ts';
import type { Currency, Governorate, Text3 } from '../types.ts';
import { T, patientAt } from './mi-common.ts';

export type PayerKind = 'insurer' | 'corporate' | 'ngo';

export interface Ageing {
  readonly d0to30: number;
  readonly d31to60: number;
  readonly d61to90: number;
  readonly d90plus: number;
}

export interface PayerAccount {
  readonly id: string;
  readonly name: Text3;
  readonly kind: PayerKind;
  readonly governorate: Governorate;
  readonly currency: Currency;
  readonly contractRef: string;
  readonly contractEnds: string;
  /** Default share of an approved line the payer covers, 0 to 100. */
  readonly coveragePct: number;
  readonly creditLimitIqd: number;
  readonly usedIqd: number;
  readonly contact: string;
  readonly phone: string;
  readonly paymentTermsDays: number;
  readonly ageing: Ageing;
}

export const PAYER_ACCOUNTS: readonly PayerAccount[] = [
  {
    id: 'SYN-PYR-01',
    name: T('Halgurd Health Insurance (synthetic)', 'بیمەی تەندروستیی هەڵگورد (نموونە)', 'تأمين هلكورد الصحي (تجريبي)'),
    kind: 'insurer', governorate: 'erbil', currency: 'IQD', contractRef: 'SYN-CTR-2026-014', contractEnds: '2027-03-31',
    coveragePct: 80, creditLimitIqd: 250_000_000, usedIqd: 187_450_000, contact: 'Rozhgar Salih', phone: '+964 750 000 7101', paymentTermsDays: 45,
    ageing: { d0to30: 64_200_000, d31to60: 41_850_000, d61to90: 18_300_000, d90plus: 6_950_000 },
  },
  {
    id: 'SYN-PYR-02',
    name: T('Dijla Takaful Insurance (synthetic)', 'بیمەی تەکافولی دیجلە (نموونە)', 'دجلة للتكافل والتأمين (تجريبي)'),
    kind: 'insurer', governorate: 'erbil', currency: 'USD', contractRef: 'SYN-CTR-2025-031', contractEnds: '2026-12-31',
    coveragePct: 90, creditLimitIqd: 180_000_000, usedIqd: 96_320_000, contact: 'Layla Hamid', phone: '+964 750 000 7102', paymentTermsDays: 30,
    ageing: { d0to30: 38_400_000, d31to60: 22_100_000, d61to90: 4_200_000, d90plus: 0 },
  },
  {
    id: 'SYN-PYR-03',
    name: T('Zagros Petroleum Services – staff scheme (synthetic)', 'خزمەتگوزارییەکانی نەوتی زاگرۆس – بەرنامەی کارمەندان (نموونە)', 'زاكروس للخدمات النفطية – برنامج الموظفين (تجريبي)'),
    kind: 'corporate', governorate: 'erbil', currency: 'USD', contractRef: 'SYN-CTR-2026-002', contractEnds: '2027-01-31',
    coveragePct: 100, creditLimitIqd: 120_000_000, usedIqd: 113_900_000, contact: 'Peshawa Karim', phone: '+964 750 000 7103', paymentTermsDays: 60,
    ageing: { d0to30: 31_500_000, d31to60: 27_400_000, d61to90: 19_850_000, d90plus: 12_600_000 },
  },
  {
    id: 'SYN-PYR-04',
    name: T('Nishtiman Telecom – employee health (synthetic)', 'تێلیکۆمی نیشتمان – تەندروستیی کارمەندان (نموونە)', 'نشتمان للاتصالات – صحة الموظفين (تجريبي)'),
    kind: 'corporate', governorate: 'sulaymaniyah', currency: 'IQD', contractRef: 'SYN-CTR-2025-047', contractEnds: '2026-11-30',
    coveragePct: 85, creditLimitIqd: 90_000_000, usedIqd: 41_700_000, contact: 'Shirin Aziz', phone: '+964 750 000 7104', paymentTermsDays: 45,
    ageing: { d0to30: 18_900_000, d31to60: 9_600_000, d61to90: 2_100_000, d90plus: 850_000 },
  },
  {
    id: 'SYN-PYR-05',
    name: T('Hawler Construction Group (synthetic)', 'گرووپی بیناسازیی هەولێر (نموونە)', 'مجموعة هولير للإنشاءات (تجريبي)'),
    kind: 'corporate', governorate: 'erbil', currency: 'IQD', contractRef: 'SYN-CTR-2026-009', contractEnds: '2027-06-30',
    coveragePct: 75, creditLimitIqd: 60_000_000, usedIqd: 22_350_000, contact: 'Dana Rasul', phone: '+964 750 000 7105', paymentTermsDays: 30,
    ageing: { d0to30: 11_200_000, d31to60: 4_300_000, d61to90: 0, d90plus: 0 },
  },
  {
    id: 'SYN-PYR-06',
    name: T('Kurdistan Relief Alliance – NGO (synthetic)', 'هاوپەیمانیی هاوکاریی کوردستان – ڕێکخراو (نموونە)', 'تحالف كوردستان للإغاثة – منظمة (تجريبي)'),
    kind: 'ngo', governorate: 'duhok', currency: 'USD', contractRef: 'SYN-CTR-2026-021', contractEnds: '2026-12-15',
    coveragePct: 100, creditLimitIqd: 75_000_000, usedIqd: 52_800_000, contact: 'Maria Lindqvist', phone: '+964 750 000 7106', paymentTermsDays: 30,
    ageing: { d0to30: 21_600_000, d31to60: 14_900_000, d61to90: 6_300_000, d90plus: 1_200_000 },
  },
  {
    id: 'SYN-PYR-07',
    name: T('Sardam Mutual Health Fund (synthetic)', 'سندووقی هاوبەشی تەندروستیی سەردەم (نموونە)', 'صندوق سردم للتأمين الصحي التعاوني (تجريبي)'),
    kind: 'insurer', governorate: 'sulaymaniyah', currency: 'IQD', contractRef: 'SYN-CTR-2024-088', contractEnds: '2026-10-31',
    coveragePct: 70, creditLimitIqd: 40_000_000, usedIqd: 38_950_000, contact: 'Hawre Jalal', phone: '+964 750 000 7107', paymentTermsDays: 60,
    ageing: { d0to30: 6_400_000, d31to60: 8_100_000, d61to90: 9_750_000, d90plus: 11_300_000 },
  },
  {
    id: 'SYN-PYR-08',
    name: T('Hope Bridge Medical Aid – NGO (synthetic)', 'هاوکاریی پزیشکیی پردی هیوا – ڕێکخراو (نموونە)', 'جسر الأمل للمساعدات الطبية – منظمة (تجريبي)'),
    kind: 'ngo', governorate: 'duhok', currency: 'USD', contractRef: 'SYN-CTR-2026-030', contractEnds: '2027-02-28',
    coveragePct: 100, creditLimitIqd: 50_000_000, usedIqd: 9_400_000, contact: 'Ahmed Yousif', phone: '+964 750 000 7108', paymentTermsDays: 30,
    ageing: { d0to30: 5_900_000, d31to60: 1_100_000, d61to90: 0, d90plus: 0 },
  },
];

export function payerAccount(id: string): PayerAccount {
  const payer = PAYER_ACCOUNTS.find((candidate) => candidate.id === id);
  if (payer === undefined) {
    throw new Error(`Unknown synthetic payer ${id}`);
  }
  return payer;
}

// ---------------------------------------------------------------------------------------------------------
// Pre-approvals
// ---------------------------------------------------------------------------------------------------------

export type PreApprovalStatus = 'draft' | 'submitted' | 'queried' | 'approved' | 'partial' | 'denied' | 'expired';

export interface PreApprovalLine {
  readonly id: string;
  /** Synthetic tariff code. */
  readonly code: string;
  readonly description: Text3;
  readonly quantity: number;
  readonly unitIqd: number;
  /** Share the payer covers on this line, 0 to 100 (0: excluded by the contract). */
  readonly payerPct: number;
}

export interface PreApproval {
  readonly id: string;
  readonly patientId: string;
  readonly payerId: string;
  readonly service: Text3;
  readonly kind: 'inpatient' | 'day-case' | 'outpatient' | 'imaging';
  readonly requestedIso: string;
  readonly status: PreApprovalStatus;
  readonly authorisationNo: string | null;
  readonly validUntil: string | null;
  readonly note: Text3 | null;
  readonly lines: readonly PreApprovalLine[];
}

const L = (id: string, code: string, description: Text3, quantity: number, unitIqd: number, payerPct: number): PreApprovalLine => ({
  id, code, description, quantity, unitIqd, payerPct,
});

const ROOM = T('Ward bed, per day', 'جێگای قاوش، بۆ هەر ڕۆژێک', 'سرير ردهة، لليوم');
const PRIVATE = T('Private room upgrade, per day', 'بەرزکردنەوە بۆ ژووری تایبەت، بۆ هەر ڕۆژێک', 'ترقية إلى غرفة خاصة، لليوم');
const CONSULT = T('Consultant visit', 'سەردانی ڕاوێژکار', 'زيارة استشاري');
const LABS = T('Laboratory panel', 'کۆمەڵەی تاقیکردنەوە', 'حزمة فحوصات مخبرية');

interface PaSeed {
  readonly patient: number;
  readonly payer: string;
  readonly service: Text3;
  readonly kind: PreApproval['kind'];
  readonly daysAgo: number;
  readonly time: string;
  readonly status: PreApprovalStatus;
  readonly lines: readonly PreApprovalLine[];
  readonly note?: Text3;
}

const PA_SEEDS: readonly PaSeed[] = [
  { patient: 0, payer: 'SYN-PYR-01', service: T('Admission: community-acquired pneumonia, 5 days', 'خەواندن: سییەپەتای کۆمەڵگە، 5 ڕۆژ', 'إدخال: ذات رئة مكتسبة من المجتمع، 5 أيام'), kind: 'inpatient', daysAgo: 0, time: '08:40', status: 'submitted',
    lines: [L('a', 'SYN-TAR-BED01', ROOM, 5, 185_000, 80), L('b', 'SYN-TAR-CON02', CONSULT, 5, 45_000, 80), L('c', 'SYN-TAR-LAB10', LABS, 3, 62_000, 80), L('d', 'SYN-TAR-PVT01', PRIVATE, 5, 95_000, 0)] },
  { patient: 1, payer: 'SYN-PYR-03', service: T('Laparoscopic cholecystectomy', 'لابرۆسکۆپیی لابردنی زراو', 'استئصال المرارة بالمنظار'), kind: 'day-case', daysAgo: 1, time: '14:10', status: 'approved',
    lines: [L('a', 'SYN-TAR-THR22', T('Theatre and anaesthesia', 'هۆڵی نەشتەرگەری و بێهۆشکردن', 'صالة العمليات والتخدير'), 1, 2_450_000, 100), L('b', 'SYN-TAR-SUP05', T('Laparoscopic consumables', 'کەرەستەی لابرۆسکۆپی', 'مستلزمات المنظار'), 1, 780_000, 100), L('c', 'SYN-TAR-BED01', ROOM, 1, 185_000, 100)] },
  { patient: 2, payer: 'SYN-PYR-02', service: T('MRI brain with contrast', 'MRI ی مێشک لەگەڵ ماددەی ڕەنگ', 'رنين مغناطيسي للدماغ مع مادة ظليلة'), kind: 'imaging', daysAgo: 0, time: '09:05', status: 'queried',
    note: T('Payer asks for the neurology referral letter and the last CT report.', 'بیمەکە داوای نامەی ڕەوانەکردنی دەمار و دوایین ڕاپۆرتی CT دەکات.', 'تطلب الجهة الدافعة رسالة الإحالة العصبية وآخر تقرير CT.'),
    lines: [L('a', 'SYN-TAR-MRI03', T('MRI brain, with gadolinium', 'MRI ی مێشک، لەگەڵ گادۆلینیۆم', 'رنين الدماغ مع الغادولينيوم'), 1, 420_000, 90), L('b', 'SYN-TAR-RAD01', T('Radiologist report', 'ڕاپۆرتی تیشکناس', 'تقرير أخصائي الأشعة'), 1, 35_000, 90)] },
  { patient: 3, payer: 'SYN-PYR-06', service: T('Paediatric admission: bronchiolitis', 'خەواندنی منداڵ: هەوکردنی بۆرییە وردەکان', 'إدخال أطفال: التهاب القصيبات'), kind: 'inpatient', daysAgo: 2, time: '11:30', status: 'approved',
    lines: [L('a', 'SYN-TAR-BED03', T('Paediatric bed, per day', 'جێگای منداڵان، بۆ هەر ڕۆژێک', 'سرير أطفال، لليوم'), 3, 165_000, 100), L('b', 'SYN-TAR-NEB01', T('Nebulisation, per session', 'هەڵمژین، بۆ هەر دانیشتنێک', 'جلسة إرذاذ'), 9, 12_000, 100)] },
  { patient: 4, payer: 'SYN-PYR-07', service: T('Cardiac catheterisation (diagnostic)', 'کاتێتەری دڵ (دەستنیشانکردن)', 'قسطرة قلبية تشخيصية'), kind: 'day-case', daysAgo: 3, time: '10:00', status: 'partial',
    note: T('Approved at the fund tariff; stent excluded pending a second request.', 'بە نرخی سندووق پەسەند کرا؛ ستێنت دەرکرا تا داواکاریی دووەم.', 'وُوفق عليه بتعرفة الصندوق؛ استُبعدت الدعامة لحين طلب ثانٍ.'),
    lines: [L('a', 'SYN-TAR-CAT01', T('Coronary angiography', 'ئەنجیۆگرافیی دڵ', 'تصوير الأوعية التاجية'), 1, 1_850_000, 70), L('b', 'SYN-TAR-STN02', T('Drug-eluting stent', 'ستێنتی دەرمانداری', 'دعامة دوائية'), 1, 2_600_000, 0), L('c', 'SYN-TAR-BED01', ROOM, 1, 185_000, 70)] },
  { patient: 5, payer: 'SYN-PYR-04', service: T('Physiotherapy course, 10 sessions', 'خولی فیزیۆتێراپی، 10 دانیشتن', 'دورة علاج طبيعي، 10 جلسات'), kind: 'outpatient', daysAgo: 4, time: '12:20', status: 'approved',
    lines: [L('a', 'SYN-TAR-PHY01', T('Physiotherapy session', 'دانیشتنی فیزیۆتێراپی', 'جلسة علاج طبيعي'), 10, 30_000, 85)] },
  { patient: 6, payer: 'SYN-PYR-01', service: T('Elective inguinal hernia repair', 'چاکردنەوەی فەتقی گەڕاوە', 'إصلاح فتق إربي اختياري'), kind: 'day-case', daysAgo: 0, time: '07:55', status: 'draft',
    lines: [L('a', 'SYN-TAR-THR12', T('Theatre and anaesthesia', 'هۆڵی نەشتەرگەری و بێهۆشکردن', 'صالة العمليات والتخدير'), 1, 1_650_000, 80), L('b', 'SYN-TAR-MSH01', T('Mesh implant', 'تۆڕی چاندن', 'شبكة مزروعة'), 1, 340_000, 80)] },
  { patient: 7, payer: 'SYN-PYR-03', service: T('ICU admission after road traffic injury', 'خەواندن لە چاودێریی چڕ دوای ڕووداوی هاتووچۆ', 'إدخال العناية المركزة بعد حادث سير'), kind: 'inpatient', daysAgo: 5, time: '23:15', status: 'approved',
    lines: [L('a', 'SYN-TAR-ICU01', T('ICU bed, per day', 'جێگای چاودێریی چڕ، بۆ هەر ڕۆژێک', 'سرير عناية مركزة، لليوم'), 4, 650_000, 100), L('b', 'SYN-TAR-VNT01', T('Ventilator, per day', 'هەناسەدەری دەستکرد، بۆ هەر ڕۆژێک', 'جهاز تنفس، لليوم'), 2, 240_000, 100)] },
  { patient: 8, payer: 'SYN-PYR-07', service: T('Knee arthroscopy', 'ئارسرۆسکۆپیی ئەژنۆ', 'تنظير مفصل الركبة'), kind: 'day-case', daysAgo: 9, time: '09:40', status: 'denied',
    note: T('Denied: waiting period of 6 months not yet completed under the policy.', 'ڕەتکرایەوە: ماوەی چاوەڕوانیی 6 مانگ هێشتا تەواو نەبووە.', 'رُفض: لم تكتمل فترة الانتظار البالغة 6 أشهر في الوثيقة.'),
    lines: [L('a', 'SYN-TAR-ART01', T('Arthroscopy, knee', 'ئارسرۆسکۆپی، ئەژنۆ', 'تنظير الركبة'), 1, 1_950_000, 0)] },
  { patient: 9, payer: 'SYN-PYR-02', service: T('Obstetric admission: caesarean section', 'خەواندنی منداڵبوون: نەشتەرگەریی قەیسەری', 'إدخال توليد: عملية قيصرية'), kind: 'inpatient', daysAgo: 1, time: '16:45', status: 'submitted',
    lines: [L('a', 'SYN-TAR-OBS04', T('Caesarean section package', 'پاکێجی نەشتەرگەریی قەیسەری', 'باقة العملية القيصرية'), 1, 2_900_000, 90), L('b', 'SYN-TAR-NIC01', T('Newborn check and vaccines', 'پشکنینی ساوا و کوتان', 'فحص المولود واللقاحات'), 1, 120_000, 90), L('c', 'SYN-TAR-PVT01', PRIVATE, 3, 95_000, 0)] },
  { patient: 10, payer: 'SYN-PYR-05', service: T('CT abdomen and pelvis', 'CT ی سک و حەوز', 'تصوير مقطعي للبطن والحوض'), kind: 'imaging', daysAgo: 2, time: '13:05', status: 'approved',
    lines: [L('a', 'SYN-TAR-CTA02', T('CT abdomen and pelvis, with contrast', 'CT ی سک و حەوز، لەگەڵ ڕەنگ', 'مقطعي للبطن والحوض مع مادة ظليلة'), 1, 260_000, 75)] },
  { patient: 11, payer: 'SYN-PYR-08', service: T('Dialysis, 12 sessions', 'دیالیز، 12 دانیشتن', 'غسيل كلى، 12 جلسة'), kind: 'outpatient', daysAgo: 6, time: '08:30', status: 'approved',
    lines: [L('a', 'SYN-TAR-HDX01', T('Haemodialysis session', 'دانیشتنی دیالیزی خوێن', 'جلسة غسيل دموي'), 12, 150_000, 100)] },
  { patient: 12, payer: 'SYN-PYR-01', service: T('Extension of stay: 3 more days', 'درێژکردنەوەی مانەوە: 3 ڕۆژی تر', 'تمديد الإقامة: 3 أيام إضافية'), kind: 'inpatient', daysAgo: 0, time: '09:12', status: 'submitted',
    lines: [L('a', 'SYN-TAR-BED01', ROOM, 3, 185_000, 80), L('b', 'SYN-TAR-CON02', CONSULT, 3, 45_000, 80)] },
  { patient: 13, payer: 'SYN-PYR-04', service: T('Endoscopy (upper GI)', 'ئێندۆسکۆپیی سەرەوەی هەرس', 'تنظير الجهاز الهضمي العلوي'), kind: 'day-case', daysAgo: 21, time: '10:10', status: 'expired',
    note: T('Authorisation expired before the procedure was booked.', 'مۆڵەت بەسەرچوو پێش ئەوەی کردارەکە کات بۆ دابنرێت.', 'انتهت صلاحية الموافقة قبل حجز الإجراء.'),
    lines: [L('a', 'SYN-TAR-END01', T('Upper GI endoscopy', 'ئێندۆسکۆپیی سەرەوە', 'تنظير علوي'), 1, 380_000, 85)] },
  { patient: 14, payer: 'SYN-PYR-06', service: T('Fracture fixation, forearm', 'جێگیرکردنی شکاوی، باسک', 'تثبيت كسر الساعد'), kind: 'day-case', daysAgo: 1, time: '18:20', status: 'queried',
    note: T('NGO asks for proof of displacement status (camp registration card).', 'ڕێکخراوەکە داوای بەڵگەی ئاوارەیی دەکات (کارتی تۆمارکردنی کەمپ).', 'تطلب المنظمة إثبات صفة النزوح (بطاقة تسجيل المخيم).'),
    lines: [L('a', 'SYN-TAR-ORT03', T('Open reduction and plating', 'ڕاستکردنەوەی کراوە و پلەیت', 'رد مفتوح وتثبيت بصفيحة'), 1, 1_400_000, 100), L('b', 'SYN-TAR-IMP02', T('Plate and screws', 'پلەیت و بزمار', 'صفيحة ومسامير'), 1, 520_000, 100)] },
  { patient: 15, payer: 'SYN-PYR-03', service: T('Executive health check', 'پشکنینی تەندروستیی گشتگیر', 'فحص صحي شامل للتنفيذيين'), kind: 'outpatient', daysAgo: 3, time: '09:00', status: 'approved',
    lines: [L('a', 'SYN-TAR-CHK01', T('Health check package', 'پاکێجی پشکنین', 'باقة الفحص'), 1, 450_000, 100)] },
  { patient: 16, payer: 'SYN-PYR-07', service: T('Admission: diabetic foot infection', 'خەواندن: هەوکردنی پێی شەکرە', 'إدخال: التهاب القدم السكرية'), kind: 'inpatient', daysAgo: 0, time: '06:50', status: 'draft',
    lines: [L('a', 'SYN-TAR-BED01', ROOM, 7, 185_000, 70), L('b', 'SYN-TAR-ABX04', T('IV antibiotics, per day', 'دژەبەکتریای دەمار، بۆ هەر ڕۆژێک', 'مضادات حيوية وريدية، لليوم'), 7, 58_000, 70), L('c', 'SYN-TAR-DRS01', T('Wound dressing', 'پێچانی برین', 'تضميد الجرح'), 7, 18_000, 70)] },
  { patient: 17, payer: 'SYN-PYR-02', service: T('Echocardiogram', 'ئێکۆی دڵ', 'تخطيط صدى القلب'), kind: 'imaging', daysAgo: 4, time: '15:30', status: 'approved',
    lines: [L('a', 'SYN-TAR-ECH01', T('Transthoracic echocardiogram', 'ئێکۆی سنگ', 'صدى القلب عبر الصدر'), 1, 110_000, 90)] },
];

export const PRE_APPROVALS: readonly PreApproval[] = PA_SEEDS.map((seed, index) => {
  const n = String(index + 1).padStart(4, '0');
  const decided = seed.status === 'approved' || seed.status === 'partial' || seed.status === 'expired';
  return {
    id: `SYN-PA-${n}`,
    patientId: patientAt(seed.patient).id,
    payerId: seed.payer,
    service: seed.service,
    kind: seed.kind,
    requestedIso: daysAgoAt(seed.daysAgo, seed.time),
    status: seed.status,
    authorisationNo: decided ? `AUTH-${String(77120 + index * 37)}` : null,
    validUntil: decided ? demoDate(seed.daysAgo - 30) : null,
    note: seed.note ?? null,
    lines: seed.lines,
  };
});

// ---------------------------------------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------------------------------------

export type ClaimStatus = 'preparing' | 'submitted' | 'under-review' | 'part-paid' | 'paid' | 'rejected';
export type ClaimDocKind = 'invoice' | 'preapproval' | 'discharge' | 'reports' | 'id' | 'consent' | 'referral';
export const CLAIM_DOC_KINDS: readonly ClaimDocKind[] = ['invoice', 'preapproval', 'discharge', 'reports', 'id', 'consent', 'referral'];

export interface Deduction {
  readonly id: string;
  readonly reason: Text3;
  readonly code: string;
  readonly amountIqd: number;
}

export interface Claim {
  readonly id: string;
  readonly payerId: string;
  readonly patientId: string;
  readonly invoiceRef: string;
  readonly serviceOn: string;
  readonly submittedOn: string | null;
  readonly billedIqd: number;
  readonly paidIqd: number;
  readonly status: ClaimStatus;
  readonly docs: readonly ClaimDocKind[];
  readonly deductions: readonly Deduction[];
}

const D = (id: string, code: string, reason: Text3, amountIqd: number): Deduction => ({ id, code, reason, amountIqd });
const TARIFF = T('Above the contracted tariff', 'زیاتر لە نرخی گرێبەست', 'أعلى من التعرفة المتعاقد عليها');
const NOT_COVERED = T('Item not covered by the policy', 'بڕگەکە لە بیمەنامەکەدا نییە', 'البند غير مشمول بالوثيقة');
const NO_AUTH = T('Service without pre-approval', 'خزمەتگوزاری بەبێ پەسەندکردنی پێشوەختە', 'خدمة دون موافقة مسبقة');
const DUPLICATE = T('Duplicate line on the invoice', 'هێڵی دووبارە لە پسوولەکەدا', 'بند مكرر في الفاتورة');
const EXTRA_DAY = T('Length of stay above the approved days', 'ماوەی مانەوە زیاتر لە ڕۆژە پەسەندکراوەکان', 'مدة إقامة تتجاوز الأيام الموافق عليها');

interface ClaimSeed {
  readonly payer: string;
  readonly patient: number;
  readonly daysAgo: number;
  readonly submitted: number | null;
  readonly billed: number;
  readonly paid: number;
  readonly status: ClaimStatus;
  readonly docs: readonly ClaimDocKind[];
  readonly deductions?: readonly Deduction[];
}

const ALL_DOCS = CLAIM_DOC_KINDS;
const CLAIM_SEEDS: readonly ClaimSeed[] = [
  { payer: 'SYN-PYR-01', patient: 18, daysAgo: 12, submitted: 9, billed: 3_420_000, paid: 0, status: 'under-review', docs: ALL_DOCS },
  { payer: 'SYN-PYR-03', patient: 19, daysAgo: 40, submitted: 35, billed: 6_850_000, paid: 6_210_000, status: 'part-paid', docs: ALL_DOCS,
    deductions: [D('a', 'DED-TAR', TARIFF, 420_000), D('b', 'DED-NCV', NOT_COVERED, 220_000)] },
  { payer: 'SYN-PYR-02', patient: 20, daysAgo: 3, submitted: null, billed: 2_150_000, paid: 0, status: 'preparing', docs: ['invoice', 'preapproval', 'id'] },
  { payer: 'SYN-PYR-06', patient: 21, daysAgo: 25, submitted: 20, billed: 1_480_000, paid: 1_480_000, status: 'paid', docs: ALL_DOCS },
  { payer: 'SYN-PYR-07', patient: 22, daysAgo: 95, submitted: 88, billed: 4_960_000, paid: 0, status: 'rejected', docs: ['invoice', 'discharge', 'reports', 'id'],
    deductions: [D('a', 'DED-NAU', NO_AUTH, 4_960_000)] },
  { payer: 'SYN-PYR-01', patient: 23, daysAgo: 1, submitted: null, billed: 925_000, paid: 0, status: 'preparing', docs: ['invoice'] },
  { payer: 'SYN-PYR-04', patient: 24, daysAgo: 58, submitted: 50, billed: 2_740_000, paid: 2_515_000, status: 'part-paid', docs: ALL_DOCS,
    deductions: [D('a', 'DED-DUP', DUPLICATE, 125_000), D('b', 'DED-TAR', TARIFF, 100_000)] },
  { payer: 'SYN-PYR-03', patient: 25, daysAgo: 70, submitted: 66, billed: 9_300_000, paid: 0, status: 'under-review', docs: ALL_DOCS },
  { payer: 'SYN-PYR-05', patient: 26, daysAgo: 18, submitted: 14, billed: 640_000, paid: 640_000, status: 'paid', docs: ALL_DOCS },
  { payer: 'SYN-PYR-02', patient: 27, daysAgo: 33, submitted: 28, billed: 5_120_000, paid: 4_430_000, status: 'part-paid', docs: ALL_DOCS,
    deductions: [D('a', 'DED-LOS', EXTRA_DAY, 555_000), D('b', 'DED-NCV', NOT_COVERED, 135_000)] },
  { payer: 'SYN-PYR-08', patient: 28, daysAgo: 7, submitted: 5, billed: 1_800_000, paid: 0, status: 'submitted', docs: ALL_DOCS },
  { payer: 'SYN-PYR-07', patient: 29, daysAgo: 120, submitted: 112, billed: 3_150_000, paid: 0, status: 'under-review', docs: ALL_DOCS },
  { payer: 'SYN-PYR-01', patient: 30, daysAgo: 6, submitted: null, billed: 1_265_000, paid: 0, status: 'preparing', docs: ['invoice', 'preapproval', 'discharge', 'id'] },
  { payer: 'SYN-PYR-06', patient: 31, daysAgo: 45, submitted: 41, billed: 2_390_000, paid: 2_100_000, status: 'part-paid', docs: ALL_DOCS,
    deductions: [D('a', 'DED-NCV', NOT_COVERED, 290_000)] },
  { payer: 'SYN-PYR-04', patient: 32, daysAgo: 2, submitted: 1, billed: 780_000, paid: 0, status: 'submitted', docs: ALL_DOCS },
  { payer: 'SYN-PYR-03', patient: 33, daysAgo: 15, submitted: null, billed: 4_420_000, paid: 0, status: 'preparing', docs: ['invoice', 'preapproval', 'discharge', 'reports', 'id', 'consent'] },
];

export const CLAIMS: readonly Claim[] = CLAIM_SEEDS.map((seed, index) => ({
  id: `SYN-CLM-${String(26_0101 + index)}`,
  payerId: seed.payer,
  patientId: patientAt(seed.patient).id,
  invoiceRef: `SYN-INV-${String(8800 + index * 7)}`,
  serviceOn: demoDate(seed.daysAgo),
  submittedOn: seed.submitted === null ? null : demoDate(seed.submitted),
  billedIqd: seed.billed,
  paidIqd: seed.paid,
  status: seed.status,
  docs: seed.docs,
  deductions: seed.deductions ?? [],
}));
