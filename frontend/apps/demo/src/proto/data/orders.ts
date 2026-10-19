/**
 * Active orders and today's medication administration record (MAR). SYNTHETIC DATA ONLY.
 *
 * Safety cases built in:
 * - SYN-ORD-0102: amoxicillin-clavulanate drafted for Karwan Tahir Bakr, who has a severe penicillin
 *   allergy: awaiting signature with a danger alert (the order must not be signed as it stands).
 * - SYN-ORD-0202: spironolactone on hold for Gulala Osman Rashid because of the critical potassium of
 *   6.8 mmol/L; its 08:00 dose is "held". Her 08:00 bisoprolol is overdue.
 * - High-alert medicines (insulin, morphine, noradrenaline, enoxaparin, potassium) carry `highAlert` and a
 *   second-nurse witness on the MAR.
 */
import { daysAgoAt, todayAt } from './clock.ts';
import type { MarDose, MarStatus, MedicationSpec, Order, OrderAlert, Text3 } from './types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

const FREQ = {
  once: T('Once', 'یەک جار', 'مرة واحدة'),
  daily: T('Once daily', 'ڕۆژانە یەک جار', 'مرة يومياً'),
  bd: T('Twice daily', 'ڕۆژانە دوو جار', 'مرتين يومياً'),
  q8h: T('Every 8 hours', 'هەر 8 کاتژمێر جارێک', 'كل 8 ساعات'),
  q6h: T('Every 6 hours', 'هەر 6 کاتژمێر جارێک', 'كل 6 ساعات'),
  q12h: T('Every 12 hours', 'هەر 12 کاتژمێر جارێک', 'كل 12 ساعة'),
  q4hPrn: T('Every 4 hours if needed', 'هەر 4 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 4 ساعات عند الحاجة'),
  q6hPrn: T('Every 6 hours if needed', 'هەر 6 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 6 ساعات عند الحاجة'),
  q8hPrn: T('Every 8 hours if needed', 'هەر 8 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 8 ساعات عند الحاجة'),
  meals: T('Before meals, by sliding scale', 'پێش ژەمەکان، بەپێی خشتەی پێوانە', 'قبل الوجبات، حسب الجدول المتدرج'),
  continuous: T('Continuous infusion', 'تکاندنی بەردەوام', 'تسريب مستمر'),
} as const;

const PRN = {
  pain: T('Pain or fever', 'ئازار یان تا', 'ألم أو حمى'),
  severePain: T('Severe pain (score 7 or more)', 'ئازاری توند (نمرەی 7 یان زیاتر)', 'ألم شديد (درجة 7 أو أكثر)'),
  vomiting: T('Nausea or vomiting', 'دڵتێکهەڵهاتن یان ڕشانەوە', 'غثيان أو تقيؤ'),
} as const;

function med(
  drug: string,
  dose: string,
  doseUnit: string,
  route: MedicationSpec['route'],
  frequency: Text3,
  options: Partial<Pick<MedicationSpec, 'prn' | 'prnReason' | 'highAlert' | 'times' | 'continuous'>> = {},
): MedicationSpec {
  return {
    drug,
    dose,
    doseUnit,
    route,
    frequency,
    prn: options.prn ?? false,
    prnReason: options.prnReason ?? null,
    highAlert: options.highAlert ?? false,
    times: options.times ?? [],
    continuous: options.continuous ?? false,
  };
}

interface OrderInput {
  readonly id: string;
  readonly patient: string;
  readonly category: Order['category'];
  readonly title: Text3;
  readonly detail?: Text3;
  readonly priority?: Order['priority'];
  readonly status?: Order['status'];
  readonly by: string;
  readonly at: string;
  readonly medication?: MedicationSpec;
  readonly alerts?: readonly OrderAlert[];
}

function order(input: OrderInput): Order {
  return {
    id: input.id,
    patientId: input.patient,
    encounterId: `SYN-ENC-${input.patient.slice(-4)}`,
    category: input.category,
    title: input.title,
    detail: input.detail ?? null,
    priority: input.priority ?? 'routine',
    status: input.status ?? 'active',
    orderedById: input.by,
    orderedIso: input.at,
    medication: input.medication ?? null,
    alerts: input.alerts ?? [],
  };
}

/** A medication order's title: the drug name, which is the same in every language. */
function drugTitle(drug: string): Text3 {
  return { en: drug, ckb: drug, ar: drug };
}

const P = {
  karwan: 'SYN-PAT-0101',
  gulala: 'SYN-PAT-0102',
  baby: 'SYN-PAT-0103',
  rebin: 'SYN-PAT-0104',
  aso: 'SYN-PAT-0105',
  nasreen: 'SYN-PAT-0106',
  abdulrahman: 'SYN-PAT-0107',
  abdulrahmanOp: 'SYN-PAT-0108',
  mohammed: 'SYN-PAT-0109',
  anna: 'SYN-PAT-0110',
  hawre: 'SYN-PAT-0112',
  peyman: 'SYN-PAT-0114',
} as const;

