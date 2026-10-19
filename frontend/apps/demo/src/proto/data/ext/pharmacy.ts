/**
 * Pharmacy: the inpatient verification queue, look-alike sound-alike (LASA) pairs in tall-man lettering,
 * regional brands mapped to generics, the outpatient retail counter and the narcotics register.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Drug names, strengths and units are Latin script; every brand
 * and manufacturer name is invented.
 */
import { daysAgoAt, todayAt } from '../clock.ts';
import type { OrderPriority, RouteId, Text3, Tone } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

// ---------------------------------------------------------------------------------------------------------
// Tall-man lettering and LASA pairs
// ---------------------------------------------------------------------------------------------------------

/** Generic name (lower case) to its tall-man form. */
export const TALL_MAN: Readonly<Record<string, string>> = {
  hydralazine: 'hydrALAZINE',
  hydroxyzine: 'hydrOXYzine',
  dopamine: 'DOPamine',
  dobutamine: 'DOBUTamine',
  prednisolone: 'prednisoLONE',
  prednisone: 'predniSONE',
  ceftriaxone: 'cefTRIAXone',
  cefotaxime: 'cefOTAXime',
  nifedipine: 'NIFEdipine',
  nicardipine: 'niCARdipine',
  glipizide: 'glipiZIDE',
  glyburide: 'glyBURIDE',
  tramadol: 'traMADol',
  trazodone: 'traZODone',
  metformin: 'metFORMIN',
  metronidazole: 'metroNIDAZOLE',
  insulin: 'insulin',
  'insulin glargine': 'insulin glargine',
  'insulin aspart': 'insulin aspart',
};

export function tallMan(drug: string): string {
  return TALL_MAN[drug.toLowerCase()] ?? drug;
}

export interface LasaPair {
  readonly a: string;
  readonly b: string;
  readonly risk: Text3;
}

export const LASA_PAIRS: readonly LasaPair[] = [
  { a: 'hydralazine', b: 'hydroxyzine', risk: T('Antihypertensive vs antihistamine', 'دژە پەستانی خوێن بەرامبەر دژە هیستامین', 'خافض ضغط مقابل مضاد هيستامين') },
  { a: 'dopamine', b: 'dobutamine', risk: T('Both vasoactive infusions; different doses', 'هەردووکیان تکاندنی ڤازۆئەکتیڤ؛ ژەمی جیاواز', 'كلاهما تسريب فعال وعائياً؛ جرعات مختلفة') },
  { a: 'prednisolone', b: 'prednisone', risk: T('Different strengths in stock', 'هێزی جیاواز لە کۆگادا', 'تراكيز مختلفة في المخزون') },
  { a: 'ceftriaxone', b: 'cefotaxime', risk: T('Different dosing intervals', 'ماوەی جیاوازی ژەم', 'فواصل جرعات مختلفة') },
  { a: 'nifedipine', b: 'nicardipine', risk: T('Oral vs IV calcium-channel blocker', 'دەمی بەرامبەر ناو دەمار', 'فموي مقابل وريدي') },
  { a: 'tramadol', b: 'trazodone', risk: T('Opioid vs antidepressant', 'ئۆپیۆید بەرامبەر دژە خەمۆکی', 'أفيوني مقابل مضاد اكتئاب') },
  { a: 'metformin', b: 'metronidazole', risk: T('Shelved side by side in the main store', 'لە کۆگای سەرەکی تەنیشت یەکن', 'متجاوران على الرف في المخزن الرئيسي') },
  { a: 'glipizide', b: 'glyburide', risk: T('Both sulfonylureas; hypoglycaemia risk', 'هەردووکیان سەلفۆنیل یوریا؛ مەترسیی دابەزینی شەکر', 'كلاهما سلفونيل يوريا؛ خطر نقص السكر') },
];

/** The LASA partner of a drug, if it has one. */
export function lasaPartner(drug: string): LasaPair | undefined {
  const key = drug.toLowerCase();
  return LASA_PAIRS.find((pair) => pair.a === key || pair.b === key);
}

