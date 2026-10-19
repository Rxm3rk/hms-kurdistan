/**
 * Hospital-wide laboratory worklist: accessions, analysers, quality control, critical-result calls and
 * turnaround times. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Test codes and units are Latin script.
 */
import { daysAgoAt, todayAt } from '../clock.ts';
import type { OrderPriority, PersonName, Text3 } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export type LabSection = 'haematology' | 'biochemistry' | 'microbiology';
export type AccessionStatus = 'awaiting-receipt' | 'received' | 'on-analyser' | 'resulted' | 'verified' | 'rejected';

/** Where a sample came from: a ward bed, a clinic, the emergency room or an outside doctor. */
export type SampleSource =
  | { readonly kind: 'ward'; readonly patientId: string }
  | { readonly kind: 'opd'; readonly patientId: string; readonly clinic: Text3 }
  | { readonly kind: 'er'; readonly patientId: string }
  | { readonly kind: 'external'; readonly patientId: string; readonly doctor: ExternalDoctor };

export interface ExternalDoctor {
  readonly name: PersonName;
  readonly clinic: Text3;
  readonly phone: string;
}

export interface LabTest {
  /** Latin test code: `K`, `CBC`, `TROP-I`. */
  readonly code: string;
  readonly name: Text3;
  readonly section: LabSection;
  /** Target turnaround, minutes, routine. */
  readonly tatRoutineMin: number;
  readonly tatStatMin: number;
}

export interface Accession {
  /** Barcode on the tube. */
  readonly id: string;
  readonly source: SampleSource;
  readonly tests: readonly string[];
  readonly section: LabSection;
  readonly priority: OrderPriority;
  readonly status: AccessionStatus;
  readonly collectedIso: string;
  readonly receivedIso: string | null;
  readonly analyserId: string | null;
  /** Ordering clinician (staff id) for in-house samples. */
  readonly orderedById: string | null;
  readonly critical: boolean;
  readonly note: Text3 | null;
}

