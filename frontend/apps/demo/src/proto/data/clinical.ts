/**
 * Vital signs (the last 24 hours, every 4 hours) and clinical notes of the curated inpatients.
 * SYNTHETIC DATA ONLY.
 */
import { daysAgoAt, todayAt } from './clock.ts';
import type { ClinicalNote, Text3, VitalSigns } from './types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** Observation times: yesterday 13:30 to today 09:30, every 4 hours. */
const TIMES: readonly string[] = [
  daysAgoAt(1, '13:30'),
  daysAgoAt(1, '17:30'),
  daysAgoAt(1, '21:30'),
  todayAt('01:30'),
  todayAt('05:30'),
  todayAt('09:30'),
];

type Series = readonly [string, string, string, string, string, string];

interface VitalsPlan {
  readonly patientId: string;
  readonly by: string;
  readonly temp: Series;
  readonly hr: Series;
  readonly sys: Series;
  readonly dia: Series;
  readonly rr: Series;
  readonly spo2: Series;
  readonly pain: Series | null;
  readonly news2: readonly [number, number, number, number, number, number];
}

const PLANS: readonly VitalsPlan[] = [
  {
    patientId: 'SYN-PAT-0101',
    by: 'SYN-STF-010',
    temp: ['38.9', '38.6', '38.4', '38.1', '37.8', '37.6'],
    hr: ['112', '108', '104', '99', '96', '94'],
    sys: ['118', '121', '119', '124', '126', '128'],
    dia: ['72', '74', '70', '76', '78', '78'],
    rr: ['24', '23', '22', '21', '20', '19'],
    spo2: ['90', '91', '92', '93', '94', '95'],
    pain: ['3', '3', '2', '2', '2', '1'],
    news2: [7, 6, 5, 4, 3, 2],
  },
  {
    patientId: 'SYN-PAT-0102',
    by: 'SYN-STF-002',
    temp: ['36.6', '36.7', '36.5', '36.6', '36.4', '36.5'],
    hr: ['68', '64', '62', '58', '54', '52'],
    sys: ['104', '102', '100', '98', '96', '95'],
    dia: ['62', '60', '58', '58', '56', '55'],
    rr: ['20', '20', '21', '22', '22', '23'],
    spo2: ['94', '94', '93', '93', '92', '92'],
    pain: ['0', '0', '0', '0', '0', '0'],
    news2: [2, 2, 3, 3, 4, 5],
  },
  {
    patientId: 'SYN-PAT-0103',
    by: 'SYN-STF-014',
    temp: ['36.8', '37.0', '36.9', '37.1', '36.9', '37.0'],
    hr: ['142', '138', '146', '140', '136', '139'],
    sys: ['68', '66', '70', '67', '69', '68'],
    dia: ['40', '38', '42', '39', '41', '40'],
    rr: ['44', '46', '42', '45', '43', '44'],
    spo2: ['98', '97', '98', '98', '99', '98'],
    pain: null,
    news2: [0, 0, 0, 0, 0, 0],
  },
  {
    patientId: 'SYN-PAT-0104',
    by: 'SYN-STF-014',
    temp: ['38.2', '38.0', '37.8', '37.4', '37.2', '37.0'],
    hr: ['128', '124', '118', '112', '106', '102'],
    sys: ['92', '94', '96', '98', '100', '101'],
    dia: ['54', '56', '58', '60', '62', '62'],
    rr: ['28', '27', '26', '24', '23', '22'],
    spo2: ['98', '98', '99', '99', '99', '99'],
    pain: ['4', '4', '3', '2', '2', '1'],
    news2: [0, 0, 0, 0, 0, 0],
  },
  {
    patientId: 'SYN-PAT-0105',
    by: 'SYN-STF-010',
    temp: ['38.1', '38.3', '37.9', '37.6', '37.4', '37.5'],
    hr: ['98', '102', '96', '92', '90', '91'],
    sys: ['116', '114', '118', '117', '120', '119'],
    dia: ['72', '70', '74', '72', '76', '75'],
    rr: ['20', '21', '20', '19', '19', '19'],
    spo2: ['95', '95', '96', '96', '96', '96'],
    pain: ['1', '1', '1', '0', '0', '0'],
    news2: [2, 3, 1, 1, 0, 1],
  },
  {
    patientId: 'SYN-PAT-0106',
    by: 'SYN-STF-009',
    temp: ['37.2', '37.4', '37.3', '37.1', '36.9', '36.9'],
    hr: ['88', '92', '90', '84', '80', '78'],
    sys: ['132', '128', '126', '124', '122', '124'],
    dia: ['82', '80', '78', '76', '76', '78'],
    rr: ['16', '17', '16', '16', '15', '15'],
    spo2: ['97', '96', '97', '97', '98', '98'],
    pain: ['6', '7', '5', '8', '3', '2'],
    news2: [0, 0, 0, 0, 0, 0],
  },
  {
    patientId: 'SYN-PAT-0107',
    by: 'SYN-STF-009',
    temp: ['37.0', '37.3', '37.1', '36.9', '36.8', '36.9'],
    hr: ['84', '86', '82', '80', '78', '80'],
    sys: ['142', '138', '136', '134', '138', '140'],
    dia: ['80', '78', '76', '74', '78', '80'],
    rr: ['18', '18', '17', '17', '16', '16'],
    spo2: ['95', '95', '96', '96', '96', '95'],
    pain: ['5', '4', '4', '3', '3', '4'],
    news2: [1, 1, 0, 0, 0, 1],
  },
  {
    patientId: 'SYN-PAT-0109',
    by: 'SYN-STF-015',
    temp: ['38.8', '38.5', '38.3', '38.0', '37.9', '37.7'],
    hr: ['124', '120', '116', '112', '108', '106'],
    sys: ['84', '88', '90', '92', '94', '96'],
    dia: ['48', '50', '52', '54', '56', '58'],
    rr: ['18', '18', '18', '18', '18', '18'],
    spo2: ['93', '94', '94', '95', '95', '96'],
    pain: null,
    news2: [11, 10, 10, 9, 9, 8],
  },
  {
    patientId: 'SYN-PAT-0110',
    by: 'SYN-STF-009',
    temp: ['38.0', '37.8', '37.9', '37.5', '37.2', '37.1'],
    hr: ['104', '100', '98', '92', '88', '84'],
    sys: ['118', '116', '114', '118', '120', '122'],
    dia: ['74', '72', '70', '74', '76', '76'],
    rr: ['18', '18', '17', '16', '16', '16'],
    spo2: ['98', '98', '98', '99', '99', '99'],
    pain: ['7', '6', '8', '4', '3', '3'],
    news2: [2, 1, 1, 0, 0, 0],
  },
  {
    patientId: 'SYN-PAT-0112',
    by: 'SYN-STF-010',
    temp: ['37.1', '37.0', '36.9', '36.9', '36.8', '36.8'],
    hr: ['118', '112', '106', '100', '98', '96'],
    sys: ['104', '108', '110', '114', '116', '118'],
    dia: ['62', '66', '68', '70', '72', '74'],
    rr: ['28', '26', '24', '22', '20', '18'],
    spo2: ['98', '98', '98', '99', '99', '99'],
    pain: ['5', '4', '3', '2', '2', '1'],
    news2: [5, 4, 3, 2, 1, 1],
  },
];