// ---------------------------------------------------------------------------------------------------------
// Inpatient verification queue
// ---------------------------------------------------------------------------------------------------------

export type RxStatus = 'pending' | 'clarify' | 'verified' | 'dispensed';

export interface RxAlert {
  readonly tone: Tone;
  readonly text: Text3;
}

export interface RxItem {
  readonly id: string;
  readonly patientId: string;
  readonly drug: string;
  readonly dose: string;
  readonly doseUnit: string;
  readonly route: RouteId;
  readonly frequency: Text3;
  readonly durationDays: number | null;
  readonly priority: OrderPriority;
  readonly highAlert: boolean;
  readonly orderedById: string;
  readonly orderedIso: string;
  readonly status: RxStatus;
  readonly alerts: readonly RxAlert[];
}

const ONCE = T('Once now', 'یەک جار ئێستا', 'مرة واحدة الآن');
const BD = T('Twice daily', 'ڕۆژانە دوو جار', 'مرتين يومياً');
const TDS = T('Three times daily', 'ڕۆژانە سێ جار', 'ثلاث مرات يومياً');
const OD = T('Once daily', 'ڕۆژانە یەک جار', 'مرة يومياً');
const Q8H = T('Every 8 hours', 'هەر 8 کاتژمێر جارێک', 'كل 8 ساعات');
const CONT = T('Continuous infusion', 'تکاندنی بەردەوام', 'تسريب مستمر');
const PRN = T('As needed, max 4 doses a day', 'بەپێی پێویست، زۆرترین 4 ژەم لە ڕۆژێکدا', 'عند الحاجة، 4 جرعات يومياً كحد أقصى');

function rx(
  id: string,
  patientId: string,
  drug: string,
  dose: string,
  doseUnit: string,
  route: RouteId,
  frequency: Text3,
  priority: OrderPriority,
  highAlert: boolean,
  orderedById: string,
  orderedIso: string,
  status: RxStatus,
  alerts: readonly RxAlert[] = [],
  durationDays: number | null = null,
): RxItem {
  return { id, patientId, drug, dose, doseUnit, route, frequency, durationDays, priority, highAlert, orderedById, orderedIso, status, alerts };
}

