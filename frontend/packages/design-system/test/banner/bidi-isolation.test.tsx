/**
 * UnitTest:bidi-isolation (docs/specs/modules/design-system.md §9, §2.1 rule 5, §2.7; §14.7): names, the MRN,
 * dates and numbers with units are each inside their own `<bdi>`, isolated, with the expected `dir` (and
 * `lang` for names and governed labels), so a Sorani name next to a Latin MRN and a weight in kilograms keeps
 * each part in order in every locale. Computed direction in a real browser is E2E:banner-trilingual-rtl
 * (slice S7).
 */
import { UI_LOCALES } from '@hms/i18n';
import { describe, expect, it } from 'vitest';
import { completeBannerData, field, renderBanner } from './fixtures.tsx';

/** The `<bdi>` inside `scope` whose whole text is `value`. */
function bdiWithText(scope: HTMLElement, value: string): HTMLElement | undefined {
  return [...scope.querySelectorAll<HTMLElement>('bdi')].find((bdi) => bdi.textContent === value);
}

function expectIsolated(element: HTMLElement | undefined, dir: string, lang?: string): void {
  expect(element).toBeDefined();
  expect(element).toHaveAttribute('dir', dir);
  expect(element).toHaveStyle({ unicodeBidi: 'isolate' });
  if (lang === undefined) {
    expect(element).not.toHaveAttribute('lang');
  } else {
    expect(element).toHaveAttribute('lang', lang);
  }
}

describe('UnitTest:bidi-isolation', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      it('isolates every name form with its own direction and language', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        expectIsolated(bdiWithText(field(banner, 'name.ckb'), 'هێمن ئازاد عومەر کەریم'), 'rtl', 'ckb');
        expectIsolated(bdiWithText(field(banner, 'name.ar'), 'هيمن آزاد عمر كريم'), 'rtl', 'ar');
        expectIsolated(bdiWithText(field(banner, 'name.latin'), 'Hêmin Azad Omer Kerîm'), 'ltr', 'und-Latn');
      });

      it('isolates the MRN and every date left to right', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        expectIsolated(bdiWithText(field(banner, 'mrn'), 'SYN-100234-7'), 'ltr');
        expectIsolated(bdiWithText(field(banner, 'dob'), '1984-03-17'), 'ltr');
        expectIsolated(bdiWithText(field(banner, 'codeStatus'), '2026-10-01'), 'ltr');
        expectIsolated(bdiWithText(field(banner, 'weight'), '2026-10-18'), 'ltr');
      });

      it('isolates the weight and its unit together, left to right, with Western digits', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const weight = bdiWithText(field(banner, 'weight'), '72.5 kg');
        expectIsolated(weight, 'ltr');
        expect(field(banner, 'weight').textContent).not.toMatch(/[٠-٩۰-۹]/);
      });

      it('isolates governed labels with their own language and direction', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const direction = locale === 'en' ? 'ltr' : 'rtl';
        const labels = {
          en: ['Penicillin', 'Attempt CPR (synthetic)', 'Contact (synthetic)'],
          ckb: ['پێنیسیلین', 'هەوڵی CPR (نموونە)', 'پەیوەندی (نموونە)'],
          ar: ['بنسلين', 'محاولة CPR (تجريبي)', 'تلامس (تجريبي)'],
        }[locale];
        const [allergy, codeStatus, isolation] = labels;
        expectIsolated(bdiWithText(field(banner, 'allergies'), allergy ?? ''), direction, locale);
        expectIsolated(bdiWithText(field(banner, 'codeStatus'), codeStatus ?? ''), direction, locale);
        expectIsolated(bdiWithText(field(banner, 'isolation'), isolation ?? ''), direction, locale);
      });

      it('leaves no name, MRN, date or number outside a <bdi>', () => {
        const { banner } = renderBanner(completeBannerData(), locale);
        const values = [
          'هێمن ئازاد عومەر کەریم',
          'هيمن آزاد عمر كريم',
          'Hêmin Azad Omer Kerîm',
          'SYN-100234-7',
          '1984-03-17',
          '2026-10-01',
          '2026-10-18',
          '72.5 kg',
        ];
        for (const value of values) {
          const holders = [...banner.querySelectorAll('*')].filter((element) =>
            [...element.childNodes].some(
              (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').includes(value),
            ),
          );
          expect(holders.length, value).toBeGreaterThan(0);
          for (const holder of holders) {
            expect(holder.tagName, value).toBe('BDI');
            expect(holder.textContent, value).toBe(value);
          }
        }
      });
    });
  }
});
