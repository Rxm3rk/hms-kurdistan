/**
 * Patients registered during this browser session (the prototype writes nothing back to the shared data).
 * Kept in memory for as long as the page is open, so a patient registered on the patients screen can be
 * found again, given a wristband and checked in as a walk-in on the outpatient screen. A reload forgets them.
 *
 * SYNTHETIC DATA ONLY: identifiers continue the synthetic series (`SYN-PAT-0901`, MRN `SYN-100901-1`).
 */
import { useMemo, useSyncExternalStore } from 'react';
import { findPatient, PATIENTS, type Patient } from '../../data/index.ts';

let registered: readonly Patient[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): readonly Patient[] {
  return registered;
}

/** The identifiers the next registration will get. */
export function nextIdentifiers(): { readonly id: string; readonly mrn: string } {
  const number = 901 + registered.length;
  const digits = String(number).padStart(4, '0');
  return { id: `SYN-PAT-${digits}`, mrn: `SYN-10${digits}-${String(number % 10)}` };
}

export function addSessionPatient(patient: Patient): void {
  registered = [...registered, patient];
  for (const listener of listeners) {
    listener();
  }
}

/** The patients registered in this session, oldest first. */
export function useSessionPatients(): readonly Patient[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Every patient: the synthetic data, then this session's registrations. */
export function useAllPatients(): readonly Patient[] {
  const session = useSessionPatients();
  return useMemo(() => (session.length === 0 ? PATIENTS : [...PATIENTS, ...session]), [session]);
}

export function isSessionPatient(patientId: string): boolean {
  return registered.some((patient) => patient.id === patientId);
}

/** A patient of the synthetic data or of this session. */
export function findAnyPatient(patientId: string): Patient | undefined {
  return findPatient(patientId) ?? registered.find((patient) => patient.id === patientId);
}
