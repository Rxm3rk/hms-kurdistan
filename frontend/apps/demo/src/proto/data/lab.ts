/**
 * Laboratory specimens and results. SYNTHETIC DATA ONLY.
 *
 * The critical case: potassium 6.8 mmol/L for Gulala Osman Rashid (SYN-PAT-0102), specimen SYN-SPC-260001,
 * verified at 08:10 and NOT yet acknowledged by a clinician (`critical.acknowledged === false`).
 */
import { isAcknowledgedInSession } from './acknowledgements.ts';
import { daysAgoAt, todayAt } from './clock.ts';
import type { LabResult, ResultFlag, Specimen, Text3 } from './types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

const LAB = 'SYN-STF-011';
const N_GORAN = 'SYN-STF-010';
const N_HANA = 'SYN-STF-014';
const N_BAHAR = 'SYN-STF-009';
const N_ARI = 'SYN-STF-015';
const N_KARZAN = 'SYN-STF-019';

const SERUM = T('Blood (serum)', 'خوێن (سیرەم)', 'دم (مصل)');
const WHOLE_BLOOD = T('Blood (whole, EDTA)', 'خوێن (تەواو، EDTA)', 'دم كامل (EDTA)');
const ARTERIAL = T('Arterial blood', 'خوێنی شادەمار', 'دم شرياني');
const VENOUS = T('Venous blood', 'خوێنی دەمار', 'دم وريدي');

