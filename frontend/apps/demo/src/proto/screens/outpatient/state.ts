/**
 * Today's outpatient day as the desk changes it: check-ins, walk-ins, patients called to a room and visits
 * completed. It starts from the shared synthetic appointments and lives in memory for the browser session
 * (so leaving the screen and coming back keeps the queue); nothing is written back to the data module.
 *
 * Queue tokens: one letter per clinic and a running number (the data's own tokens are C-01, M-02, D-02,
 * S-01…); the next token of a clinic is one above the highest already issued there.
 */
import { useSyncExternalStore } from 'react';
import { APPOINTMENTS, DEMO_NOW_ISO, type Appointment, type ClinicId, type Text3 } from '../../data/index.ts';

export const TOKEN_PREFIX: Readonly<Record<ClinicId, string>> = {
  'clinic-im': 'M',
  'clinic-endo': 'D',
  'clinic-cardio': 'C',
  'clinic-surg': 'S',
  'clinic-paeds': 'P',
};

/** The clinician who runs each clinic today (from the shared appointments). */
export const CLINIC_CLINICIAN: Readonly<Record<ClinicId, string>> = {
  'clinic-im': 'SYN-STF-008',
  'clinic-endo': 'SYN-STF-016',
  'clinic-cardio': 'SYN-STF-017',
  'clinic-surg': 'SYN-STF-005',
  'clinic-paeds': 'SYN-STF-006',
};

export const WALK_IN_REASON: Text3 = { en: 'Walk-in, no appointment', ckb: 'سەردانی بێ کاتی پێشوەختە', ar: 'مراجعة بلا موعد مسبق' };

export interface CallEvent {
  readonly seq: number;
  readonly token: string;
  readonly clinicId: ClinicId;
  readonly appointmentId: string;
  readonly iso: string;
}

export interface TokenSlip {
  readonly token: string;
  readonly clinicId: ClinicId;
  readonly patientId: string;
  readonly iso: string;
  readonly walkIn: boolean;
}

export interface OpdState {
  readonly appointments: readonly Appointment[];
  readonly calls: readonly CallEvent[];
  readonly lastSlip: TokenSlip | null;
  readonly seq: number;
}

function initialCalls(): CallEvent[] {
  return APPOINTMENTS.filter((appointment) => (appointment.status === 'in-consultation' || appointment.status === 'completed') && appointment.queueNumber !== null)
    .toSorted((a, b) => (a.arrivedIso ?? a.startIso).localeCompare(b.arrivedIso ?? b.startIso))
    .map((appointment, index) => ({
      seq: index + 1,
      token: appointment.queueNumber ?? '',
      clinicId: appointment.clinicId,
      appointmentId: appointment.id,
      iso: appointment.arrivedIso ?? appointment.startIso,
    }));
}

const calls = initialCalls();
let state: OpdState = { appointments: APPOINTMENTS, calls, lastSlip: null, seq: calls.length };
const listeners = new Set<() => void>();

function update(next: OpdState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): OpdState {
  return state;
}

export function useOpdState(): OpdState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function isWalkIn(appointment: Appointment): boolean {
  return appointment.id.startsWith('SYN-APT-W');
}

/** The next queue token of a clinic: `M-03` after M-02. */
export function nextToken(clinicId: ClinicId, appointments: readonly Appointment[] = state.appointments): string {
  const prefix = TOKEN_PREFIX[clinicId];
  let highest = 0;
  for (const appointment of appointments) {
    const token = appointment.queueNumber;
    if (token !== null && token.startsWith(`${prefix}-`)) {
      highest = Math.max(highest, Number(token.slice(prefix.length + 1)) || 0);
    }
  }
  return `${prefix}-${String(highest + 1).padStart(2, '0')}`;
}

function replace(appointmentId: string, change: (appointment: Appointment) => Appointment): void {
  update({ ...state, appointments: state.appointments.map((appointment) => (appointment.id === appointmentId ? change(appointment) : appointment)) });
}

/** Marks a booked appointment arrived and issues its token. Returns the token. */
export function checkIn(appointmentId: string): string {
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (appointment === undefined) {
    return '';
  }
  const token = appointment.queueNumber ?? nextToken(appointment.clinicId);
  replace(appointmentId, (current) => ({ ...current, status: 'arrived', arrivedIso: DEMO_NOW_ISO, queueNumber: token }));
  update({ ...state, lastSlip: { token, clinicId: appointment.clinicId, patientId: appointment.patientId, iso: DEMO_NOW_ISO, walkIn: false } });
  return token;
}

/** Adds a walk-in (already identified at the desk), arrived, with a token. Returns the token. */
export function addWalkIn(patientId: string, clinicId: ClinicId): string {
  const token = nextToken(clinicId);
  const number = state.appointments.filter(isWalkIn).length + 1;
  const appointment: Appointment = {
    id: `SYN-APT-W${String(number).padStart(3, '0')}`,
    patientId,
    clinicId,
    clinicianId: CLINIC_CLINICIAN[clinicId],
    startIso: DEMO_NOW_ISO,
    durationMin: 15,
    status: 'arrived',
    visitType: 'new',
    reason: WALK_IN_REASON,
    arrivedIso: DEMO_NOW_ISO,
    queueNumber: token,
    encounterId: null,
  };
  update({
    ...state,
    appointments: [...state.appointments, appointment],
    lastSlip: { token, clinicId, patientId, iso: DEMO_NOW_ISO, walkIn: true },
  });
  return token;
}

/** Calls a waiting patient to the clinic room: in consultation, and shown on the waiting-room screen. */
export function callPatient(appointmentId: string): CallEvent | null {
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (appointment === undefined || appointment.queueNumber === null) {
    return null;
  }
  replace(appointmentId, (current) => ({ ...current, status: 'in-consultation' }));
  const event: CallEvent = {
    seq: state.seq + 1,
    token: appointment.queueNumber,
    clinicId: appointment.clinicId,
    appointmentId,
    iso: DEMO_NOW_ISO,
  };
  update({ ...state, calls: [...state.calls, event], seq: event.seq });
  return event;
}

/** Calls the longest-waiting patient of a clinic. */
export function callNext(clinicId: ClinicId): CallEvent | null {
  const waiting = state.appointments
    .filter((appointment) => appointment.clinicId === clinicId && appointment.status === 'arrived')
    .toSorted((a, b) => (a.arrivedIso ?? '').localeCompare(b.arrivedIso ?? ''));
  const first = waiting[0];
  return first === undefined ? null : callPatient(first.id);
}

/** Shows the last called token again (the screen flashes and chimes, simulated). */
export function recall(): CallEvent | null {
  const last = state.calls.at(-1);
  if (last === undefined) {
    return null;
  }
  const event: CallEvent = { ...last, seq: state.seq + 1 };
  update({ ...state, calls: [...state.calls, event], seq: event.seq });
  return event;
}

export function completeVisit(appointmentId: string): void {
  replace(appointmentId, (current) => ({ ...current, status: 'completed' }));
}
