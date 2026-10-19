/**
 * The orders screen's own synthetic catalogue: a 9-medicine formulary, laboratory tests, imaging studies,
 * order sets and reasons. SYNTHETIC, NOT FOR CLINICAL USE: doses and limits are illustrative only.
 * ckb and ar texts are AI drafts, unreviewed.
 */
import type { OrderPriority, RouteId, Text3 } from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** The dose units the order form understands (UCUM codes; `mmol` is shown through our own map). */
export type DoseUnit = 'mg' | 'g' | 'ug' | 'U' | 'mL' | 'mmol';

export type FrequencyId = 'once' | 'daily' | 'bd' | 'q8h' | 'q6h' | 'q12h' | 'q4h-prn' | 'q6h-prn' | 'q8h-prn' | 'continuous';
export type DurationId = 'single' | 'd3' | 'd5' | 'd7' | 'd14' | 'review';

export const FREQUENCY: Readonly<Record<FrequencyId, Text3>> = {
  once: T('Once', 'یەک جار', 'مرة واحدة'),
  daily: T('Once daily', 'ڕۆژانە یەک جار', 'مرة يومياً'),
  bd: T('Twice daily', 'ڕۆژانە دوو جار', 'مرتين يومياً'),
  q8h: T('Every 8 hours', 'هەر 8 کاتژمێر جارێک', 'كل 8 ساعات'),
  q6h: T('Every 6 hours', 'هەر 6 کاتژمێر جارێک', 'كل 6 ساعات'),
  q12h: T('Every 12 hours', 'هەر 12 کاتژمێر جارێک', 'كل 12 ساعة'),
  'q4h-prn': T('Every 4 hours if needed', 'هەر 4 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 4 ساعات عند الحاجة'),
  'q6h-prn': T('Every 6 hours if needed', 'هەر 6 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 6 ساعات عند الحاجة'),
  'q8h-prn': T('Every 8 hours if needed', 'هەر 8 کاتژمێر جارێک ئەگەر پێویست بوو', 'كل 8 ساعات عند الحاجة'),
  continuous: T('Continuous infusion', 'تکاندنی بەردەوام', 'تسريب مستمر'),
};

export const FREQUENCY_IDS = Object.keys(FREQUENCY) as FrequencyId[];

/** Today's clock times of a new order's doses (for the summary only). */
export const FREQUENCY_TIMES: Readonly<Record<FrequencyId, readonly string[]>> = {
  once: ['10:00'],
  daily: ['10:00'],
  bd: ['10:00', '22:00'],
  q8h: ['14:00', '22:00'],
  q6h: ['12:00', '18:00', '24:00'],
  q12h: ['10:00', '22:00'],
  'q4h-prn': [],
  'q6h-prn': [],
  'q8h-prn': [],
  continuous: [],
};

export const DURATION: Readonly<Record<DurationId, Text3>> = {
  single: T('Single dose', 'یەک ژەم', 'جرعة واحدة'),
  d3: T('3 days', '3 ڕۆژ', '3 أيام'),
  d5: T('5 days', '5 ڕۆژ', '5 أيام'),
  d7: T('7 days', '7 ڕۆژ', '7 أيام'),
  d14: T('14 days', '14 ڕۆژ', '14 يوماً'),
  review: T('Until reviewed', 'تا پێداچوونەوە', 'حتى المراجعة'),
};

export const DURATION_IDS = Object.keys(DURATION) as DurationId[];

export interface FormularyDrug {
  readonly id: string;
  /** International generic name, Latin script. */
  readonly drug: string;
  /** Extra search words (brand-like or local spellings), lower case. */
  readonly search: readonly string[];
  readonly drugClass: Text3;
  readonly forms: Text3;
  readonly units: readonly DoseUnit[];
  /** The example shown under the dose field. */
  readonly example: string;
  readonly defaultRoute: RouteId;
  readonly routes: readonly RouteId[];
  readonly defaultFrequency: FrequencyId;
  readonly defaultDuration: DurationId;
  readonly highAlert: boolean;
  /** The allergy class used for the allergy check. */
  readonly allergyClass: 'penicillin' | 'cephalosporin' | 'opioid' | null;
  /** The usual maximum single dose, in the drug's base unit (mg, units or mmol), and how to show it. */
  readonly maxSingle: { readonly value: number; readonly label: string };
  /** Weight-based paediatric dose per kg in the base unit, or null. */
  readonly perKg: number | null;
  /** The strength the simulated barcode reports. */
  readonly product: string;
}

