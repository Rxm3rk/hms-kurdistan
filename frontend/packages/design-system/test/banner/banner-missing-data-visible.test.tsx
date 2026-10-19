/**
 * UnitTest:banner-missing-data-visible (docs/specs/modules/design-system.md §9; CTRL-0016-3 and CTRL-0001-6,
 * not named there yet): each missing or invalid field shows its own text, in its own place, and the other
 * fields still render (§2.1 rule 4). A missing name form in the patient's script or the Latin form (for a
 * patient whose own script is Latin, the same form) shows "Identity incomplete" and a missing third form is
 * flagged only; an absent or invalid own script shows "Identity incomplete" with the forms in the default
 * order; "No dated weight" and "Weight unavailable" are distinct; a code-status, isolation or allergy label
 * missing in the user's locale shows another locale's label with "Not translated", in every locale; an
 * unknown code-status or isolation code shows the field unavailable; the error state and a missing or
 * invalid date of birth disable signing.
 */
import { UI_LOCALES, type UiLocale } from '@hms/i18n';
import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../src/index.ts';
import { PatientIdentity } from '../../src/banner/index.ts';
import {
  bannerData,
  completeBannerData,
  field,
  modelOf,
  renderBanner,
  statusesIn,
  text,
  type BannerData,
} from './fixtures.tsx';

/** The complete name with one form removed (or replaced). */
function nameWith(overrides: Record<string, unknown>): Record<string, unknown> {
  const name: Record<string, unknown> = {
    ckb: 'هێمن ئازاد عومەر کەریم',
    ar: 'هيمن آزاد عمر كريم',
    latin: 'Hêmin Azad Omer Kerîm',
    ownScript: 'ckb',
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(name, key);
    } else {
      name[key] = value;
    }
  }
  return name;
}

/** What each field shows for the complete record, by locale. */
const COMPLETE_CONTENT: Readonly<Record<UiLocale, Readonly<Record<string, string>>>> = {
  en: { allergies: 'Penicillin', codeStatus: 'Attempt CPR (synthetic)', isolation: 'Contact (synthetic)' },
  ckb: { allergies: 'پێنیسیلین', codeStatus: 'هەوڵی CPR (نموونە)', isolation: 'پەیوەندی (نموونە)' },
  ar: { allergies: 'بنسلين', codeStatus: 'محاولة CPR (تجريبي)', isolation: 'تلامس (تجريبي)' },
};

/** The fields other than `except` still show their complete-record content. */
function expectOtherFieldsRender(banner: HTMLElement, locale: UiLocale, except: string): void {
  const expected: Record<string, string> = {
    'name.latin': 'Hêmin Azad Omer Kerîm',
    mrn: 'SYN-100234-7',
    dob: '1984-03-17',
    weight: '72.5',
    ...COMPLETE_CONTENT[locale],
  };
  for (const [name, content] of Object.entries(expected)) {
    if (name !== except) {
      expect(field(banner, name)).toHaveTextContent(content);
    }
  }
}

