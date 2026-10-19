/**
 * UnitTest:banner-renders-every-field (docs/specs/modules/design-system.md §9; CTRL-0016-3, and CTRL-0001-7
 * and CTRL-0005-3, not named there yet): the photo, every name form, the MRN, the date of birth with the
 * approximate-DOB flag for an approximate or partial date, allergies, code status, isolation and the dated
 * weight with its source, in every UI locale.
 */
import { CATALOGUES, UI_LOCALES, uiIntlLocale, type UiLocale } from '@hms/i18n';
import { GROUP_SEPARATOR, NUMBER_UNIT_SEPARATOR, SYNTHETIC_UNIT_DISPLAY_MAP } from '@hms/ui-core';
import { render, within } from '@testing-library/react';
import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { ClinicalNumber, LocaleProvider } from '../../src/index.ts';
import { bannerData, completeBannerData, field, renderBanner, statusesIn, text } from './fixtures.tsx';

/** The allergy count as the locale's catalogue words it, formatted apart from the banner. */
function allergyCount(locale: UiLocale, count: number): string {
  const intl = createIntl({ locale: uiIntlLocale(locale), messages: CATALOGUES[locale] });
  return intl.formatMessage({ id: 'banner.allergies.count' }, { count });
}

/** A list of `count` allergies, each with its own synthetic substance. */
function allergyList(count: number): Record<string, unknown> {
  return {
    status: 'list',
    items: Array.from({ length: count }, (_, index) => ({
      substance: {
        code: `SYN-ALG-${String(index)}`,
        labels: {
          en: `Substance ${String(index)}`,
          ckb: `ماددە ${String(index)}`,
          ar: `مادة ${String(index)}`,
        },
      },
    })),
  };
}