export const FORMULARY: readonly FormularyDrug[] = [
  {
    id: 'paracetamol',
    drug: 'Paracetamol',
    search: ['acetaminophen', 'panadol', 'پاراسیتامۆل', 'باراسيتامول'],
    drugClass: T('Analgesic and antipyretic', 'ئازارشکێن و تاشکێن', 'مسكن وخافض للحرارة'),
    forms: T('500 mg tablet; 1 g in 100 mL infusion', 'حەبی 500 mg؛ 1 g لە 100 mL تکاندن', 'قرص 500 mg؛ 1 g في 100 mL تسريب'),
    units: ['mg', 'g'],
    example: '1 g',
    defaultRoute: 'po',
    routes: ['po', 'iv', 'ng'],
    defaultFrequency: 'q6h-prn',
    defaultDuration: 'd3',
    highAlert: false,
    allergyClass: null,
    maxSingle: { value: 1000, label: '1 g' },
    perKg: 15,
    product: 'Paracetamol 500 mg tablet',
  },
  {
    id: 'amoxicillin',
    drug: 'Amoxicillin',
    search: ['amoxil', 'penicillin', 'ئەمۆکسیسیلین', 'أموكسيسيلين'],
    drugClass: T('Penicillin antibiotic', 'دژەبەکتریای پێنیسیلین', 'مضاد حيوي من البنسلينات'),
    forms: T('500 mg capsule; 250 mg in 5 mL suspension', 'کەپسولی 500 mg؛ 250 mg لە 5 mL شلە', 'كبسولة 500 mg؛ 250 mg في 5 mL معلق'),
    units: ['mg', 'g'],
    example: '500 mg',
    defaultRoute: 'po',
    routes: ['po', 'ng'],
    defaultFrequency: 'q8h',
    defaultDuration: 'd5',
    highAlert: false,
    allergyClass: 'penicillin',
    maxSingle: { value: 1000, label: '1 g' },
    perKg: 25,
    product: 'Amoxicillin 500 mg capsule',
  },
  {
    id: 'ceftriaxone',
    drug: 'Ceftriaxone',
    search: ['rocephin', 'cephalosporin', 'سێفتریاکزۆن', 'سيفترياكسون'],
    drugClass: T('Cephalosporin antibiotic', 'دژەبەکتریای سێفالۆسپۆرین', 'مضاد حيوي من السيفالوسبورينات'),
    forms: T('1 g vial for injection', 'شووشەی 1 g بۆ دەرزی', 'قارورة 1 g للحقن'),
    units: ['mg', 'g'],
    example: '1 g',
    defaultRoute: 'iv',
    routes: ['iv', 'im'],
    defaultFrequency: 'daily',
    defaultDuration: 'd5',
    highAlert: false,
    allergyClass: 'cephalosporin',
    maxSingle: { value: 2000, label: '2 g' },
    perKg: 50,
    product: 'Ceftriaxone 1 g vial',
  },
  {
    id: 'enoxaparin',
    drug: 'Enoxaparin',
    search: ['clexane', 'heparin', 'ئینۆکساپارین', 'إينوكسابارين'],
    drugClass: T('Anticoagulant (low molecular weight heparin)', 'دژەمەیین (هێپارینی کێشی گەردیلەیی نزم)', 'مضاد تخثر (هيبارين منخفض الوزن الجزيئي)'),
    forms: T('40 mg in 0.4 mL prefilled syringe', '40 mg لە سرنجی پڕکراوی 0.4 mL', '40 mg في محقنة معبأة 0.4 mL'),
    units: ['mg'],
    example: '40 mg',
    defaultRoute: 'sc',
    routes: ['sc'],
    defaultFrequency: 'daily',
    defaultDuration: 'review',
    highAlert: true,
    allergyClass: null,
    maxSingle: { value: 150, label: '150 mg' },
    perKg: null,
    product: 'Enoxaparin 40 mg/0.4 mL syringe',
  },
  {
    id: 'insulin-glargine',
    drug: 'Insulin glargine',
    search: ['lantus', 'basal insulin', 'ئینسولین', 'أنسولين'],
    drugClass: T('Long-acting insulin', 'ئینسولینی درێژخایەن', 'أنسولين طويل المفعول'),
    forms: T('100 units/mL pen', 'پێنی 100 یەکە/mL', 'قلم 100 وحدة/mL'),
    units: ['U'],
    example: '10 units',
    defaultRoute: 'sc',
    routes: ['sc'],
    defaultFrequency: 'daily',
    defaultDuration: 'review',
    highAlert: true,
    allergyClass: null,
    maxSingle: { value: 60, label: '60 units' },
    perKg: null,
    product: 'Insulin glargine 100 units/mL pen',
  },
  {
    id: 'morphine',
    drug: 'Morphine',
    search: ['opioid', 'مۆرفین', 'مورفين'],
    drugClass: T('Opioid analgesic (controlled)', 'ئازارشکێنی ئەفیونی (کۆنترۆڵکراو)', 'مسكن أفيوني (خاضع للرقابة)'),
    forms: T('10 mg in 1 mL ampoule', '10 mg لە ئەمپوولی 1 mL', '10 mg في أمبولة 1 mL'),
    units: ['mg'],
    example: '2 mg',
    defaultRoute: 'iv',
    routes: ['iv', 'sc', 'po'],
    defaultFrequency: 'q4h-prn',
    defaultDuration: 'd3',
    highAlert: true,
    allergyClass: 'opioid',
    maxSingle: { value: 10, label: '10 mg' },
    perKg: 0.1,
    product: 'Morphine 10 mg/mL ampoule',
  },
  {
    id: 'ondansetron',
    drug: 'Ondansetron',
    search: ['zofran', 'antiemetic', 'ئۆندانسێترۆن', 'أوندانسيترون'],
    drugClass: T('Antiemetic', 'دژەڕشانەوە', 'مضاد للقيء'),
    forms: T('4 mg in 2 mL ampoule; 4 mg tablet', '4 mg لە ئەمپوولی 2 mL؛ حەبی 4 mg', '4 mg في أمبولة 2 mL؛ قرص 4 mg'),
    units: ['mg'],
    example: '4 mg',
    defaultRoute: 'iv',
    routes: ['iv', 'po', 'im'],
    defaultFrequency: 'q8h-prn',
    defaultDuration: 'd3',
    highAlert: false,
    allergyClass: null,
    maxSingle: { value: 8, label: '8 mg' },
    perKg: 0.15,
    product: 'Ondansetron 4 mg/2 mL ampoule',
  },
  {
    id: 'salbutamol',
    drug: 'Salbutamol nebule',
    search: ['albuterol', 'ventolin', 'nebuliser', 'سالبیوتامۆل', 'سالبوتامول'],
    drugClass: T('Bronchodilator', 'فراوانکەری بۆرییەکانی هەوا', 'موسع للقصبات'),
    forms: T('2.5 mg in 2.5 mL nebule', '2.5 mg لە نێبیولی 2.5 mL', '2.5 mg في عبوة رذاذ 2.5 mL'),
    units: ['mg'],
    example: '2.5 mg',
    defaultRoute: 'neb',
    routes: ['neb'],
    defaultFrequency: 'q6h-prn',
    defaultDuration: 'review',
    highAlert: false,
    allergyClass: null,
    maxSingle: { value: 5, label: '5 mg' },
    perKg: null,
    product: 'Salbutamol 2.5 mg/2.5 mL nebule',
  },
  {
    id: 'potassium-chloride',
    drug: 'Potassium chloride',
    search: ['kcl', 'potassium', 'پۆتاسیۆم', 'بوتاسيوم'],
    drugClass: T('Electrolyte (concentrated: high-alert)', 'ئەلیکترۆلایت (چڕ: مەترسیدار)', 'إلكتروليت (مركز: عالي الخطورة)'),
    forms: T('20 mmol in 500 mL sodium chloride 0.9%', '20 mmol لە 500 mL کلۆریدی سۆدیۆم 0.9%', '20 mmol في 500 mL كلوريد الصوديوم 0.9%'),
    units: ['mmol'],
    example: '20 mmol',
    defaultRoute: 'iv-infusion',
    routes: ['iv-infusion', 'po'],
    defaultFrequency: 'once',
    defaultDuration: 'single',
    highAlert: true,
    allergyClass: null,
    maxSingle: { value: 40, label: '40 mmol' },
    perKg: null,
    product: 'Potassium chloride 20 mmol in 500 mL bag',
  },
];

