/**
 * Where the web app finds patients (docs/specs/modules/design-system.md §2.2, §4).
 *
 * A directory lists the patients a chooser or the command palette offers, with the identity a list shows,
 * and loads one patient's banner data. Both are untrusted until ui-core's parseBannerData has read them field
 * by field. The app reads a patient's data only by the window's patient context, never by a URL (§2.2): the
 * directory is asked for the context's patient and, while a switch waits for confirmation, for the requested
 * one.
 *
 * Production builds have no directory yet: the patient search and the chart API come with WP-0.4 and the
 * clinical work packages (KA-044), so a production build offers no patient and opens none. Demo builds use
 * the synthetic fixtures (src/demo/).
 */
import { parseBannerData, type BannerModel, type BannerVocabularies } from '@hms/ui-core';

/** One patient as a list shows it. */
export interface PatientListEntry {
  readonly patientId: string;
  /** The identity a chooser or the palette shows (PatientIdentity reads the identity fields only). */
  readonly identity: BannerModel;
}

export interface PatientDirectory {
  /**
   * The code-status and isolation codes this directory's data uses; any other code shows its field as
   * unavailable (design-system §2.1 rule 6).
   */
  readonly vocabularies: BannerVocabularies;
  /** The patients a chooser or the palette offers. */
  readonly list: () => readonly PatientListEntry[];
  /** One patient's banner data, untrusted; undefined when the directory does not know the patient. */
  readonly loadBannerData: (patientId: string) => Promise<unknown>;
}

/** The production directory until WP-0.4: no patients, no codes (KA-044). */
export const NO_PATIENT_DIRECTORY: PatientDirectory = {
  vocabularies: { codeStatus: new Set(), isolation: new Set() },
  list: () => [],
  loadBannerData: () => Promise.resolve(undefined),
};

/**
 * One patient's banner model, or null when the directory does not know the patient (it resolved undefined):
 * a patient that does not exist is never opened (OQ-163). Never rejects: data that cannot be loaded (the
 * directory failed) is parsed as missing, so the banner shows its error state ("Patient banner data
 * unavailable") and signing stays blocked (fail visibly, §2.1 rule 4).
 */
export async function loadBannerModel(
  directory: PatientDirectory,
  patientId: string,
): Promise<BannerModel | null> {
  let data: unknown;
  try {
    data = await directory.loadBannerData(patientId);
  } catch {
    return parseBannerData(undefined, directory.vocabularies);
  }
  return data === undefined ? null : parseBannerData(data, directory.vocabularies);
}
