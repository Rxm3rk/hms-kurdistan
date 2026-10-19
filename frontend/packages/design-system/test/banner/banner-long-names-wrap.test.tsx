/**
 * UnitTest:banner-long-names-wrap (docs/specs/modules/design-system.md §9, §2.1 rule 3; §18.9 "Names";
 * CTRL-0016-3, not named there yet): four-part names in every script, MRNs and allergy substances are fully
 * present and never truncated, in the banner and in PatientIdentity (the identity part that the switch
 * confirmation, the re-verification step, the palette's patient results and the patient chooser reuse),
 * and two patients whose names differ only in the grandfather's name are told apart.
 *
 * jsdom has no layout, so this test checks what can be checked without one: every character is in the DOM,
 * in one element, with no tooltip-only text, no ellipsis and no inline style that clips; and banner.css,
 * the stylesheet the browser applies, sets no ellipsis, line clamp, fixed or maximum height, hidden or
 * clipped overflow or `nowrap` anywhere but on the icons and the photo image, and lets text wrap. The width
 * and density case in a real browser is the long-name case of E2E:visual and E2E:pseudo-locale (slice S7).
 */
import { UI_LOCALES } from '@hms/i18n';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../src/index.ts';
import { PatientIdentity } from '../../src/banner/index.ts';
import {
  bannerData,
  field,
  LONG_NAMES,
  modelOf,
  readBannerCss,
  renderBanner,
  type BannerData,
} from './fixtures.tsx';

const LONG_MRN = 'SYN-1234567890-ABCDEFGHIJ-1234567890-ABCDEFGHIJ-1234567890-K';
const LONG_SUBSTANCE = 'Amoxicillin with clavulanic acid (co-amoxiclav), all formulations (synthetic)';

function longData(name: (typeof LONG_NAMES)[keyof typeof LONG_NAMES], ownScript: string): BannerData {
  return bannerData({
    name: { ...name, ownScript },
    mrn: LONG_MRN,
    allergies: {
      status: 'list',
      items: [{ substance: { code: 'SYN-ALG-COAMOX', labels: { en: LONG_SUBSTANCE } } }],
    },
  });
}

/** The values that must be shown whole. */
function wholeValues(name: (typeof LONG_NAMES)[keyof typeof LONG_NAMES]): string[] {
  return [name.ckb, name.ar, name.latin, LONG_MRN, LONG_SUBSTANCE];
}

function expectShownWhole(root: HTMLElement, values: readonly string[]): void {
  for (const value of values) {
    const holders = [...root.querySelectorAll('bdi')].filter((bdi) => bdi.textContent === value);
    expect(holders, value).toHaveLength(1);
  }
  // No tooltip-only text and no ellipsis added by the component.
  expect(root.querySelector('[title]')).toBeNull();
  expect(root.textContent).not.toContain('…');
  // No inline style that clips or clamps.
  for (const element of root.querySelectorAll<HTMLElement>('[style]')) {
    expect(element.getAttribute('style')).not.toMatch(/overflow|text-overflow|line-clamp|height|nowrap/);
  }
}

interface CssRule {
  readonly selector: string;
  readonly declarations: readonly (readonly [string, string])[];
}

function bannerCssRules(): CssRule[] {
  const css = readBannerCss().replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').trim(),
    declarations: (match[2] ?? '')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== '')
      .map((declaration) => {
        const colon = declaration.indexOf(':');
        return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const;
      }),
  }));
}

/** Elements with no text, whose size may be fixed. */
const FIXED_SIZE_SELECTORS = new Set(['.hms-banner-icon', '.hms-patient-photo__image']);

describe('UnitTest:banner-long-names-wrap', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      for (const ownScript of ['ckb', 'ar', 'latin'] as const) {
        it(`shows long four-part names whole in the banner, own script ${ownScript}`, () => {
          for (const name of Object.values(LONG_NAMES)) {
            const { banner, result } = renderBanner(longData(name, ownScript), locale);
            expectShownWhole(banner, wholeValues(name));
            result.unmount();
          }
        });
      }

      it('shows long names whole in PatientIdentity, as confirmations and choosers use it', () => {
        for (const name of Object.values(LONG_NAMES)) {
          const { container, unmount } = render(
            <LocaleProvider locale={locale}>
              <PatientIdentity model={modelOf(longData(name, 'ckb'))} />
            </LocaleProvider>,
          );
          expectShownWhole(container, [name.ckb, name.ar, name.latin, LONG_MRN]);
          unmount();
        }
      });

      it("tells apart two patients whose names differ only in the grandfather's name", () => {
        const shown = Object.values(LONG_NAMES).map((name) => {
          const { banner, result } = renderBanner(longData(name, 'ckb'), locale);
          const names = ['name.ckb', 'name.ar', 'name.latin'].map((form) => field(banner, form).textContent);
          result.unmount();
          return names;
        });
        const [first, second] = shown;
        for (const index of [0, 1, 2]) {
          expect(first?.[index]).not.toBe(second?.[index]);
        }
      });
    });
  }

  it("lets the banner's text wrap, and never clips, clamps or fixes the height of text, in banner.css", () => {
    const rules = bannerCssRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const { selector, declarations } of rules) {
      for (const [property, value] of declarations) {
        expect(`${selector} { ${property}: ${value} }`).not.toMatch(
          /text-overflow|line-clamp|white-space:\s*(nowrap|pre)|overflow(-x|-y|-inline|-block)?:\s*(hidden|clip|scroll|auto)/,
        );
        if (!FIXED_SIZE_SELECTORS.has(selector)) {
          expect(`${selector} { ${property} }`).not.toMatch(
            /\{ (height|max-height|block-size|max-block-size|width|inline-size) \}/,
          );
        }
      }
    }
    // The banner and every value let a word wider than its place break rather than overflow.
    for (const selector of ['.hms-banner', '.hms-banner__value', '.hms-banner-status']) {
      const rule = rules.find((candidate) => candidate.selector === selector);
      expect(rule?.declarations, selector).toContainEqual(['overflow-wrap', 'anywhere']);
    }
    // "No photo" may shrink to the space there is and is never wider than it, so its text wraps there; only
    // the photo image keeps a fixed size.
    const missingPhoto = rules.find((candidate) => candidate.selector === '.hms-patient-photo--missing');
    expect(missingPhoto?.declarations).toContainEqual(['flex', '0 1 auto']);
    expect(missingPhoto?.declarations).toContainEqual(['max-inline-size', '100%']);
    expect(missingPhoto?.declarations).toContainEqual(['min-inline-size', 'min(4rem, 100%)']);
  });
});