export const RX_QUEUE: readonly RxItem[] = [
  rx('RX-26-8801', 'SYN-PAT-0102', 'calcium gluconate 10%', '10', 'mL', 'iv', ONCE, 'stat', true, 'SYN-STF-005', todayAt('08:12'), 'dispensed', [
    { tone: 'danger', text: T('Potassium 6.8 mmol/L: hyperkalaemia protocol', 'پۆتاسیۆم 6.8: پرۆتۆکۆلی زیادبوونی پۆتاسیۆم', 'بوتاسيوم 6.8: بروتوكول فرط البوتاسيوم') },
  ]),
  rx('RX-26-8802', 'SYN-PAT-0102', 'insulin', '10', 'U', 'iv', ONCE, 'stat', true, 'SYN-STF-005', todayAt('08:12'), 'verified', [
    { tone: 'warning', text: T('Give with 50 mL glucose 50%; check glucose hourly', 'لەگەڵ 50 mL گلوکۆزی 50% بدرێت؛ هەر کاتژمێرێک گلوکۆز بپشکنە', 'يُعطى مع 50 mL غلوكوز 50%؛ افحص السكر كل ساعة') },
  ]),
  rx('RX-26-8803', 'SYN-PAT-0110', 'alteplase', '63', 'mg', 'iv-infusion', CONT, 'stat', true, 'SYN-STF-016', todayAt('09:24'), 'pending', [
    { tone: 'warning', text: T('Stroke thrombolysis: weight 70 kg, 0.9 mg/kg; await CT result', 'تێکشکاندنی تەڵە: کێش 70 kg؛ چاوەڕێی ئەنجامی CT', 'إذابة الخثرة: الوزن 70 كغ؛ بانتظار نتيجة المفراس') },
  ]),
  rx('RX-26-8804', 'SYN-PAT-0109', 'noradrenaline', '0.1', 'ug/kg/min', 'iv-infusion', CONT, 'stat', true, 'SYN-STF-007', todayAt('09:05'), 'pending', [
    { tone: 'info', text: T('Central line only; double-strength 8 mg in 50 mL', 'تەنها هێڵی ناوەندی؛ 8 mg لە 50 mL', 'خط مركزي فقط؛ 8 ملغ في 50 مل') },
  ]),
  rx('RX-26-8805', 'SYN-PAT-0105', 'ceftriaxone', '2', 'g', 'iv', OD, 'urgent', false, 'SYN-STF-005', todayAt('08:45'), 'pending', [
    { tone: 'warning', text: T('LASA: cefOTAXime is shelved next to it', 'LASA: cefOTAXime لە تەنیشتیەتی', 'LASA: cefOTAXime بجانبه على الرف') },
  ], 7),
  rx('RX-26-8806', 'SYN-PAT-0107', 'morphine', '2.5', 'mg', 'iv', PRN, 'urgent', true, 'SYN-STF-008', todayAt('07:50'), 'pending', [
    { tone: 'info', text: T('Controlled drug: register entry and witness on issue', 'دەرمانی کۆنترۆڵکراو: تۆمار و شایەت لە کاتی دابەشکردن', 'دواء مراقب: قيد في السجل وشاهد عند الصرف') },
  ]),
  rx('RX-26-8807', 'SYN-PAT-0106', 'enoxaparin', '40', 'mg', 'sc', OD, 'routine', true, 'SYN-STF-008', todayAt('07:20'), 'pending', [
    { tone: 'warning', text: T('Creatinine clearance 28 mL/min: consider 20 mg', 'پاکژکردنی کریاتینین 28: بیر لە 20 mg بکەوە', 'تصفية الكرياتينين 28: فكّر في 20 ملغ') },
  ]),
  rx('RX-26-8808', 'SYN-PAT-0101', 'amoxicillin-clavulanate', '1.2', 'g', 'iv', Q8H, 'routine', false, 'SYN-STF-005', todayAt('07:10'), 'clarify', [
    { tone: 'danger', text: T('Penicillin allergy recorded: confirm with the prescriber', 'هەستیاری بە پەنسیلین تۆمارکراوە: لەگەڵ پزیشک پشتڕاستی بکەوە', 'حساسية بنسلين مسجلة: تحقق مع الطبيب') },
  ]),
  rx('RX-26-8809', 'SYN-PAT-0104', 'paracetamol', '15', 'mg/kg', 'po', T('Every 6 hours', 'هەر 6 کاتژمێر جارێک', 'كل 6 ساعات'), 'routine', false, 'SYN-STF-006', todayAt('06:55'), 'pending', [], 3),
  rx('RX-26-8810', 'SYN-PAT-0112', 'hydralazine', '10', 'mg', 'iv', ONCE, 'urgent', false, 'SYN-STF-017', todayAt('09:15'), 'pending', [
    { tone: 'warning', text: T('LASA: not hydrOXYzine', 'LASA: hydrOXYzine نییە', 'LASA: ليس hydrOXYzine') },
  ]),
  rx('RX-26-8811', 'SYN-PAT-0211', 'metformin', '500', 'mg', 'po', BD, 'routine', false, 'SYN-STF-020', todayAt('06:40'), 'pending', [], 30),
  rx('RX-26-8812', 'SYN-PAT-0229', 'potassium chloride', '20', 'mmol', 'iv-infusion', T('Over 4 hours', 'لە ماوەی 4 کاتژمێردا', 'خلال 4 ساعات'), 'urgent', true, 'SYN-STF-007', todayAt('08:58'), 'pending', [
    { tone: 'danger', text: T('Concentrated electrolyte: premixed bag only', 'ئەلیکترۆلایتی چڕ: تەنها کیسەی ئامادەکراو', 'كهارل مركزة: كيس جاهز فقط') },
  ]),
  rx('RX-26-8813', 'SYN-PAT-0215', 'tramadol', '50', 'mg', 'po', PRN, 'routine', false, 'SYN-STF-008', todayAt('08:05'), 'verified', [], 3),
  rx('RX-26-8814', 'SYN-PAT-0203', 'prednisolone', '40', 'mg', 'po', OD, 'routine', false, 'SYN-STF-005', todayAt('07:35'), 'pending', [], 5),
  rx('RX-26-8815', 'SYN-PAT-0222', 'ceftriaxone', '80', 'mg/kg', 'iv', OD, 'urgent', false, 'SYN-STF-006', todayAt('03:10'), 'dispensed', [], 5),
  rx('RX-26-8816', 'SYN-PAT-0227', 'heparin', '1000', 'U', 'iv-infusion', T('Per hour, aPTT-guided', 'هەر کاتژمێرێک، بەپێی aPTT', 'كل ساعة، حسب aPTT'), 'urgent', true, 'SYN-STF-007', todayAt('09:00'), 'pending', [
    { tone: 'warning', text: T('Two-person check of pump rate', 'پشکنینی دوو کەسی بۆ خێرایی پەمپ', 'تحقق شخصين من سرعة المضخة') },
  ]),
  rx('RX-26-8817', 'SYN-PAT-0213', 'metronidazole', '500', 'mg', 'iv', Q8H, 'routine', false, 'SYN-STF-008', todayAt('08:30'), 'pending', [
    { tone: 'warning', text: T('LASA: not metFORMIN', 'LASA: metFORMIN نییە', 'LASA: ليس metFORMIN') },
  ], 5),
  rx('RX-26-8818', 'SYN-PAT-0108', 'nifedipine', '30', 'mg', 'po', OD, 'routine', false, 'SYN-STF-016', daysAgoAt(0, '06:20'), 'verified', [], null),
];

