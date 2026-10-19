/**
 * Banner models and "where is the patient today" for the patients screen. The model comes from the same
 * parser the real PatientBanner uses (ui-core's parseBannerData over the data module's bannerDataOf), so a
 * patient registered in this session is shown, checked and flagged exactly like the synthetic ones.
 */
import { parseBannerData, SYNTHETIC_BANNER_VOCABULARIES, type BannerModel } from '@hms/ui-core';
import { appointmentsOf, bannerDataOf, getClinic, locationOf, type Appointment, type Patient, type Ward } from '../../data/index.ts';

const models = new WeakMap<Patient, BannerModel>();

/** The banner model of a patient (synthetic data or this session), parsed once. */
export function identityOf(patient: Patient): BannerModel {
  const cached = models.get(patient);
  if (cached !== undefined) {
    return cached;
  }
  const model = parseBannerData(bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES);
  models.set(patient, model);
  return model;
}

/** A banner model for a draft (not cached: it changes with every keystroke). */
export function draftIdentity(patient: Patient): BannerModel {
  return parseBannerData(bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES);
}

export type WhereToday =
  | { readonly kind: 'ward'; readonly ward: Ward; readonly bedId: string }
  | { readonly kind: 'clinic'; readonly appointment: Appointment; readonly clinicName: ReturnType<typeof getClinic>['name'] }
  | { readonly kind: 'none' };

export function whereToday(patient: Patient): WhereToday {
  const location = locationOf(patient.id);
  if (location !== undefined) {
    return { kind: 'ward', ward: location.ward, bedId: location.bedId };
  }
  const appointment = appointmentsOf(patient.id)
    .filter((candidate) => candidate.status !== 'cancelled')
    .toSorted((a, b) => a.startIso.localeCompare(b.startIso))
    .at(-1);
  if (appointment !== undefined) {
    return { kind: 'clinic', appointment, clinicName: getClinic(appointment.clinicId).name };
  }
  return { kind: 'none' };
}
