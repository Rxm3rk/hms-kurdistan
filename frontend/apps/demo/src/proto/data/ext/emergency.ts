/**
 * Emergency department: the configured triage scale, today's tracking board, the time-critical pathway clocks
 * (stroke, STEMI, sepsis) and the medico-legal case (MLC) register with police-notification times.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Times are on the demo day (Monday 19 October 2026, now 09:30).
 */
import { getPatient, todayAt, daysAgoAt } from '../index.ts';
import type { Patient, Text3, Tone } from '../types.ts';
import { extPatient, unknownName } from './care-people.ts';

// ---------------------------------------------------------------------------------------------------------
// Triage scale (one scale in use; the administrator chooses which)
// ---------------------------------------------------------------------------------------------------------

export type TriageLevel = 1 | 2 | 3 | 4 | 5;
export type TriageScaleId = 'mts' | 'esi';

export interface TriageCategory {
  readonly level: TriageLevel;
  readonly name: Text3;
  /** Colour name as staff say it (red, orange…). */
  readonly colour: Text3;
  /** Target minutes from arrival to first doctor contact. */
  readonly targetMin: number;
}

export interface TriageScale {
  readonly id: TriageScaleId;
  readonly name: Text3;
  readonly categories: readonly TriageCategory[];
}

const COLOUR = {
  red: { en: 'Red', ckb: 'سوور', ar: 'أحمر' },
  orange: { en: 'Orange', ckb: 'پرتەقاڵی', ar: 'برتقالي' },
  yellow: { en: 'Yellow', ckb: 'زەرد', ar: 'أصفر' },
  green: { en: 'Green', ckb: 'سەوز', ar: 'أخضر' },
  blue: { en: 'Blue', ckb: 'شین', ar: 'أزرق' },
} as const satisfies Record<string, Text3>;