export function findDrug(id: string): FormularyDrug | undefined {
  return FORMULARY.find((drug) => drug.id === id);
}

// ---------------------------------------------------------------------------------------------------------
// Laboratory and imaging
// ---------------------------------------------------------------------------------------------------------

export interface LabTest {
  readonly id: string;
  readonly name: Text3;
  readonly short: string;
  readonly container: Text3;
  /** Words that find an existing order for the same test (English titles of the data's orders). */
  readonly match: readonly string[];
}

export const LAB_TESTS: readonly LabTest[] = [
  {
    id: 'cbc',
    short: 'CBC',
    name: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد الدم الكامل'),
    container: T('EDTA tube (purple top)', 'بۆریی EDTA (سەرپۆشی مۆر)', 'أنبوب EDTA (غطاء بنفسجي)'),
    match: ['Full blood count', 'blood count'],
  },
  {
    id: 'ue',
    short: 'U&E',
    name: T('Urea and electrolytes', 'یووریا و ئەلیکترۆلایتەکان', 'اليوريا والأملاح'),
    container: T('Serum tube (yellow top)', 'بۆریی سیرەم (سەرپۆشی زەرد)', 'أنبوب مصل (غطاء أصفر)'),
    match: ['Renal profile', 'electrolytes'],
  },
  {
    id: 'crp',
    short: 'CRP',
    name: T('C-reactive protein', 'پرۆتینی C-ی کاردانەوەیی', 'البروتين المتفاعل C'),
    container: T('Serum tube (yellow top)', 'بۆریی سیرەم (سەرپۆشی زەرد)', 'أنبوب مصل (غطاء أصفر)'),
    match: ['CRP'],
  },
  {
    id: 'lft',
    short: 'LFT',
    name: T('Liver function tests', 'پشکنینی کاری جگەر', 'وظائف الكبد'),
    container: T('Serum tube (yellow top)', 'بۆریی سیرەم (سەرپۆشی زەرد)', 'أنبوب مصل (غطاء أصفر)'),
    match: ['Liver function'],
  },
  {
    id: 'cultures',
    short: 'BC x2',
    name: T('Blood cultures, two sets', 'چاندنی خوێن، دوو کۆمەڵە', 'زرع دم، مجموعتان'),
    container: T('Aerobic and anaerobic bottles', 'شووشەی هەوایی و بێهەوا', 'قوارير هوائية ولاهوائية'),
    match: ['Blood cultures'],
  },
  {
    id: 'coag',
    short: 'PT/INR',
    name: T('Coagulation screen (PT, INR, aPTT)', 'پشکنینی مەیین (PT، INR، aPTT)', 'فحص التخثر (PT، INR، aPTT)'),
    container: T('Citrate tube (light blue top)', 'بۆریی سیترات (سەرپۆشی شینی کاڵ)', 'أنبوب سترات (غطاء أزرق فاتح)'),
    match: ['clotting', 'Coagulation'],
  },
  {
    id: 'hba1c',
    short: 'HbA1c',
    name: T('Glycated haemoglobin', 'هیمۆگلۆبینی شەکرەدار', 'الهيموغلوبين السكري'),
    container: T('EDTA tube (purple top)', 'بۆریی EDTA (سەرپۆشی مۆر)', 'أنبوب EDTA (غطاء بنفسجي)'),
    match: ['HbA1c'],
  },
];

