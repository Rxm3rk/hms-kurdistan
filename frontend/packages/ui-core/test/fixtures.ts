/**
 * Synthetic banner data for the ui-core tests (§18.10, §3.4 item 7: synthetic only, NOT FOR CLINICAL USE).
 * The names, MRNs and codes are invented.
 */
import { parseBannerData, SYNTHETIC_BANNER_VOCABULARIES, type BannerModel } from '../src/index.ts';

/** A complete record with all three name forms, every field valid. */
export function completeBannerData(patientId = 'SYN-PAT-0001'): Record<string, unknown> {
  return {
    provenance: 'synthetic',
    patientId,
    photo: { status: 'present', src: '/demo/photos/syn-0001.webp' },
    name: {
      ckb: 'هێمن ئازاد عومەر کەریم',
      ar: 'هيمن آزاد عمر كريم',
      latin: 'Hêmin Azad Omer Kerîm',
      ownScript: 'ckb',
    },
    mrn: 'SYN-100234-7',
    dob: { value: '1984-03-17', precision: 'day', approximate: false },
    allergies: {
      status: 'list',
      items: [
        {
          substance: {
            code: 'SYN-ALG-PENICILLIN',
            labels: { en: 'Penicillin', ckb: 'پێنیسیلین', ar: 'بنسلين' },
          },
          reaction: { code: 'SYN-RX-RASH', labels: { en: 'Rash' } },
          severity: { code: 'SYN-SEV-MODERATE', labels: { en: 'Moderate' } },
        },
      ],
    },
    codeStatus: {
      status: 'documented',
      concept: { code: 'SYN-CS-ATTEMPT-CPR', labels: { en: 'Attempt CPR (synthetic)' } },
      recordedOn: '2026-10-01',
    },
    isolation: {
      status: 'active',
      precautions: [{ code: 'SYN-ISO-CONTACT', labels: { en: 'Contact (synthetic)' } }],
    },
    weight: { status: 'recorded', value: '72.50', unit: 'kg', measuredOn: '2026-10-18', source: 'measured' },
  };
}

export function bannerFor(data: unknown): BannerModel {
  return parseBannerData(data, SYNTHETIC_BANNER_VOCABULARIES);
}

/** A parsed, valid banner for the patient. */
export function validBanner(patientId = 'SYN-PAT-0001'): BannerModel {
  return bannerFor(completeBannerData(patientId));
}

/** A parsed banner in its error state (no MRN). */
export function errorBanner(patientId = 'SYN-PAT-0001'): BannerModel {
  const data = completeBannerData(patientId);
  delete data.mrn;
  return bannerFor(data);
}

/** A parsed banner whose date of birth is missing: not in its error state, but signing is blocked. */
export function noDobBanner(patientId = 'SYN-PAT-0001'): BannerModel {
  const data = completeBannerData(patientId);
  delete data.dob;
  return bannerFor(data);
}
