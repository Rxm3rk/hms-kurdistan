/**
 * The prototype's demo module: the window's patient directory (the synthetic patients of src/proto/data), the
 * synthetic session user, the design system's simulated sign-in (KA-032) and a simulated server that accepts
 * every sign command and stores nothing. SYNTHETIC DATA AND SIMULATED SIGN-IN, NOT FOR CLINICAL USE.
 */
import { createSimulatedAuthenticator, type SignSubmitter } from '@hms/design-system';
import { parseBannerData, SYNTHETIC_BANNER_VOCABULARIES, type BannerModel, type UserId } from '@hms/ui-core';
import type { DemoModule } from '../../demo/demo-module.ts';
import type { PatientDirectory, PatientListEntry } from '../../patient/directory.ts';
import { bannerDataOf, findPatient, PATIENTS } from '../data/patients.ts';
import { sessionPatients } from '../data/session-patients.ts';

/** The window's session user (synthetic). The role switcher changes the person shown, not this id. */
export const PROTO_SESSION_USER: UserId = 'user-synthetic-prototype';

let entries: readonly PatientListEntry[] | null = null;
let entriesSession: readonly unknown[] | null = null;

/**
 * Every synthetic patient, then this session's registrations, as list entries (parsed again only after a
 * registration).
 */
function listEntries(): readonly PatientListEntry[] {
  const session = sessionPatients();
  if (entries === null || entriesSession !== session) {
    entries = [...PATIENTS, ...session].map((patient) => ({
      patientId: patient.id,
      identity: parseBannerData(bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES),
    }));
    entriesSession = session;
  }
  return entries;
}

/** The banner model of one patient (for lists that show PatientIdentity). */
export function bannerModelOf(patientId: string): BannerModel {
  const patient = findPatient(patientId);
  return parseBannerData(patient === undefined ? undefined : bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES);
}

export const protoDirectory: PatientDirectory = {
  vocabularies: SYNTHETIC_BANNER_VOCABULARIES,
  list: listEntries,
  loadBannerData: (patientId) => {
    const patient = findPatient(patientId);
    return Promise.resolve(patient === undefined ? undefined : bannerDataOf(patient));
  },
};

/** Accepts every sign command and stores nothing. */
const submit: SignSubmitter = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 'accepted' });
    }, 400);
  });

export const protoModule: DemoModule = {
  directory: protoDirectory,
  sessionUser: PROTO_SESSION_USER,
  authenticator: createSimulatedAuthenticator(PROTO_SESSION_USER),
  submit,
  pages: [],
  patientPath: '/chart',
  createClinicalRoutes: () => [],
};
