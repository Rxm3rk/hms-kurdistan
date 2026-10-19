/**
 * The lab screen's own synthetic data and helpers. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * - Extra specimens so the lab-wide worklist has something in every stage (to collect, in transit, received,
 *   in analysis, resulted, rejected), built on the shared data module's patients. Ids continue the shared
 *   series (`SYN-SPC-260015` …); recollection tasks carry `-R1`.
 * - One corrected result (Gulala's urea: 12.4 reported in error, corrected to 21.4).
 * - Critical limits for flagging earlier values, tube print codes, rejection reasons.
 * - The cumulative-table and trend builders.
 */
import {
  RESULTS,
  SPECIMENS,
  daysAgoAt,
  findOrder,
  todayAt,
  type LabResult,
  type OrderPriority,
  type ResultFlag,
  type Specimen,
  type SpecimenStatus,
  type Text3,
} from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** How the patient's identity was confirmed at collection. */
export type IdentityCheck = 'scan' | 'manual';

/** A specimen as the lab screen sees it: the shared record plus the worklist's own fields. */
export interface LabSpecimen extends Specimen {
  /** When the test was requested (the order time, or the time the recollection task was created). */
  readonly orderedIso: string;
  /** For a recollection task: the rejected specimen it replaces. */
  readonly recollectOf: string | null;
  /** A note for the collector or the lab. */
  readonly note: Text3 | null;
  readonly rejectedIso: string | null;
  readonly rejectedById: string | null;
  readonly rejectComment: string | null;
  readonly identityCheck: IdentityCheck | null;
}

/** The worklist stages (the six columns of the lab-wide pipeline). */
export type Stage = 'collect' | 'transit' | 'received' | 'process' | 'resulted' | 'rejected';
export const STAGES: readonly Stage[] = ['collect', 'transit', 'received', 'process', 'resulted', 'rejected'];

export function stageOf(status: SpecimenStatus): Stage {
  switch (status) {
    case 'ordered':
      return 'collect';
    case 'collected':
      return 'transit';
    case 'received':
      return 'received';
    case 'in-progress':
      return 'process';
    case 'resulted':
    case 'verified':
      return 'resulted';
    case 'rejected':
      return 'rejected';
  }
}

export const PRIORITY_RANK: Readonly<Record<OrderPriority, number>> = { stat: 0, urgent: 1, routine: 2 };

// ---------------------------------------------------------------------------------------------------------
// Tubes
// ---------------------------------------------------------------------------------------------------------

/**
 * What the thermal label prints for each container (labels are monochrome; the cap colour is printed as a
 * word) and the swatch modifier the screen uses next to the container's name.
 */
export const TUBE_PRINT: Readonly<Record<Specimen['container'], string>> = {
  serum: 'GOLD SST',
  edta: 'LAV EDTA',
  citrate: 'BLUE CIT',
  'blood-gas': 'ABG SYR',
  'blood-culture': 'BC BTL',
  sputum: 'SPUTUM',
  capillary: 'CAPILL',
};

// ---------------------------------------------------------------------------------------------------------
// Extra specimens (the worklist)
// ---------------------------------------------------------------------------------------------------------

const LAB = 'SYN-STF-011';
const N_GORAN = 'SYN-STF-010';
const N_BAHAR = 'SYN-STF-009';
const N_ARI = 'SYN-STF-015';
const N_HANA = 'SYN-STF-014';
const N_KARZAN = 'SYN-STF-019';

const SERUM = T('Blood (serum)', 'خوێن (سیرەم)', 'دم (مصل)');
const WHOLE_BLOOD = T('Blood (whole, EDTA)', 'خوێن (تەواو، EDTA)', 'دم كامل (EDTA)');
const CITRATE = T('Blood (citrate)', 'خوێن (سیترات)', 'دم (سترات)');

