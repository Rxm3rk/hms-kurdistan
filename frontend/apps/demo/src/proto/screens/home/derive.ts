/**
 * Worklists of the home screen, derived (read-only) from the shared synthetic data. SYNTHETIC DATA ONLY.
 * Nothing here writes back; the home screen only reads and links to the screens that act.
 */
import {
  BEDS,
  ENCOUNTERS,
  INVOICES,
  MAR,
  NOTES,
  ORDERS,
  PATIENTS,
  SPECIMENS,
  WARDS,
  bedOfPatient,
  currentEncounter,
  demoDate,
  findOrder,
  getPatient,
  invoiceTotals,
  minutesFromNow,
  hasFallRiskAlert,
  unacknowledgedCriticals,
} from '../../data/index.ts';
import type {
  Bed,
  ClinicalNote,
  Encounter,
  Invoice,
  InvoiceStatus,
  LabResult,
  MarDose,
  Order,
  Patient,
  Specimen,
  Ward,
  WardId,
} from '../../data/index.ts';

/** A safety cue shown beside a patient in a worklist (always with text and an icon, never colour alone). */
export type FlagKind = 'critical' | 'overdue' | 'allergy' | 'allergy-unknown' | 'isolation' | 'fall' | 'dnacpr';

/** True when the patient carries the "High fall risk" alert. */
export function hasFallRisk(patient: Patient): boolean {
  return hasFallRiskAlert(patient);
}

/** Patients with an unacknowledged critical result (read live: the lab screen's acknowledgement clears it). */
function criticalPatients(): ReadonlySet<string> {
  return new Set(unacknowledgedCriticals().map((result) => result.patientId));
}
const OVERDUE_PATIENTS: ReadonlySet<string> = new Set(MAR.filter((dose) => dose.status === 'overdue').map((dose) => dose.patientId));

/** The safety cues of one patient, most urgent first. */
export function flagsOf(patient: Patient): readonly FlagKind[] {
  const flags: FlagKind[] = [];
  if (criticalPatients().has(patient.id)) {
    flags.push('critical');
  }
  if (OVERDUE_PATIENTS.has(patient.id)) {
    flags.push('overdue');
  }
  if (patient.allergies.kind === 'list') {
    flags.push('allergy');
  } else if (patient.allergies.kind === 'not-assessed') {
    flags.push('allergy-unknown');
  }
  if (patient.isolation !== null) {
    flags.push('isolation');
  }
  if (hasFallRisk(patient)) {
    flags.push('fall');
  }
  if (patient.codeStatus.kind === 'dnacpr') {
    flags.push('dnacpr');
  }
  return flags;
}

/** The ward a patient lies in, or null for outpatients. */
export function wardIdOf(patientId: string): WardId | null {
  return bedOfPatient(patientId)?.wardId ?? null;
}

export function wardById(wardId: WardId): Ward | undefined {
  return WARDS.find((ward) => ward.id === wardId);
}

function inScope(patientId: string, wardId: WardId | null): boolean {
  const ward = wardIdOf(patientId);
  return wardId === null ? ward !== null : ward === wardId;
}

// ---------------------------------------------------------------------------------------------------------
// Physician
// ---------------------------------------------------------------------------------------------------------

export interface MyPatientRow {
  readonly patient: Patient;
  readonly encounter: Encounter;
  readonly flags: readonly FlagKind[];
}

/** The active inpatients a consultant is attending, flagged patients first. */
export function myInpatients(staffId: string): readonly MyPatientRow[] {
  return ENCOUNTERS.filter((encounter) => encounter.type === 'inpatient' && encounter.status === 'active' && encounter.attendingId === staffId)
    .map((encounter) => {
      const patient = getPatient(encounter.patientId);
      return { patient, encounter, flags: flagsOf(patient) };
    })
    .toSorted(
      (a, b) =>
        b.flags.length - a.flags.length ||
        Number(b.patient.curated) - Number(a.patient.curated) ||
        (a.encounter.bedId ?? '').localeCompare(b.encounter.bedId ?? ''),
    );
}

