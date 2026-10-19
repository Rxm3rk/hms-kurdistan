/**
 * The eMAR screen's model: today's doses of one patient as grid rows, each dose's display state from the
 * data, the demo clock and this screen's own documentation (kept in React state; nothing is written back),
 * and the rules ("state machine") that say what a dose allows now.
 *
 * Time windows (prototype rule, shown in the legend): due from 30 min before to 60 min after the scheduled
 * time; late from 60 to 120 min after; missed when still undocumented 2 h after.
 */
import {
  CURATED_PATIENTS,
  findPatient,
  marOf,
  minutesFromNow,
  ordersOf,
  type MarDose,
  type MedicationSpec,
  type Order,
  type OrderStatus,
  type Patient,
  type Text3,
} from '../../data/index.ts';

export type DoseState = 'scheduled' | 'due' | 'late' | 'missed' | 'given' | 'not-given' | 'held' | 'running' | 'blocked';

export const DOSE_STATES: readonly DoseState[] = ['scheduled', 'due', 'late', 'missed', 'given', 'not-given', 'held', 'running', 'blocked'];

/** Documentation made in this screen (simulated; React state only). */
export interface LocalDoc {
  readonly kind: 'given' | 'not-given';
  readonly iso: string;
  readonly byId: string;
  readonly witnessId: string | null;
  readonly reason: Text3 | null;
  readonly note: string;
}

export interface GridDose {
  readonly id: string;
  readonly orderId: string;
  readonly scheduledIso: string;
  readonly state: DoseState;
  readonly mar: MarDose | null;
  readonly doc: LocalDoc | null;
  /** A PRN dose (given when needed, not on a schedule). */
  readonly prn: boolean;
  /** A PRN dose being started now (not yet documented). */
  readonly fresh: boolean;
}

export interface MedRow {
  readonly order: Order;
  readonly med: MedicationSpec;
  readonly kind: 'continuous' | 'scheduled' | 'prn';
  readonly doses: readonly GridDose[];
}

const ACTIVE: readonly OrderStatus[] = ['active', 'in-progress'];
const SHOWN: readonly OrderStatus[] = ['active', 'in-progress', 'on-hold', 'pending-signature', 'draft'];

export function orderIsActive(order: Order): boolean {
  return ACTIVE.includes(order.status);
}

/** Scheduled, due, late or missed by the demo clock. */
export function timeState(iso: string): 'scheduled' | 'due' | 'late' | 'missed' {
  const minutes = minutesFromNow(iso);
  if (minutes > 30) {
    return 'scheduled';
  }
  if (minutes >= -60) {
    return 'due';
  }
  if (minutes >= -120) {
    return 'late';
  }
  return 'missed';
}

function stateOf(dose: MarDose, doc: LocalDoc | undefined, order: Order): DoseState {
  if (doc !== undefined) {
    return doc.kind;
  }
  switch (dose.status) {
    case 'given':
      return 'given';
    case 'refused':
      return 'not-given';
    case 'held':
      return 'held';
    case 'running':
      return 'running';
    default:
      break;
  }
  if (order.status === 'on-hold') {
    return 'held';
  }
  if (!orderIsActive(order)) {
    return 'blocked';
  }
  return timeState(dose.scheduledIso);
}

export function todayIso(hhmm: string): string {
  const time = hhmm === '24:00' ? '23:59' : hhmm;
  return `2026-10-19T${time}:00+03:00`;
}