describe('UnitTest:banner-missing-data-visible', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      it('shows "No photo" in the photo\'s place for an absent, invalid or failed photo, never an empty frame', () => {
        const cases: BannerData[] = [
          bannerData({ photo: { status: 'absent' } }),
          bannerData({ photo: undefined }),
          bannerData({ photo: { status: 'present', src: 'https://example.invalid/p.png' } }),
          bannerData({ photo: { status: 'present', src: '/p.png', extra: true } }),
        ];
        for (const data of cases) {
          const { banner, result } = renderBanner(data, locale);
          expect(banner.querySelector('img')).toBeNull();
          const photo = banner.querySelector('[data-photo]');
          expect(photo).toHaveAttribute('data-photo', 'missing');
          expect(photo).toHaveTextContent(text(locale, 'banner.photo.missing'));
          result.unmount();
        }
        // A present photo that fails to load.
        const { banner } = renderBanner(completeBannerData(), locale);
        const image = banner.querySelector('img');
        expect(image).not.toBeNull();
        if (image !== null) {
          fireEvent.error(image);
        }
        expect(banner.querySelector('img')).toBeNull();
        expect(banner.querySelector('[data-photo]')).toHaveTextContent(text(locale, 'banner.photo.missing'));
      });

      it('shows a missing Latin name in its place, with "Identity incomplete"', () => {
        for (const latin of [undefined, '', 'Hêmin‮Azad', 'Неmin']) {
          const { banner, result } = renderBanner(bannerData({ name: nameWith({ latin }) }), locale);
          expect(field(banner, 'name.latin')).toHaveTextContent(text(locale, 'banner.name.latinMissing'));
          expect(statusesIn(banner)).toContain('identity.incomplete');
          expect(banner).toHaveTextContent(text(locale, 'banner.identity.incomplete'));
          expect(banner).toHaveAttribute('data-identity-incomplete', 'true');
          // Flagged, not blocking (DN-032): signing stays open while the date of birth is valid.
          expect(banner).toHaveAttribute('data-signing-blocked', 'false');
          expect(banner).toHaveAttribute('data-error-state', 'false');
          result.unmount();
        }
      });

      it('shows a missing own-script name with "Identity incomplete", and a missing third form flagged only', () => {
        const ownMissing = renderBanner(bannerData({ name: nameWith({ ckb: undefined }) }), locale);
        expect(field(ownMissing.banner, 'name.ckb')).toHaveTextContent(
          text(locale, 'banner.name.kurdishMissing'),
        );
        expect(statusesIn(ownMissing.banner)).toContain('identity.incomplete');
        ownMissing.result.unmount();

        const thirdMissing = renderBanner(bannerData({ name: nameWith({ ar: undefined }) }), locale);
        expect(field(thirdMissing.banner, 'name.ar')).toHaveTextContent(
          text(locale, 'banner.name.arabicMissing'),
        );
        expect(statusesIn(field(thirdMissing.banner, 'name.ar'))).toEqual(['name.ar.missing']);
        expect(statusesIn(thirdMissing.banner)).not.toContain('identity.incomplete');
        expect(thirdMissing.banner).toHaveAttribute('data-identity-incomplete', 'false');
      });

      it('shows "Identity incomplete" and the default name order when the own script is absent or invalid', () => {
        for (const ownScript of [undefined, null, 'kmr', 'CKB', 7]) {
          const { banner, result, model } = renderBanner(
            bannerData({ name: nameWith({ ownScript }) }),
            locale,
          );
          const names = [...banner.querySelectorAll<HTMLElement>('[data-field^="name."]')];
          expect(names.map((element) => element.dataset.field)).toEqual([
            'name.ckb',
            'name.ar',
            'name.latin',
          ]);
          // Every form is still shown: only the patient's own script is unknown.
          expect(field(banner, 'name.latin')).toHaveTextContent('Hêmin Azad Omer Kerîm');
          expect(statusesIn(banner)).toContain('identity.incomplete');
          expect(banner).toHaveTextContent(text(locale, 'banner.identity.incomplete'));
          expect(banner).toHaveAttribute('data-identity-incomplete', 'true');
          expect(model.errorState).toBe(false);
          result.unmount();
        }
      });

      it('shows a missing Latin name for a patient whose own script is Latin, with "Identity incomplete"', () => {
        const { banner, model } = renderBanner(
          bannerData({ name: nameWith({ ownScript: 'latin', latin: undefined }) }),
          locale,
        );
        const names = [...banner.querySelectorAll<HTMLElement>('[data-field^="name."]')];
        expect(names.map((element) => element.dataset.field)).toEqual(['name.latin', 'name.ckb', 'name.ar']);
        expect(statusesIn(field(banner, 'name.latin'))).toEqual(['name.latin.missing']);
        expect(field(banner, 'name.latin')).toHaveTextContent(text(locale, 'banner.name.latinMissing'));
        expect(statusesIn(banner)).toContain('identity.incomplete');
        expect(banner).toHaveAttribute('data-identity-incomplete', 'true');
        expect(model.errorState).toBe(false);
        // The two forms in Arabic script are still shown.
        expect(field(banner, 'name.ckb')).toHaveTextContent('هێمن ئازاد عومەر کەریم');
        expect(field(banner, 'name.ar')).toHaveTextContent('هيمن آزاد عمر كريم');
      });

      it('shows "Date of birth missing" or "unavailable", with "Identity incomplete", and disables signing', () => {
        for (const [dob, status, key] of [
          [undefined, 'dob.missing', 'banner.dob.missing'],
          [null, 'dob.missing', 'banner.dob.missing'],
          [
            { value: '1984-02-30', precision: 'day', approximate: false },
            'dob.unavailable',
            'banner.dob.unavailable',
          ],
          [
            { value: '1984-01-01', precision: 'year', approximate: true },
            'dob.unavailable',
            'banner.dob.unavailable',
          ],
          ['1984-03-17', 'dob.unavailable', 'banner.dob.unavailable'],
        ] as const) {
          const { banner, result, model } = renderBanner(bannerData({ dob }), locale);
          expect(statusesIn(field(banner, 'dob'))).toEqual([status]);
          expect(field(banner, 'dob')).toHaveTextContent(text(locale, key));
          expect(statusesIn(banner)).toContain('identity.incomplete');
          expect(model.signingBlocked).toBe(true);
          expect(banner).toHaveAttribute('data-signing-blocked', 'true');
          expect(banner).toHaveAttribute('data-error-state', 'false');
          expectOtherFieldsRender(banner, locale, 'dob');
          result.unmount();
        }
      });

      it('shows the error state for a missing or invalid MRN, patient id or every name form, and disables signing', () => {
        const cases: BannerData[] = [
          bannerData({ mrn: undefined }),
          bannerData({ mrn: 'SYN 100234' }),
          bannerData({ patientId: undefined }),
          bannerData({ name: undefined }),
          bannerData({ name: { ckb: '', ar: null, latin: 7, ownScript: 'ckb' } }),
        ];
        for (const data of cases) {
          const { banner, result, model } = renderBanner(data, locale);
          expect(model.errorState).toBe(true);
          expect(banner).toHaveAttribute('data-error-state', 'true');
          expect(banner).toHaveAttribute('data-signing-blocked', 'true');
          expect(statusesIn(banner)[0]).toBe('banner.dataUnavailable');
          expect(banner).toHaveTextContent(text(locale, 'banner.dataUnavailable'));
          // The other fields still render with their own content or state.
          expect(field(banner, 'allergies')).toHaveTextContent(COMPLETE_CONTENT[locale].allergies ?? '');
          result.unmount();
        }
        const noMrn = renderBanner(bannerData({ mrn: undefined }), locale);
        expect(statusesIn(field(noMrn.banner, 'mrn'))).toEqual(['mrn.unavailable']);
        expect(field(noMrn.banner, 'mrn')).toHaveTextContent(text(locale, 'banner.dataUnavailable'));
      });

      it('shows "Allergy status unavailable" for missing, invalid or contradictory data, never NKA', () => {
        const cases: unknown[] = [
          undefined,
          null,
          { status: 'unknown' },
          { status: 'list', items: [] },
          { status: 'nka', items: [{ substance: { code: 'SYN-ALG-LATEX', labels: { en: 'Latex' } } }] },
          { status: 'not-assessed', items: [] },
          { status: 'list', items: [{ substance: { code: 'SYN-ALG-LATEX', labels: { en: 'Latex' } } }, {}] },
        ];
        for (const allergies of cases) {
          const { banner, result } = renderBanner(bannerData({ allergies }), locale);
          const allergyField = field(banner, 'allergies');
          expect(statusesIn(allergyField)).toEqual(['allergies.unavailable']);
          expect(allergyField).toHaveTextContent(text(locale, 'banner.allergies.unavailable'));
          expect(allergyField).not.toHaveTextContent(text(locale, 'banner.allergies.nka'));
          expect(allergyField.querySelector('li')).toBeNull();
          expectOtherFieldsRender(banner, locale, 'allergies');
          result.unmount();
        }
      });

      it('shows code status and isolation unavailable for missing data or a code the vocabulary does not know', () => {
        for (const [overrides, codeStatus, isolation] of [
          [
            { codeStatus: undefined, isolation: undefined },
            'codeStatus.unavailable',
            'isolation.unavailable',
          ],
          [
            {
              codeStatus: {
                status: 'documented',
                concept: { code: 'SYN-CS-UNKNOWN', labels: { en: 'Unknown' } },
                recordedOn: '2026-10-01',
              },
              isolation: {
                status: 'active',
                precautions: [
                  { code: 'SYN-ISO-CONTACT', labels: { en: 'Contact' } },
                  { code: 'SYN-ISO-UNKNOWN', labels: { en: 'Unknown' } },
                ],
              },
            },
            'codeStatus.unavailable',
            'isolation.unavailable',
          ],
          [
            { codeStatus: { status: 'not-documented' }, isolation: { status: 'none-recorded' } },
            'codeStatus.notDocumented',
            'isolation.noneRecorded',
          ],
        ] as const) {
          const { banner, result } = renderBanner(bannerData(overrides), locale);
          expect(statusesIn(field(banner, 'codeStatus'))).toEqual([codeStatus]);
          expect(statusesIn(field(banner, 'isolation'))).toEqual([isolation]);
          result.unmount();
        }
        const unavailable = renderBanner(bannerData({ codeStatus: undefined, isolation: undefined }), locale);
        expect(field(unavailable.banner, 'codeStatus')).toHaveTextContent(
          text(locale, 'banner.codeStatus.unavailable'),
        );
        expect(field(unavailable.banner, 'isolation')).toHaveTextContent(
          text(locale, 'banner.isolation.unavailable'),
        );
        expect(text(locale, 'banner.codeStatus.unavailable')).not.toBe(
          text(locale, 'banner.codeStatus.notDocumented'),
        );
        expect(text(locale, 'banner.isolation.unavailable')).not.toBe(
          text(locale, 'banner.isolation.noneRecorded'),
        );
      });

      it('shows "No dated weight" and "Weight unavailable" as distinct states, never as a weight', () => {
        const none = renderBanner(bannerData({ weight: { status: 'none-recorded' } }), locale);
        expect(statusesIn(field(none.banner, 'weight'))).toEqual(['weight.missing']);
        expect(field(none.banner, 'weight')).toHaveTextContent(text(locale, 'banner.weight.missing'));
        none.result.unmount();

        const recorded = { status: 'recorded', unit: 'kg', measuredOn: '2026-10-18', source: 'measured' };
        const invalid: unknown[] = [
          undefined,
          { ...recorded, value: '0' },
          { ...recorded, value: '0.0' },
          { ...recorded, value: '-72' },
          { ...recorded, value: '72,5' },
          { ...recorded, value: '٧٢' },
          { status: 'recorded', value: '72.5', unit: 'kg', source: 'measured' },
          { ...recorded, value: '72.5', unit: 'lb' },
        ];
        for (const weight of invalid) {
          const { banner, result } = renderBanner(bannerData({ weight }), locale);
          const weightField = field(banner, 'weight');
          expect(statusesIn(weightField)).toEqual(['weight.unavailable']);
          expect(weightField).toHaveTextContent(text(locale, 'banner.weight.unavailable'));
          expect(weightField.querySelector('.hms-clinical-number')).toBeNull();
          expectOtherFieldsRender(banner, locale, 'weight');
          result.unmount();
        }
        expect(text(locale, 'banner.weight.missing')).not.toBe(text(locale, 'banner.weight.unavailable'));
      });

      it('shows a label missing in the user\'s locale in another locale, with "Not translated"; a code when none has one', () => {
        const data = bannerData({
          allergies: {
            status: 'list',
            items: [
              { substance: { code: 'SYN-ALG-ONLY-AR', labels: { ar: 'أسبرين' } } },
              { substance: { code: 'SYN-ALG-NO-LABEL', labels: {} } },
            ],
          },
        });
        const { banner } = renderBanner(data, locale);
        const [onlyArabic, noLabel] = [...field(banner, 'allergies').querySelectorAll('li')];
        const arabicLabel = onlyArabic?.querySelector('bdi');
        expect(arabicLabel).toHaveTextContent('أسبرين');
        expect(arabicLabel).toHaveAttribute('lang', 'ar');
        expect(statusesIn(onlyArabic ?? document.body)).toEqual(
          locale === 'ar' ? [] : ['label.untranslated'],
        );
        const codeLabel = noLabel?.querySelector('bdi');
        expect(codeLabel).toHaveTextContent('SYN-ALG-NO-LABEL');
        expect(codeLabel).toHaveAttribute('lang', 'zxx');
        expect(statusesIn(noLabel ?? document.body)).toEqual(['label.untranslated']);
        expect(noLabel).toHaveTextContent(text(locale, 'banner.label.untranslated'));
      });

      it(`shows a code-status, isolation or allergy label missing in the user's locale in another locale, with "Not translated"`, () => {
        // A locale other than the user's that has the label: in ar too, so the fallback path is exercised
        // in every locale.
        const other: UiLocale = locale === 'en' ? 'ckb' : 'en';
        const otherLabel = { en: 'Synthetic label', ckb: 'ناونیشانی نموونە', ar: 'تسمية تجريبية' }[other];
        const data = bannerData({
          allergies: {
            status: 'list',
            items: [{ substance: { code: 'SYN-ALG-OTHER', labels: { [other]: otherLabel } } }],
          },
          codeStatus: {
            status: 'documented',
            concept: { code: 'SYN-CS-ATTEMPT-CPR', labels: { [other]: otherLabel } },
            recordedOn: '2026-10-01',
          },
          isolation: {
            status: 'active',
            precautions: [{ code: 'SYN-ISO-CONTACT', labels: { [other]: otherLabel } }],
          },
        });
        const { banner } = renderBanner(data, locale);
        for (const name of ['allergies', 'codeStatus', 'isolation']) {
          const governed = field(banner, name).querySelector<HTMLElement>('.hms-governed-label');
          expect(governed, name).not.toBeNull();
          expect(governed).toHaveAttribute('data-untranslated', 'true');
          const label = governed?.querySelector('bdi');
          expect(label).toHaveTextContent(otherLabel);
          expect(label).toHaveAttribute('lang', other);
          expect(label).toHaveAttribute('dir', other === 'en' ? 'ltr' : 'rtl');
          expect(statusesIn(governed ?? document.body)).toEqual(['label.untranslated']);
          expect(governed).toHaveTextContent(text(locale, 'banner.label.untranslated'));
        }
        // Still the documented code status and the active isolation, not their missing states.
        expect(statusesIn(field(banner, 'codeStatus'))[0]).toBe('codeStatus.documented');
        expect(statusesIn(field(banner, 'isolation'))[0]).toBe('isolation.active');
      });

      it('shows the same missing states in PatientIdentity, the identity part reused by confirmations', () => {
        const model = modelOf(
          bannerData({ photo: undefined, dob: undefined, name: nameWith({ latin: undefined }) }),
        );
        const { container } = render(
          <LocaleProvider locale={locale}>
            <PatientIdentity model={model} />
          </LocaleProvider>,
        );
        const identity = within(container);
        expect(identity.getByText(text(locale, 'banner.photo.missing'))).toBeInTheDocument();
        expect(identity.getByText(text(locale, 'banner.name.latinMissing'))).toBeInTheDocument();
        expect(identity.getByText(text(locale, 'banner.dob.missing'))).toBeInTheDocument();
        expect(identity.getByText(text(locale, 'banner.identity.incomplete'))).toBeInTheDocument();
      });
    });
  }
});