export const LAB_TESTS: readonly LabTest[] = [
  { code: 'CBC', name: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد الدم الكامل'), section: 'haematology', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'ESR', name: T('Erythrocyte sedimentation rate', 'خێرایی نیشتنی خڕۆکە سوورەکان', 'سرعة ترسب الكريات'), section: 'haematology', tatRoutineMin: 90, tatStatMin: 60 },
  { code: 'PT-INR', name: T('Prothrombin time / INR', 'کاتی پرۆترۆمبین / INR', 'زمن البروثرومبين / INR'), section: 'haematology', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'APTT', name: T('Activated partial thromboplastin time', 'کاتی APTT', 'زمن الثرومبوبلاستين الجزئي'), section: 'haematology', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'K', name: T('Potassium', 'پۆتاسیۆم', 'البوتاسيوم'), section: 'biochemistry', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'NA', name: T('Sodium', 'سۆدیۆم', 'الصوديوم'), section: 'biochemistry', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'CREA', name: T('Creatinine', 'کریاتینین', 'الكرياتينين'), section: 'biochemistry', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'GLU', name: T('Glucose', 'گلوکۆز', 'الغلوكوز'), section: 'biochemistry', tatRoutineMin: 45, tatStatMin: 20 },
  { code: 'TROP-I', name: T('Troponin I (high-sensitivity)', 'ترۆپۆنین I', 'التروبونين I'), section: 'biochemistry', tatRoutineMin: 60, tatStatMin: 45 },
  { code: 'LFT', name: T('Liver function tests', 'پشکنینی جگەر', 'وظائف الكبد'), section: 'biochemistry', tatRoutineMin: 120, tatStatMin: 60 },
  { code: 'HBA1C', name: T('HbA1c', 'HbA1c', 'HbA1c'), section: 'biochemistry', tatRoutineMin: 240, tatStatMin: 120 },
  { code: 'CRP', name: T('C-reactive protein', 'CRP', 'البروتين التفاعلي C'), section: 'biochemistry', tatRoutineMin: 60, tatStatMin: 30 },
  { code: 'BC', name: T('Blood culture', 'چاندنی خوێن', 'زرع الدم'), section: 'microbiology', tatRoutineMin: 2880, tatStatMin: 2880 },
  { code: 'UC', name: T('Urine culture', 'چاندنی میز', 'زرع البول'), section: 'microbiology', tatRoutineMin: 2880, tatStatMin: 2880 },
];

export function findLabTest(code: string): LabTest | undefined {
  return LAB_TESTS.find((test) => test.code === code);
}

const EXT_DR_SALAR: ExternalDoctor = {
  name: { ckb: 'د. سالار مەحموود', ar: 'د. سالار محمود', latin: 'Dr. Salar Mahmood' },
  clinic: T('Private clinic, Ankawa, Erbil', 'نۆرینگەی تایبەت، عەنکاوە، هەولێر', 'عيادة خاصة، عنكاوا، أربيل'),
  phone: '+964 750 000 9311',
};
const EXT_DR_ZAINAB: ExternalDoctor = {
  name: { ckb: 'د. زەینەب عەبدولڕەزاق', ar: 'د. زينب عبدالرزاق', latin: 'Dr. Zainab Abdulrazaq' },
  clinic: T('Polyclinic, Sulaymaniyah', 'پۆلیکلینیک، سلێمانی', 'مجمع عيادات، السليمانية'),
  phone: '+964 770 000 9422',
};
const EXT_DR_BRWA: ExternalDoctor = {
  name: { ckb: 'د. بروا شێخانی', ar: 'د. بروا شيخاني', latin: 'Dr. Brwa Shekhani' },
  clinic: T('Family practice, Duhok', 'نۆرینگەی خێزانی، دهۆک', 'طب الأسرة، دهوك'),
  phone: '+964 750 000 9533',
};

export const EXTERNAL_DOCTORS: readonly ExternalDoctor[] = [EXT_DR_SALAR, EXT_DR_ZAINAB, EXT_DR_BRWA];

const IM_CLINIC = T('Internal Medicine Clinic', 'نۆرینگەی ناوەکی', 'عيادة الباطنية');
const ENDO_CLINIC = T('Diabetes Clinic', 'نۆرینگەی شەکرە', 'عيادة السكري');

function acc(
  id: string,
  source: SampleSource,
  tests: readonly string[],
  section: LabSection,
  priority: OrderPriority,
  status: AccessionStatus,
  collected: string,
  received: string | null,
  extra: Partial<Pick<Accession, 'analyserId' | 'orderedById' | 'critical' | 'note'>> = {},
): Accession {
  return {
    id,
    source,
    tests,
    section,
    priority,
    status,
    collectedIso: todayAt(collected),
    receivedIso: received === null ? null : todayAt(received),
    analyserId: extra.analyserId ?? null,
    orderedById: extra.orderedById ?? null,
    critical: extra.critical ?? false,
    note: extra.note ?? null,
  };
}

const ward = (patientId: string): SampleSource => ({ kind: 'ward', patientId });
const er = (patientId: string): SampleSource => ({ kind: 'er', patientId });
const opd = (patientId: string, clinic: Text3): SampleSource => ({ kind: 'opd', patientId, clinic });
const ext = (patientId: string, doctor: ExternalDoctor): SampleSource => ({ kind: 'external', patientId, doctor });

export const ACCESSIONS: readonly Accession[] = [
  acc('SYN-SPC-260101', er('SYN-PAT-0110'), ['TROP-I', 'K', 'NA', 'CREA'], 'biochemistry', 'stat', 'on-analyser', '09:02', '09:09', { analyserId: 'AN-C311', orderedById: 'SYN-STF-016' }),
  acc('SYN-SPC-260102', er('SYN-PAT-0110'), ['CBC', 'PT-INR'], 'haematology', 'stat', 'resulted', '09:02', '09:09', { analyserId: 'AN-XN1000', orderedById: 'SYN-STF-016' }),
  acc('SYN-SPC-260103', ward('SYN-PAT-0109'), ['K', 'NA', 'GLU'], 'biochemistry', 'stat', 'received', '09:15', '09:21', { orderedById: 'SYN-STF-007' }),
  acc('SYN-SPC-260104', ward('SYN-PAT-0102'), ['K'], 'biochemistry', 'stat', 'awaiting-receipt', '09:20', null, {
    orderedById: 'SYN-STF-005',
    note: T('Repeat potassium after critical 6.8', 'دووبارەکردنەوەی پۆتاسیۆم دوای 6.8ی مەترسیدار', 'إعادة البوتاسيوم بعد القيمة الحرجة 6.8'),
  }),
  acc('SYN-SPC-260105', ward('SYN-PAT-0101'), ['CBC', 'CRP'], 'haematology', 'routine', 'verified', '06:00', '06:40', { analyserId: 'AN-XN1000', orderedById: 'SYN-STF-005' }),
  acc('SYN-SPC-260106', ward('SYN-PAT-0106'), ['LFT', 'CREA'], 'biochemistry', 'routine', 'verified', '06:10', '06:45', { analyserId: 'AN-C311', orderedById: 'SYN-STF-008' }),
  acc('SYN-SPC-260107', ward('SYN-PAT-0107'), ['CBC'], 'haematology', 'urgent', 'resulted', '07:30', '07:48', { analyserId: 'AN-XN1000', orderedById: 'SYN-STF-008', critical: true }),
  acc('SYN-SPC-260108', ward('SYN-PAT-0105'), ['BC'], 'microbiology', 'urgent', 'on-analyser', '05:40', '06:20', {
    analyserId: 'AN-BACT',
    orderedById: 'SYN-STF-005',
    note: T('Set 1 of 2, aerobic and anaerobic', 'کۆمەڵەی 1 لە 2', 'المجموعة 1 من 2'),
  }),
  acc('SYN-SPC-260109', ward('SYN-PAT-0104'), ['CBC', 'CRP'], 'haematology', 'urgent', 'received', '08:50', '09:05', { orderedById: 'SYN-STF-006' }),
  acc('SYN-SPC-260110', ward('SYN-PAT-0103'), ['GLU'], 'biochemistry', 'routine', 'awaiting-receipt', '09:10', null, { orderedById: 'SYN-STF-006' }),
  acc('SYN-SPC-260111', opd('SYN-PAT-0233', ENDO_CLINIC), ['HBA1C', 'GLU', 'CREA'], 'biochemistry', 'routine', 'received', '08:35', '08:52', { orderedById: 'SYN-STF-020' }),
  acc('SYN-SPC-260112', opd('SYN-PAT-0234', IM_CLINIC), ['CBC', 'ESR'], 'haematology', 'routine', 'on-analyser', '08:40', '08:55', { analyserId: 'AN-XN1000', orderedById: 'SYN-STF-005' }),
  acc('SYN-SPC-260113', opd('SYN-PAT-0235', IM_CLINIC), ['LFT'], 'biochemistry', 'routine', 'awaiting-receipt', '09:18', null, { orderedById: 'SYN-STF-005' }),
  acc('SYN-SPC-260114', ext('SYN-PAT-0236', EXT_DR_SALAR), ['K', 'CREA', 'NA'], 'biochemistry', 'routine', 'resulted', '07:50', '08:05', { analyserId: 'AN-C311', critical: true }),
  acc('SYN-SPC-260115', ext('SYN-PAT-0237', EXT_DR_ZAINAB), ['CBC'], 'haematology', 'routine', 'verified', '07:15', '07:30', { analyserId: 'AN-XN1000' }),
  acc('SYN-SPC-260116', ext('SYN-PAT-0238', EXT_DR_BRWA), ['UC'], 'microbiology', 'routine', 'received', '08:20', '08:44'),
  acc('SYN-SPC-260117', ward('SYN-PAT-0228'), ['PT-INR', 'APTT'], 'haematology', 'urgent', 'awaiting-receipt', '09:22', null, { orderedById: 'SYN-STF-007' }),
  acc('SYN-SPC-260118', ward('SYN-PAT-0229'), ['K', 'NA', 'CREA', 'GLU'], 'biochemistry', 'routine', 'verified', '05:55', '06:30', { analyserId: 'AN-C311', orderedById: 'SYN-STF-007' }),
  acc('SYN-SPC-260119', ward('SYN-PAT-0213'), ['CBC'], 'haematology', 'routine', 'rejected', '06:20', '06:50', {
    orderedById: 'SYN-STF-008',
    note: T('Clotted EDTA sample; recollection requested', 'نموونەی EDTA مەییوە؛ داوای دووبارە وەرگرتن کرا', 'عينة EDTA متخثرة؛ طُلب سحب جديد'),
  }),
  acc('SYN-SPC-260120', er('SYN-PAT-0112'), ['TROP-I'], 'biochemistry', 'stat', 'awaiting-receipt', '09:26', null, { orderedById: 'SYN-STF-017' }),
  acc('SYN-SPC-260121', ward('SYN-PAT-0203'), ['CRP', 'CREA'], 'biochemistry', 'routine', 'on-analyser', '06:30', '07:05', { analyserId: 'AN-C311', orderedById: 'SYN-STF-005' }),
  acc('SYN-SPC-260122', ward('SYN-PAT-0222'), ['BC'], 'microbiology', 'urgent', 'on-analyser', '02:10', '02:35', { analyserId: 'AN-BACT', orderedById: 'SYN-STF-006' }),
  acc('SYN-SPC-260123', opd('SYN-PAT-0239', ENDO_CLINIC), ['HBA1C'], 'biochemistry', 'routine', 'awaiting-receipt', '09:24', null, { orderedById: 'SYN-STF-020' }),
  acc('SYN-SPC-260124', ward('SYN-PAT-0215'), ['CBC', 'PT-INR'], 'haematology', 'urgent', 'received', '09:00', '09:14', { orderedById: 'SYN-STF-008' }),
];

// ---------------------------------------------------------------------------------------------------------
// Analysers
// ---------------------------------------------------------------------------------------------------------

export type AnalyserState = 'running' | 'qc-due' | 'maintenance' | 'down';

export interface Analyser {
  readonly id: string;
  /** Make and model, Latin. */
  readonly model: string;
  readonly section: LabSection;
  readonly state: AnalyserState;
  readonly samplesToday: number;
  readonly queue: number;
  readonly lastQcIso: string;
  /** Lowest reagent on board, 0 to 1. */
  readonly reagentLevel: number;
  readonly note: Text3 | null;
}

export const ANALYSERS: readonly Analyser[] = [
  { id: 'AN-XN1000', model: 'Sysmex XN-1000', section: 'haematology', state: 'running', samplesToday: 64, queue: 3, lastQcIso: todayAt('06:15'), reagentLevel: 0.72, note: null },
  { id: 'AN-BC6800', model: 'Mindray BC-6800 (backup)', section: 'haematology', state: 'qc-due', samplesToday: 0, queue: 0, lastQcIso: daysAgoAt(1, '06:20'), reagentLevel: 0.55, note: T('Daily QC not yet run', 'QCی ڕۆژانە هێشتا نەکراوە', 'لم تُجرَ مراقبة الجودة اليومية بعد') },
  { id: 'AN-C311', model: 'Roche cobas c 311', section: 'biochemistry', state: 'running', samplesToday: 118, queue: 6, lastQcIso: todayAt('06:30'), reagentLevel: 0.18, note: T('Creatinine reagent low: one cassette left', 'ڕیئەجێنتی کریاتینین کەمە', 'كاشف الكرياتينين منخفض') },
  { id: 'AN-E411', model: 'Roche cobas e 411', section: 'biochemistry', state: 'maintenance', samplesToday: 22, queue: 2, lastQcIso: todayAt('06:40'), reagentLevel: 0.64, note: T('Weekly maintenance until 10:00', 'چاککردنەوەی هەفتانە تا 10:00', 'صيانة أسبوعية حتى 10:00') },
  { id: 'AN-BACT', model: 'bioMérieux BacT/ALERT 3D', section: 'microbiology', state: 'running', samplesToday: 9, queue: 0, lastQcIso: daysAgoAt(0, '07:00'), reagentLevel: 0.9, note: null },
];

// ---------------------------------------------------------------------------------------------------------
// Quality control (Levey–Jennings)
// ---------------------------------------------------------------------------------------------------------

export interface QcSeries {
  readonly id: string;
  readonly analyserId: string;
  readonly testCode: string;
  readonly level: 1 | 2;
  readonly lot: string;
  readonly unit: string;
  readonly mean: number;
  readonly sd: number;
  /** Twenty runs, oldest first. */
  readonly values: readonly number[];
}

/** Values as multiples of the SD from the mean, turned into control results. */
function series(id: string, analyserId: string, testCode: string, level: 1 | 2, lot: string, unit: string, mean: number, sd: number, z: readonly number[]): QcSeries {
  return { id, analyserId, testCode, level, lot, unit, mean, sd, values: z.map((k) => Math.round((mean + k * sd) * 100) / 100) };
}

export const QC_SERIES: readonly QcSeries[] = [
  series('QC-K-1', 'AN-C311', 'K', 1, 'PCCC1-2604', 'mmol/L', 4.1, 0.08, [0.2, -0.4, 0.6, 0.1, -0.9, 0.3, 1.1, -0.2, 0.5, -0.6, 0.8, 0.4, -1.2, 0.0, 0.9, 1.4, 0.7, 2.3, 1.1, 0.6]),
  series('QC-K-2', 'AN-C311', 'K', 2, 'PCCC2-2604', 'mmol/L', 6.6, 0.11, [-0.3, 0.4, 0.2, -0.8, 0.1, 0.6, -0.5, 0.9, -0.2, 0.3, -1.0, 0.7, 0.2, -0.4, 1.2, -0.1, 0.5, 0.8, -0.6, 0.2]),
  series('QC-GLU-1', 'AN-C311', 'GLU', 1, 'PCCC1-2604', 'mmol/L', 5.5, 0.14, [0.1, 0.5, -0.3, 0.9, -1.1, 0.2, 0.4, -0.6, 1.3, 0.0, -0.2, 0.7, -0.9, 0.3, 0.6, -0.4, 1.0, -0.1, 0.5, 0.2]),
  series('QC-CREA-1', 'AN-C311', 'CREA', 1, 'PCCC1-2604', 'umol/L', 88, 3.1, [0.3, -0.2, 0.8, 1.2, 0.5, 1.6, 1.1, 0.9, 1.4, 1.8, 1.3, 1.0, 1.5, 2.1, 1.7, 2.2, 1.9, 2.4, 2.6, 3.2]),
  series('QC-HGB-1', 'AN-XN1000', 'CBC', 1, 'XN-L1-2605', 'g/dL', 6.2, 0.12, [0.4, -0.3, 0.1, 0.6, -0.8, 0.2, -0.1, 0.9, -0.5, 0.3, 0.0, -0.7, 0.5, 1.1, -0.2, 0.4, -0.9, 0.6, 0.1, -0.3]),
  series('QC-HGB-2', 'AN-XN1000', 'CBC', 2, 'XN-L2-2605', 'g/dL', 12.4, 0.18, [-0.2, 0.3, 0.7, -0.5, 0.1, 0.9, -1.3, 0.4, 0.2, -0.6, 0.8, 0.0, -0.4, 0.6, 1.0, -0.8, 0.3, -0.1, 0.5, 0.2]),
];

/** QC run dates: the last twenty runs, one a day ending today. */
export const QC_RUN_DAYS: readonly string[] = Array.from({ length: 20 }, (_, index) => daysAgoAt(19 - index, '06:30'));

export type WestgardRule = '1-2s' | '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10x';

export interface WestgardHit {
  readonly index: number;
  readonly rule: WestgardRule;
  /** Reject (1-3s, 2-2s, R-4s, 4-1s, 10x) or warning (1-2s). */
  readonly reject: boolean;
}

/** Westgard multirule check on one series (single level), newest run last. */
export function westgard(qc: QcSeries): readonly WestgardHit[] {
  const z = qc.values.map((value) => (value - qc.mean) / qc.sd);
  const hits: WestgardHit[] = [];
  z.forEach((k, i) => {
    const prev = z[i - 1];
    if (Math.abs(k) > 3) {
      hits.push({ index: i, rule: '1-3s', reject: true });
    } else if (prev !== undefined && Math.abs(k) > 2 && Math.abs(prev) > 2 && Math.sign(k) === Math.sign(prev)) {
      hits.push({ index: i, rule: '2-2s', reject: true });
    } else if (i >= 3 && z.slice(i - 3, i + 1).every((v) => v > 1)) {
      hits.push({ index: i, rule: '4-1s', reject: true });
    } else if (i >= 9 && (z.slice(i - 9, i + 1).every((v) => v > 0) || z.slice(i - 9, i + 1).every((v) => v < 0))) {
      hits.push({ index: i, rule: '10x', reject: true });
    } else if (Math.abs(k) > 2) {
      hits.push({ index: i, rule: '1-2s', reject: false });
    }
  });
  return hits;
}

// ---------------------------------------------------------------------------------------------------------
// Critical-result calls
// ---------------------------------------------------------------------------------------------------------

export interface CriticalCall {
  readonly id: string;
  readonly accessionId: string;
  readonly patientId: string;
  readonly testCode: string;
  readonly value: string;
  readonly unit: string;
  /** In-house doctor (staff id) or an outside doctor. */
  readonly recipient: { readonly kind: 'staff'; readonly staffId: string } | { readonly kind: 'external'; readonly doctor: ExternalDoctor };
  readonly resultedIso: string;
  /** Null while the call is still to be made. */
  readonly calledIso: string | null;
  readonly calledById: string | null;
  readonly readBack: boolean;
  readonly attempts: number;
}

export const CRITICAL_CALLS: readonly CriticalCall[] = [
  {
    id: 'CC-0412',
    accessionId: 'SYN-SPC-260001',
    patientId: 'SYN-PAT-0102',
    testCode: 'K',
    value: '6.8',
    unit: 'mmol/L',
    recipient: { kind: 'staff', staffId: 'SYN-STF-005' },
    resultedIso: todayAt('07:55'),
    calledIso: todayAt('08:04'),
    calledById: 'SYN-STF-011',
    readBack: true,
    attempts: 1,
  },
  {
    id: 'CC-0413',
    accessionId: 'SYN-SPC-260107',
    patientId: 'SYN-PAT-0107',
    testCode: 'CBC',
    value: '6.9',
    unit: 'g/dL',
    recipient: { kind: 'staff', staffId: 'SYN-STF-008' },
    resultedIso: todayAt('08:21'),
    calledIso: null,
    calledById: null,
    readBack: false,
    attempts: 1,
  },
  {
    id: 'CC-0414',
    accessionId: 'SYN-SPC-260114',
    patientId: 'SYN-PAT-0236',
    testCode: 'K',
    value: '2.6',
    unit: 'mmol/L',
    recipient: { kind: 'external', doctor: EXT_DR_SALAR },
    resultedIso: todayAt('08:47'),
    calledIso: null,
    calledById: null,
    readBack: false,
    attempts: 2,
  },
  {
    id: 'CC-0409',
    accessionId: 'SYN-SPC-259877',
    patientId: 'SYN-PAT-0109',
    testCode: 'GLU',
    value: '2.1',
    unit: 'mmol/L',
    recipient: { kind: 'staff', staffId: 'SYN-STF-007' },
    resultedIso: daysAgoAt(1, '22:40'),
    calledIso: daysAgoAt(1, '22:46'),
    calledById: 'SYN-STF-011',
    readBack: true,
    attempts: 1,
  },
  {
    id: 'CC-0410',
    accessionId: 'SYN-SPC-259902',
    patientId: 'SYN-PAT-0237',
    testCode: 'PT-INR',
    value: '5.4',
    unit: '{ratio}',
    recipient: { kind: 'external', doctor: EXT_DR_ZAINAB },
    resultedIso: daysAgoAt(1, '15:10'),
    calledIso: daysAgoAt(1, '15:31'),
    calledById: 'SYN-STF-011',
    readBack: true,
    attempts: 3,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Turnaround times, last 7 days
// ---------------------------------------------------------------------------------------------------------

export interface TatStat {
  readonly code: string;
  readonly count: number;
  readonly medianMin: number;
  readonly p90Min: number;
  /** Share within the target, 0 to 1. */
  readonly withinTarget: number;
}

export const TAT_STATS: readonly TatStat[] = [
  { code: 'K', count: 412, medianMin: 42, p90Min: 71, withinTarget: 0.86 },
  { code: 'CBC', count: 538, medianMin: 34, p90Min: 58, withinTarget: 0.93 },
  { code: 'TROP-I', count: 96, medianMin: 39, p90Min: 64, withinTarget: 0.78 },
  { code: 'CREA', count: 455, medianMin: 47, p90Min: 83, withinTarget: 0.81 },
  { code: 'GLU', count: 301, medianMin: 28, p90Min: 49, withinTarget: 0.9 },
  { code: 'PT-INR', count: 188, medianMin: 41, p90Min: 66, withinTarget: 0.84 },
  { code: 'LFT', count: 203, medianMin: 88, p90Min: 141, withinTarget: 0.79 },
  { code: 'HBA1C', count: 74, medianMin: 160, p90Min: 260, withinTarget: 0.88 },
  { code: 'CRP', count: 266, medianMin: 45, p90Min: 77, withinTarget: 0.83 },
  { code: 'BC', count: 31, medianMin: 2210, p90Min: 2950, withinTarget: 0.87 },
];
