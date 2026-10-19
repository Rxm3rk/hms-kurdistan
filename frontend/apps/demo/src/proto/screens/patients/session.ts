/**
 * Patients registered during this browser session (the prototype writes nothing back to the shared data).
 * Kept in memory for as long as the page is open, so a patient registered on the patients screen can be
 * found again, given a wristband, checked in as a walk-in on the outpatient screen and opened in the
 * window's patient context (the shared `findPatient` falls back to these registrations). A reload forgets them.
 *
 * The store itself lives in the data module (src/proto/data/session-patients.ts); this file keeps the hooks.
 *
 * SYNTHETIC DATA ONLY: identifiers continue the synthetic series (`SYN-PAT-0901`, MRN `SYN-100901-1`).
 */
import { useMemo, useSyncExternalStore } from 'react';
import {
  addSessionPatient as addToStore,
  findPatient,
  isSessionPatient as isInStore,
  PATIENTS,
  sessionPatients,
  subscribeSessionPatients,
  type Patient,
} from '../../data/index.ts';

/** The identifiers the next registration will get. */
export function nextIdentifiers(): { readonly id: string; readonly mrn: string } {
  const number = 901 + sessionPatients().length;
  const digits = String(number).padStart(4, '0');
  return { id: `SYN-PAT-${digits}`, mrn: `SYN-10${digits}-${String(number % 10)}` };
}

export function addSessionPatient(patient: Patient): void {
  addToStore(patient);
}

/** The patients registered in this session, oldest first. */
export function useSessionPatients(): readonly Patient[] {
  return useSyncExternalStore(subscribeSessionPatients, sessionPatients, sessionPatients);
}

/** Every patient: the synthetic data, then this session's registrations. */
export function useAllPatients(): readonly Patient[] {
  const session = useSessionPatients();
  return useMemo(() => (session.length === 0 ? PATIENTS : [...PATIENTS, ...session]), [session]);
}

export function isSessionPatient(patientId: string): boolean {
  return isInStore(patientId);
}

/** A patient of the synthetic data or of this session. */
export function findAnyPatient(patientId: string): Patient | undefined {
  return findPatient(patientId);
}
