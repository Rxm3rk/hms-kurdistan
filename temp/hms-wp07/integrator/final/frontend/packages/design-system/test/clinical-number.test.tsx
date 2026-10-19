/**
 * ClinicalNumber and Bdi in the DOM (docs/specs/modules/design-system.md §2.6, §2.7). The display rules
 * themselves are ui-core's (UnitTest:clinical-number-ismp-display-rules, slice S3); this file checks that
 * the component renders ui-core's string unchanged inside `<bdi dir="ltr">`, shows the invalid and missing
 * markers from the catalogue in every locale, and never writes Eastern Arabic-Indic digits.
 */
import { CATALOGUES, UI_LOCALES, type UiLocale } from '@hms/i18n';
import { formatClinicalQuantity, SYNTHETIC_UNIT_DISPLAY_MAP } from '@hms/ui-core';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Bdi, ClinicalNumber, LocaleProvider } from '../src/index.ts';

function inLocale(locale: UiLocale, node: ReactNode): HTMLElement {
  return render(<LocaleProvider locale={locale}>{node}</LocaleProvider>).container;
}

describe('ClinicalNumber', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      it('renders a number and its unit in one <bdi dir="ltr">, joined by a no-break space', () => {
        const container = inLocale(locale, <ClinicalNumber value=".5" unit="mg" />);
        const bdi = container.querySelector('bdi');
        expect(bdi).toHaveAttribute('dir', 'ltr');
        expect(bdi?.textContent).toBe('0.5 mg');
        expect(bdi).toHaveStyle({ unicodeBidi: 'isolate' });
      });

      it('groups a large integer part with U+202F and writes Western digits only', () => {
        const container = inLocale(locale, <ClinicalNumber value="150000.50" />);
        expect(container.querySelector('bdi')?.textContent).toBe('150 000.5');
        expect(container.textContent).not.toMatch(/[٠-٩۰-۹]/);
      });

      it('shows "Invalid value" from the catalogue for a malformed value or an unmapped unit, never the input', () => {
        for (const node of [
          <ClinicalNumber key="a" value="1,5" />,
          <ClinicalNumber key="b" value="٠٫٥" />,
          <ClinicalNumber key="c" value="5" unit="IU" />,
        ]) {
          const container = inLocale(locale, node);
          expect(container.querySelector('bdi')).toBeNull();
          expect(container.querySelector('[data-status="invalid"]')).toHaveTextContent(
            CATALOGUES[locale]['clinical.number.invalid'],
          );
          expect(container.textContent).not.toMatch(/1,5|٠٫٥|IU/);
        }
      });

      it('shows "Not recorded" from the catalogue for an absent value', () => {
        for (const value of ['', null, undefined]) {
          const container = inLocale(locale, <ClinicalNumber value={value} unit="kg" />);
          expect(container.querySelector('[data-status="missing"]')).toHaveTextContent(
            CATALOGUES[locale]['clinical.value.missing'],
          );
        }
      });
    });
  }

  it('renders exactly the text ui-core computes, ISMP unit names included', () => {
    for (const [value, unit] of [
      ['0.250', 'ug'],
      ['2.50', 'U'],
      ['-0', 'kg'],
      ['1000', '[iU]'],
    ] as const) {
      const expected = formatClinicalQuantity(value, unit, SYNTHETIC_UNIT_DISPLAY_MAP);
      const container = inLocale('ckb', <ClinicalNumber value={value} unit={unit} />);
      expect(expected.status).toBe('valid');
      expect(container.querySelector('bdi')?.textContent).toBe(
        expected.status === 'valid' ? expected.text : '',
      );
    }
  });
});

describe('Bdi', () => {
  it('renders <bdi> with the stated dir and lang, isolated', () => {
    const name = CATALOGUES.ckb['language.ckb.endonym'];
    const container = inLocale(
      'en',
      <Bdi dir="rtl" lang="ckb">
        {name}
      </Bdi>,
    );
    const bdi = container.querySelector('bdi');
    expect(bdi).toHaveAttribute('dir', 'rtl');
    expect(bdi).toHaveAttribute('lang', 'ckb');
    expect(bdi).toHaveStyle({ unicodeBidi: 'isolate' });
    expect(bdi).toHaveTextContent(name);
  });

  it('leaves lang off when the language is not known', () => {
    const container = inLocale('ar', <Bdi dir="auto">{CATALOGUES.en['app.name']}</Bdi>);
    expect(container.querySelector('bdi')).not.toHaveAttribute('lang');
    expect(container.querySelector('bdi')).toHaveAttribute('dir', 'auto');
  });
});