export type SignItem =
  | {
      readonly kind: 'order';
      readonly id: string;
      readonly order: Order;
      readonly patient: Patient;
      readonly authorId: string;
      readonly iso: string;
      /** The order carries a danger alert (an allergy conflict): it must not be signed as it stands. */
      readonly conflict: boolean;
    }
  | {
      readonly kind: 'note';
      readonly id: string;
      readonly note: ClinicalNote;
      readonly patient: Patient;
      readonly authorId: string;
      readonly iso: string;
      /** Written by the consultant herself (not a co-signature). */
      readonly own: boolean;
    };

/** Orders awaiting signature and unsigned notes on the consultant's own patients, newest first. */
export function signQueue(staffId: string): readonly SignItem[] {
  const isMine = (patientId: string): boolean => currentEncounter(patientId)?.attendingId === staffId;
  const orders: SignItem[] = ORDERS.filter((order) => order.status === 'pending-signature' && isMine(order.patientId)).map((order) => ({
    kind: 'order',
    id: order.id,
    order,
    patient: getPatient(order.patientId),
    authorId: order.orderedById,
    iso: order.orderedIso,
    conflict: order.alerts.some((alert) => alert.tone === 'danger'),
  }));
  const notes: SignItem[] = NOTES.filter((note) => !note.signed && isMine(note.patientId)).map((note) => ({
    kind: 'note',
    id: note.id,
    note,
    patient: getPatient(note.patientId),
    authorId: note.authorId,
    iso: note.iso,
    own: note.authorId === staffId,
  }));
  return [...orders, ...notes].toSorted((a, b) => Number(b.kind === 'order' && b.conflict) - Number(a.kind === 'order' && a.conflict) || b.iso.localeCompare(a.iso));
}

export interface CriticalRow {
  readonly result: LabResult;
  readonly patient: Patient;
  readonly specimen: Specimen | undefined;
  /** Minutes since the result was released. */
  readonly waitingMin: number;
}

export function criticalRows(): readonly CriticalRow[] {
  return unacknowledgedCriticals().map((result) => ({
    result,
    patient: getPatient(result.patientId),
    specimen: SPECIMENS.find((specimen) => specimen.id === result.specimenId),
    waitingMin: Math.max(0, -minutesFromNow(result.resultedIso)),
  }));
}

// ---------------------------------------------------------------------------------------------------------
// Nurse
// ---------------------------------------------------------------------------------------------------------

export interface RoundRow {
  readonly dose: MarDose;
  readonly order: Order | undefined;
  readonly patient: Patient;
  readonly bed: Bed | undefined;
  readonly minutes: number;
}

/** Doses overdue, due now or scheduled within the next hour, overdue first. `wardId` null: every ward. */
export function roundsDue(wardId: WardId | null): readonly RoundRow[] {
  return MAR.filter((dose) => {
    const minutes = minutesFromNow(dose.scheduledIso);
    const relevant = dose.status === 'overdue' || dose.status === 'due' || (dose.status === 'scheduled' && minutes >= 0 && minutes <= 60);
    return relevant && inScope(dose.patientId, wardId);
  })
    .map((dose) => ({
      dose,
      order: findOrder(dose.orderId),
      patient: getPatient(dose.patientId),
      bed: bedOfPatient(dose.patientId),
      minutes: minutesFromNow(dose.scheduledIso),
    }))
    .toSorted((a, b) => Number(b.dose.status === 'overdue') - Number(a.dose.status === 'overdue') || a.minutes - b.minutes);
}

