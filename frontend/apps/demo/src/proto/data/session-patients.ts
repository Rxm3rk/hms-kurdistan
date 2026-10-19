/**
 * Patients registered during this browser session (the patients screen's registration form). The prototype
 * writes nothing back to the synthetic data; these records live in memory until the page is reloaded.
 *
 * `findPatient` (./patients.ts) falls back to this list, so a newly registered patient can be opened in the
 * window's patient context (banner, chart, orders, medication, lab, billing) like any other patient.
 *
 * SYNTHETIC DATA ONLY: identifiers continue the synthetic series (`SYN-PAT-0901`, MRN `SYN-100901-1`).
 */
import type { Patient } from './types.ts';

let registered: readonly Patient[] = [];
const listeners = new Set<() => void>();

/** Subscribes to registrations (for useSyncExternalStore). */
export function subscribeSessionPatients(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The patients registered in this session, oldest first (a new array after each registration). */
export function sessionPatients(): readonly Patient[] {
  return registered;
}

/** Adds a registration and tells the subscribers. */
export function addSessionPatient(patient: Patient): void {
  registered = [...registered, patient];
  for (const listener of listeners) {
    listener();
  }
}

/** A patient registered in this session, or undefined. */
export function findSessionPatient(patientId: string): Patient | undefined {
  return registered.find((patient) => patient.id === patientId);
}

export function isSessionPatient(patientId: string): boolean {
  return registered.some((patient) => patient.id === patientId);
}