export type CollectionId = 'round' | 'now' | 'tomorrow';

export const COLLECTION: Readonly<Record<CollectionId, Text3>> = {
  round: T('Next phlebotomy round (10:00)', 'گەڕی داهاتووی وەرگرتنی خوێن (10:00)', 'جولة سحب الدم التالية (10:00)'),
  now: T('Now, at the bedside', 'ئێستا، لە لای جێگە', 'الآن، عند السرير'),
  tomorrow: T('Tomorrow 06:00', 'بەیانی کاتژمێر 06:00', 'غداً الساعة 06:00'),
};

export interface ImagingStudy {
  readonly id: string;
  readonly name: Text3;
  readonly short: string;
  readonly radiation: boolean;
  readonly contrast: boolean;
  /** A chest X-ray that needs the patient moved to the department. */
  readonly departmental: boolean;
}

export const IMAGING_STUDIES: readonly ImagingStudy[] = [
  { id: 'cxr-pa', short: 'CXR PA', name: T('Chest X-ray, PA view', 'تیشکی سنگ، ڕووی PA', 'أشعة صدر، وضعية PA'), radiation: true, contrast: false, departmental: true },
  { id: 'cxr-ap', short: 'CXR AP', name: T('Chest X-ray, portable AP (on the ward)', 'تیشکی سنگ، گەڕۆک AP (لە قاوش)', 'أشعة صدر محمولة AP (في الردهة)'), radiation: true, contrast: false, departmental: false },
  { id: 'us-abd', short: 'US', name: T('Ultrasound, abdomen', 'سۆنەری سک', 'تصوير بالموجات فوق الصوتية للبطن'), radiation: false, contrast: false, departmental: true },
  { id: 'ct-head', short: 'CT', name: T('CT head without contrast', 'CT-ی سەر بەبێ کۆنتراست', 'تصوير مقطعي للرأس بدون تباين'), radiation: true, contrast: false, departmental: true },
  { id: 'ct-abd', short: 'CT+C', name: T('CT abdomen and pelvis with contrast', 'CT-ی سک و حەوز لەگەڵ کۆنتراست', 'تصوير مقطعي للبطن والحوض مع تباين'), radiation: true, contrast: true, departmental: true },
];