function buildVitals(): readonly VitalSigns[] {
  const sets: VitalSigns[] = [];
  for (const plan of PLANS) {
    TIMES.forEach((iso, i) => {
      sets.push({
        patientId: plan.patientId,
        iso,
        tempC: plan.temp[i] ?? '',
        heartRate: plan.hr[i] ?? '',
        systolic: plan.sys[i] ?? '',
        diastolic: plan.dia[i] ?? '',
        respRate: plan.rr[i] ?? '',
        spo2: plan.spo2[i] ?? '',
        painScore: plan.pain === null ? null : (plan.pain[i] ?? null),
        news2: plan.news2[i] ?? 0,
        recordedById: plan.by,
      });
    });
  }
  return sets;
}

/** Every vital-signs set, by patient then time. */
export const VITALS: readonly VitalSigns[] = buildVitals();

/** One patient's vital signs, oldest first (empty for patients without observations). */
export function vitalsOf(patientId: string): readonly VitalSigns[] {
  return VITALS.filter((set) => set.patientId === patientId);
}

/** The latest vital signs of a patient, if any. */
export function latestVitals(patientId: string): VitalSigns | undefined {
  return vitalsOf(patientId).at(-1);
}

// ---------------------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------------------

export const NOTES: readonly ClinicalNote[] = [
  {
    id: 'SYN-NOTE-0001',
    patientId: 'SYN-PAT-0101',
    encounterId: 'SYN-ENC-0101',
    kind: 'admission',
    iso: daysAgoAt(2, '11:30'),
    authorId: 'SYN-STF-008',
    title: T('Admission: community-acquired pneumonia', 'خەواندن: هەوکردنی سییەکان', 'الإدخال: التهاب رئوي مكتسب من المجتمع'),
    body: T(
      'Four days of fever and productive cough. Right basal crackles. CURB-65 score 2. Severe penicillin allergy (anaphylaxis in 2014), so levofloxacin started. Insulin sliding scale for diabetes.',
      'چوار ڕۆژ تا و کۆکەی بەڵغەمدار. دەنگی خشەخش لە بنی سیی ڕاست. نمرەی CURB-65 بریتییە لە 2. هەستیاریی توند بە پێنیسیلین (ئەنافیلاکسی لە 2014)، بۆیە لێڤۆفلۆکساسین دەستی پێکرا. ئەنسولین بەپێی خشتەی پێوانە بۆ شەکرە.',
      'حمى وسعال منتج منذ أربعة أيام. خراخر في قاعدة الرئة اليمنى. درجة CURB-65 تساوي 2. حساسية شديدة للبنسلين (صدمة تحسسية عام 2014)، لذلك بدأ الليفوفلوكساسين. أنسولين حسب الجدول المتدرج للسكري.',
    ),
    signed: true,
  },
  {
    id: 'SYN-NOTE-0002',
    patientId: 'SYN-PAT-0101',
    encounterId: 'SYN-ENC-0101',
    kind: 'progress',
    iso: todayAt('08:45'),
    authorId: 'SYN-STF-001',
    title: T('Ward round, day 3', 'سەردانی قاوش، ڕۆژی 3', 'جولة الردهة، اليوم الثالث'),
    body: T(
      'Improving: fever settling, oxygen saturation 95% on 2 litres. CRP falling (210 to 142). Continue levofloxacin. Plan oral switch tomorrow; no penicillins.',
      'باشتر دەبێت: تا دادەبەزێت، تێربوونی ئۆکسجین 95% بە 2 لیتر. CRP دادەبەزێت (210 بۆ 142). لێڤۆفلۆکساسین بەردەوام بێت. سبەی گۆڕین بۆ دەرمانی دەم؛ هیچ پێنیسیلینێک نا.',
      'تحسن: الحمى تنخفض، تشبع الأكسجين 95% على لترين. CRP ينخفض (من 210 إلى 142). يستمر الليفوفلوكساسين. التحويل إلى الفموي غداً؛ لا بنسلينات.',
    ),
    signed: false,
  },
  {
    id: 'SYN-NOTE-0003',
    patientId: 'SYN-PAT-0102',
    encounterId: 'SYN-ENC-0102',
    kind: 'progress',
    iso: daysAgoAt(1, '09:15'),
    authorId: 'SYN-STF-001',
    title: T('Ward round, day 4', 'سەردانی قاوش، ڕۆژی 4', 'جولة الردهة، اليوم الرابع'),
    body: T(
      'Less breathless, weight down 1.4 kg. Potassium rising (5.9). Creatinine worse. Continue furosemide; review spironolactone tomorrow. DNACPR discussed with patient and son.',
      'هەناسەتەنگی کەمترە، کێش 1.4 kg دابەزیوە. پۆتاسیۆم بەرز دەبێتەوە (5.9). کریاتینین خراپتر. فیوروسێماید بەردەوام بێت؛ سبەی سپیرۆنۆلاکتۆن پێدا بچینەوە. بڕیاری DNACPR لەگەڵ نەخۆش و کوڕەکەی گفتوگۆ کرا.',
      'ضيق النفس أقل، انخفض الوزن 1.4 kg. البوتاسيوم يرتفع (5.9). الكرياتينين أسوأ. يستمر الفوروسيمايد؛ مراجعة السبيرونولاكتون غداً. نوقش قرار عدم الإنعاش مع المريضة وابنها.',
    ),
    signed: true,
  },
  {
    id: 'SYN-NOTE-0004',
    patientId: 'SYN-PAT-0102',
    encounterId: 'SYN-ENC-0102',
    kind: 'nursing',
    iso: todayAt('08:05'),
    authorId: 'SYN-STF-002',
    title: T('Morning medicines', 'دەرمانەکانی بەیانی', 'أدوية الصباح'),
    body: T(
      'Spironolactone held because of the potassium result. Heart rate 54. Doctor bleeped at 08:05, awaiting call back.',
      'سپیرۆنۆلاکتۆن ڕاگیرا بەهۆی ئەنجامی پۆتاسیۆم. لێدانی دڵ 54. کاتژمێر 08:05 پەیوەندی بە پزیشکەوە کرا، چاوەڕێی وەڵامە.',
      'أوقف السبيرونولاكتون بسبب نتيجة البوتاسيوم. نبض القلب 54. تم استدعاء الطبيب الساعة 08:05، بانتظار الرد.',
    ),
    signed: true,
  },
  {
    id: 'SYN-NOTE-0005',
    patientId: 'SYN-PAT-0103',
    encounterId: 'SYN-ENC-0103',
    kind: 'progress',
    iso: todayAt('08:20'),
    authorId: 'SYN-STF-006',
    title: T('Neonatal review', 'پێداچوونەوەی کۆرپە', 'مراجعة الوليدة'),
    body: T(
      'Feeding well, 8 breastfeeds overnight. Bilirubin 248, just below the threshold. Continue phototherapy; repeat bilirubin at 18:00.',
      'باش شیر دەخوات، 8 جار لە شەودا. بیلیڕووبین 248، کەمێک لە خوار سنوورەوە. چارەسەری ڕووناکی بەردەوام بێت؛ کاتژمێر 18:00 بیلیڕووبین دووبارە بکرێتەوە.',
      'ترضع جيداً، 8 رضعات خلال الليل. البيليروبين 248، أقل بقليل من العتبة. يستمر العلاج الضوئي؛ يعاد البيليروبين الساعة 18:00.',
    ),
    signed: true,
  },
  {
    id: 'SYN-NOTE-0006',
    patientId: 'SYN-PAT-0109',
    encounterId: 'SYN-ENC-0109',
    kind: 'progress',
    iso: todayAt('08:30'),
    authorId: 'SYN-STF-007',
    title: T('ICU round', 'سەردانی چاودێریی چڕ', 'جولة العناية المركزة'),
    body: T(
      'Septic shock improving: noradrenaline reduced to 0.12 micrograms/kg/min, lactate 3.4. Urine output 0.6 mL/kg/h. Continue meropenem and vancomycin. Sedation hold at 10:00.',
      'شۆکی ژەهراویبوون باشتر دەبێت: نۆرئەدرێنالین کەمکرایەوە بۆ 0.12 مایکرۆگرام/kg/خولەک، لاکتەیت 3.4. میز 0.6 mL/kg/کاتژمێر. مێرۆپینێم و ڤانکۆمایسین بەردەوام بن. کاتژمێر 10:00 هێورکەرەوە ڕادەگیرێت.',
      'الصدمة الإنتانية تتحسن: خُفض النورأدرينالين إلى 0.12 ميكروغرام/kg/دقيقة، اللاكتات 3.4. الإدرار 0.6 mL/kg/ساعة. يستمر الميروبينيم والفانكومايسين. إيقاف التخدير الساعة 10:00.',
    ),
    signed: true,
  },
  {
    id: 'SYN-NOTE-0007',
    patientId: 'SYN-PAT-0112',
    encounterId: 'SYN-ENC-0112',
    kind: 'progress',
    iso: todayAt('09:25'),
    authorId: 'SYN-STF-008',
    title: T('DKA review', 'پێداچوونەوەی ترشبوونی کیتۆنی', 'مراجعة الحماض الكيتوني'),
    body: T(
      'pH 7.28, ketones 2.1 (falling). Glucose 14.2: add glucose 10% alongside the insulin infusion. Potassium 4.1. Not yet ready to stop the infusion.',
      'pH 7.28، کیتۆن 2.1 (دادەبەزێت). گلووکۆز 14.2: گلووکۆزی 10% لەگەڵ تکاندنی ئەنسولین زیاد بکە. پۆتاسیۆم 4.1. هێشتا کاتی ڕاگرتنی تکاندن نییە.',
      'pH 7.28، الكيتونات 2.1 (تنخفض). الغلوكوز 14.2: أضف غلوكوز 10% مع تسريب الأنسولين. البوتاسيوم 4.1. لم يحن بعد إيقاف التسريب.',
    ),
    signed: false,
  },
  {
    id: 'SYN-NOTE-0008',
    patientId: 'SYN-PAT-0106',
    encounterId: 'SYN-ENC-0106',
    kind: 'discharge-plan',
    iso: todayAt('08:40'),
    authorId: 'SYN-STF-005',
    title: T('Discharge plan', 'پلانی دەرچوون', 'خطة الخروج'),
    body: T(
      'Day 1 after laparoscopic cholecystectomy. Eating and walking. Home today if pain controlled on oral paracetamol. Clinic in 2 weeks.',
      'ڕۆژی 1 دوای نەشتەرگەریی لابراسکۆپی زراو. دەخوات و دەڕوات. ئەمڕۆ بۆ ماڵەوە ئەگەر ئازار بە پاراسیتامۆڵی دەم کۆنتڕۆڵ کرا. نۆرینگە دوای 2 هەفتە.',
      'اليوم الأول بعد استئصال المرارة بالمنظار. تأكل وتمشي. الخروج اليوم إذا تمت السيطرة على الألم بالباراسيتامول الفموي. العيادة بعد أسبوعين.',
    ),
    signed: true,
  },
];

/** One patient's notes, newest first. */
export function notesOf(patientId: string): readonly ClinicalNote[] {
  return NOTES.filter((note) => note.patientId === patientId).toSorted((a, b) => b.iso.localeCompare(a.iso));
}
