/**
 * Small helpers shared by the synthetic data of the management and finance extra screens (insurance,
 * dashboard, quality, staff, reports, messaging). SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { PATIENTS, STAFF } from '../index.ts';
import type { Patient, StaffMember, Text3 } from '../types.ts';

/** A Text3 from its three forms (ckb and ar are AI drafts, unreviewed). */
export const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** The n-th patient of the shared list (wraps around), so the extra data always points at real demo patients. */
export function patientAt(index: number): Patient {
  const patient = PATIENTS[index % PATIENTS.length];
  if (patient === undefined) {
    throw new Error('No synthetic patients');
  }
  return patient;
}

/** The n-th staff member of the shared list (wraps around). */
export function staffAt(index: number): StaffMember {
  const member = STAFF[index % STAFF.length];
  if (member === undefined) {
    throw new Error('No synthetic staff');
  }
  return member;
}

/** A small deterministic pseudo-random sequence (so the synthetic series look the same at every load). */
export function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