export type NurseTask =
  | { readonly kind: 'overdue-dose' | 'held-dose' | 'refused-dose'; readonly id: string; readonly dose: MarDose; readonly order: Order | undefined; readonly patient: Patient }
  | { readonly kind: 'critical'; readonly id: string; readonly result: LabResult; readonly patient: Patient }
  | { readonly kind: 'bed-reserved' | 'bed-cleaning' | 'bed-blocked'; readonly id: string; readonly bed: Bed }
  | { readonly kind: 'discharges'; readonly id: string; readonly count: number };

/** Outstanding nursing tasks in scope, most urgent first. */
export function nurseTasks(wardId: WardId | null): readonly NurseTask[] {
  const tasks: NurseTask[] = [];
  for (const result of unacknowledgedCriticals()) {
    if (inScope(result.patientId, wardId)) {
      tasks.push({ kind: 'critical', id: result.id, result, patient: getPatient(result.patientId) });
    }
  }
  const doseKinds: readonly ['overdue' | 'held' | 'refused', 'overdue-dose' | 'held-dose' | 'refused-dose'][] = [
    ['overdue', 'overdue-dose'],
    ['held', 'held-dose'],
    ['refused', 'refused-dose'],
  ];
  for (const [status, kind] of doseKinds) {
    for (const dose of MAR) {
      if (dose.status === status && inScope(dose.patientId, wardId)) {
        tasks.push({ kind, id: dose.id, dose, order: findOrder(dose.orderId), patient: getPatient(dose.patientId) });
      }
    }
  }
  const today = demoDate(0);
  const discharges = ENCOUNTERS.filter(
    (encounter) => encounter.type === 'inpatient' && encounter.status === 'active' && encounter.expectedDischargeOn === today && inScope(encounter.patientId, wardId),
  ).length;
  if (discharges > 0) {
    tasks.push({ kind: 'discharges', id: 'discharges', count: discharges });
  }
  const bedKinds: readonly ['reserved' | 'cleaning' | 'blocked', 'bed-reserved' | 'bed-cleaning' | 'bed-blocked'][] = [
    ['reserved', 'bed-reserved'],
    ['cleaning', 'bed-cleaning'],
    ['blocked', 'bed-blocked'],
  ];
  for (const [state, kind] of bedKinds) {
    for (const bed of BEDS) {
      if (bed.state === state && (wardId === null || bed.wardId === wardId)) {
        tasks.push({ kind, id: bed.id, bed });
      }
    }
  }
  return tasks;
}

export interface WatchRow {
  readonly patient: Patient;
  readonly bed: Bed | undefined;
  readonly isolation: boolean;
  readonly fall: boolean;
}

/** Inpatients in isolation or at high risk of falls. */
export function safetyWatch(wardId: WardId | null): readonly WatchRow[] {
  return PATIENTS.filter((patient) => (patient.isolation !== null || hasFallRisk(patient)) && inScope(patient.id, wardId)).map((patient) => ({
    patient,
    bed: bedOfPatient(patient.id),
    isolation: patient.isolation !== null,
    fall: hasFallRisk(patient),
  }));
}

// ---------------------------------------------------------------------------------------------------------
// Cashier
// ---------------------------------------------------------------------------------------------------------

const STATUS_ORDER: Readonly<Record<InvoiceStatus, number>> = { open: 0, 'partially-paid': 1, draft: 2, paid: 3, void: 4 };

export interface OpenInvoiceRow {
  readonly invoice: Invoice;
  readonly patient: Patient;
  readonly balanceIqd: number;
}

/** Invoices not yet settled (unpaid, part paid, interim), unpaid first, then by balance. */
export function openInvoices(): readonly OpenInvoiceRow[] {
  return INVOICES.filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'void')
    .map((invoice) => ({ invoice, patient: getPatient(invoice.patientId), balanceIqd: invoiceTotals(invoice).balanceIqd }))
    .toSorted((a, b) => STATUS_ORDER[a.invoice.status] - STATUS_ORDER[b.invoice.status] || b.balanceIqd - a.balanceIqd);
}