export type PregnancyId = 'no' | 'possible' | 'yes' | 'na';

// ---------------------------------------------------------------------------------------------------------
// Order sets
// ---------------------------------------------------------------------------------------------------------

export type SetItem =
  | {
      readonly kind: 'medication';
      readonly drugId: string;
      readonly dose: string;
      readonly route: RouteId;
      readonly frequency: FrequencyId;
      readonly duration: DurationId;
      readonly optional?: boolean;
    }
  | { readonly kind: 'lab'; readonly testId: string; readonly optional?: boolean }
  | { readonly kind: 'imaging'; readonly studyId: string; readonly optional?: boolean };

export interface OrderSet {
  readonly id: string;
  readonly name: Text3;
  readonly description: Text3;
  readonly indication: Text3;
  readonly priority: OrderPriority;
  readonly items: readonly SetItem[];
}

export const ORDER_SETS: readonly OrderSet[] = [
  {
    id: 'cap-adult',
    name: T('Community-acquired pneumonia, adult', 'هەوکردنی سیی کۆمەڵگە، گەورەساڵ', 'التهاب رئوي مكتسب من المجتمع، بالغ'),
    description: T(
      'CURB-65 score 0 to 2: oral antibiotic, cultures, inflammatory markers and a chest X-ray.',
      'نمرەی CURB-65 لە 0 بۆ 2: دژەبەکتریای دەم، چاندن، نیشانەکانی هەوکردن و تیشکی سنگ.',
      'درجة CURB-65 من 0 إلى 2: مضاد حيوي فموي، زرع، مؤشرات الالتهاب وأشعة صدر.',
    ),
    indication: T('Community-acquired pneumonia', 'هەوکردنی سیی کۆمەڵگە', 'التهاب رئوي مكتسب من المجتمع'),
    priority: 'urgent',
    items: [
      { kind: 'medication', drugId: 'amoxicillin', dose: '1 g', route: 'po', frequency: 'q8h', duration: 'd5' },
      { kind: 'medication', drugId: 'ceftriaxone', dose: '2 g', route: 'iv', frequency: 'daily', duration: 'd5', optional: true },
      { kind: 'medication', drugId: 'paracetamol', dose: '1 g', route: 'po', frequency: 'q6h-prn', duration: 'd3' },
      { kind: 'medication', drugId: 'enoxaparin', dose: '40 mg', route: 'sc', frequency: 'daily', duration: 'review' },
      { kind: 'lab', testId: 'cbc' },
      { kind: 'lab', testId: 'ue' },
      { kind: 'lab', testId: 'crp' },
      { kind: 'lab', testId: 'cultures' },
      { kind: 'imaging', studyId: 'cxr-pa' },
    ],
  },
  {
    id: 'postop-adult',
    name: T('Post-operative pain and nausea, adult', 'ئازار و دڵتێکهەڵهاتنی دوای نەشتەرگەری، گەورەساڵ', 'الألم والغثيان بعد العملية، بالغ'),
    description: T(
      'Regular paracetamol, morphine if needed, an antiemetic and thrombosis prevention.',
      'پاراسیتامۆلی بەردەوام، مۆرفین ئەگەر پێویست بوو، دژەڕشانەوە و ڕێگری لە مەیینی خوێن.',
      'باراسيتامول منتظم، مورفين عند الحاجة، مضاد للقيء والوقاية من الخثار.',
    ),
    indication: T('Post-operative pain', 'ئازاری دوای نەشتەرگەری', 'ألم ما بعد العملية'),
    priority: 'routine',
    items: [
      { kind: 'medication', drugId: 'paracetamol', dose: '1 g', route: 'iv', frequency: 'q6h', duration: 'd3' },
      { kind: 'medication', drugId: 'morphine', dose: '2 mg', route: 'iv', frequency: 'q4h-prn', duration: 'd3' },
      { kind: 'medication', drugId: 'ondansetron', dose: '4 mg', route: 'iv', frequency: 'q8h-prn', duration: 'd3' },
      { kind: 'medication', drugId: 'enoxaparin', dose: '40 mg', route: 'sc', frequency: 'daily', duration: 'review' },
      { kind: 'lab', testId: 'cbc', optional: true },
    ],
  },
  {
    id: 'sepsis-hour1',
    name: T('Suspected sepsis, first hour', 'گومانی سێپسیس، کاتژمێری یەکەم', 'اشتباه إنتان، الساعة الأولى'),
    description: T(
      'Cultures before antibiotics, bloods, a broad-spectrum antibiotic within the hour.',
      'چاندن پێش دژەبەکتریا، پشکنینی خوێن، دژەبەکتریایەکی فراوان لە ماوەی کاتژمێرێکدا.',
      'زرع قبل المضاد الحيوي، تحاليل دم، ومضاد حيوي واسع الطيف خلال ساعة.',
    ),
    indication: T('Suspected sepsis', 'گومانی سێپسیس', 'اشتباه إنتان'),
    priority: 'stat',
    items: [
      { kind: 'lab', testId: 'cultures' },
      { kind: 'lab', testId: 'cbc' },
      { kind: 'lab', testId: 'ue' },
      { kind: 'lab', testId: 'crp' },
      { kind: 'lab', testId: 'coag', optional: true },
      { kind: 'medication', drugId: 'ceftriaxone', dose: '2 g', route: 'iv', frequency: 'once', duration: 'single' },
      { kind: 'medication', drugId: 'paracetamol', dose: '1 g', route: 'iv', frequency: 'once', duration: 'single' },
      { kind: 'imaging', studyId: 'cxr-ap', optional: true },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------------------------------------

export interface Reason {
  readonly id: string;
  readonly text: Text3;
}

export const OVERRIDE_REASONS: readonly Reason[] = [
  { id: 'tolerated', text: T('Tolerated this medicine before (documented)', 'پێشتر ئەم دەرمانەی بەرگە گرتووە (تۆمارکراوە)', 'تحمّل هذا الدواء سابقاً (موثّق)') },
  { id: 'record-wrong', text: T('Allergy record is wrong (correction requested)', 'تۆماری هەستیارییەکە هەڵەیە (داوای ڕاستکردنەوە کراوە)', 'سجل الحساسية خاطئ (طُلب التصحيح)') },
  { id: 'desensitisation', text: T('Desensitisation under specialist supervision', 'بێهەستکردن بە سەرپەرشتیی پسپۆڕ', 'إزالة التحسس تحت إشراف اختصاصي') },
  { id: 'no-alternative', text: T('No suitable alternative; benefit outweighs risk', 'هیچ جێگرەوەیەکی گونجاو نییە؛ سوود لە مەترسی زیاترە', 'لا بديل مناسب؛ الفائدة تفوق الخطر') },
];

export const HOLD_REASONS: readonly Reason[] = [
  { id: 'result', text: T('Abnormal result (for example potassium)', 'ئەنجامی نائاسایی (بۆ نموونە پۆتاسیۆم)', 'نتيجة غير طبيعية (مثل البوتاسيوم)') },
  { id: 'procedure', text: T('Procedure or theatre today', 'پرۆسە یان نەشتەرگەری ئەمڕۆ', 'إجراء أو عملية اليوم') },
  { id: 'nil-by-mouth', text: T('Nil by mouth', 'هیچ شتێک لە ڕێگەی دەمەوە نا', 'لا شيء عن طريق الفم') },
  { id: 'side-effect', text: T('Suspected side effect', 'گومانی کاریگەریی لاوەکی', 'اشتباه بأثر جانبي') },
];

export const DISCONTINUE_REASONS: readonly Reason[] = [
  { id: 'course-complete', text: T('Course complete', 'خولی چارەسەر تەواو بوو', 'اكتمل العلاج') },
  { id: 'adverse', text: T('Adverse reaction', 'کاردانەوەی خراپ', 'تفاعل ضار') },
  { id: 'switch', text: T('Changed to another medicine or route', 'گۆڕدرا بۆ دەرمان یان ڕێگایەکی تر', 'تغيّر إلى دواء أو طريق آخر') },
  { id: 'allergy', text: T('Allergy conflict', 'ناکۆکی لەگەڵ هەستیاری', 'تعارض مع الحساسية') },
  { id: 'error', text: T('Entered in error', 'بە هەڵە تۆمارکرا', 'أُدخل خطأً') },
];
