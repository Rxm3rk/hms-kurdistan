/**
 * The ward screen's own synthetic extras, derived from the shared data module (read-only). SYNTHETIC DATA
 * ONLY, NOT FOR CLINICAL USE.
 *
 * - Who is waiting for a bed (decisions to admit from today's clinics) and the pending transfer requests.
 * - Early warning scores for the board: NEWS2 for adults (from the curated vital signs where they exist, a
 *   fixed synthetic score for the generated census) and PEWS for children on Paediatrics (NEWS2 is not used
 *   for children).
 * - Fall risk, look-alike names, and the starting state of each patient's discharge checklist.
 */
import {
  APPOINTMENTS,
  BEDS,
  DEMO_TODAY,
  ENCOUNTERS,
  currentEncounter,
  demoDate,
  getPatient,
  invoicesOf,
  invoiceTotals,
  todayAt,
  hasFallRiskAlert,
  unacknowledgedCriticals,
  vitalsOf,
} from '../../data/index.ts';
import type { ClinicId, LabResult, OrderPriority, Patient, Text3, WardId } from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

/** Whole years of age on the demo day (year-only and month-only dates of birth count from 1 January / the 1st). */
export function ageInYears(dob: string): number {
  const [y, m, d] = dob.split('-');
  const [ty, tm, td] = DEMO_TODAY.split('-').map(Number);
  const year = Number(y);
  const month = m === undefined ? 1 : Number(m);
  const day = d === undefined ? 1 : Number(d);
  const thisYear = ty ?? 2026;
  const thisMonth = tm ?? 10;
  const thisDay = td ?? 19;
  let age = thisYear - year;
  if (thisMonth < month || (thisMonth === month && thisDay < day)) {
    age -= 1;
  }
  return Math.max(0, age);
}

/** A stable small number from a patient id (`SYN-PAT-0213` → 213), for deterministic synthetic values. */
function seedOf(patientId: string): number {
  const n = Number(patientId.slice(-3));
  return Number.isFinite(n) ? n : 0;
}

/** Children are under 16 on the board (paediatric early warning, paediatric ward). */
export function isChild(patient: Patient): boolean {
  return ageInYears(patient.dob) < 16;
}

// ---------------------------------------------------------------------------------------------------------
// Early warning scores
// ---------------------------------------------------------------------------------------------------------

export type WarningScale = 'NEWS2' | 'PEWS';
export type WarningBand = 'low' | 'medium' | 'high';

export interface EarlyWarning {
  readonly scale: WarningScale;
  readonly score: number;
  readonly band: WarningBand;
  /** When the observations were taken. */
  readonly iso: string;
  /** Earlier scores, oldest first, when the vital signs chart has them. */
  readonly trend: readonly number[] | null;
}

function band(scale: WarningScale, score: number): WarningBand {
  if (scale === 'NEWS2') {
    return score >= 7 ? 'high' : score >= 5 ? 'medium' : 'low';
  }
  return score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';
}

const CENSUS_NEWS2 = [0, 1, 0, 2, 1, 3, 0, 1, 2, 4, 0, 1, 5, 2] as const;
const CENSUS_PEWS = [0, 1, 2, 0, 3, 1] as const;