export const SPECIMENS: readonly Specimen[] = [
  {
    id: 'SYN-SPC-260001',
    patientId: 'SYN-PAT-0102',
    orderIds: ['SYN-ORD-0204'],
    panel: T('Renal profile', 'پرۆفایلی گورچیلە', 'وظائف الكلى'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'verified',
    collectedIso: todayAt('06:05'),
    collectedById: N_GORAN,
    receivedIso: todayAt('06:40'),
    resultedIso: todayAt('07:55'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260002',
    patientId: 'SYN-PAT-0101',
    orderIds: ['SYN-ORD-0106'],
    panel: T('Full blood count and CRP', 'پشکنینی تەواوی خوێن و CRP', 'تعداد دم كامل و CRP'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'verified',
    collectedIso: todayAt('06:00'),
    collectedById: N_GORAN,
    receivedIso: todayAt('06:40'),
    resultedIso: todayAt('07:30'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260003',
    patientId: 'SYN-PAT-0101',
    orderIds: ['SYN-ORD-0107'],
    panel: T('Blood cultures (2 sets)', 'چاندنی خوێن (2 کۆمەڵە)', 'زرع الدم (مجموعتان)'),
    specimenType: T('Blood (culture bottles)', 'خوێن (بوتڵی چاندن)', 'دم (قناني زرع)'),
    container: 'blood-culture',
    priority: 'urgent',
    status: 'in-progress',
    collectedIso: daysAgoAt(2, '10:50'),
    collectedById: N_GORAN,
    receivedIso: daysAgoAt(2, '11:30'),
    resultedIso: null,
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260004',
    patientId: 'SYN-PAT-0105',
    orderIds: ['SYN-ORD-0501'],
    panel: T('Sputum AFB and GeneXpert MTB/RIF', 'بەڵغەم AFB و GeneXpert MTB/RIF', 'القشع AFB و GeneXpert MTB/RIF'),
    specimenType: T('Sputum, early morning', 'بەڵغەمی بەیانیانی زوو', 'قشع صباحي مبكر'),
    container: 'sputum',
    priority: 'urgent',
    status: 'in-progress',
    collectedIso: todayAt('07:15'),
    collectedById: N_GORAN,
    receivedIso: todayAt('07:50'),
    resultedIso: null,
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260005',
    patientId: 'SYN-PAT-0103',
    orderIds: ['SYN-ORD-0302'],
    panel: T('Total serum bilirubin', 'کۆی بیلیڕووبینی خوێن', 'البيليروبين الكلي'),
    specimenType: T('Capillary blood (heel prick)', 'خوێنی موو (پاژنە)', 'دم شعري (وخز الكعب)'),
    container: 'capillary',
    priority: 'urgent',
    status: 'verified',
    collectedIso: todayAt('06:00'),
    collectedById: N_HANA,
    receivedIso: todayAt('06:20'),
    resultedIso: todayAt('07:05'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260006',
    patientId: 'SYN-PAT-0112',
    orderIds: ['SYN-ORD-1203'],
    panel: T('Venous blood gas, ketones, electrolytes', 'گازی خوێنی دەمار، کیتۆن، ئەلیکترۆلایت', 'غازات الدم الوريدي، الكيتونات، الأملاح'),
    specimenType: VENOUS,
    container: 'blood-gas',
    priority: 'urgent',
    status: 'resulted',
    collectedIso: todayAt('09:00'),
    collectedById: N_GORAN,
    receivedIso: todayAt('09:08'),
    resultedIso: todayAt('09:20'),
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260007',
    patientId: 'SYN-PAT-0108',
    orderIds: ['SYN-ORD-0801', 'SYN-ORD-0802'],
    panel: T('HbA1c, fasting glucose, lipids', 'HbA1c، شەکرەی بەرچایی، چەوری', 'HbA1c، سكر الصيام، الدهون'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'resulted',
    collectedIso: todayAt('08:50'),
    collectedById: 'SYN-STF-018',
    receivedIso: todayAt('09:00'),
    resultedIso: todayAt('09:25'),
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260008',
    patientId: 'SYN-PAT-0109',
    orderIds: ['SYN-ORD-0904'],
    panel: T('Arterial blood gas and lactate', 'گازی خوێنی شادەمار و لاکتەیت', 'غازات الدم الشرياني واللاكتات'),
    specimenType: ARTERIAL,
    container: 'blood-gas',
    priority: 'urgent',
    status: 'verified',
    collectedIso: todayAt('08:00'),
    collectedById: N_ARI,
    receivedIso: todayAt('08:05'),
    resultedIso: todayAt('08:12'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260009',
    patientId: 'SYN-PAT-0114',
    orderIds: ['SYN-ORD-1401'],
    panel: T('Pre-operative bloods', 'پشکنینی خوێنی پێش نەشتەرگەری', 'تحاليل ما قبل العملية'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'ordered',
    collectedIso: null,
    collectedById: null,
    receivedIso: null,
    resultedIso: null,
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260010',
    patientId: 'SYN-PAT-0104',
    orderIds: [],
    panel: T('Renal profile', 'پرۆفایلی گورچیلە', 'وظائف الكلى'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'urgent',
    status: 'verified',
    collectedIso: daysAgoAt(1, '22:00'),
    collectedById: N_HANA,
    receivedIso: daysAgoAt(1, '22:20'),
    resultedIso: daysAgoAt(1, '23:05'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260011',
    patientId: 'SYN-PAT-0110',
    orderIds: [],
    panel: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد دم كامل'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'urgent',
    status: 'verified',
    collectedIso: daysAgoAt(1, '23:10'),
    collectedById: N_BAHAR,
    receivedIso: daysAgoAt(1, '23:25'),
    resultedIso: daysAgoAt(1, '23:50'),
    verifiedById: LAB,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260012',
    patientId: 'SYN-PAT-0106',
    orderIds: [],
    panel: T('Full blood count (post-operative)', 'پشکنینی تەواوی خوێن (دوای نەشتەرگەری)', 'تعداد دم كامل (بعد العملية)'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'in-progress',
    collectedIso: todayAt('06:30'),
    collectedById: N_BAHAR,
    receivedIso: todayAt('07:00'),
    resultedIso: null,
    verifiedById: null,
    rejectionReason: null,
  },
  {
    id: 'SYN-SPC-260013',
    patientId: 'SYN-PAT-0201',
    orderIds: [],
    panel: T('Clotting screen (INR)', 'پشکنینی مەیین (INR)', 'فحص التخثر (INR)'),
    specimenType: T('Blood (citrate)', 'خوێن (سیترات)', 'دم (سترات)'),
    container: 'citrate',
    priority: 'routine',
    status: 'rejected',
    collectedIso: todayAt('05:50'),
    collectedById: N_KARZAN,
    receivedIso: todayAt('06:40'),
    resultedIso: null,
    verifiedById: LAB,
    rejectionReason: T('Under-filled tube: please collect again', 'بۆری کەم پڕکراوە: تکایە دووبارە وەربگرەوە', 'الأنبوب غير ممتلئ بما يكفي: يرجى إعادة السحب'),
  },
  {
    id: 'SYN-SPC-260014',
    patientId: 'SYN-PAT-0107',
    orderIds: [],
    panel: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد دم كامل'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'collected',
    collectedIso: todayAt('09:10'),
    collectedById: N_BAHAR,
    receivedIso: null,
    resultedIso: null,
    verifiedById: null,
    rejectionReason: null,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------------------

let resultSeq = 0;

interface ResultInput {
  readonly specimen: string;
  readonly analyte: Text3;
  readonly code: string;
  readonly value?: string;
  readonly unit?: string;
  readonly low?: string;
  readonly high?: string;
  readonly text?: Text3;
  readonly flag: ResultFlag;
  readonly at: string;
  readonly critical?: boolean;
  readonly history?: readonly (readonly [string, string])[];
}

function result(input: ResultInput): LabResult {
  resultSeq += 1;
  const specimen = SPECIMENS.find((candidate) => candidate.id === input.specimen);
  if (specimen === undefined) {
    throw new Error(`Result for unknown specimen ${input.specimen}`);
  }
  return {
    id: `SYN-RES-${String(resultSeq).padStart(4, '0')}`,
    specimenId: input.specimen,
    patientId: specimen.patientId,
    analyte: input.analyte,
    code: input.code,
    value: input.value ?? null,
    unit: input.unit ?? null,
    refLow: input.low ?? null,
    refHigh: input.high ?? null,
    text: input.text ?? null,
    flag: input.flag,
    resultedIso: input.at,
    critical: input.critical === true ? { acknowledged: false, acknowledgedById: null, acknowledgedIso: null } : null,
    history: (input.history ?? []).map(([iso, value]) => ({ iso, value })),
  };
}

const A = {
  sodium: T('Sodium', 'سۆدیۆم', 'الصوديوم'),
  potassium: T('Potassium', 'پۆتاسیۆم', 'البوتاسيوم'),
  urea: T('Urea', 'یووریا', 'اليوريا'),
  creatinine: T('Creatinine', 'کریاتینین', 'الكرياتينين'),
  egfr: T('eGFR', 'eGFR', 'eGFR'),
  bicarbonate: T('Bicarbonate', 'بایکاربۆنات', 'البيكربونات'),
  wbc: T('White cell count', 'ژمارەی خڕۆکە سپییەکان', 'عدد الكريات البيض'),
  neutrophils: T('Neutrophils', 'نیوترۆفیل', 'العدلات'),
  hb: T('Haemoglobin', 'هیمۆگلۆبین', 'الهيموغلوبين'),
  platelets: T('Platelets', 'پلێتلێت', 'الصفائح الدموية'),
  crp: T('C-reactive protein', 'پرۆتینی C-ی کاردانەوە', 'البروتين المتفاعل C'),
  bilirubin: T('Total bilirubin', 'کۆی بیلیڕووبین', 'البيليروبين الكلي'),
  ph: T('pH', 'pH', 'pH'),
  pco2: T('pCO2', 'pCO2', 'pCO2'),
  po2: T('pO2', 'pO2', 'pO2'),
  lactate: T('Lactate', 'لاکتەیت', 'اللاكتات'),
  glucose: T('Glucose', 'گلووکۆز', 'الغلوكوز'),
  ketones: T('Ketones (beta-hydroxybutyrate)', 'کیتۆن (بیتا-هایدرۆکسی بیوتیرەیت)', 'الكيتونات (بيتا هيدروكسي بيوتيرات)'),
  hba1c: T('HbA1c', 'HbA1c', 'HbA1c'),
  fastingGlucose: T('Fasting glucose', 'شەکرەی بەرچایی', 'سكر الصيام'),
  bloodCulture: T('Blood culture', 'چاندنی خوێن', 'زرع الدم'),
} as const;

export const RESULTS: readonly LabResult[] = [
  // Gulala: renal profile with the critical potassium
  result({ specimen: 'SYN-SPC-260001', analyte: A.sodium, code: 'SYN-LAB-NA', value: '134', unit: 'mmol/L', low: '135', high: '145', flag: 'low', at: todayAt('07:55'), history: [[daysAgoAt(2, '06:00'), '136'], [daysAgoAt(1, '06:00'), '135']] }),
  result({
    specimen: 'SYN-SPC-260001',
    analyte: A.potassium,
    code: 'SYN-LAB-K',
    value: '6.8',
    unit: 'mmol/L',
    low: '3.5',
    high: '5.1',
    flag: 'critical-high',
    at: todayAt('07:55'),
    critical: true,
    history: [[daysAgoAt(3, '06:00'), '5.2'], [daysAgoAt(2, '06:00'), '5.4'], [daysAgoAt(1, '06:00'), '5.9']],
  }),
  result({ specimen: 'SYN-SPC-260001', analyte: A.urea, code: 'SYN-LAB-UREA', value: '21.4', unit: 'mmol/L', low: '2.5', high: '7.8', flag: 'high', at: todayAt('07:55'), history: [[daysAgoAt(2, '06:00'), '17.9'], [daysAgoAt(1, '06:00'), '19.6']] }),
  result({ specimen: 'SYN-SPC-260001', analyte: A.creatinine, code: 'SYN-LAB-CREAT', value: '286', unit: 'umol/L', low: '45', high: '84', flag: 'high', at: todayAt('07:55'), history: [[daysAgoAt(3, '06:00'), '241'], [daysAgoAt(2, '06:00'), '255'], [daysAgoAt(1, '06:00'), '268']] }),
  result({ specimen: 'SYN-SPC-260001', analyte: A.egfr, code: 'SYN-LAB-EGFR', value: '13', unit: 'mL/min/{1.73_m2}', low: '60', flag: 'low', at: todayAt('07:55') }),
  result({ specimen: 'SYN-SPC-260001', analyte: A.bicarbonate, code: 'SYN-LAB-HCO3', value: '18', unit: 'mmol/L', low: '22', high: '29', flag: 'low', at: todayAt('07:55') }),

  // Karwan: blood count and CRP improving
  result({ specimen: 'SYN-SPC-260002', analyte: A.wbc, code: 'SYN-LAB-WBC', value: '15.8', unit: '10*9/L', low: '4.0', high: '11.0', flag: 'high', at: todayAt('07:30'), history: [[daysAgoAt(2, '11:00'), '18.2'], [daysAgoAt(1, '06:00'), '16.9']] }),
  result({ specimen: 'SYN-SPC-260002', analyte: A.neutrophils, code: 'SYN-LAB-NEUT', value: '12.9', unit: '10*9/L', low: '2.0', high: '7.5', flag: 'high', at: todayAt('07:30') }),
  result({ specimen: 'SYN-SPC-260002', analyte: A.hb, code: 'SYN-LAB-HB', value: '13.1', unit: 'g/dL', low: '13.0', high: '17.0', flag: 'normal', at: todayAt('07:30'), history: [[daysAgoAt(2, '11:00'), '13.6'], [daysAgoAt(1, '06:00'), '13.3']] }),
  result({ specimen: 'SYN-SPC-260002', analyte: A.platelets, code: 'SYN-LAB-PLT', value: '312', unit: '10*9/L', low: '150', high: '400', flag: 'normal', at: todayAt('07:30') }),
  result({ specimen: 'SYN-SPC-260002', analyte: A.crp, code: 'SYN-LAB-CRP', value: '142', unit: 'mg/L', high: '5', flag: 'high', at: todayAt('07:30'), history: [[daysAgoAt(2, '11:00'), '210'], [daysAgoAt(1, '06:00'), '176']] }),

  // Karwan: blood cultures, preliminary
  result({
    specimen: 'SYN-SPC-260003',
    analyte: A.bloodCulture,
    code: 'SYN-LAB-BCX',
    text: T('No growth at 48 hours (preliminary)', 'هیچ گەشەیەک نییە دوای 48 کاتژمێر (سەرەتایی)', 'لا نمو بعد 48 ساعة (أولي)'),
    flag: 'pending',
    at: todayAt('08:30'),
  }),

  // Baby girl of Shnyar: bilirubin
  result({ specimen: 'SYN-SPC-260005', analyte: A.bilirubin, code: 'SYN-LAB-TBIL', value: '248', unit: 'umol/L', high: '250', text: T('Phototherapy threshold for age: 250', 'سنووری چارەسەری ڕووناکی بۆ تەمەن: 250', 'عتبة العلاج الضوئي للعمر: 250'), flag: 'high', at: todayAt('07:05'), history: [[daysAgoAt(1, '18:00'), '196'], [daysAgoAt(1, '23:30'), '231']] }),

  // Hawre: DKA improving (resulted, not yet verified)
  result({ specimen: 'SYN-SPC-260006', analyte: A.ph, code: 'SYN-LAB-PH', value: '7.28', low: '7.35', high: '7.45', flag: 'low', at: todayAt('09:20'), history: [[daysAgoAt(1, '19:30'), '7.12'], [daysAgoAt(1, '23:00'), '7.19'], [todayAt('05:00'), '7.24']] }),
  result({ specimen: 'SYN-SPC-260006', analyte: A.bicarbonate, code: 'SYN-LAB-HCO3', value: '14', unit: 'mmol/L', low: '22', high: '29', flag: 'low', at: todayAt('09:20'), history: [[daysAgoAt(1, '19:30'), '8'], [todayAt('05:00'), '12']] }),
  result({ specimen: 'SYN-SPC-260006', analyte: A.glucose, code: 'SYN-LAB-GLU', value: '14.2', unit: 'mmol/L', low: '3.9', high: '7.8', flag: 'high', at: todayAt('09:20'), history: [[daysAgoAt(1, '19:30'), '28.6'], [daysAgoAt(1, '23:00'), '21.0'], [todayAt('05:00'), '17.5']] }),
  result({ specimen: 'SYN-SPC-260006', analyte: A.ketones, code: 'SYN-LAB-BHB', value: '2.1', unit: 'mmol/L', high: '0.6', flag: 'high', at: todayAt('09:20'), history: [[daysAgoAt(1, '19:30'), '6.4'], [todayAt('05:00'), '3.3']] }),
  result({ specimen: 'SYN-SPC-260006', analyte: A.potassium, code: 'SYN-LAB-K', value: '4.1', unit: 'mmol/L', low: '3.5', high: '5.1', flag: 'normal', at: todayAt('09:20'), history: [[daysAgoAt(1, '19:30'), '5.6'], [todayAt('05:00'), '4.4']] }),

  // Abdulrahman (outpatient): diabetes control
  result({ specimen: 'SYN-SPC-260007', analyte: A.hba1c, code: 'SYN-LAB-HBA1C', value: '9.1', unit: '%', low: '4.0', high: '5.6', flag: 'high', at: todayAt('09:25'), history: [['2025-10-20T09:00:00+03:00', '7.9'], ['2026-04-14T09:00:00+03:00', '8.4']] }),
  result({ specimen: 'SYN-SPC-260007', analyte: A.fastingGlucose, code: 'SYN-LAB-FBG', value: '11.3', unit: 'mmol/L', low: '3.9', high: '5.5', flag: 'high', at: todayAt('09:25') }),

  // Mohammed (ICU): blood gas
  result({ specimen: 'SYN-SPC-260008', analyte: A.ph, code: 'SYN-LAB-PH', value: '7.31', low: '7.35', high: '7.45', flag: 'low', at: todayAt('08:12'), history: [[daysAgoAt(1, '20:00'), '7.24'], [todayAt('02:00'), '7.28']] }),
  result({ specimen: 'SYN-SPC-260008', analyte: A.pco2, code: 'SYN-LAB-PCO2', value: '5.9', unit: 'kPa', low: '4.7', high: '6.0', flag: 'normal', at: todayAt('08:12') }),
  result({ specimen: 'SYN-SPC-260008', analyte: A.po2, code: 'SYN-LAB-PO2', value: '9.8', unit: 'kPa', low: '10.0', high: '13.3', flag: 'low', at: todayAt('08:12') }),
  result({ specimen: 'SYN-SPC-260008', analyte: A.lactate, code: 'SYN-LAB-LACT', value: '3.4', unit: 'mmol/L', high: '2.0', flag: 'high', at: todayAt('08:12'), history: [[daysAgoAt(2, '04:00'), '6.1'], [daysAgoAt(1, '20:00'), '4.6'], [todayAt('02:00'), '3.9']] }),

  // Rebin: renal profile on admission
  result({ specimen: 'SYN-SPC-260010', analyte: A.sodium, code: 'SYN-LAB-NA', value: '131', unit: 'mmol/L', low: '135', high: '145', flag: 'low', at: daysAgoAt(1, '23:05') }),
  result({ specimen: 'SYN-SPC-260010', analyte: A.potassium, code: 'SYN-LAB-K', value: '3.3', unit: 'mmol/L', low: '3.5', high: '5.1', flag: 'low', at: daysAgoAt(1, '23:05') }),
  result({ specimen: 'SYN-SPC-260010', analyte: A.urea, code: 'SYN-LAB-UREA', value: '7.9', unit: 'mmol/L', low: '2.5', high: '6.4', flag: 'high', at: daysAgoAt(1, '23:05') }),
  result({ specimen: 'SYN-SPC-260010', analyte: A.creatinine, code: 'SYN-LAB-CREAT', value: '48', unit: 'umol/L', low: '27', high: '62', flag: 'normal', at: daysAgoAt(1, '23:05') }),

  // Anna: blood count on admission
  result({ specimen: 'SYN-SPC-260011', analyte: A.wbc, code: 'SYN-LAB-WBC', value: '14.1', unit: '10*9/L', low: '4.0', high: '11.0', flag: 'high', at: daysAgoAt(1, '23:50') }),
  result({ specimen: 'SYN-SPC-260011', analyte: A.hb, code: 'SYN-LAB-HB', value: '12.4', unit: 'g/dL', low: '12.0', high: '15.5', flag: 'normal', at: daysAgoAt(1, '23:50') }),
  result({ specimen: 'SYN-SPC-260011', analyte: A.platelets, code: 'SYN-LAB-PLT', value: '268', unit: '10*9/L', low: '150', high: '400', flag: 'normal', at: daysAgoAt(1, '23:50') }),
];

/** One patient's specimens, newest first. */
export function specimensOf(patientId: string): readonly Specimen[] {
  return SPECIMENS.filter((specimen) => specimen.patientId === patientId).toSorted((a, b) =>
    (b.collectedIso ?? '9999').localeCompare(a.collectedIso ?? '9999'),
  );
}

/** One patient's results, newest first. */
export function resultsOf(patientId: string): readonly LabResult[] {
  return RESULTS.filter((candidate) => candidate.patientId === patientId).toSorted((a, b) =>
    b.resultedIso.localeCompare(a.resultedIso),
  );
}

/** The results of one specimen, in panel order. */
export function resultsOfSpecimen(specimenId: string): readonly LabResult[] {
  return RESULTS.filter((candidate) => candidate.specimenId === specimenId);
}

/** Critical results nobody has acknowledged yet (the hospital-wide worklist). */
export function unacknowledgedCriticals(): readonly LabResult[] {
  return RESULTS.filter(
    (candidate) => candidate.critical !== null && !candidate.critical.acknowledged && !isAcknowledgedInSession(candidate.id),
  );
}
