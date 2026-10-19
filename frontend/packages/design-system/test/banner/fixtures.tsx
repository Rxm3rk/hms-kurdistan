/**
 * Synthetic banner data for the banner tests (§18.10, §3.4 item 7: synthetic only, NOT FOR CLINICAL USE).
 * The names, MRNs and codes are invented; the code-status and isolation codes are ui-core's synthetic
 * vocabulary (OQ-143).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOGUES, type MessageKey, type UiLocale } from '@hms/i18n';
import { parseBannerData, SYNTHETIC_BANNER_VOCABULARIES, type BannerModel } from '@hms/ui-core';
import { render, type RenderResult } from '@testing-library/react';
import { LocaleProvider } from '../../src/index.ts';
import { PatientBanner } from '../../src/banner/index.ts';

export type BannerData = Record<string, unknown>;

/** A complete record with all three name forms, every field valid. */
export function completeBannerData(): BannerData {
  return {
    provenance: 'synthetic',
    patientId: 'SYN-PAT-0001',
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
          reaction: { code: 'SYN-RX-RASH', labels: { en: 'Rash', ckb: 'خورشت', ar: 'طفح' } },
          severity: { code: 'SYN-SEV-MODERATE', labels: { en: 'Moderate', ckb: 'مامناوەند', ar: 'متوسط' } },
        },
        {
          substance: { code: 'SYN-ALG-LATEX', labels: { en: 'Latex', ckb: 'لاتێکس', ar: 'لاتكس' } },
        },
      ],
    },
    codeStatus: {
      status: 'documented',
      concept: {
        code: 'SYN-CS-ATTEMPT-CPR',
        labels: { en: 'Attempt CPR (synthetic)', ckb: 'هەوڵی CPR (نموونە)', ar: 'محاولة CPR (تجريبي)' },
      },
      recordedOn: '2026-10-01',
    },
    isolation: {
      status: 'active',
      precautions: [
        {
          code: 'SYN-ISO-CONTACT',
          labels: { en: 'Contact (synthetic)', ckb: 'پەیوەندی (نموونە)', ar: 'تلامس (تجريبي)' },
        },
        {
          code: 'SYN-ISO-DROPLET',
          labels: { en: 'Droplet (synthetic)', ckb: 'دڵۆپ (نموونە)', ar: 'رذاذ (تجريبي)' },
        },
      ],
    },
    weight: { status: 'recorded', value: '72.50', unit: 'kg', measuredOn: '2026-10-18', source: 'measured' },
  };
}

/** completeBannerData with some fields replaced; a field set to `undefined` is removed. */
export function bannerData(overrides: BannerData): BannerData {
  const data = completeBannerData();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(data, key);
    } else {
      data[key] = value;
    }
  }
  return data;
}

export function modelOf(data: unknown): BannerModel {
  return parseBannerData(data, SYNTHETIC_BANNER_VOCABULARIES);
}

/** Renders the banner for the data in the locale; returns the banner's `<section>` and the render result. */
export function renderBanner(
  data: unknown,
  locale: UiLocale = 'en',
): { readonly banner: HTMLElement; readonly result: RenderResult; readonly model: BannerModel } {
  const model = modelOf(data);
  const result = render(
    <LocaleProvider locale={locale}>
      <PatientBanner model={model} />
    </LocaleProvider>,
  );
  const banner = result.container.querySelector('section');
  if (banner === null) {
    throw new Error('the banner rendered no <section>');
  }
  return { banner, result, model };
}

/** The element of one banner field (`data-field`). */
export function field(banner: HTMLElement, name: string): HTMLElement {
  const element = banner.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (element === null) {
    throw new Error(`the banner has no field ${name}`);
  }
  return element;
}

/** The statuses shown inside an element, by `data-status`. */
export function statusesIn(element: HTMLElement): string[] {
  return [...element.querySelectorAll<HTMLElement>('[data-status]')].map(
    (status) => status.dataset.status ?? '',
  );
}

/** The catalogue text of a key in a locale. */
export function text(locale: UiLocale, key: MessageKey): string {
  return CATALOGUES[locale][key];
}

/**
 * Long four-part names (given, father's, grandfather's and family or tribal name; §11.2) in every script.
 * The two patients differ only in the grandfather's name.
 */
export const LONG_NAMES = {
  first: {
    ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولڕەزاق هەورامانی',
    ar: 'عبدالرحمن عبدالكريم عبدالرزاق الهوراماني',
    latin: 'Abdulrehman Abdulkerîm Abdulrezaq Hewramanî',
  },
  second: {
    ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولموتەلیب هەورامانی',
    ar: 'عبدالرحمن عبدالكريم عبدالمطلب الهوراماني',
    latin: 'Abdulrehman Abdulkerîm Abdulmutelîb Hewramanî',
  },
} as const;

/**
 * The banner's stylesheet as the browser receives it. Read by path from this file's directory: under jsdom
 * `import.meta.url` is not a file URL.
 */
export function readBannerCss(): string {
  return readFileSync(path.join(import.meta.dirname, '../../src/banner/banner.css'), 'utf8');
}