/** The patient's medication rows for today's grid. */
export function buildRows(patientId: string, docs: ReadonlyMap<string, LocalDoc>, extra: readonly GridDose[]): readonly MedRow[] {
  const mar = marOf(patientId);
  const rows: MedRow[] = [];
  for (const order of ordersOf(patientId)) {
    const med = order.medication;
    if (med === null) {
      continue;
    }
    const own = mar.filter((dose) => dose.orderId === order.id);
    if (!SHOWN.includes(order.status) && own.length === 0) {
      continue;
    }
    const doses: GridDose[] = own.map((dose) => ({
      id: dose.id,
      orderId: order.id,
      scheduledIso: dose.scheduledIso,
      state: stateOf(dose, docs.get(dose.id), order),
      mar: dose,
      doc: docs.get(dose.id) ?? null,
      prn: med.prn,
      fresh: false,
    }));
    // An order that is not active still shows its planned times: they cannot be given.
    if (!orderIsActive(order) && order.status !== 'on-hold' && !med.prn && !med.continuous) {
      for (const time of med.times) {
        doses.push({
          id: `plan-${order.id}-${time}`,
          orderId: order.id,
          scheduledIso: todayIso(time),
          state: 'blocked',
          mar: null,
          doc: null,
          prn: false,
          fresh: false,
        });
      }
    }
    doses.push(...extra.filter((dose) => dose.orderId === order.id));
    doses.sort((a, b) => a.scheduledIso.localeCompare(b.scheduledIso));
    rows.push({ order, med, kind: med.continuous ? 'continuous' : med.prn ? 'prn' : 'scheduled', doses });
  }
  const rank = { continuous: 0, scheduled: 1, prn: 2 } as const;
  return rows.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.doses[0]?.scheduledIso ?? '').localeCompare(b.doses[0]?.scheduledIso ?? ''));
}

/** Hour (0 to 23) and minutes of an instant on the demo day; earlier days count as 00:00. */
export function hourOf(iso: string): { readonly hour: number; readonly minute: number } {
  if (!iso.startsWith('2026-10-19')) {
    return { hour: 0, minute: 0 };
  }
  return { hour: Number(iso.slice(11, 13)), minute: Number(iso.slice(14, 16)) };
}

/** "HH:MM" of an ISO instant (Baghdad offset in the data). */
export function clockOf(iso: string): string {
  return iso.slice(11, 16);
}

/** Adds minutes to an ISO instant on the Baghdad offset and returns "HH:MM". */
export function clockPlus(iso: string, minutes: number): string {
  const date = new Date(Date.parse(iso) + minutes * 60000 + 3 * 3600000);
  return date.toISOString().slice(11, 16);
}

/** The minimum interval of a PRN order in hours ("Every 6 hours if needed"), or null. */
export function prnIntervalHours(med: MedicationSpec): number | null {
  const match = /(\d+) hours/u.exec(med.frequency.en);
  return match === null ? null : Number(match[1]);
}

/** The last time a PRN medicine was given today (data or this screen), or null. */
export function lastPrnGiven(row: MedRow): string | null {
  const times = row.doses
    .filter((dose) => dose.state === 'given')
    .map((dose) => dose.doc?.iso ?? dose.mar?.givenIso ?? dose.scheduledIso)
    .sort();
  return times.at(-1) ?? null;
}

/** For the wrong-wristband demo: the look-alike name pair, or another curated patient of the same sex. */
export function wrongPatientFor(patient: Patient): Patient {
  const pairs: Readonly<Record<string, string>> = { 'SYN-PAT-0107': 'SYN-PAT-0108', 'SYN-PAT-0108': 'SYN-PAT-0107' };
  const pair = pairs[patient.id];
  const paired = pair === undefined ? undefined : findPatient(pair);
  if (paired !== undefined) {
    return paired;
  }
  return (
    CURATED_PATIENTS.find((candidate) => candidate.id !== patient.id && candidate.sex === patient.sex) ??
    CURATED_PATIENTS.find((candidate) => candidate.id !== patient.id) ??
    patient
  );
}

export interface Reason {
  readonly id: string;
  readonly text: Text3;
}

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export const NOT_GIVEN_REASONS: readonly Reason[] = [
  { id: 'refused', text: T('Patient refused', 'نەخۆش ڕەتی کردەوە', 'رفض المريض') },
  { id: 'nbm', text: T('Nil by mouth', 'هیچ شتێک لە ڕێگەی دەمەوە نا', 'لا شيء عن طريق الفم') },
  { id: 'away', text: T('Patient away from the ward', 'نەخۆش لە قاوش نییە', 'المريض خارج الردهة') },
  { id: 'vomiting', text: T('Vomiting', 'ڕشانەوە', 'تقيؤ') },
  { id: 'clinical', text: T('Withheld on the prescriber’s advice', 'بە ئامۆژگاریی پزیشک ڕاگیرا', 'حُجب بتوجيه الطبيب') },
  { id: 'unavailable', text: T('Medicine not available on the ward', 'دەرمان لە قاوش بەردەست نییە', 'الدواء غير متوفر في الردهة') },
];