/** The patient's latest early warning score on this ward. */
export function earlyWarningOf(patient: Patient, wardId: WardId): EarlyWarning {
  const seed = seedOf(patient.id);
  if (wardId === 'paeds' || isChild(patient)) {
    const score = patient.curated ? (patient.id === 'SYN-PAT-0104' ? 1 : 0) : (CENSUS_PEWS[seed % CENSUS_PEWS.length] ?? 0);
    return { scale: 'PEWS', score, band: band('PEWS', score), iso: todayAt('08:00'), trend: null };
  }
  const vitals = vitalsOf(patient.id);
  const latest = vitals.at(-1);
  if (latest !== undefined) {
    return {
      scale: 'NEWS2',
      score: latest.news2,
      band: band('NEWS2', latest.news2),
      iso: latest.iso,
      trend: vitals.map((v) => v.news2),
    };
  }
  const score = wardId === 'icu' ? 3 + ((seed * 7) % 5) : (CENSUS_NEWS2[seed % CENSUS_NEWS2.length] ?? 0);
  return {
    scale: 'NEWS2',
    score,
    band: band('NEWS2', score),
    iso: wardId === 'icu' ? todayAt('09:00') : todayAt('08:00'),
    trend: null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Fall risk, look-alike names, critical results
// ---------------------------------------------------------------------------------------------------------

/** High fall risk: the patient's own alert, or 75 years and older (a synthetic screening rule). */
export function hasFallRisk(patient: Patient): boolean {
  return hasFallRiskAlert(patient) || ageInYears(patient.dob) >= 75;
}

function nameKey(patient: Patient): string {
  return patient.name.latin.toLowerCase().split(/\s+/u).slice(0, 2).join(' ');
}

/** Other patients whose first and father's names are the same (they differ only further on). */
export function lookAlikesOf(patient: Patient, others: readonly Patient[]): readonly Patient[] {
  const key = nameKey(patient);
  return others.filter((other) => other.id !== patient.id && nameKey(other) === key);
}

/** The patient's critical results that nobody has acknowledged. */
export function openCriticalsOf(patientId: string): readonly LabResult[] {
  return unacknowledgedCriticals().filter((result) => result.patientId === patientId);
}

// ---------------------------------------------------------------------------------------------------------
// Awaiting a bed
// ---------------------------------------------------------------------------------------------------------

export interface BedRequest {
  /** `SYN-BRQ-…`. */
  readonly id: string;
  readonly patientId: string;
  readonly fromClinicId: ClinicId;
  readonly requestedWardId: WardId;
  readonly priority: OrderPriority;
  readonly reason: Text3;
  readonly requestedIso: string;
  readonly requestedById: string;
}

function clinicianOf(patientId: string, fallback: string): string {
  const appointment = APPOINTMENTS.find((a) => a.patientId === patientId && a.status !== 'cancelled' && a.status !== 'no-show');
  return appointment?.clinicianId ?? fallback;
}

function arrivedPatient(clinicId: ClinicId, status: 'arrived' | 'in-consultation'): string | undefined {
  return APPOINTMENTS.find((a) => a.clinicId === clinicId && a.status === status && a.patientId.startsWith('SYN-PAT-02'))?.patientId;
}

function buildBedRequests(): readonly BedRequest[] {
  const requests: BedRequest[] = [];
  const chestPain = arrivedPatient('clinic-cardio', 'arrived');
  if (chestPain !== undefined) {
    requests.push({
      id: 'SYN-BRQ-0001',
      patientId: chestPain,
      fromClinicId: 'clinic-cardio',
      requestedWardId: 'med-a',
      priority: 'urgent',
      reason: T(
        'Chest pain on exertion: cardiac monitoring and serial troponin',
        'ئازاری سنگ لە کاتی ماندووبوون: چاودێریی دڵ و پشکنینی تڕۆپۆنین بە دووبارە',
        'ألم صدري عند الجهد: مراقبة قلبية وتروبونين متسلسل',
      ),
      requestedIso: todayAt('09:12'),
      requestedById: clinicianOf(chestPain, 'SYN-STF-017'),
    });
  }
  const anaemia = arrivedPatient('clinic-im', 'in-consultation');
  if (anaemia !== undefined) {
    requests.push({
      id: 'SYN-BRQ-0002',
      patientId: anaemia,
      fromClinicId: 'clinic-im',
      requestedWardId: 'med-a',
      priority: 'urgent',
      reason: T(
        'Symptomatic anaemia (Hb 6.9 g/dL): transfusion and investigation',
        'کەمخوێنیی نیشانەدار (Hb 6.9 g/dL): خوێن پێدان و پشکنین',
        'فقر دم عرضي (Hb 6.9 g/dL): نقل دم واستقصاء',
      ),
      requestedIso: todayAt('09:26'),
      requestedById: clinicianOf(anaemia, 'SYN-STF-001'),
    });
  }
  requests.push(
    {
      id: 'SYN-BRQ-0003',
      patientId: 'SYN-PAT-0108',
      fromClinicId: 'clinic-endo',
      requestedWardId: 'med-a',
      priority: 'routine',
      reason: T(
        'Uncontrolled diabetes with dehydration: IV fluids and insulin start',
        'شەکرەی کۆنتڕۆڵنەکراو لەگەڵ وشکبوونەوەی لەش: شلەی ناو دەمار و دەستپێکردنی ئەنسولین',
        'سكري غير منضبط مع جفاف: سوائل وريدية وبدء الإنسولين',
      ),
      requestedIso: todayAt('09:21'),
      requestedById: clinicianOf('SYN-PAT-0108', 'SYN-STF-016'),
    },
    {
      id: 'SYN-BRQ-0004',
      patientId: 'SYN-PAT-0114',
      fromClinicId: 'clinic-surg',
      requestedWardId: 'surg-b',
      priority: 'routine',
      reason: T(
        'Elective right inguinal hernia repair, theatre list tomorrow 08:00',
        'چاککردنەوەی پلاندانراوی فەتقی گەدەی لای ڕاست، لیستی نەشتەرگەریی سبەی 08:00',
        'إصلاح مجدول لفتق إربي أيمن، قائمة العمليات غداً 08:00',
      ),
      requestedIso: todayAt('09:28'),
      requestedById: 'SYN-STF-005',
    },
  );
  return requests;
}

/** Decisions to admit that are waiting for a bed (at 09:30). */
export const BED_REQUESTS: readonly BedRequest[] = buildBedRequests();

// ---------------------------------------------------------------------------------------------------------
// Pending transfers
// ---------------------------------------------------------------------------------------------------------

export interface TransferRequest {
  /** `SYN-TRQ-…`. */
  readonly id: string;
  readonly patientId: string;
  readonly toWardId: WardId;
  readonly reason: TransferReason;
  readonly note: Text3;
  readonly priority: OrderPriority;
  readonly requestedIso: string;
  readonly requestedById: string;
}

export type TransferReason = 'step-down' | 'step-up' | 'specialty' | 'isolation' | 'other';

export const TRANSFER_REASONS: readonly TransferReason[] = ['step-down', 'step-up', 'specialty', 'isolation', 'other'];

function buildTransfers(): readonly TransferRequest[] {
  const transfers: TransferRequest[] = [];
  const icuCensus = BEDS.find((bed) => bed.wardId === 'icu' && bed.patientId?.startsWith('SYN-PAT-02') === true)?.patientId ?? null;
  if (icuCensus !== null) {
    transfers.push({
      id: 'SYN-TRQ-0001',
      patientId: icuCensus,
      toWardId: 'med-a',
      reason: 'step-down',
      note: T(
        'Stable for 24 hours off vasopressors; ready for ward care',
        'بۆ 24 کاتژمێر جێگیرە بەبێ دەرمانی بەرزکردنەوەی پەستان؛ ئامادەیە بۆ چاودێریی قاوش',
        'مستقر منذ 24 ساعة دون رافعات الضغط؛ جاهز للرعاية في الردهة',
      ),
      priority: 'routine',
      requestedIso: todayAt('08:40'),
      requestedById: 'SYN-STF-007',
    });
  }
  const bleed = ENCOUNTERS.find(
    (encounter) => encounter.wardId === 'med-a' && encounter.status === 'active' && encounter.diagnoses[0]?.code === 'K92.2',
  );
  if (bleed !== undefined) {
    transfers.push({
      id: 'SYN-TRQ-0002',
      patientId: bleed.patientId,
      toWardId: 'icu',
      reason: 'step-up',
      note: T(
        'Further melaena overnight, haemoglobin falling: needs close monitoring',
        'دووبارە پیسایی ڕەش لە شەودا، هیمۆگلۆبین دادەبەزێت: پێویستی بە چاودێریی نزیکە',
        'تغوط أسود متكرر ليلاً وانخفاض الهيموغلوبين: يحتاج مراقبة لصيقة',
      ),
      priority: 'urgent',
      requestedIso: todayAt('09:05'),
      requestedById: 'SYN-STF-001',
    });
  }
  return transfers;
}

/** Transfer requests waiting for a bed on another ward (at 09:30). */
export const TRANSFER_REQUESTS: readonly TransferRequest[] = buildTransfers();

// ---------------------------------------------------------------------------------------------------------
// Discharge checklist
// ---------------------------------------------------------------------------------------------------------

export type ChecklistItem = 'summary' | 'meds' | 'followUp' | 'invoice';
export const CHECKLIST_ITEMS: readonly ChecklistItem[] = ['summary', 'meds', 'followUp', 'invoice'];
export type Checklist = Readonly<Record<ChecklistItem, boolean>>;

/** The patient's open balance in dinars (all invoices), or null when the patient has no invoice. */
export function openBalanceIqd(patientId: string): number | null {
  const invoices = invoicesOf(patientId).filter((invoice) => invoice.status !== 'void');
  if (invoices.length === 0) {
    return null;
  }
  return invoices.reduce((sum, invoice) => sum + Math.max(0, invoiceTotals(invoice).balanceIqd), 0);
}

function invoiceSettled(patient: Patient): boolean {
  const balance = openBalanceIqd(patient.id);
  if (balance === null) {
    // No invoice yet: the government scheme and the synthetic insurer have approved cover on file.
    return patient.payerId !== 'self-pay';
  }
  return balance <= 0;
}

const CURATED_CHECKLIST: Readonly<Record<string, Omit<Checklist, 'invoice'>>> = {
  'SYN-PAT-0106': { summary: true, meds: true, followUp: false },
  'SYN-PAT-0110': { summary: false, meds: true, followUp: false },
  'SYN-PAT-0104': { summary: false, meds: true, followUp: true },
  'SYN-PAT-0107': { summary: false, meds: false, followUp: true },
};

/** Census patients expected home today, in bed order (to vary their readiness). */
const DISCHARGE_TODAY_ORDER: readonly string[] = BEDS.flatMap((bed) => {
  if (bed.patientId === null || !bed.patientId.startsWith('SYN-PAT-02')) {
    return [];
  }
  return currentEncounter(bed.patientId)?.expectedDischargeOn === DEMO_TODAY ? [bed.patientId] : [];
});

/** Where each patient's discharge checklist starts on the demo morning. */
export function initialChecklist(patientId: string): Checklist {
  const patient = getPatient(patientId);
  const invoice = invoiceSettled(patient);
  const curated = CURATED_CHECKLIST[patientId];
  if (curated !== undefined) {
    return { ...curated, invoice };
  }
  const order = DISCHARGE_TODAY_ORDER.indexOf(patientId);
  if (order === -1) {
    return { summary: false, meds: false, followUp: false, invoice };
  }
  switch (order % 3) {
    case 0:
      return { summary: true, meds: true, followUp: true, invoice: true };
    case 1:
      return { summary: false, meds: true, followUp: true, invoice };
    default:
      return { summary: true, meds: true, followUp: false, invoice };
  }
}

/** The follow-up clinic for patients leaving each ward. */
export const FOLLOW_UP_CLINIC: Readonly<Record<WardId, ClinicId>> = {
  'med-a': 'clinic-im',
  'surg-b': 'clinic-surg',
  paeds: 'clinic-paeds',
  icu: 'clinic-im',
};

/** The follow-up slot offered by the (simulated) booking: two weeks on, 10:00. */
export const FOLLOW_UP_SLOT_ISO: string = `${demoDate(-14)}T10:00:00+03:00`;

// ---------------------------------------------------------------------------------------------------------
// Today's bed activity before the demo starts, and discharges already done today
// ---------------------------------------------------------------------------------------------------------

/** Discharges earlier today: the beds being cleaned after a discharge. */
export const DISCHARGES_BEFORE_NOW: Readonly<Record<WardId, number>> = BEDS.reduce<Record<WardId, number>>(
  (counts, bed) => {
    if (bed.state === 'cleaning' && bed.note !== null && bed.note.en.toLowerCase().includes('discharge')) {
      counts[bed.wardId] += 1;
    }
    return counts;
  },
  { 'med-a': 0, 'surg-b': 0, paeds: 0, icu: 0 },
);

/** Admissions earlier today (before 09:30), from the encounters. */
export const ADMISSIONS_BEFORE_NOW: Readonly<Record<WardId, number>> = ENCOUNTERS.reduce<Record<WardId, number>>(
  (counts, encounter) => {
    if (encounter.type === 'inpatient' && encounter.wardId !== null && encounter.startIso.startsWith(DEMO_TODAY)) {
      counts[encounter.wardId] += 1;
    }
    return counts;
  },
  { 'med-a': 0, 'surg-b': 0, paeds: 0, icu: 0 },
);

/** The instant used for actions taken in the demo (the clock is fixed). */
export const ACTION_ISO: string = todayAt('09:30');

/** This morning's nursing handover (for the board's header). */
export const LAST_HANDOVER_ISO: string = todayAt('07:30');