describe('UnitTest:banner-renders-every-field', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      it('is a region named "Patient banner", not the page header landmark', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        expect(banner.tagName).toBe('SECTION');
        expect(banner).toHaveAttribute('aria-label', text(locale, 'banner.region.label'));
        expect(banner).not.toHaveAttribute('role');
        expect(banner).toHaveAttribute('data-error-state', 'false');
        expect(banner).toHaveAttribute('data-signing-blocked', 'false');
        expect(banner).toHaveAttribute('data-identity-incomplete', 'false');
      });

      it('shows the photo with its alternative text', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const photo = within(banner).getByRole('img', { name: text(locale, 'banner.photo.alt') });
        expect(photo).toHaveAttribute('src', '/demo/photos/syn-0001.webp');
        expect(statusesIn(banner)).not.toContain('photo.missing');
      });

      it('shows every name form, each labelled, the own-script form first', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const names = [...banner.querySelectorAll<HTMLElement>('[data-field^="name."]')];
        expect(names.map((element) => element.dataset.field)).toEqual(['name.ckb', 'name.ar', 'name.latin']);
        expect(field(banner, 'name.ckb')).toHaveTextContent(text(locale, 'banner.name.kurdish.label'));
        expect(field(banner, 'name.ckb')).toHaveTextContent('هێمن ئازاد عومەر کەریم');
        expect(field(banner, 'name.ar')).toHaveTextContent(text(locale, 'banner.name.arabic.label'));
        expect(field(banner, 'name.ar')).toHaveTextContent('هيمن آزاد عمر كريم');
        expect(field(banner, 'name.latin')).toHaveTextContent(text(locale, 'banner.name.latin.label'));
        expect(field(banner, 'name.latin')).toHaveTextContent('Hêmin Azad Omer Kerîm');
        expect(names[0]).toHaveClass('hms-patient-name--first');
      });

      it('puts the Latin form first for a patient whose own script is Latin', () => {
        const data = completeBannerData();
        data.name = { ckb: 'جۆن سمیس', ar: 'جون سميث', latin: 'John Smith', ownScript: 'latin' };
        const { banner } = renderBanner(data, locale);
        const names = [...banner.querySelectorAll<HTMLElement>('[data-field^="name."]')];
        expect(names.map((element) => element.dataset.field)).toEqual(['name.latin', 'name.ckb', 'name.ar']);
      });

      it('shows the MRN as stored and an exact date of birth without the approximate flag', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        expect(field(banner, 'mrn')).toHaveTextContent(text(locale, 'banner.mrn.label'));
        expect(field(banner, 'mrn')).toHaveTextContent('SYN-100234-7');
        expect(field(banner, 'dob')).toHaveTextContent(text(locale, 'banner.dob.label'));
        expect(field(banner, 'dob')).toHaveTextContent('1984-03-17');
        expect(statusesIn(field(banner, 'dob'))).toEqual([]);
      });

      it('shows an approximate or partial date of birth at its precision, with the approximate flag', () => {
        for (const [dob, shown] of [
          [{ value: '1984', precision: 'year', approximate: true }, '1984'],
          [{ value: '1984', precision: 'year', approximate: false }, '1984'],
          [{ value: '1984-03', precision: 'month', approximate: false }, '1984-03'],
          // An approximate date recorded at day precision, on a day that is not the §18.10 estimate
          // placeholder. A placeholder sent at day precision (1 January or 1 July) is shown with its day:
          // the open limitation KA-041, not asserted here.
          [{ value: '1984-03-12', precision: 'day', approximate: true }, '1984-03-12'],
        ] as const) {
          const { banner, result } = renderBanner(bannerData({ dob }), locale);
          const dobField = field(banner, 'dob');
          expect(dobField.querySelector('bdi')?.textContent).toBe(shown);
          expect(statusesIn(dobField)).toEqual(['dob.approximate']);
          expect(dobField).toHaveTextContent(text(locale, 'banner.dob.approximateFlag'));
          // The date is shown as recorded: no placeholder day or month is added to a partial date.
          expect(dobField.querySelectorAll('bdi')).toHaveLength(1);
          expect(dobField.textContent).not.toMatch(new RegExp(`${shown}-`));
          result.unmount();
        }
      });

      it('shows every allergy with its reaction and severity, and the count', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const allergies = field(banner, 'allergies');
        expect(allergies).toHaveTextContent(text(locale, 'banner.allergies.label'));
        expect(statusesIn(allergies)[0]).toBe('allergies.list');
        const items = allergies.querySelectorAll('li');
        expect(items).toHaveLength(2);
        const labels = {
          en: ['Penicillin', 'Rash', 'Moderate', 'Latex'],
          ckb: ['پێنیسیلین', 'خورشت', 'مامناوەند', 'لاتێکس'],
          ar: ['بنسلين', 'طفح', 'متوسط', 'لاتكس'],
        }[locale];
        expect(items[0]).toHaveTextContent(labels[0] ?? '');
        expect(items[0]?.querySelector('[data-detail="reaction"]')).toHaveTextContent(labels[1] ?? '');
        expect(items[0]?.querySelector('[data-detail="severity"]')).toHaveTextContent(labels[2] ?? '');
        expect(items[1]).toHaveTextContent(labels[3] ?? '');
        expect(items[1]?.querySelector('[data-detail]')).toBeNull();
        // The count is the catalogue's plural for 2, with Western digits.
        expect(allergies.querySelector('[data-status="allergies.list"]')?.textContent).toBe(
          allergyCount(locale, 2),
        );
        if (locale === 'en') {
          expect(allergyCount(locale, 2)).toBe('2 allergies');
        }
        // Nothing is collapsed behind a control.
        expect(within(allergies).queryByRole('button')).toBeNull();
      });

      it("shows the allergy count in the locale's plural form for each count", () => {
        for (const count of [1, 2, 3, 11, 12, 100]) {
          const { banner, result } = renderBanner(bannerData({ allergies: allergyList(count) }), locale);
          const allergies = field(banner, 'allergies');
          expect(allergies.querySelectorAll('li')).toHaveLength(count);
          const shown = allergies.querySelector('[data-status="allergies.list"]')?.textContent;
          expect(shown).toBe(allergyCount(locale, count));
          expect(shown).toContain(String(count));
          result.unmount();
        }
      });

      it('shows NKA and "not assessed" as their own texts', () => {
        for (const [status, key] of [
          ['nka', 'banner.allergies.nka'],
          ['not-assessed', 'banner.allergies.notAssessed'],
        ] as const) {
          const { banner, result } = renderBanner(bannerData({ allergies: { status } }), locale);
          expect(field(banner, 'allergies')).toHaveTextContent(text(locale, key));
          result.unmount();
        }
      });

      it('shows the documented code status with its governed label and the date recorded', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const codeStatus = field(banner, 'codeStatus');
        expect(codeStatus).toHaveTextContent(text(locale, 'banner.codeStatus.label'));
        expect(statusesIn(codeStatus)).toEqual(['codeStatus.documented']);
        const label = { en: 'Attempt CPR (synthetic)', ckb: 'هەوڵی CPR (نموونە)', ar: 'محاولة CPR (تجريبي)' }[
          locale
        ];
        expect(codeStatus).toHaveTextContent(label);
        expect(codeStatus).toHaveTextContent('2026-10-01');
      });

      it('shows "Code status not documented" and "No isolation recorded"', () => {
        const { banner } = renderBanner(
          bannerData({ codeStatus: { status: 'not-documented' }, isolation: { status: 'none-recorded' } }),
          locale,
        );
        expect(field(banner, 'codeStatus')).toHaveTextContent(
          text(locale, 'banner.codeStatus.notDocumented'),
        );
        expect(field(banner, 'isolation')).toHaveTextContent(text(locale, 'banner.isolation.noneRecorded'));
      });

      it('shows every active isolation precaution', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const isolation = field(banner, 'isolation');
        expect(isolation).toHaveTextContent(text(locale, 'banner.isolation.label'));
        expect(within(isolation).getAllByRole('listitem')).toHaveLength(2);
        const labels = {
          en: ['Contact (synthetic)', 'Droplet (synthetic)'],
          ckb: ['پەیوەندی (نموونە)', 'دڵۆپ (نموونە)'],
          ar: ['تلامس (تجريبي)', 'رذاذ (تجريبي)'],
        }[locale];
        for (const label of labels) {
          expect(isolation).toHaveTextContent(label);
        }
      });

      it('shows the dated weight in kilograms with its source and the date measured', () => {
        for (const source of ['measured', 'stated', 'estimated'] as const) {
          const { banner, result } = renderBanner(
            bannerData({
              weight: { status: 'recorded', value: '72.50', unit: 'kg', measuredOn: '2026-10-18', source },
            }),
            locale,
          );
          const weight = field(banner, 'weight');
          expect(weight).toHaveTextContent(text(locale, 'banner.weight.label'));
          expect(weight.querySelector('.hms-clinical-number')?.textContent).toBe('72.5 kg');
          expect(weight).toHaveTextContent(text(locale, `banner.weight.source.${source}`));
          expect(weight).toHaveTextContent('2026-10-18');
          result.unmount();
        }
      });

      it("shows the weight through ClinicalNumber: the component's own markup, the model's display text", () => {
        for (const value of ['72.50', '0.85', '3.2', '0070.0', '1250.5', '12345.678']) {
          const { banner, result, model } = renderBanner(
            bannerData({
              weight: { status: 'recorded', value, unit: 'kg', measuredOn: '2026-10-18', source: 'measured' },
            }),
            locale,
          );
          expect(model.weight.status).toBe('recorded');
          const shown = field(banner, 'weight').querySelector('.hms-clinical-number');
          const expected = render(
            <LocaleProvider locale={locale}>
              <ClinicalNumber value={value} unit="kg" unitDisplayMap={SYNTHETIC_UNIT_DISPLAY_MAP} />
            </LocaleProvider>,
          );
          const reference = expected.container.querySelector('.hms-clinical-number');
          expect(reference).not.toBeNull();
          // The same element, attributes and text as ClinicalNumber renders for the recorded value.
          expect(shown?.outerHTML).toBe(reference?.outerHTML);
          if (model.weight.status === 'recorded') {
            expect(shown?.textContent).toBe(model.weight.quantity.text);
          }
          expect(shown).toHaveAttribute('dir', 'ltr');
          expected.unmount();
          result.unmount();
        }
        // A grouped weight keeps its U+202F separator, as ClinicalNumber shows it.
        const grouped = renderBanner(
          bannerData({
            weight: {
              status: 'recorded',
              value: '1250.5',
              unit: 'kg',
              measuredOn: '2026-10-18',
              source: 'stated',
            },
          }),
          locale,
        );
        expect(field(grouped.banner, 'weight').querySelector('.hms-clinical-number')?.textContent).toBe(
          `1${GROUP_SEPARATOR}250.5${NUMBER_UNIT_SEPARATOR}kg`,
        );
      });
    });
  }
});