// ---------------------------------------------------------------------------------------------------------
// Regional brands mapped to generics (brand and maker names invented)
// ---------------------------------------------------------------------------------------------------------

export interface BrandEntry {
  readonly brand: string;
  readonly maker: string;
  readonly origin: Text3;
  readonly priceIqd: number;
  readonly onFormulary: boolean;
}

export interface GenericEntry {
  readonly generic: string;
  readonly strength: string;
  readonly form: Text3;
  readonly atc: string;
  readonly brands: readonly BrandEntry[];
}

const KRI = T('Kurdistan Region', 'هەرێمی کوردستان', 'إقليم كوردستان');
const IRAQ = T('Iraq', 'عێراق', 'العراق');
const JORDAN = T('Jordan', 'ئوردن', 'الأردن');
const TURKEY = T('Türkiye', 'تورکیا', 'تركيا');
const IRAN = T('Iran', 'ئێران', 'إيران');
const INDIA = T('India', 'هیندستان', 'الهند');
const EU = T('European Union', 'یەکێتیی ئەورووپا', 'الاتحاد الأوروبي');
const TAB = T('Tablet', 'حەب', 'قرص');
const CAP = T('Capsule', 'کەپسوول', 'كبسولة');
const VIAL = T('Vial', 'ڤایل', 'قارورة');
const SYRUP = T('Syrup', 'شروب', 'شراب');