interface ExtraInput {
  readonly id: string;
  readonly patientId: string;
  readonly panel: Text3;
  readonly specimenType: Text3;
  readonly container: Specimen['container'];
  readonly priority: OrderPriority;
  readonly status: SpecimenStatus;
  readonly orderedIso: string;
  readonly collectedIso?: string;
  readonly collectedById?: string;
  readonly receivedIso?: string;
  readonly resultedIso?: string;
  readonly note?: Text3;
  readonly recollectOf?: string;
}

function extra(input: ExtraInput): LabSpecimen {
  return {
    id: input.id,
    patientId: input.patientId,
    orderIds: [],
    panel: input.panel,
    specimenType: input.specimenType,
    container: input.container,
    priority: input.priority,
    status: input.status,
    collectedIso: input.collectedIso ?? null,
    collectedById: input.collectedById ?? null,
    receivedIso: input.receivedIso ?? null,
    resultedIso: input.resultedIso ?? null,
    verifiedById: null,
    rejectionReason: null,
    orderedIso: input.orderedIso,
    recollectOf: input.recollectOf ?? null,
    note: input.note ?? null,
    rejectedIso: null,
    rejectedById: null,
    rejectComment: null,
    identityCheck: input.collectedIso === undefined ? null : 'scan',
  };
}