const DR_SHILAN = 'SYN-STF-001';
const DR_SAMAN = 'SYN-STF-005';
const DR_NAZDAR = 'SYN-STF-006';
const DR_KOSRAT = 'SYN-STF-007';
const DR_ARAM = 'SYN-STF-008';
const DR_LANA = 'SYN-STF-016';

export const ORDERS: readonly Order[] = [
  // Karwan Tahir Bakr: pneumonia, severe penicillin allergy, type 2 diabetes
  order({
    id: 'SYN-ORD-0101',
    patient: P.karwan,
    category: 'medication',
    title: drugTitle('Levofloxacin'),
    detail: T('Penicillin-free choice for pneumonia', 'هەڵبژاردەی بێ پێنیسیلین بۆ هەوکردنی سی', 'خيار خالٍ من البنسلين لالتهاب الرئة'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:05'),
    medication: med('Levofloxacin', '750', 'mg', 'iv', FREQ.daily, { times: ['10:00'] }),
  }),
  order({
    id: 'SYN-ORD-0102',
    patient: P.karwan,
    category: 'medication',
    title: drugTitle('Amoxicillin and clavulanic acid'),
    detail: T('Drafted by the resident: step-down to oral therapy', 'ڕەشنووسی پزیشکی نیشتەجێ: گۆڕین بۆ دەرمانی دەم', 'مسودة الطبيب المقيم: التحويل إلى علاج فموي'),
    status: 'pending-signature',
    by: DR_ARAM,
    at: todayAt('09:10'),
    medication: med('Amoxicillin and clavulanic acid', '1.2', 'g', 'iv', FREQ.q8h, { times: ['14:00', '22:00'] }),
    alerts: [
      {
        tone: 'danger',
        text: T(
          'Allergy conflict: penicillin (anaphylaxis, severe). Do not sign; choose another antibiotic.',
          'ناکۆکی لەگەڵ هەستیاری: پێنیسیلین (ئەنافیلاکسی، توند). واژۆ مەکە؛ دژەبەکتریایەکی تر هەڵبژێرە.',
          'تعارض مع الحساسية: البنسلين (صدمة تحسسية، شديدة). لا توقّع؛ اختر مضاداً حيوياً آخر.',
        ),
      },
    ],
  }),
  order({
    id: 'SYN-ORD-0103',
    patient: P.karwan,
    category: 'medication',
    title: drugTitle('Insulin aspart'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:10'),
    medication: med('Insulin aspart', '4', 'U', 'sc', FREQ.meals, { highAlert: true, times: ['07:30', '12:30', '18:30'] }),
    detail: T('Dose by capillary glucose, see the sliding scale', 'بڕ بەپێی شەکرەی خوێن، سەیری خشتەی پێوانە بکە', 'الجرعة حسب سكر الدم الشعري، راجع الجدول المتدرج'),
  }),
  order({
    id: 'SYN-ORD-0104',
    patient: P.karwan,
    category: 'medication',
    title: drugTitle('Enoxaparin'),
    detail: T('Prevention of venous thrombosis', 'ڕێگری لە مەیینی خوێن لە دەمارەکان', 'الوقاية من الخثار الوريدي'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:12'),
    medication: med('Enoxaparin', '40', 'mg', 'sc', FREQ.daily, { highAlert: true, times: ['08:00'] }),
  }),
  order({
    id: 'SYN-ORD-0105',
    patient: P.karwan,
    category: 'medication',
    title: drugTitle('Paracetamol'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:14'),
    medication: med('Paracetamol', '1', 'g', 'po', FREQ.q6hPrn, { prn: true, prnReason: PRN.pain }),
  }),
  order({
    id: 'SYN-ORD-0106',
    patient: P.karwan,
    category: 'lab',
    title: T('Full blood count and CRP', 'پشکنینی تەواوی خوێن و CRP', 'تعداد دم كامل و CRP'),
    detail: T('Daily at 06:00', 'ڕۆژانە کاتژمێر 06:00', 'يومياً الساعة 06:00'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:20'),
  }),
  order({
    id: 'SYN-ORD-0107',
    patient: P.karwan,
    category: 'lab',
    title: T('Blood cultures, two sets', 'چاندنی خوێن، دوو کۆمەڵە', 'زرع دم، مجموعتان'),
    status: 'in-progress',
    priority: 'urgent',
    by: DR_SHILAN,
    at: daysAgoAt(2, '10:40'),
  }),
  order({
    id: 'SYN-ORD-0108',
    patient: P.karwan,
    category: 'imaging',
    title: T('Chest X-ray, PA view', 'تیشکی سنگ، ڕووی PA', 'أشعة صدر، وضعية PA'),
    detail: T(
      'Reported: right lower lobe consolidation',
      'ڕاپۆرت: چڕبوونەوەی بەشی خوارەوەی ڕاستی سی',
      'التقرير: تكثف في الفص السفلي الأيمن',
    ),
    status: 'completed',
    priority: 'urgent',
    by: DR_SHILAN,
    at: daysAgoAt(2, '10:30'),
  }),
  order({
    id: 'SYN-ORD-0109',
    patient: P.karwan,
    category: 'nursing',
    title: T('Observations every 4 hours', 'چاودێریی نیشانە ژیانییەکان هەر 4 کاتژمێر', 'العلامات الحيوية كل 4 ساعات'),
    detail: T('Target oxygen saturation 92 to 96%', 'ئامانجی تێربوونی ئۆکسجین 92 بۆ 96%', 'تشبع الأكسجين المستهدف 92 إلى 96%'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:00'),
  }),
  order({
    id: 'SYN-ORD-0110',
    patient: P.karwan,
    category: 'diet',
    title: T('Diabetic diet', 'خۆراکی شەکرە', 'نظام غذائي للسكري'),
    by: DR_SHILAN,
    at: daysAgoAt(2, '11:00'),
  }),

  // Gulala Osman Rashid: heart failure, CKD 4, critical potassium
  order({
    id: 'SYN-ORD-0201',
    patient: P.gulala,
    category: 'medication',
    title: drugTitle('Furosemide'),
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:00'),
    medication: med('Furosemide', '40', 'mg', 'iv', FREQ.bd, { times: ['08:00', '16:00'] }),
  }),
  order({
    id: 'SYN-ORD-0202',
    patient: P.gulala,
    category: 'medication',
    title: drugTitle('Spironolactone'),
    status: 'on-hold',
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:05'),
    medication: med('Spironolactone', '25', 'mg', 'po', FREQ.daily, { times: ['08:00'] }),
    alerts: [
      {
        tone: 'warning',
        text: T(
          'On hold: potassium 6.8 mmol/L this morning',
          'ڕاگیراوە: پۆتاسیۆم 6.8 mmol/L ئەمڕۆ بەیانی',
          'موقوف: البوتاسيوم 6.8 mmol/L صباح اليوم',
        ),
      },
    ],
  }),
  order({
    id: 'SYN-ORD-0203',
    patient: P.gulala,
    category: 'medication',
    title: drugTitle('Bisoprolol'),
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:06'),
    medication: med('Bisoprolol', '2.5', 'mg', 'po', FREQ.daily, { times: ['08:00'] }),
  }),
  order({
    id: 'SYN-ORD-0204',
    patient: P.gulala,
    category: 'lab',
    title: T('Renal profile (urea, creatinine, electrolytes)', 'پرۆفایلی گورچیلە (یووریا، کریاتینین، ئەلیکترۆلایت)', 'وظائف الكلى (يوريا، كرياتينين، أملاح)'),
    detail: T('Daily at 06:00', 'ڕۆژانە کاتژمێر 06:00', 'يومياً الساعة 06:00'),
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:10'),
  }),
  order({
    id: 'SYN-ORD-0205',
    patient: P.gulala,
    category: 'nursing',
    title: T('Fluid balance chart and daily weight', 'خشتەی هاوسەنگیی شلە و کێشی ڕۆژانە', 'مخطط توازن السوائل والوزن اليومي'),
    detail: T('Fluid restriction 1.5 litres a day', 'سنووردارکردنی شلە بۆ 1.5 لیتر لە ڕۆژێکدا', 'تقييد السوائل إلى 1.5 لتر يومياً'),
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:12'),
  }),
  order({
    id: 'SYN-ORD-0206',
    patient: P.gulala,
    category: 'nursing',
    title: T('Fall precautions', 'ڕێکارەکانی ڕێگری لە کەوتن', 'احتياطات منع السقوط'),
    detail: T('Bed low, call bell in reach, non-slip socks', 'جێگەی نزم، زەنگ لە دەستڕەس، گۆرەوی نەخلیسک', 'سرير منخفض، جرس النداء في المتناول، جوارب مانعة للانزلاق'),
    by: DR_SHILAN,
    at: daysAgoAt(4, '15:15'),
  }),

  // Baby girl of Shnyar: neonatal jaundice
  order({
    id: 'SYN-ORD-0301',
    patient: P.baby,
    category: 'nursing',
    title: T('Phototherapy, continuous', 'چارەسەری ڕووناکی، بەردەوام', 'علاج ضوئي مستمر'),
    detail: T('Eye shields on; check temperature every 3 hours', 'پارێزەری چاو؛ پلەی گەرمی هەر 3 کاتژمێر بپشکنە', 'واقيات العين؛ قياس الحرارة كل 3 ساعات'),
    status: 'in-progress',
    by: DR_NAZDAR,
    at: daysAgoAt(1, '15:00'),
  }),
  order({
    id: 'SYN-ORD-0302',
    patient: P.baby,
    category: 'lab',
    title: T('Total serum bilirubin', 'کۆی بیلیڕووبینی خوێن', 'البيليروبين الكلي في المصل'),
    detail: T('Every 12 hours', 'هەر 12 کاتژمێر جارێک', 'كل 12 ساعة'),
    priority: 'urgent',
    by: DR_NAZDAR,
    at: daysAgoAt(1, '15:02'),
  }),
  order({
    id: 'SYN-ORD-0303',
    patient: P.baby,
    category: 'diet',
    title: T('Breastfeeding on demand, 8 to 12 feeds a day', 'شیردان بەپێی داواکاری، 8 بۆ 12 جار لە ڕۆژێکدا', 'رضاعة طبيعية عند الطلب، 8 إلى 12 رضعة يومياً'),
    by: DR_NAZDAR,
    at: daysAgoAt(1, '15:05'),
  }),
  order({
    id: 'SYN-ORD-0304',
    patient: P.baby,
    category: 'medication',
    title: drugTitle('Phytomenadione (vitamin K)'),
    status: 'completed',
    by: DR_NAZDAR,
    at: daysAgoAt(1, '14:50'),
    medication: med('Phytomenadione (vitamin K)', '1', 'mg', 'im', FREQ.once),
  }),

  // Rebin Sardar Qadir: gastroenteritis with dehydration
  order({
    id: 'SYN-ORD-0401',
    patient: P.rebin,
    category: 'medication',
    title: drugTitle('Oral rehydration solution'),
    detail: T('50 mL/kg over 4 hours, then replace losses', '50 mL/kg لە 4 کاتژمێردا، پاشان قەرەبووی لەدەستچوو', '50 mL/kg خلال 4 ساعات، ثم تعويض الفاقد'),
    by: DR_NAZDAR,
    at: daysAgoAt(1, '21:30'),
    medication: med('Oral rehydration solution', '1100', 'mL', 'po', FREQ.continuous, { continuous: true }),
  }),
  order({
    id: 'SYN-ORD-0402',
    patient: P.rebin,
    category: 'medication',
    title: drugTitle('Ondansetron'),
    detail: T('0.1 mg/kg, weight 22.4 kg', '0.1 mg/kg، کێش 22.4 kg', '0.1 mg/kg، الوزن 22.4 kg'),
    by: DR_NAZDAR,
    at: daysAgoAt(1, '21:32'),
    medication: med('Ondansetron', '2', 'mg', 'iv', FREQ.q8hPrn, { prn: true, prnReason: PRN.vomiting }),
  }),
  order({
    id: 'SYN-ORD-0403',
    patient: P.rebin,
    category: 'nursing',
    title: T('Strict intake and output, weigh daily', 'تۆمارکردنی ورد و ڕێکی وەرگرتن و دەرچوون، کێشکردنی ڕۆژانە', 'تسجيل دقيق للمدخول والمخرج، الوزن يومياً'),
    by: DR_NAZDAR,
    at: daysAgoAt(1, '21:35'),
  }),

  // Aso Kamaran Yousif: suspected TB, airborne isolation
  order({
    id: 'SYN-ORD-0501',
    patient: P.aso,
    category: 'lab',
    title: T('Sputum AFB smear and GeneXpert MTB/RIF', 'پشکنینی بەڵغەم بۆ AFB و GeneXpert MTB/RIF', 'لطاخة القشع AFB و GeneXpert MTB/RIF'),
    detail: T('Three early-morning samples', 'سێ نموونەی بەیانیانی زوو', 'ثلاث عينات صباحية مبكرة'),
    status: 'in-progress',
    priority: 'urgent',
    by: DR_SHILAN,
    at: daysAgoAt(1, '17:00'),
  }),
  order({
    id: 'SYN-ORD-0502',
    patient: P.aso,
    category: 'imaging',
    title: T('Chest X-ray, PA view', 'تیشکی سنگ، ڕووی PA', 'أشعة صدر، وضعية PA'),
    detail: T('Reported: right upper lobe cavitation', 'ڕاپۆرت: کونبوون لە بەشی سەرەوەی ڕاستی سی', 'التقرير: تكهف في الفص العلوي الأيمن'),
    status: 'completed',
    by: DR_SHILAN,
    at: daysAgoAt(1, '16:45'),
  }),
  order({
    id: 'SYN-ORD-0503',
    patient: P.aso,
    category: 'nursing',
    title: T('Airborne isolation', 'جیاکردنەوەی هەوایی', 'عزل هوائي'),
    detail: T('Negative-pressure room, N95 for staff, door closed', 'ژووری پەستانی نەرێنی، N95 بۆ ستاف، دەرگا داخراو', 'غرفة ضغط سلبي، N95 للطاقم، الباب مغلق'),
    by: DR_SHILAN,
    at: daysAgoAt(1, '16:35'),
  }),

  // Nasreen Jalal Mahmood: day 1 after laparoscopic cholecystectomy
  order({
    id: 'SYN-ORD-0601',
    patient: P.nasreen,
    category: 'medication',
    title: drugTitle('Morphine'),
    detail: T('Controlled drug: second nurse checks', 'دەرمانی کۆنتڕۆڵکراو: پەرستاری دووەم دەپشکنێت', 'دواء مراقب: تحقق ممرض ثانٍ'),
    by: DR_SAMAN,
    at: daysAgoAt(1, '13:00'),
    medication: med('Morphine', '2', 'mg', 'iv', FREQ.q4hPrn, { prn: true, prnReason: PRN.severePain, highAlert: true }),
  }),
  order({
    id: 'SYN-ORD-0602',
    patient: P.nasreen,
    category: 'medication',
    title: drugTitle('Paracetamol'),
    by: DR_SAMAN,
    at: daysAgoAt(1, '13:02'),
    medication: med('Paracetamol', '1', 'g', 'iv', FREQ.q6h, { times: ['06:00', '12:00', '18:00', '24:00'] }),
  }),
  order({
    id: 'SYN-ORD-0603',
    patient: P.nasreen,
    category: 'medication',
    title: drugTitle('Omeprazole'),
    by: DR_SAMAN,
    at: daysAgoAt(1, '13:04'),
    medication: med('Omeprazole', '40', 'mg', 'iv', FREQ.daily, { times: ['08:00'] }),
  }),
  order({
    id: 'SYN-ORD-0604',
    patient: P.nasreen,
    category: 'nursing',
    title: T('Wound check and early mobilisation', 'پشکنینی برین و جووڵەی زوو', 'فحص الجرح والتحريك المبكر'),
    detail: T('Latex-free dressings only', 'تەنها پێچانی بێ لاتێکس', 'ضمادات خالية من اللاتكس فقط'),
    by: DR_SAMAN,
    at: daysAgoAt(1, '13:06'),
  }),
  order({
    id: 'SYN-ORD-0605',
    patient: P.nasreen,
    category: 'consult',
    title: T('Discharge today if pain controlled', 'دەرچوون ئەمڕۆ ئەگەر ئازار کۆنتڕۆڵ کرا', 'الخروج اليوم إذا تمت السيطرة على الألم'),
    status: 'pending-signature',
    by: DR_SAMAN,
    at: todayAt('08:40'),
  }),

  // Abdulrahman Abdulkarim Abdulrazaq Hawramani: hip fracture, day 2 after surgery
  order({
    id: 'SYN-ORD-0701',
    patient: P.abdulrahman,
    category: 'medication',
    title: drugTitle('Enoxaparin'),
    by: DR_SAMAN,
    at: daysAgoAt(2, '18:00'),
    medication: med('Enoxaparin', '40', 'mg', 'sc', FREQ.daily, { highAlert: true, times: ['08:00'] }),
  }),
  order({
    id: 'SYN-ORD-0702',
    patient: P.abdulrahman,
    category: 'medication',
    title: drugTitle('Paracetamol'),
    by: DR_SAMAN,
    at: daysAgoAt(2, '18:02'),
    medication: med('Paracetamol', '1', 'g', 'po', FREQ.q6h, { times: ['06:00', '12:00', '18:00', '24:00'] }),
  }),
  order({
    id: 'SYN-ORD-0703',
    patient: P.abdulrahman,
    category: 'consult',
    title: T('Physiotherapy: walk with a frame', 'چارەسەری سروشتی: ڕۆیشتن بە چوارچێوە', 'علاج طبيعي: المشي بالمشاية'),
    status: 'in-progress',
    by: DR_SAMAN,
    at: daysAgoAt(1, '09:00'),
  }),
  order({
    id: 'SYN-ORD-0704',
    patient: P.abdulrahman,
    category: 'imaging',
    title: T('X-ray of the right hip', 'تیشکی سمتی ڕاست', 'أشعة الورك الأيمن'),
    detail: T('Reported: hemiarthroplasty in good position', 'ڕاپۆرت: جومگەی دەستکرد لە شوێنی دروستدایە', 'التقرير: المفصل الصناعي في وضع جيد'),
    status: 'completed',
    by: DR_SAMAN,
    at: daysAgoAt(2, '12:00'),
  }),

  // Abdulrahman Abdulkarim Abdulmutalib Hawramani (outpatient look-alike)
  order({
    id: 'SYN-ORD-0801',
    patient: P.abdulrahmanOp,
    category: 'lab',
    title: T('HbA1c and fasting glucose', 'HbA1c و شەکرەی بەرچایی', 'HbA1c وسكر الصيام'),
    status: 'completed',
    by: DR_LANA,
    at: todayAt('08:45'),
  }),
  order({
    id: 'SYN-ORD-0802',
    patient: P.abdulrahmanOp,
    category: 'lab',
    title: T('Lipid profile', 'پرۆفایلی چەوری', 'دهون الدم'),
    status: 'in-progress',
    by: DR_LANA,
    at: todayAt('08:45'),
  }),

  // Mohammed Abdulkarim Abdulrazzaq al-Dulaimi: septic shock, ventilated
  order({
    id: 'SYN-ORD-0901',
    patient: P.mohammed,
    category: 'medication',
    title: drugTitle('Meropenem'),
    by: DR_KOSRAT,
    at: daysAgoAt(2, '04:00'),
    medication: med('Meropenem', '1', 'g', 'iv', FREQ.q8h, { times: ['06:00', '14:00', '22:00'] }),
  }),
  order({
    id: 'SYN-ORD-0902',
    patient: P.mohammed,
    category: 'medication',
    title: drugTitle('Vancomycin'),
    detail: T('Trough level before the 4th dose', 'ئاستی کەمترین پێش ژەمی چوارەم', 'مستوى القاع قبل الجرعة الرابعة'),
    by: DR_KOSRAT,
    at: daysAgoAt(1, '09:00'),
    medication: med('Vancomycin', '1', 'g', 'iv', FREQ.q12h, { times: ['09:00', '21:00'] }),
  }),
  order({
    id: 'SYN-ORD-0903',
    patient: P.mohammed,
    category: 'medication',
    title: drugTitle('Noradrenaline'),
    detail: T('Titrate to mean arterial pressure 65 mmHg or more', 'ڕێکخستن بۆ پەستانی ناوەندیی شادەمار 65 mmHg یان زیاتر', 'المعايرة لضغط شرياني متوسط 65 mmHg أو أكثر'),
    priority: 'stat',
    by: DR_KOSRAT,
    at: daysAgoAt(2, '03:50'),
    medication: med('Noradrenaline', '0.12', 'ug/kg/min', 'iv-infusion', FREQ.continuous, { highAlert: true, continuous: true }),
  }),
  order({
    id: 'SYN-ORD-0904',
    patient: P.mohammed,
    category: 'lab',
    title: T('Arterial blood gas and lactate', 'گازی خوێنی شادەمار و لاکتەیت', 'غازات الدم الشرياني واللاكتات'),
    detail: T('Every 6 hours', 'هەر 6 کاتژمێر جارێک', 'كل 6 ساعات'),
    priority: 'urgent',
    by: DR_KOSRAT,
    at: daysAgoAt(2, '04:05'),
  }),
  order({
    id: 'SYN-ORD-0905',
    patient: P.mohammed,
    category: 'nursing',
    title: T('Ventilator check every hour', 'پشکنینی ئامێری هەناسەدان هەموو کاتژمێرێک', 'فحص جهاز التنفس كل ساعة'),
    detail: T('Head of bed at 30 degrees, contact precautions', 'سەری جێگە 30 پلە، ڕێکاری بەرکەوتن', 'رأس السرير بزاوية 30 درجة، احتياطات التلامس'),
    by: DR_KOSRAT,
    at: daysAgoAt(2, '04:10'),
  }),

  // Anna Maria Kowalska: after laparoscopic appendicectomy (codeine intolerance)
  order({
    id: 'SYN-ORD-1001',
    patient: P.anna,
    category: 'medication',
    title: drugTitle('Ceftriaxone'),
    by: DR_SAMAN,
    at: todayAt('02:30'),
    medication: med('Ceftriaxone', '1', 'g', 'iv', FREQ.daily, { times: ['10:00'] }),
  }),
  order({
    id: 'SYN-ORD-1002',
    patient: P.anna,
    category: 'medication',
    title: drugTitle('Metronidazole'),
    by: DR_SAMAN,
    at: todayAt('02:32'),
    medication: med('Metronidazole', '500', 'mg', 'iv', FREQ.q8h, { times: ['06:00', '14:00', '22:00'] }),
  }),
  order({
    id: 'SYN-ORD-1003',
    patient: P.anna,
    category: 'medication',
    title: drugTitle('Paracetamol'),
    detail: T('No codeine-based painkillers', 'هیچ ئازارشکێنێکی کۆدیندار نا', 'لا مسكنات تحتوي على الكودايين'),
    by: DR_SAMAN,
    at: todayAt('02:34'),
    medication: med('Paracetamol', '1', 'g', 'iv', FREQ.q6h, { times: ['06:00', '12:00', '18:00', '24:00'] }),
  }),

  // Hawre Nawzad Fattah: diabetic ketoacidosis
  order({
    id: 'SYN-ORD-1201',
    patient: P.hawre,
    category: 'medication',
    title: drugTitle('Insulin (soluble)'),
    detail: T('Fixed rate 0.1 units/kg/h by protocol', 'ڕێژەی جێگیر 0.1 یەکە/kg/کاتژمێر بەپێی پرۆتۆکۆڵ', 'معدل ثابت 0.1 وحدة/kg/ساعة حسب البروتوكول'),
    priority: 'stat',
    by: DR_SHILAN,
    at: daysAgoAt(1, '19:20'),
    medication: med('Insulin (soluble)', '6.6', 'U/h', 'iv-infusion', FREQ.continuous, { highAlert: true, continuous: true }),
  }),
  order({
    id: 'SYN-ORD-1202',
    patient: P.hawre,
    category: 'medication',
    title: drugTitle('Sodium chloride 0.9% with potassium chloride'),
    detail: T('20 mmol potassium in each litre', '20 mmol پۆتاسیۆم لە هەر لیترێکدا', '20 mmol بوتاسيوم في كل لتر'),
    by: DR_SHILAN,
    at: daysAgoAt(1, '19:25'),
    medication: med('Sodium chloride 0.9% with potassium chloride', '150', 'mL/h', 'iv-infusion', FREQ.continuous, {
      highAlert: true,
      continuous: true,
    }),
  }),
  order({
    id: 'SYN-ORD-1203',
    patient: P.hawre,
    category: 'lab',
    title: T('Venous blood gas, ketones and electrolytes', 'گازی خوێنی دەمار، کیتۆن و ئەلیکترۆلایت', 'غازات الدم الوريدي والكيتونات والأملاح'),
    detail: T('Every 2 hours until ketones below 0.6', 'هەر 2 کاتژمێر تا کیتۆن لە خوار 0.6', 'كل ساعتين حتى تنخفض الكيتونات دون 0.6'),
    priority: 'urgent',
    by: DR_SHILAN,
    at: daysAgoAt(1, '19:30'),
  }),
  order({
    id: 'SYN-ORD-1204',
    patient: P.hawre,
    category: 'nursing',
    title: T('Capillary glucose every hour', 'شەکرەی خوێن هەموو کاتژمێرێک', 'سكر الدم الشعري كل ساعة'),
    by: DR_SHILAN,
    at: daysAgoAt(1, '19:30'),
  }),

  // Peyman Sherzad Anwar: pre-operative assessment (outpatient)
  order({
    id: 'SYN-ORD-1401',
    patient: P.peyman,
    category: 'lab',
    title: T('Pre-operative bloods: blood count, clotting, renal profile', 'پشکنینی پێش نەشتەرگەری: خوێن، مەیین، گورچیلە', 'تحاليل ما قبل العملية: تعداد الدم، التخثر، وظائف الكلى'),
    status: 'active',
    by: DR_SAMAN,
    at: todayAt('09:25'),
  }),
  order({
    id: 'SYN-ORD-1402',
    patient: P.peyman,
    category: 'nursing',
    title: T('Allergy assessment before any medicine', 'هەڵسەنگاندنی هەستیاری پێش هەر دەرمانێک', 'تقييم الحساسية قبل أي دواء'),
    priority: 'urgent',
    by: DR_SAMAN,
    at: todayAt('09:25'),
  }),
];

// ---------------------------------------------------------------------------------------------------------
// Today's MAR
// ---------------------------------------------------------------------------------------------------------

const N_RAWA = 'SYN-STF-002';
const N_BAHAR = 'SYN-STF-009';
const N_GORAN = 'SYN-STF-010';
const N_HANA = 'SYN-STF-014';
const N_ARI = 'SYN-STF-015';
const N_KARZAN_NIGHT = 'SYN-STF-019';

interface DoseInput {
  readonly order: string;
  readonly at: string;
  readonly status: MarStatus;
  readonly given?: string;
  readonly by?: string;
  readonly witness?: string;
  readonly note?: Text3;
}

let doseSeq = 0;

function dose(input: DoseInput): MarDose {
  doseSeq += 1;
  const found = ORDERS.find((candidate) => candidate.id === input.order);
  if (found === undefined) {
    throw new Error(`MAR dose for unknown order ${input.order}`);
  }
  return {
    id: `SYN-MAR-${String(doseSeq).padStart(4, '0')}`,
    patientId: found.patientId,
    orderId: input.order,
    scheduledIso: input.at === '24:00' ? `${todayAt('23:59')}` : todayAt(input.at),
    status: input.status,
    givenIso: input.given === undefined ? null : input.given.length === 5 ? todayAt(input.given) : input.given,
    givenById: input.by ?? null,
    witnessId: input.witness ?? null,
    note: input.note ?? null,
  };
}

export const MAR: readonly MarDose[] = [
  // Karwan
  dose({ order: 'SYN-ORD-0105', at: '03:10', status: 'given', given: '03:10', by: N_KARZAN_NIGHT, note: T('Temperature 38.4 °C', 'پلەی گەرمی 38.4 °C', 'الحرارة 38.4 °C') }),
  dose({ order: 'SYN-ORD-0103', at: '07:30', status: 'given', given: '07:36', by: N_GORAN, witness: N_RAWA, note: T('Glucose 11.2 mmol/L: 4 units', 'شەکرە 11.2 mmol/L: 4 یەکە', 'السكر 11.2 mmol/L: 4 وحدات') }),
  dose({ order: 'SYN-ORD-0104', at: '08:00', status: 'given', given: '08:12', by: N_GORAN, witness: N_RAWA }),
  dose({ order: 'SYN-ORD-0101', at: '10:00', status: 'due' }),
  dose({ order: 'SYN-ORD-0103', at: '12:30', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0103', at: '18:30', status: 'scheduled' }),
  // Gulala
  dose({ order: 'SYN-ORD-0201', at: '08:00', status: 'given', given: '08:06', by: N_RAWA }),
  dose({
    order: 'SYN-ORD-0202',
    at: '08:00',
    status: 'held',
    by: N_RAWA,
    note: T('Held: potassium 6.8 mmol/L, doctor informed', 'ڕاگیرا: پۆتاسیۆم 6.8 mmol/L، پزیشک ئاگادار کرایەوە', 'أوقفت: البوتاسيوم 6.8 mmol/L، تم إبلاغ الطبيب'),
  }),
  dose({ order: 'SYN-ORD-0203', at: '08:00', status: 'overdue' }),
  dose({ order: 'SYN-ORD-0201', at: '16:00', status: 'scheduled' }),
  // Rebin
  dose({ order: 'SYN-ORD-0401', at: '06:00', status: 'running', given: '06:00', by: N_HANA }),
  dose({ order: 'SYN-ORD-0402', at: '06:40', status: 'given', given: '06:40', by: N_HANA, note: T('Vomited twice', 'دوو جار ڕشایەوە', 'تقيأ مرتين') }),
  // Nasreen
  dose({ order: 'SYN-ORD-0601', at: '05:10', status: 'given', given: '05:10', by: N_BAHAR, witness: N_KARZAN_NIGHT, note: T('Pain score 8 of 10', 'نمرەی ئازار 8 لە 10', 'درجة الألم 8 من 10') }),
  dose({ order: 'SYN-ORD-0602', at: '06:00', status: 'given', given: '06:04', by: N_BAHAR }),
  dose({ order: 'SYN-ORD-0603', at: '08:00', status: 'given', given: '08:20', by: N_BAHAR }),
  dose({ order: 'SYN-ORD-0602', at: '12:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0602', at: '18:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0602', at: '24:00', status: 'scheduled' }),
  // Abdulrahman (inpatient)
  dose({ order: 'SYN-ORD-0702', at: '06:00', status: 'given', given: '06:10', by: N_BAHAR }),
  dose({
    order: 'SYN-ORD-0701',
    at: '08:00',
    status: 'refused',
    by: N_BAHAR,
    note: T('Patient refused, will try again at 10:00; surgeon informed', 'نەخۆش ڕەتی کردەوە، کاتژمێر 10:00 دووبارە هەوڵ دەدرێتەوە؛ نەشتەرگەر ئاگادار کرا', 'رفض المريض، ستُعاد المحاولة الساعة 10:00؛ تم إبلاغ الجراح'),
  }),
  dose({ order: 'SYN-ORD-0702', at: '12:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0702', at: '18:00', status: 'scheduled' }),
  // Mohammed (ICU)
  dose({ order: 'SYN-ORD-0903', at: '00:00', status: 'running', given: daysAgoAt(2, '03:55'), by: N_ARI, witness: N_KARZAN_NIGHT }),
  dose({ order: 'SYN-ORD-0901', at: '06:00', status: 'given', given: '06:02', by: N_ARI }),
  dose({ order: 'SYN-ORD-0902', at: '09:00', status: 'due' }),
  dose({ order: 'SYN-ORD-0901', at: '14:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0902', at: '21:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-0901', at: '22:00', status: 'scheduled' }),
  // Anna
  dose({ order: 'SYN-ORD-1002', at: '06:00', status: 'given', given: '06:15', by: N_BAHAR }),
  dose({ order: 'SYN-ORD-1003', at: '06:00', status: 'given', given: '06:15', by: N_BAHAR }),
  dose({ order: 'SYN-ORD-1001', at: '10:00', status: 'due' }),
  dose({ order: 'SYN-ORD-1003', at: '12:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-1002', at: '14:00', status: 'scheduled' }),
  dose({ order: 'SYN-ORD-1002', at: '22:00', status: 'scheduled' }),
  // Hawre
  dose({ order: 'SYN-ORD-1201', at: '00:00', status: 'running', given: daysAgoAt(1, '19:40'), by: N_KARZAN_NIGHT, witness: N_GORAN }),
  dose({ order: 'SYN-ORD-1202', at: '00:00', status: 'running', given: daysAgoAt(1, '19:45'), by: N_KARZAN_NIGHT, witness: N_GORAN }),
];

/** One patient's orders, newest first. */
export function ordersOf(patientId: string): readonly Order[] {
  return ORDERS.filter((candidate) => candidate.patientId === patientId).toSorted((a, b) =>
    b.orderedIso.localeCompare(a.orderedIso),
  );
}

/** The order with this id, or undefined. */
export function findOrder(orderId: string): Order | undefined {
  return ORDERS.find((candidate) => candidate.id === orderId);
}

/** One patient's MAR for today, by scheduled time. */
export function marOf(patientId: string): readonly MarDose[] {
  return MAR.filter((candidate) => candidate.patientId === patientId).toSorted((a, b) =>
    a.scheduledIso.localeCompare(b.scheduledIso),
  );
}