export const TRIAGE_SCALES: Readonly<Record<TriageScaleId, TriageScale>> = {
  mts: {
    id: 'mts',
    name: { en: 'Manchester-style 5-level scale', ckb: 'پێوەری 5 ئاستیی شێوەی مانچستەر', ar: 'مقياس من 5 مستويات على نمط مانشستر' },
    categories: [
      { level: 1, name: { en: 'Immediate', ckb: 'دەستبەجێ', ar: 'فوري' }, colour: COLOUR.red, targetMin: 0 },
      { level: 2, name: { en: 'Very urgent', ckb: 'زۆر بەپەلە', ar: 'عاجل جداً' }, colour: COLOUR.orange, targetMin: 10 },
      { level: 3, name: { en: 'Urgent', ckb: 'بەپەلە', ar: 'عاجل' }, colour: COLOUR.yellow, targetMin: 60 },
      { level: 4, name: { en: 'Standard', ckb: 'ئاسایی', ar: 'قياسي' }, colour: COLOUR.green, targetMin: 120 },
      { level: 5, name: { en: 'Non-urgent', ckb: 'ناپەلە', ar: 'غير عاجل' }, colour: COLOUR.blue, targetMin: 240 },
    ],
  },
  esi: {
    id: 'esi',
    name: { en: 'ESI-style 5-level scale', ckb: 'پێوەری 5 ئاستیی شێوەی ESI', ar: 'مقياس من 5 مستويات على نمط ESI' },
    categories: [
      { level: 1, name: { en: 'Resuscitation', ckb: 'زیندووکردنەوە', ar: 'إنعاش' }, colour: COLOUR.red, targetMin: 0 },
      { level: 2, name: { en: 'Emergent', ckb: 'فریاکەوتن', ar: 'طارئ' }, colour: COLOUR.orange, targetMin: 15 },
      { level: 3, name: { en: 'Urgent', ckb: 'بەپەلە', ar: 'عاجل' }, colour: COLOUR.yellow, targetMin: 30 },
      { level: 4, name: { en: 'Less urgent', ckb: 'کەمتر بەپەلە', ar: 'أقل إلحاحاً' }, colour: COLOUR.green, targetMin: 60 },
      { level: 5, name: { en: 'Non-urgent', ckb: 'ناپەلە', ar: 'غير عاجل' }, colour: COLOUR.blue, targetMin: 120 },
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------
// Tracking board
// ---------------------------------------------------------------------------------------------------------

export type EdArea = 'resus' | 'majors' | 'minors' | 'paeds' | 'waiting';
export type EdStatus = 'awaiting-triage' | 'awaiting-doctor' | 'in-assessment' | 'awaiting-results' | 'awaiting-bed' | 'ready-discharge';
export type ArrivalMode = 'walk-in' | 'ambulance' | 'police' | 'referral' | 'private-car';
export type PathwayKind = 'stroke' | 'stemi' | 'sepsis';

export interface EdVitals {
  readonly hr: string;
  readonly sys: string;
  readonly dia: string;
  readonly rr: string;
  readonly spo2: string;
  readonly temp: string;
  readonly gcs: string;
}

export interface EdRow {
  readonly id: string;
  readonly patient: Patient;
  /** True for patients registered without a confirmed identity. */
  readonly unknownIdentity: boolean;
  readonly arrivalIso: string;
  readonly mode: ArrivalMode;
  readonly complaint: Text3;
  /** null: not yet triaged. */
  readonly triage: TriageLevel | null;
  readonly triageIso: string | null;
  readonly seenIso: string | null;
  readonly area: EdArea;
  /** Bay or cubicle label: `R1`, `M4`. */
  readonly bay: string | null;
  readonly status: EdStatus;
  readonly doctorId: string | null;
  readonly nurseId: string | null;
  readonly pathways: readonly PathwayKind[];
  readonly mlcId: string | null;
  readonly vitals: EdVitals | null;
}

const P = (n: number, sex: 'male' | 'female', age: number): Patient => extPatient(100 + n, { sex, age });

const C = {
  chestPain: { en: 'Central chest pain, sweating', ckb: 'ئازاری ناوەڕاستی سنگ، ئارەقکردنەوە', ar: 'ألم صدري مركزي مع تعرق' },
  weakness: { en: 'Sudden right-sided weakness, slurred speech', ckb: 'لاوازیی لەناکاوی لای ڕاست، قسەکردنی تێکچوو', ar: 'ضعف مفاجئ في الجانب الأيمن مع تلعثم الكلام' },
  fever: { en: 'Fever, confusion, low blood pressure', ckb: 'تا، شڵەژان، پەستانی نزم', ar: 'حمى وتشوش وانخفاض ضغط الدم' },
  rta: { en: 'Road traffic collision, driver', ckb: 'ڕووداوی هاتوچۆ، شۆفێر', ar: 'حادث سير، السائق' },
  assault: { en: 'Assault, head laceration', ckb: 'دەستدرێژی، برینی سەر', ar: 'اعتداء، جرح في الرأس' },
  fall: { en: 'Fall from scaffolding, 4 metres', ckb: 'کەوتن لە سکافۆڵد، 4 مەتر', ar: 'سقوط من سقالة، 4 أمتار' },
  burn: { en: 'Kerosene heater burn, both hands', ckb: 'سووتان بە سۆبەی نەوت، هەردوو دەست', ar: 'حرق من مدفأة نفطية، كلتا اليدين' },
  poisoning: { en: 'Possible tablet overdose', ckb: 'ئەگەری خواردنی زۆری حەب', ar: 'احتمال جرعة زائدة من الأقراص' },
  asthma: { en: 'Wheeze and shortness of breath', ckb: 'فیکە و هەناسەتەنگی', ar: 'أزيز وضيق تنفس' },
  abdo: { en: 'Right lower abdominal pain', ckb: 'ئازاری خوارەوەی ڕاستی سک', ar: 'ألم أسفل البطن الأيمن' },
  ankle: { en: 'Twisted ankle playing football', ckb: 'پێ وەرگەڕان لە کاتی تۆپی پێ', ar: 'التواء الكاحل أثناء لعب كرة القدم' },
  childFever: { en: 'Child, fever 39 °C and vomiting', ckb: 'منداڵ، تای 39 پلە و ڕشانەوە', ar: 'طفل، حمى 39 درجة وتقيؤ' },
  colic: { en: 'Loin-to-groin pain, vomiting', ckb: 'ئازاری گورچیلە بۆ ناوگەڵ، ڕشانەوە', ar: 'ألم من الخاصرة إلى الأربية مع تقيؤ' },
  headache: { en: 'Headache for 2 days', ckb: 'سەرئێشە بۆ 2 ڕۆژ', ar: 'صداع منذ يومين' },
  hypo: { en: 'Diabetic, found drowsy', ckb: 'شەکرەیی، بە خەوالوویی دۆزرایەوە', ar: 'مريض سكري، وُجد نعساناً' },
  cut: { en: 'Kitchen knife cut, left hand', ckb: 'برینی چەقۆی چێشتخانە، دەستی چەپ', ar: 'جرح بسكين المطبخ، اليد اليسرى' },
  sob: { en: 'Breathless, swollen legs', ckb: 'هەناسەتەنگی، ئاوسانی قاچەکان', ar: 'ضيق تنفس وتورم الساقين' },
  dog: { en: 'Dog bite, right calf', ckb: 'گازی سەگ، پشتی قاچی ڕاست', ar: 'عضة كلب، ربلة الساق اليمنى' },
  gunshot: { en: 'Celebratory gunfire injury, shoulder', ckb: 'برینی تەقەی ئاهەنگ، شان', ar: 'إصابة بطلق ناري احتفالي، الكتف' },
} as const satisfies Record<string, Text3>;

const V = (hr: string, sys: string, dia: string, rr: string, spo2: string, temp: string, gcs = '15'): EdVitals => ({ hr, sys, dia, rr, spo2, temp, gcs });

const UNKNOWN_1 = { ...extPatient(150, { sex: 'male', age: 35, unknown: true }), name: { ...unknownName('ED-0419-07'), ownScript: 'latin' as const } };

export const ED_ROWS: readonly EdRow[] = [
  { id: 'ED-0419-01', patient: P(1, 'male', 58), unknownIdentity: false, arrivalIso: todayAt('08:52'), mode: 'ambulance', complaint: C.chestPain, triage: 2, triageIso: todayAt('08:55'), seenIso: todayAt('08:58'), area: 'resus', bay: 'R1', status: 'awaiting-results', doctorId: 'SYN-STF-017', nurseId: 'SYN-STF-015', pathways: ['stemi'], mlcId: null, vitals: V('104', '158', '94', '22', '94', '36.8') },
  { id: 'ED-0419-02', patient: P(2, 'female', 71), unknownIdentity: false, arrivalIso: todayAt('09:04'), mode: 'ambulance', complaint: C.weakness, triage: 1, triageIso: todayAt('09:05'), seenIso: todayAt('09:06'), area: 'resus', bay: 'R2', status: 'in-assessment', doctorId: 'SYN-STF-020', nurseId: 'SYN-STF-015', pathways: ['stroke'], mlcId: null, vitals: V('88', '182', '101', '18', '96', '36.6', '13') },
  { id: 'ED-0419-03', patient: P(3, 'male', 66), unknownIdentity: false, arrivalIso: todayAt('08:21'), mode: 'referral', complaint: C.fever, triage: 2, triageIso: todayAt('08:27'), seenIso: todayAt('08:36'), area: 'majors', bay: 'M2', status: 'awaiting-bed', doctorId: 'SYN-STF-008', nurseId: 'SYN-STF-019', pathways: ['sepsis'], mlcId: null, vitals: V('118', '86', '50', '26', '92', '39.2', '14') },
  { id: 'ED-0419-04', patient: P(4, 'male', 29), unknownIdentity: false, arrivalIso: todayAt('07:48'), mode: 'ambulance', complaint: C.rta, triage: 2, triageIso: todayAt('07:51'), seenIso: todayAt('07:58'), area: 'majors', bay: 'M1', status: 'awaiting-results', doctorId: 'SYN-STF-005', nurseId: 'SYN-STF-019', pathways: [], mlcId: 'MLC-2026-0412', vitals: V('96', '128', '80', '20', '98', '36.9') },
  { id: 'ED-0419-05', patient: P(5, 'male', 24), unknownIdentity: false, arrivalIso: todayAt('06:40'), mode: 'police', complaint: C.assault, triage: 3, triageIso: todayAt('06:52'), seenIso: todayAt('07:30'), area: 'minors', bay: 'N3', status: 'ready-discharge', doctorId: 'SYN-STF-020', nurseId: 'SYN-STF-010', pathways: [], mlcId: 'MLC-2026-0411', vitals: V('84', '132', '78', '16', '99', '36.7') },
  { id: 'ED-0419-06', patient: P(6, 'male', 41), unknownIdentity: false, arrivalIso: todayAt('08:05'), mode: 'ambulance', complaint: C.fall, triage: 2, triageIso: todayAt('08:08'), seenIso: todayAt('08:15'), area: 'resus', bay: 'R3', status: 'awaiting-bed', doctorId: 'SYN-STF-005', nurseId: 'SYN-STF-015', pathways: [], mlcId: 'MLC-2026-0413', vitals: V('110', '104', '66', '24', '95', '36.4', '14') },
  { id: 'ED-0419-07', patient: UNKNOWN_1, unknownIdentity: true, arrivalIso: todayAt('09:12'), mode: 'ambulance', complaint: C.poisoning, triage: 2, triageIso: todayAt('09:14'), seenIso: null, area: 'majors', bay: 'M4', status: 'awaiting-doctor', doctorId: null, nurseId: 'SYN-STF-019', pathways: [], mlcId: 'MLC-2026-0414', vitals: V('58', '96', '60', '10', '91', '35.9', '9') },
  { id: 'ED-0419-08', patient: P(8, 'female', 9), unknownIdentity: false, arrivalIso: todayAt('08:44'), mode: 'walk-in', complaint: C.childFever, triage: 3, triageIso: todayAt('08:56'), seenIso: null, area: 'paeds', bay: 'P1', status: 'awaiting-doctor', doctorId: null, nurseId: 'SYN-STF-010', pathways: [], mlcId: null, vitals: V('132', '98', '60', '28', '97', '39.1') },
  { id: 'ED-0419-09', patient: P(9, 'female', 34), unknownIdentity: false, arrivalIso: todayAt('08:30'), mode: 'private-car', complaint: C.colic, triage: 3, triageIso: todayAt('08:41'), seenIso: todayAt('09:02'), area: 'majors', bay: 'M3', status: 'awaiting-results', doctorId: 'SYN-STF-008', nurseId: 'SYN-STF-019', pathways: [], mlcId: null, vitals: V('92', '138', '84', '18', '99', '37.1') },
  { id: 'ED-0419-10', patient: P(10, 'male', 19), unknownIdentity: false, arrivalIso: todayAt('08:10'), mode: 'walk-in', complaint: C.ankle, triage: 4, triageIso: todayAt('08:25'), seenIso: null, area: 'waiting', bay: null, status: 'awaiting-doctor', doctorId: null, nurseId: null, pathways: [], mlcId: null, vitals: V('76', '124', '76', '14', '99', '36.6') },
  { id: 'ED-0419-11', patient: P(11, 'female', 47), unknownIdentity: false, arrivalIso: todayAt('07:55'), mode: 'walk-in', complaint: C.headache, triage: 4, triageIso: todayAt('08:12'), seenIso: null, area: 'waiting', bay: null, status: 'awaiting-doctor', doctorId: null, nurseId: null, pathways: [], mlcId: null, vitals: V('80', '146', '92', '16', '98', '36.8') },
  { id: 'ED-0419-12', patient: P(12, 'male', 36), unknownIdentity: false, arrivalIso: todayAt('09:20'), mode: 'walk-in', complaint: C.cut, triage: null, triageIso: null, seenIso: null, area: 'waiting', bay: null, status: 'awaiting-triage', doctorId: null, nurseId: null, pathways: [], mlcId: null, vitals: null },
  { id: 'ED-0419-13', patient: P(13, 'female', 62), unknownIdentity: false, arrivalIso: todayAt('09:24'), mode: 'private-car', complaint: C.sob, triage: null, triageIso: null, seenIso: null, area: 'waiting', bay: null, status: 'awaiting-triage', doctorId: null, nurseId: null, pathways: [], mlcId: null, vitals: null },
  { id: 'ED-0419-14', patient: P(14, 'male', 6), unknownIdentity: false, arrivalIso: todayAt('07:20'), mode: 'walk-in', complaint: C.asthma, triage: 2, triageIso: todayAt('07:24'), seenIso: todayAt('07:31'), area: 'paeds', bay: 'P2', status: 'in-assessment', doctorId: 'SYN-STF-006', nurseId: 'SYN-STF-010', pathways: [], mlcId: null, vitals: V('146', '102', '64', '38', '91', '37.4') },
  { id: 'ED-0419-15', patient: P(15, 'female', 23), unknownIdentity: false, arrivalIso: todayAt('06:15'), mode: 'walk-in', complaint: C.abdo, triage: 3, triageIso: todayAt('06:24'), seenIso: todayAt('06:58'), area: 'majors', bay: 'M5', status: 'awaiting-bed', doctorId: 'SYN-STF-005', nurseId: 'SYN-STF-019', pathways: [], mlcId: null, vitals: V('102', '118', '74', '18', '99', '38.0') },
  { id: 'ED-0419-16', patient: P(16, 'female', 54), unknownIdentity: false, arrivalIso: todayAt('08:58'), mode: 'ambulance', complaint: C.hypo, triage: 2, triageIso: todayAt('09:00'), seenIso: todayAt('09:04'), area: 'majors', bay: 'M6', status: 'in-assessment', doctorId: 'SYN-STF-008', nurseId: 'SYN-STF-015', pathways: [], mlcId: null, vitals: V('98', '134', '82', '18', '97', '36.5', '13') },
  { id: 'ED-0419-17', patient: P(17, 'male', 31), unknownIdentity: false, arrivalIso: todayAt('05:40'), mode: 'police', complaint: C.gunshot, triage: 2, triageIso: todayAt('05:42'), seenIso: todayAt('05:48'), area: 'resus', bay: 'R4', status: 'awaiting-bed', doctorId: 'SYN-STF-005', nurseId: 'SYN-STF-015', pathways: [], mlcId: 'MLC-2026-0410', vitals: V('112', '108', '70', '22', '97', '36.6') },
  { id: 'ED-0419-18', patient: P(18, 'female', 12), unknownIdentity: false, arrivalIso: todayAt('08:35'), mode: 'walk-in', complaint: C.dog, triage: 4, triageIso: todayAt('08:47'), seenIso: todayAt('09:15'), area: 'minors', bay: 'N1', status: 'in-assessment', doctorId: 'SYN-STF-006', nurseId: 'SYN-STF-010', pathways: [], mlcId: null, vitals: V('94', '110', '68', '18', '99', '36.8') },
  { id: 'ED-0419-19', patient: P(19, 'male', 44), unknownIdentity: false, arrivalIso: todayAt('07:05'), mode: 'walk-in', complaint: C.burn, triage: 3, triageIso: todayAt('07:13'), seenIso: todayAt('07:40'), area: 'minors', bay: 'N2', status: 'ready-discharge', doctorId: 'SYN-STF-020', nurseId: 'SYN-STF-010', pathways: [], mlcId: null, vitals: V('88', '130', '82', '16', '99', '36.7') },
  { id: 'ED-0419-20', patient: getPatient('SYN-PAT-0114'), unknownIdentity: false, arrivalIso: todayAt('08:02'), mode: 'walk-in', complaint: C.abdo, triage: 5, triageIso: todayAt('08:20'), seenIso: null, area: 'waiting', bay: null, status: 'awaiting-doctor', doctorId: null, nurseId: null, pathways: [], mlcId: null, vitals: V('78', '122', '78', '14', '99', '36.9') },
];

export const AREA_LABEL: Readonly<Record<EdArea, Text3>> = {
  resus: { en: 'Resuscitation', ckb: 'زیندووکردنەوە', ar: 'الإنعاش' },
  majors: { en: 'Majors', ckb: 'حاڵەتە گەورەکان', ar: 'الحالات الكبرى' },
  minors: { en: 'Minors', ckb: 'حاڵەتە بچووکەکان', ar: 'الحالات البسيطة' },
  paeds: { en: 'Paediatric ED', ckb: 'فریاکەوتنی منداڵان', ar: 'طوارئ الأطفال' },
  waiting: { en: 'Waiting room', ckb: 'هۆڵی چاوەڕوانی', ar: 'صالة الانتظار' },
};

export const ED_STATUS_LABEL: Readonly<Record<EdStatus, Text3>> = {
  'awaiting-triage': { en: 'Awaiting triage', ckb: 'چاوەڕێی پۆلێنکردن', ar: 'بانتظار الفرز' },
  'awaiting-doctor': { en: 'Awaiting doctor', ckb: 'چاوەڕێی پزیشک', ar: 'بانتظار الطبيب' },
  'in-assessment': { en: 'In assessment', ckb: 'لە هەڵسەنگاندندا', ar: 'قيد التقييم' },
  'awaiting-results': { en: 'Awaiting results', ckb: 'چاوەڕێی ئەنجام', ar: 'بانتظار النتائج' },
  'awaiting-bed': { en: 'Awaiting bed', ckb: 'چاوەڕێی جێگە', ar: 'بانتظار سرير' },
  'ready-discharge': { en: 'Ready to go home', ckb: 'ئامادەی ڕۆیشتنەوە', ar: 'جاهز للخروج' },
};

export const ED_STATUS_TONE: Readonly<Record<EdStatus, Tone>> = {
  'awaiting-triage': 'warning',
  'awaiting-doctor': 'warning',
  'in-assessment': 'info',
  'awaiting-results': 'info',
  'awaiting-bed': 'accent',
  'ready-discharge': 'success',
};

export const MODE_LABEL: Readonly<Record<ArrivalMode, Text3>> = {
  'walk-in': { en: 'Walk-in', ckb: 'بە پێ', ar: 'حضور ذاتي' },
  ambulance: { en: 'Ambulance', ckb: 'ئەمبولانس', ar: 'إسعاف' },
  police: { en: 'Brought by police', ckb: 'پۆلیس هێنای', ar: 'أحضرته الشرطة' },
  referral: { en: 'Referred', ckb: 'ڕەوانەکراو', ar: 'محال' },
  'private-car': { en: 'Private car', ckb: 'ئۆتۆمبێلی تایبەت', ar: 'سيارة خاصة' },
};

// ---------------------------------------------------------------------------------------------------------
// Pathway clocks
// ---------------------------------------------------------------------------------------------------------

export interface PathwayStepDef {
  readonly id: string;
  readonly label: Text3;
  /** Target minutes from the pathway start. */
  readonly targetMin: number;
}

export const PATHWAY_DEFS: Readonly<Record<PathwayKind, { readonly name: Text3; readonly steps: readonly PathwayStepDef[] }>> = {
  stroke: {
    name: { en: 'Stroke (code stroke)', ckb: 'جەڵتەی مێشک (کۆدی جەڵتە)', ar: 'السكتة الدماغية (رمز السكتة)' },
    steps: [
      { id: 'team', label: { en: 'Stroke team alerted', ckb: 'تیمی جەڵتە ئاگادارکرا', ar: 'تنبيه فريق السكتة' }, targetMin: 10 },
      { id: 'ct', label: { en: 'Door to CT', ckb: 'لە دەرگاوە بۆ CT', ar: 'من الباب إلى التصوير المقطعي' }, targetMin: 25 },
      { id: 'ct-read', label: { en: 'CT reported', ckb: 'ڕاپۆرتی CT', ar: 'تقرير التصوير المقطعي' }, targetMin: 45 },
      { id: 'needle', label: { en: 'Door to needle (thrombolysis)', ckb: 'لە دەرگاوە بۆ دەرزی (تواندنەوەی خوێنی مەیو)', ar: 'من الباب إلى الإبرة (إذابة الخثرة)' }, targetMin: 60 },
    ],
  },
  stemi: {
    name: { en: 'STEMI (heart attack)', ckb: 'STEMI (جەڵتەی دڵ)', ar: 'STEMI (احتشاء عضلة القلب)' },
    steps: [
      { id: 'ecg', label: { en: 'Door to ECG', ckb: 'لە دەرگاوە بۆ ECG', ar: 'من الباب إلى تخطيط القلب' }, targetMin: 10 },
      { id: 'aspirin', label: { en: 'Aspirin and ticagrelor given', ckb: 'ئەسپرین و تیکاگرێلۆر درا', ar: 'إعطاء الأسبرين والتيكاغريلور' }, targetMin: 20 },
      { id: 'cathlab', label: { en: 'Cath lab activated', ckb: 'تاقیگەی کاتەتەر چالاککرا', ar: 'تفعيل مختبر القسطرة' }, targetMin: 30 },
      { id: 'balloon', label: { en: 'Door to balloon', ckb: 'لە دەرگاوە بۆ باڵۆن', ar: 'من الباب إلى البالون' }, targetMin: 90 },
    ],
  },
  sepsis: {
    name: { en: 'Sepsis six', ckb: 'شەشەکەی سێپسیس', ar: 'سداسية الإنتان' },
    steps: [
      { id: 'cultures', label: { en: 'Blood cultures taken', ckb: 'نموونەی خوێن بۆ چاندن وەرگیرا', ar: 'أخذ مزارع الدم' }, targetMin: 30 },
      { id: 'lactate', label: { en: 'Lactate measured', ckb: 'لاکتەیت پێورا', ar: 'قياس اللاكتات' }, targetMin: 30 },
      { id: 'antibiotics', label: { en: 'IV antibiotics given', ckb: 'دژەبەکتریای ناو دەمار درا', ar: 'إعطاء المضادات الحيوية وريدياً' }, targetMin: 60 },
      { id: 'fluids', label: { en: 'IV fluids started', ckb: 'شلەی ناو دەمار دەستیپێکرد', ar: 'بدء السوائل الوريدية' }, targetMin: 60 },
      { id: 'oxygen', label: { en: 'Oxygen to target', ckb: 'ئۆکسجین بۆ ئامانج', ar: 'الأكسجين حتى الهدف' }, targetMin: 60 },
      { id: 'urine', label: { en: 'Urine output monitored', ckb: 'چاودێریی میز', ar: 'مراقبة إخراج البول' }, targetMin: 60 },
    ],
  },
};

export interface PathwayClock {
  readonly id: string;
  readonly edId: string;
  readonly kind: PathwayKind;
  readonly startIso: string;
  /** Step id to the time it was done. */
  readonly done: Readonly<Record<string, string>>;
}

export const PATHWAY_CLOCKS: readonly PathwayClock[] = [
  { id: 'PW-1', edId: 'ED-0419-02', kind: 'stroke', startIso: todayAt('09:04'), done: { team: todayAt('09:07'), ct: todayAt('09:24') } },
  { id: 'PW-2', edId: 'ED-0419-01', kind: 'stemi', startIso: todayAt('08:52'), done: { ecg: todayAt('08:58'), aspirin: todayAt('09:03'), cathlab: todayAt('09:15') } },
  { id: 'PW-3', edId: 'ED-0419-03', kind: 'sepsis', startIso: todayAt('08:27'), done: { cultures: todayAt('08:44'), lactate: todayAt('08:46'), oxygen: todayAt('08:40'), fluids: todayAt('08:58') } },
];

// ---------------------------------------------------------------------------------------------------------
// Medico-legal cases
// ---------------------------------------------------------------------------------------------------------

export type MlcType = 'rta' | 'assault' | 'fall' | 'burn' | 'poisoning' | 'firearm' | 'domestic';
export type MlcStatus = 'pending' | 'notified' | 'attended' | 'report-issued';

export interface MlcCase {
  readonly id: string;
  readonly edId: string | null;
  readonly patient: Patient;
  readonly type: MlcType;
  readonly arrivalIso: string;
  readonly station: Text3 | null;
  readonly notifiedIso: string | null;
  readonly notifiedById: string | null;
  readonly officer: string | null;
  readonly policeRef: string | null;
  readonly status: MlcStatus;
}

export const POLICE_STATIONS: readonly Text3[] = [
  { en: 'Erbil Central Police Station', ckb: 'بنکەی پۆلیسی ناوەندی هەولێر', ar: 'مركز شرطة أربيل المركزي' },
  { en: 'Erbil Traffic Police', ckb: 'پۆلیسی هاتوچۆی هەولێر', ar: 'شرطة مرور أربيل' },
  { en: 'Ankawa Police Station', ckb: 'بنکەی پۆلیسی عەنکاوە', ar: 'مركز شرطة عنكاوا' },
  { en: 'Family Violence Directorate, Erbil', ckb: 'بەڕێوەبەرایەتیی بەرەنگاربوونەوەی توندوتیژی خێزانی، هەولێر', ar: 'مديرية مناهضة العنف الأسري، أربيل' },
];

export const MLC_TYPE_LABEL: Readonly<Record<MlcType, Text3>> = {
  rta: { en: 'Road traffic collision', ckb: 'ڕووداوی هاتوچۆ', ar: 'حادث مروري' },
  assault: { en: 'Assault', ckb: 'دەستدرێژی', ar: 'اعتداء' },
  fall: { en: 'Fall at work', ckb: 'کەوتن لە کار', ar: 'سقوط أثناء العمل' },
  burn: { en: 'Burn', ckb: 'سووتان', ar: 'حرق' },
  poisoning: { en: 'Poisoning or overdose', ckb: 'ژەهراویبوون یان زیادەڕۆیی دەرمان', ar: 'تسمم أو جرعة زائدة' },
  firearm: { en: 'Firearm injury', ckb: 'برینی چەک', ar: 'إصابة بسلاح ناري' },
  domestic: { en: 'Domestic violence', ckb: 'توندوتیژیی خێزانی', ar: 'عنف أسري' },
};

export const MLC_STATUS_LABEL: Readonly<Record<MlcStatus, Text3>> = {
  pending: { en: 'Police not yet notified', ckb: 'پۆلیس هێشتا ئاگادار نەکراوە', ar: 'لم تُبلَّغ الشرطة بعد' },
  notified: { en: 'Police notified', ckb: 'پۆلیس ئاگادارکرا', ar: 'أُبلغت الشرطة' },
  attended: { en: 'Police attended', ckb: 'پۆلیس ئامادە بوو', ar: 'حضرت الشرطة' },
  'report-issued': { en: 'Medico-legal report issued', ckb: 'ڕاپۆرتی پزیشکی-یاسایی دەرچوو', ar: 'صدر التقرير الطبي العدلي' },
};

export const MLC_STATUS_TONE: Readonly<Record<MlcStatus, Tone>> = {
  pending: 'danger',
  notified: 'warning',
  attended: 'info',
  'report-issued': 'success',
};

const rowById = (id: string): EdRow => ED_ROWS.find((row) => row.id === id) ?? ED_ROWS[0]!;

export const MLC_CASES: readonly MlcCase[] = [
  { id: 'MLC-2026-0414', edId: 'ED-0419-07', patient: rowById('ED-0419-07').patient, type: 'poisoning', arrivalIso: todayAt('09:12'), station: null, notifiedIso: null, notifiedById: null, officer: null, policeRef: null, status: 'pending' },
  { id: 'MLC-2026-0413', edId: 'ED-0419-06', patient: rowById('ED-0419-06').patient, type: 'fall', arrivalIso: todayAt('08:05'), station: POLICE_STATIONS[0]!, notifiedIso: todayAt('08:31'), notifiedById: 'SYN-STF-015', officer: 'Lt. Karwan Salih', policeRef: 'EPS/26/7731', status: 'notified' },
  { id: 'MLC-2026-0412', edId: 'ED-0419-04', patient: rowById('ED-0419-04').patient, type: 'rta', arrivalIso: todayAt('07:48'), station: POLICE_STATIONS[1]!, notifiedIso: todayAt('07:56'), notifiedById: 'SYN-STF-019', officer: 'Sgt. Hersh Kamal', policeRef: 'ETP/26/2210', status: 'attended' },
  { id: 'MLC-2026-0411', edId: 'ED-0419-05', patient: rowById('ED-0419-05').patient, type: 'assault', arrivalIso: todayAt('06:40'), station: POLICE_STATIONS[0]!, notifiedIso: todayAt('06:40'), notifiedById: 'SYN-STF-010', officer: 'Lt. Shakhawan Rasul', policeRef: 'EPS/26/7728', status: 'attended' },
  { id: 'MLC-2026-0410', edId: 'ED-0419-17', patient: rowById('ED-0419-17').patient, type: 'firearm', arrivalIso: todayAt('05:40'), station: POLICE_STATIONS[2]!, notifiedIso: todayAt('05:44'), notifiedById: 'SYN-STF-015', officer: 'Capt. Dler Hamad', policeRef: 'APS/26/0915', status: 'attended' },
  { id: 'MLC-2026-0409', edId: null, patient: extPatient(131, { sex: 'female', age: 33 }), type: 'domestic', arrivalIso: daysAgoAt(1, '22:15'), station: POLICE_STATIONS[3]!, notifiedIso: daysAgoAt(1, '23:40'), notifiedById: 'SYN-STF-019', officer: 'Lt. Nask Omer', policeRef: 'FVD/26/0388', status: 'report-issued' },
  { id: 'MLC-2026-0408', edId: null, patient: extPatient(132, { sex: 'male', age: 52 }), type: 'rta', arrivalIso: daysAgoAt(1, '17:05'), station: POLICE_STATIONS[1]!, notifiedIso: daysAgoAt(1, '17:12'), notifiedById: 'SYN-STF-015', officer: 'Sgt. Hersh Kamal', policeRef: 'ETP/26/2204', status: 'report-issued' },
  { id: 'MLC-2026-0407', edId: null, patient: extPatient(133, { sex: 'male', age: 17 }), type: 'assault', arrivalIso: daysAgoAt(1, '14:30'), station: POLICE_STATIONS[0]!, notifiedIso: daysAgoAt(1, '14:52'), notifiedById: 'SYN-STF-010', officer: 'Lt. Karwan Salih', policeRef: 'EPS/26/7702', status: 'report-issued' },
  { id: 'MLC-2026-0406', edId: null, patient: extPatient(134, { sex: 'female', age: 4 }), type: 'burn', arrivalIso: daysAgoAt(2, '19:20'), station: POLICE_STATIONS[0]!, notifiedIso: daysAgoAt(2, '21:05'), notifiedById: 'SYN-STF-019', officer: 'Lt. Shakhawan Rasul', policeRef: 'EPS/26/7680', status: 'attended' },
  { id: 'MLC-2026-0405', edId: null, patient: extPatient(135, { sex: 'male', age: 27 }), type: 'firearm', arrivalIso: daysAgoAt(3, '01:10'), station: POLICE_STATIONS[2]!, notifiedIso: daysAgoAt(3, '01:13'), notifiedById: 'SYN-STF-015', officer: 'Capt. Dler Hamad', policeRef: 'APS/26/0902', status: 'report-issued' },
  { id: 'MLC-2026-0404', edId: null, patient: extPatient(136, { sex: 'female', age: 19 }), type: 'poisoning', arrivalIso: daysAgoAt(3, '16:45'), station: POLICE_STATIONS[0]!, notifiedIso: daysAgoAt(3, '17:20'), notifiedById: 'SYN-STF-010', officer: 'Lt. Nask Omer', policeRef: 'EPS/26/7641', status: 'report-issued' },
  { id: 'MLC-2026-0403', edId: null, patient: extPatient(137, { sex: 'male', age: 45 }), type: 'fall', arrivalIso: daysAgoAt(4, '11:30'), station: POLICE_STATIONS[0]!, notifiedIso: daysAgoAt(4, '11:58'), notifiedById: 'SYN-STF-019', officer: 'Lt. Karwan Salih', policeRef: 'EPS/26/7620', status: 'report-issued' },
];

/** The ED's doctors and nurses for assignment. */
export const ED_DOCTORS: readonly string[] = ['SYN-STF-020', 'SYN-STF-008', 'SYN-STF-005', 'SYN-STF-017', 'SYN-STF-006'];
