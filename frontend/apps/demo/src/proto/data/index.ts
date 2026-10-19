/**
 * The prototype's shared synthetic data: one import for every screen.
 *
 *   import { PATIENTS, getPatient, ordersOf, BED_STATE_LABEL, DEMO_NOW } from '../../data/index.ts';
 *
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Everything is read-only, in memory and fixed to the demo clock
 * (Monday 19 October 2026, 09:30 Asia/Baghdad). Screens that "change" data (sign an order, give a dose,
 * take a payment) keep the change in their own React state; nothing is written back.
 */
import { CLINICS, DEPARTMENTS, STAFF, WARDS } from './organisation.ts';
import { findPatient } from './patients.ts';
import { bedOfPatient } from './wards.ts';
import type { Clinic, ClinicId, Department, DepartmentId, StaffMember, Ward, WardId } from './types.ts';

export type * from './types.ts';
export * from './clock.ts';
export * from './labels.ts';
export * from './organisation.ts';
export * from './patients.ts';
export * from './wards.ts';
export * from './encounters.ts';
export * from './orders.ts';
export * from './lab.ts';
export * from './clinical.ts';
export * from './billing.ts';
export * from './stats.ts';

const STAFF_BY_ID: ReadonlyMap<string, StaffMember> = new Map(STAFF.map((member) => [member.id, member]));

/** The staff member with this id; throws for an unknown id. */
export function getStaff(staffId: string): StaffMember {
  const member = STAFF_BY_ID.get(staffId);
  if (member === undefined) {
    throw new Error(`Unknown synthetic staff member ${staffId}`);
  }
  return member;
}

/** The staff member with this id, or undefined (for nullable ids such as `givenById`). */
export function findStaff(staffId: string | null | undefined): StaffMember | undefined {
  return staffId === null || staffId === undefined ? undefined : STAFF_BY_ID.get(staffId);
}

export function getDepartment(departmentId: DepartmentId): Department {
  const department = DEPARTMENTS.find((candidate) => candidate.id === departmentId);
  if (department === undefined) {
    throw new Error(`Unknown department ${departmentId}`);
  }
  return department;
}

export function getClinic(clinicId: ClinicId): Clinic {
  const clinic = CLINICS.find((candidate) => candidate.id === clinicId);
  if (clinic === undefined) {
    throw new Error(`Unknown clinic ${clinicId}`);
  }
  return clinic;
}

/** Where an inpatient lies: ward and bed, or undefined for outpatients. */
export function locationOf(patientId: string): { readonly ward: Ward; readonly bedId: string } | undefined {
  const bed = bedOfPatient(patientId);
  if (bed === undefined) {
    return undefined;
  }
  const ward = WARDS.find((candidate) => candidate.id === bed.wardId);
  return ward === undefined ? undefined : { ward, bedId: bed.id };
}

/** True for a known patient id. */
export function isKnownPatient(patientId: string): boolean {
  return findPatient(patientId) !== undefined;
}

/** Ward ids in display order. */
export const WARD_IDS: readonly WardId[] = WARDS.map((ward) => ward.id);