const EXTRA_SPECIMENS: readonly LabSpecimen[] = [
  extra({
    id: 'SYN-SPC-260015',
    patientId: 'SYN-PAT-0102',
    panel: T('Repeat potassium (confirm critical value)', 'دووبارەکردنەوەی پۆتاسیۆم (دڵنیابوون لە بەهای مەترسیدار)', 'إعادة البوتاسيوم (تأكيد القيمة الحرجة)'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'stat',
    status: 'ordered',
    orderedIso: todayAt('08:20'),
    note: T(
      'Lab advises a fresh venepuncture, not from the cannula, to rule out haemolysis.',
      'تاقیگە ئامۆژگاری دەکات خوێنی نوێ لە دەمار وەربگیرێت، نەک لە کانیولا، بۆ دوورخستنەوەی هیمۆلیز.',
      'ينصح المختبر بسحب جديد من الوريد وليس من الكانيولا لاستبعاد انحلال الدم.',
    ),
  }),
  extra({
    id: 'SYN-SPC-260016',
    patientId: 'SYN-PAT-0101',
    panel: T('Renal profile (daily)', 'پرۆفایلی گورچیلە (ڕۆژانە)', 'وظائف الكلى (يومي)'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'ordered',
    orderedIso: todayAt('07:00'),
  }),
  extra({
    id: 'SYN-SPC-260017',
    patientId: 'SYN-PAT-0105',
    panel: T('Liver function tests (baseline before TB treatment)', 'پشکنینی جگەر (بنەڕەت پێش چارەسەری سیل)', 'وظائف الكبد (أساسية قبل علاج السل)'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'ordered',
    orderedIso: todayAt('08:00'),
    note: T(
      'Airborne precautions: put on an FFP2/N95 respirator before entering room A-20.',
      'ڕێکاری گواستنەوە بە هەوا: پێش چوونە ژووری A-20 دەمامکی FFP2/N95 لەبەر بکە.',
      'احتياطات الانتقال الهوائي: ارتدِ كمامة FFP2/N95 قبل دخول الغرفة A-20.',
    ),
  }),
  extra({
    id: 'SYN-SPC-260018',
    patientId: 'SYN-PAT-0203',
    panel: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد دم كامل'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'ordered',
    orderedIso: todayAt('07:40'),
  }),
  extra({
    id: 'SYN-SPC-260019',
    patientId: 'SYN-PAT-0214',
    panel: T('Group and screen (before theatre)', 'گرووپی خوێن و پشکنین (پێش نەشتەرگەری)', 'فصيلة الدم والفحص (قبل العملية)'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'urgent',
    status: 'ordered',
    orderedIso: todayAt('08:45'),
  }),
  extra({
    id: 'SYN-SPC-260013-R1',
    patientId: 'SYN-PAT-0201',
    panel: T('Clotting screen (INR)', 'پشکنینی مەیین (INR)', 'فحص التخثر (INR)'),
    specimenType: CITRATE,
    container: 'citrate',
    priority: 'urgent',
    status: 'ordered',
    orderedIso: todayAt('06:45'),
    recollectOf: 'SYN-SPC-260013',
    note: T('Recollect: under-filled tube', 'دووبارە وەرگرتنەوە: بۆری کەم پڕکراوە', 'إعادة السحب: أنبوب غير ممتلئ'),
  }),
  extra({
    id: 'SYN-SPC-260020',
    patientId: 'SYN-PAT-0222',
    panel: T('Glucose and electrolytes', 'گلووکۆز و ئەلیکترۆلایت', 'الغلوكوز والأملاح'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'collected',
    orderedIso: todayAt('08:30'),
    collectedIso: todayAt('09:05'),
    collectedById: N_HANA,
  }),
  extra({
    id: 'SYN-SPC-260021',
    patientId: 'SYN-PAT-0109',
    panel: T('Clotting screen (INR, APTT)', 'پشکنینی مەیین (INR، APTT)', 'فحص التخثر (INR، APTT)'),
    specimenType: CITRATE,
    container: 'citrate',
    priority: 'urgent',
    status: 'collected',
    orderedIso: todayAt('08:50'),
    collectedIso: todayAt('09:15'),
    collectedById: N_ARI,
  }),
  extra({
    id: 'SYN-SPC-260022',
    patientId: 'SYN-PAT-0228',
    panel: T('Magnesium and phosphate', 'مەگنیزیۆم و فۆسفات', 'المغنيسيوم والفوسفات'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'received',
    orderedIso: todayAt('07:30'),
    collectedIso: todayAt('08:30'),
    collectedById: N_ARI,
    receivedIso: todayAt('09:00'),
  }),
  extra({
    id: 'SYN-SPC-260023',
    patientId: 'SYN-PAT-0207',
    panel: T('Lipid profile', 'پرۆفایلی چەوری', 'دهون الدم'),
    specimenType: SERUM,
    container: 'serum',
    priority: 'routine',
    status: 'received',
    orderedIso: todayAt('07:15'),
    collectedIso: todayAt('08:25'),
    collectedById: N_BAHAR,
    receivedIso: todayAt('08:55'),
  }),
  extra({
    id: 'SYN-SPC-260024',
    patientId: 'SYN-PAT-0112',
    panel: T('HbA1c', 'HbA1c', 'HbA1c'),
    specimenType: WHOLE_BLOOD,
    container: 'edta',
    priority: 'routine',
    status: 'received',
    orderedIso: todayAt('08:00'),
    collectedIso: todayAt('09:00'),
    collectedById: N_GORAN,
    receivedIso: todayAt('09:10'),
  }),
  extra({
    id: 'SYN-SPC-260025',
    patientId: 'SYN-PAT-0230',
    panel: T('Blood culture (1 set)', 'چاندنی خوێن (1 کۆمەڵە)', 'زرع الدم (مجموعة واحدة)'),
    specimenType: T('Blood (culture bottles)', 'خوێن (بوتڵی چاندن)', 'دم (قناني زرع)'),
    container: 'blood-culture',
    priority: 'urgent',
    status: 'in-progress',
    orderedIso: daysAgoAt(1, '15:30'),
    collectedIso: daysAgoAt(1, '16:00'),
    collectedById: N_KARZAN,
    receivedIso: daysAgoAt(1, '16:40'),
  }),
];

function orderedIsoOf(specimen: Specimen): string {
  const orderId = specimen.orderIds[0];
  const order = orderId === undefined ? undefined : findOrder(orderId);
  return order?.orderedIso ?? specimen.collectedIso ?? todayAt('08:00');
}

/** Every specimen the lab screen starts with: the shared ones, then the screen's own. */
export const BASE_LAB_SPECIMENS: readonly LabSpecimen[] = [
  ...SPECIMENS.map(
    (specimen): LabSpecimen => ({
      ...specimen,
      orderedIso: orderedIsoOf(specimen),
      recollectOf: null,
      note:
        specimen.id === 'SYN-SPC-260001'
          ? T(
              'Not visibly haemolysed (haemolysis index 12). Lab phoned the ward at 08:12.',
              'بە چاو هیمۆلیز دیار نییە (ئیندێکسی هیمۆلیز 12). تاقیگە کاتژمێر 08:12 تەلەفۆنی بۆ قاوش کرد.',
              'لا انحلال دم ظاهر (مؤشر الانحلال 12). اتصل المختبر بالردهة الساعة 08:12.',
            )
          : null,
      rejectedIso: specimen.status === 'rejected' ? specimen.receivedIso : null,
      rejectedById: specimen.status === 'rejected' ? LAB : null,
      rejectComment: null,
      identityCheck: specimen.collectedIso === null ? null : 'scan',
    }),
  ),
  ...EXTRA_SPECIMENS,
];

// ---------------------------------------------------------------------------------------------------------
// Rejection reasons and acknowledgement actions
// ---------------------------------------------------------------------------------------------------------

export type RejectReasonId = 'haemolysed' | 'clotted' | 'unlabelled' | 'mislabelled' | 'insufficient' | 'wrong-tube';
export const REJECT_REASON_IDS: readonly RejectReasonId[] = ['haemolysed', 'clotted', 'unlabelled', 'mislabelled', 'insufficient', 'wrong-tube'];

/** Stored on the rejected specimen (the shared data type keeps the reason as a Text3). */
export const REJECT_REASON_TEXT: Readonly<Record<RejectReasonId, Text3>> = {
  haemolysed: T('Haemolysed', 'هیمۆلیزبووە', 'متحلل (انحلال الدم)'),
  clotted: T('Clotted', 'مەیبووە', 'متخثر'),
  unlabelled: T('Unlabelled', 'بێ لەیبڵ', 'بلا ملصق'),
  mislabelled: T('Label does not match the request', 'لەیبڵ لەگەڵ داواکارییەکە ناگونجێت', 'الملصق لا يطابق الطلب'),
  insufficient: T('Insufficient volume', 'بڕی خوێن بەس نییە', 'كمية غير كافية'),
  'wrong-tube': T('Wrong tube for the test', 'بۆریی هەڵە بۆ ئەم پشکنینە', 'أنبوب غير مناسب للفحص'),
};

export type AckActionId = 'ecg' | 'repeat' | 'treatment' | 'senior';
export const ACK_ACTION_IDS: readonly AckActionId[] = ['ecg', 'repeat', 'treatment', 'senior'];

// ---------------------------------------------------------------------------------------------------------
// Corrected results
// ---------------------------------------------------------------------------------------------------------

export interface Correction {
  /** The value first reported (struck through on screen). */
  readonly previousValue: string;
  readonly correctedIso: string;
  readonly correctedById: string;
  readonly reason: Text3;
  /** Who in the clinical team the lab told about the correction. */
  readonly notifiedId: string;
}

/** Corrections by `specimenId|code`. */
const CORRECTIONS: Readonly<Record<string, Correction>> = {
  'SYN-SPC-260001|SYN-LAB-UREA': {
    previousValue: '12.4',
    correctedIso: todayAt('08:25'),
    correctedById: LAB,
    reason: T(
      'Manual entry error: digits transposed (12.4 entered for 21.4). Re-checked against the analyser record.',
      'هەڵەی تۆمارکردنی دەستی: ژمارەکان جێگۆڕکێیان پێکراوە (12.4 لە جیاتی 21.4 نووسراوە). بەراورد کرایەوە لەگەڵ تۆماری ئامێرەکە.',
      'خطأ إدخال يدوي: تبديل الأرقام (أُدخل 12.4 بدلاً من 21.4). تمت المراجعة مقابل سجل الجهاز.',
    ),
    notifiedId: 'SYN-STF-002',
  },
};

export function correctionOf(result: LabResult): Correction | undefined {
  return CORRECTIONS[`${result.specimenId}|${result.code}`];
}

// ---------------------------------------------------------------------------------------------------------
// Flags, ranges, cumulative table, trends
// ---------------------------------------------------------------------------------------------------------

/** Synthetic critical limits, used to flag earlier values (the latest value carries the lab's own flag). */
export const CRITICAL_LIMITS: Readonly<Record<string, { readonly low?: number; readonly high?: number }>> = {
  'SYN-LAB-K': { low: 2.8, high: 6.0 },
  'SYN-LAB-NA': { low: 120, high: 160 },
  'SYN-LAB-GLU': { low: 2.5, high: 25 },
  'SYN-LAB-PH': { low: 7.2, high: 7.6 },
  'SYN-LAB-HB': { low: 7, high: 20 },
  'SYN-LAB-PLT': { low: 20, high: 1000 },
};

export function flagFor(value: string, refLow: string | null, refHigh: string | null, code: string): ResultFlag {
  const v = Number(value);
  if (!Number.isFinite(v)) {
    return 'abnormal';
  }
  const limits = CRITICAL_LIMITS[code];
  if (limits?.high !== undefined && v >= limits.high) {
    return 'critical-high';
  }
  if (limits?.low !== undefined && v <= limits.low) {
    return 'critical-low';
  }
  if (refHigh !== null && v > Number(refHigh)) {
    return 'high';
  }
  if (refLow !== null && v < Number(refLow)) {
    return 'low';
  }
  return 'normal';
}

/** The printed flag code: H, L, HH, LL (Latin, as on lab reports), or '' for normal. */
export function flagCode(flag: ResultFlag): string {
  switch (flag) {
    case 'high':
      return 'H';
    case 'low':
      return 'L';
    case 'critical-high':
      return 'HH';
    case 'critical-low':
      return 'LL';
    case 'abnormal':
      return 'A';
    default:
      return '';
  }
}

export interface CumulativeCell {
  readonly value: string;
  readonly flag: ResultFlag;
  /** The latest result of the row (the lab's record), for the newest cell only. */
  readonly result: LabResult | null;
  readonly correction: Correction | null;
}

export interface CumulativeRow {
  readonly code: string;
  readonly analyte: Text3;
  readonly unit: string | null;
  readonly refLow: string | null;
  readonly refHigh: string | null;
  readonly cells: ReadonlyMap<string, CumulativeCell>;
  readonly latest: LabResult;
}

export interface CumulativeGroup {
  readonly id: string;
  readonly panel: Text3;
  readonly specimenId: string;
  readonly rows: readonly CumulativeRow[];
}

export interface Cumulative {
  /** Column instants, newest first. */
  readonly columns: readonly string[];
  readonly groups: readonly CumulativeGroup[];
  /** Results with a text value (microbiology, comments). */
  readonly textResults: readonly LabResult[];
}

const MAX_COLUMNS = 6;

/** Builds the cumulative view of a patient's numeric results: one row per test, one column per time. */
export function buildCumulative(results: readonly LabResult[], specimens: readonly Specimen[]): Cumulative {
  const numeric = results.filter((result) => result.value !== null);
  const textResults = results.filter((result) => result.value === null);
  // Newest result per test code.
  const latestByCode = new Map<string, LabResult>();
  for (const result of numeric) {
    const known = latestByCode.get(result.code);
    if (known === undefined || known.resultedIso < result.resultedIso) {
      latestByCode.set(result.code, result);
    }
  }
  const rows: CumulativeRow[] = [];
  const instants = new Set<string>();
  for (const latest of latestByCode.values()) {
    const cells = new Map<string, CumulativeCell>();
    for (const result of numeric.filter((candidate) => candidate.code === latest.code)) {
      for (const point of result.history) {
        if (!cells.has(point.iso)) {
          cells.set(point.iso, { value: point.value, flag: flagFor(point.value, result.refLow, result.refHigh, result.code), result: null, correction: null });
        }
      }
      cells.set(result.resultedIso, {
        value: result.value ?? '',
        flag: result.flag,
        result,
        correction: correctionOf(result) ?? null,
      });
    }
    for (const iso of cells.keys()) {
      instants.add(iso);
    }
    rows.push({ code: latest.code, analyte: latest.analyte, unit: latest.unit, refLow: latest.refLow, refHigh: latest.refHigh, cells, latest });
  }
  const columns = [...instants].toSorted((a, b) => b.localeCompare(a)).slice(0, MAX_COLUMNS);
  // Group rows by the specimen (panel) of their latest result; within a panel, the lab's order (RESULTS).
  const bySpecimen = new Map<string, CumulativeRow[]>();
  for (const row of rows) {
    const list = bySpecimen.get(row.latest.specimenId) ?? [];
    list.push(row);
    bySpecimen.set(row.latest.specimenId, list);
  }
  const groups: CumulativeGroup[] = [...bySpecimen.entries()].map(([specimenId, list]) => {
    const sorted = list.toSorted((a, b) => RESULTS.indexOf(a.latest) - RESULTS.indexOf(b.latest));
    const specimen = specimens.find((candidate) => candidate.id === specimenId);
    return { id: specimenId, specimenId, panel: specimen?.panel ?? sorted[0]?.analyte ?? T('', '', ''), rows: sorted };
  });
  // Newest panel first.
  const sortedGroups = groups.toSorted((a, b) => (b.rows[0]?.latest.resultedIso ?? '').localeCompare(a.rows[0]?.latest.resultedIso ?? ''));
  return { columns, groups: sortedGroups, textResults };
}

export interface TrendPoint {
  readonly iso: string;
  readonly value: number;
  readonly flag: ResultFlag;
}

export interface TrendSeries {
  readonly code: string;
  readonly analyte: Text3;
  readonly unit: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalHigh: number | null;
  readonly criticalLow: number | null;
  readonly points: readonly TrendPoint[];
  readonly latest: LabResult;
}

/** Trend series for the patient: potassium and creatinine first (the demo story), then the longest histories. */
export function buildTrends(cumulative: Cumulative, max = 2): readonly TrendSeries[] {
  const rows = cumulative.groups.flatMap((group) => group.rows).filter((row) => row.cells.size >= 2);
  const preferred = ['SYN-LAB-K', 'SYN-LAB-CREAT'];
  const ordered = rows.toSorted((a, b) => {
    const pa = preferred.indexOf(a.code);
    const pb = preferred.indexOf(b.code);
    if (pa !== pb) {
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    }
    return b.cells.size - a.cells.size;
  });
  return ordered.slice(0, max).map((row) => {
    const limits = CRITICAL_LIMITS[row.code];
    return {
      code: row.code,
      analyte: row.analyte,
      unit: row.unit,
      refLow: row.refLow === null ? null : Number(row.refLow),
      refHigh: row.refHigh === null ? null : Number(row.refHigh),
      criticalHigh: limits?.high ?? null,
      criticalLow: limits?.low ?? null,
      points: [...row.cells.entries()]
        .map(([iso, cell]) => ({ iso, value: Number(cell.value), flag: cell.flag }))
        .filter((point) => Number.isFinite(point.value))
        .toSorted((a, b) => a.iso.localeCompare(b.iso)),
      latest: row.latest,
    };
  });
}

/** `dd/mm` from an ISO instant (Western digits in every locale). */
export function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** `HH:mm` from an ISO instant with the Baghdad offset. */
export function clockTime(iso: string): string {
  return iso.slice(11, 16);
}