export const GENERICS: readonly GenericEntry[] = [
  {
    generic: 'paracetamol',
    strength: '500 mg',
    form: TAB,
    atc: 'N02BE01',
    brands: [
      { brand: 'Paramol-Z', maker: 'Zagros Pharma (synthetic)', origin: KRI, priceIqd: 1500, onFormulary: true },
      { brand: 'Fevanol', maker: 'Levant Generics (synthetic)', origin: JORDAN, priceIqd: 2000, onFormulary: true },
      { brand: 'Dolorex', maker: 'Anatolia Ilac (synthetic)', origin: TURKEY, priceIqd: 2500, onFormulary: false },
    ],
  },
  {
    generic: 'amoxicillin',
    strength: '500 mg',
    form: CAP,
    atc: 'J01CA04',
    brands: [
      { brand: 'Amoxa-H', maker: 'Hawler Pharmaceuticals (synthetic)', origin: KRI, priceIqd: 4000, onFormulary: true },
      { brand: 'Moxilin-S', maker: 'Samarra Drug Co. (synthetic)', origin: IRAQ, priceIqd: 3500, onFormulary: true },
      { brand: 'Amocare', maker: 'Deccan Lifesciences (synthetic)', origin: INDIA, priceIqd: 3000, onFormulary: false },
    ],
  },
  {
    generic: 'amoxicillin-clavulanate',
    strength: '625 mg',
    form: TAB,
    atc: 'J01CR02',
    brands: [
      { brand: 'Clavomox', maker: 'Levant Generics (synthetic)', origin: JORDAN, priceIqd: 9500, onFormulary: true },
      { brand: 'Augmantin-K', maker: 'Zagros Pharma (synthetic)', origin: KRI, priceIqd: 8000, onFormulary: true },
    ],
  },
  {
    generic: 'metformin',
    strength: '500 mg',
    form: TAB,
    atc: 'A10BA02',
    brands: [
      { brand: 'Glucomet-D', maker: 'Duhok Medica (synthetic)', origin: KRI, priceIqd: 3000, onFormulary: true },
      { brand: 'Metfora', maker: 'Anatolia Ilac (synthetic)', origin: TURKEY, priceIqd: 4500, onFormulary: true },
    ],
  },
  {
    generic: 'omeprazole',
    strength: '20 mg',
    form: CAP,
    atc: 'A02BC01',
    brands: [
      { brand: 'Gastrozol', maker: 'Hawler Pharmaceuticals (synthetic)', origin: KRI, priceIqd: 3500, onFormulary: true },
      { brand: 'Omepra-T', maker: 'Tabriz Darou (synthetic)', origin: IRAN, priceIqd: 2500, onFormulary: false },
    ],
  },
  {
    generic: 'atorvastatin',
    strength: '20 mg',
    form: TAB,
    atc: 'C10AA05',
    brands: [
      { brand: 'Lipitas', maker: 'Levant Generics (synthetic)', origin: JORDAN, priceIqd: 7000, onFormulary: true },
      { brand: 'Atorvo-Z', maker: 'Zagros Pharma (synthetic)', origin: KRI, priceIqd: 5500, onFormulary: true },
      { brand: 'Cardiostat', maker: 'Rhein Pharma (synthetic)', origin: EU, priceIqd: 14000, onFormulary: false },
    ],
  },
  {
    generic: 'ceftriaxone',
    strength: '1 g',
    form: VIAL,
    atc: 'J01DD04',
    brands: [
      { brand: 'Triaxon-S', maker: 'Samarra Drug Co. (synthetic)', origin: IRAQ, priceIqd: 3000, onFormulary: true },
      { brand: 'Cefaxin', maker: 'Anatolia Ilac (synthetic)', origin: TURKEY, priceIqd: 4500, onFormulary: true },
    ],
  },
  {
    generic: 'amlodipine',
    strength: '5 mg',
    form: TAB,
    atc: 'C08CA01',
    brands: [
      { brand: 'Amlopress', maker: 'Duhok Medica (synthetic)', origin: KRI, priceIqd: 2500, onFormulary: true },
      { brand: 'Norvadip', maker: 'Rhein Pharma (synthetic)', origin: EU, priceIqd: 9000, onFormulary: false },
    ],
  },
  {
    generic: 'ibuprofen',
    strength: '100 mg/5 mL',
    form: SYRUP,
    atc: 'M01AE01',
    brands: [
      { brand: 'Brufenol Kids', maker: 'Levant Generics (synthetic)', origin: JORDAN, priceIqd: 3500, onFormulary: true },
      { brand: 'Ibukid-H', maker: 'Hawler Pharmaceuticals (synthetic)', origin: KRI, priceIqd: 2750, onFormulary: true },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// Outpatient retail counter
// ---------------------------------------------------------------------------------------------------------

export interface RetailProduct {
  readonly id: string;
  readonly brand: string;
  readonly generic: string;
  readonly pack: string;
  readonly priceIqd: number;
  readonly stock: number;
  readonly rxOnly: boolean;
}

export const RETAIL_PRODUCTS: readonly RetailProduct[] = [
  { id: 'P-001', brand: 'Paramol-Z', generic: 'paracetamol', pack: '500 mg × 20 tab', priceIqd: 1500, stock: 340, rxOnly: false },
  { id: 'P-002', brand: 'Fevanol', generic: 'paracetamol', pack: '500 mg × 24 tab', priceIqd: 2000, stock: 112, rxOnly: false },
  { id: 'P-003', brand: 'Amoxa-H', generic: 'amoxicillin', pack: '500 mg × 21 cap', priceIqd: 4000, stock: 86, rxOnly: true },
  { id: 'P-004', brand: 'Clavomox', generic: 'amoxicillin-clavulanate', pack: '625 mg × 14 tab', priceIqd: 9500, stock: 41, rxOnly: true },
  { id: 'P-005', brand: 'Glucomet-D', generic: 'metformin', pack: '500 mg × 60 tab', priceIqd: 3000, stock: 205, rxOnly: true },
  { id: 'P-006', brand: 'Gastrozol', generic: 'omeprazole', pack: '20 mg × 28 cap', priceIqd: 3500, stock: 150, rxOnly: false },
  { id: 'P-007', brand: 'Lipitas', generic: 'atorvastatin', pack: '20 mg × 30 tab', priceIqd: 7000, stock: 64, rxOnly: true },
  { id: 'P-008', brand: 'Amlopress', generic: 'amlodipine', pack: '5 mg × 30 tab', priceIqd: 2500, stock: 9, rxOnly: true },
  { id: 'P-009', brand: 'Brufenol Kids', generic: 'ibuprofen', pack: '100 mg/5 mL, 100 mL', priceIqd: 3500, stock: 58, rxOnly: false },
  { id: 'P-010', brand: 'ORS-Plus', generic: 'oral rehydration salts', pack: '10 sachets', priceIqd: 2000, stock: 97, rxOnly: false },
  { id: 'P-011', brand: 'Insulog Pen', generic: 'insulin glargine', pack: '100 U/mL, 5 × 3 mL', priceIqd: 52000, stock: 14, rxOnly: true },
  { id: 'P-012', brand: 'Salbu-Inh', generic: 'salbutamol', pack: '100 mcg, 200 doses', priceIqd: 6000, stock: 33, rxOnly: true },
];

/** Receipts of earlier sales today, for the counter's KPI. */
export const RETAIL_SALES_TODAY = { count: 37, iqd: 612_500, usd: 145 } as const;

// ---------------------------------------------------------------------------------------------------------
// Narcotics register
// ---------------------------------------------------------------------------------------------------------

export type NarcoticEntryType = 'receipt' | 'issue' | 'return' | 'waste' | 'count';

export interface NarcoticDrug {
  readonly id: string;
  readonly drug: string;
  readonly presentation: string;
  readonly schedule: string;
}

export const NARCOTIC_DRUGS: readonly NarcoticDrug[] = [
  { id: 'N-MOR', drug: 'morphine', presentation: '10 mg/1 mL ampoule', schedule: 'II' },
  { id: 'N-PET', drug: 'pethidine', presentation: '50 mg/1 mL ampoule', schedule: 'II' },
  { id: 'N-FEN', drug: 'fentanyl', presentation: '100 mcg/2 mL ampoule', schedule: 'II' },
  { id: 'N-MID', drug: 'midazolam', presentation: '5 mg/1 mL ampoule', schedule: 'IV' },
  { id: 'N-TRA', drug: 'tramadol', presentation: '100 mg/2 mL ampoule', schedule: 'IV' },
];

export interface NarcoticEntry {
  readonly id: string;
  readonly drugId: string;
  readonly iso: string;
  readonly type: NarcoticEntryType;
  /** Ampoules in (+) or out (−). */
  readonly qty: number;
  readonly balance: number;
  readonly patientId: string | null;
  readonly wardCode: string | null;
  readonly byId: string;
  readonly witnessId: string | null;
  readonly note: Text3 | null;
}

const PH = 'SYN-STF-012';

export const NARCOTIC_REGISTER: readonly NarcoticEntry[] = [
  { id: 'NR-5501', drugId: 'N-MOR', iso: daysAgoAt(1, '08:00'), type: 'count', qty: 0, balance: 40, patientId: null, wardCode: null, byId: PH, witnessId: 'SYN-STF-002', note: null },
  { id: 'NR-5502', drugId: 'N-MOR', iso: daysAgoAt(1, '14:20'), type: 'issue', qty: -5, balance: 35, patientId: null, wardCode: 'B', byId: PH, witnessId: 'SYN-STF-009', note: T('Ward B stock top-up', 'پڕکردنەوەی کۆگای قاوشی B', 'تعبئة مخزون ردهة B') },
  { id: 'NR-5503', drugId: 'N-FEN', iso: daysAgoAt(1, '16:05'), type: 'issue', qty: -10, balance: 20, patientId: null, wardCode: 'ICU', byId: PH, witnessId: 'SYN-STF-015', note: null },
  { id: 'NR-5504', drugId: 'N-MOR', iso: daysAgoAt(1, '21:40'), type: 'issue', qty: -2, balance: 33, patientId: 'SYN-PAT-0107', wardCode: 'B', byId: PH, witnessId: 'SYN-STF-009', note: null },
  { id: 'NR-5505', drugId: 'N-PET', iso: daysAgoAt(1, '23:15'), type: 'waste', qty: -1, balance: 14, patientId: 'SYN-PAT-0214', wardCode: 'B', byId: 'SYN-STF-019', witnessId: 'SYN-STF-009', note: T('Partial dose discarded: 25 mg wasted', 'بەشێک لە ژەم فڕێدرا: 25 mg', 'تُلف جزء من الجرعة: 25 ملغ') },
  { id: 'NR-5506', drugId: 'N-MOR', iso: todayAt('07:30'), type: 'receipt', qty: 20, balance: 53, patientId: null, wardCode: null, byId: PH, witnessId: 'SYN-STF-004', note: T('Delivery from the MOH-licensed importer, invoice SYN-INV-NAR-077', 'گەیاندن لە هاوردەکاری مۆڵەتدار لەلایەن وەزارەت', 'توريد من مستورد مرخص من وزارة الصحة') },
  { id: 'NR-5507', drugId: 'N-MID', iso: todayAt('08:15'), type: 'issue', qty: -5, balance: 25, patientId: null, wardCode: 'ICU', byId: PH, witnessId: 'SYN-STF-015', note: null },
  { id: 'NR-5508', drugId: 'N-TRA', iso: todayAt('08:40'), type: 'issue', qty: -3, balance: 47, patientId: 'SYN-PAT-0215', wardCode: 'B', byId: PH, witnessId: 'SYN-STF-009', note: null },
  { id: 'NR-5509', drugId: 'N-FEN', iso: todayAt('09:05'), type: 'return', qty: 2, balance: 22, patientId: null, wardCode: 'ICU', byId: 'SYN-STF-015', witnessId: PH, note: T('Unused ampoules returned, seals intact', 'ئەمپوولی بەکارنەهاتوو گەڕێندرایەوە', 'أُعيدت أمبولات غير مستخدمة') },
];

/** Expected balances now (the register's last balance per drug). */
export function expectedBalance(entries: readonly NarcoticEntry[], drugId: string): number {
  const last = entries.filter((entry) => entry.drugId === drugId).toSorted((a, b) => a.iso.localeCompare(b.iso)).at(-1);
  return last?.balance ?? 0;
}
