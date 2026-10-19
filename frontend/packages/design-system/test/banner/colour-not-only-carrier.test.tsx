/**
 * UnitTest:colour-not-only-carrier (docs/specs/modules/design-system.md §9, §2.1 rule 2; §6.5): every status
 * variant of the banner has its own text and its own icon shape, so colour only repeats what text and shape
 * already say. Within one field no two statuses share a text or an icon, in any locale, and no two icons
 * share an outline: the outline is read from the drawing itself (its first element: a circle, a square, a
 * wide card, a closed polygon by its number of corners, or a curved outline), so two icons that differ only
 * by a small inner mark fail. Every status shows its icon and a text that assistive technology reads as its
 * name (the icon itself is decorative, OQ-161); and each tone's colours come from one role pair of
 * tokens.css. How the icons look at their real size, in a real browser, is held by the E2E:visual baselines
 * (slice S7), not by this test.
 */
import { CATALOGUES, UI_LOCALES } from '@hms/i18n';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../src/index.ts';
import {
  BANNER_STATUSES,
  BannerStatus,
  ICON_SHAPES,
  StatusIcon,
  type BannerStatusId,
  type BannerStatusSpec,
} from '../../src/banner/index.ts';
import { bannerData, field, readBannerCss, renderBanner, type BannerData } from './fixtures.tsx';

const STATUS_IDS = Object.keys(BANNER_STATUSES) as BannerStatusId[];

function specOf(id: BannerStatusId): BannerStatusSpec {
  return BANNER_STATUSES[id];
}

/** The status ids of each field. */
function byField(): Map<string, BannerStatusId[]> {
  const fields = new Map<string, BannerStatusId[]>();
  for (const id of STATUS_IDS) {
    const list = fields.get(specOf(id).field) ?? [];
    list.push(id);
    fields.set(specOf(id).field, list);
  }
  return fields;
}

function expectAllDistinct(values: readonly string[], context = ''): void {
  expect(new Set(values).size, `${context} ${values.join(', ')}`).toBe(values.length);
}

const PATH_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g;

/**
 * The outline of a closed SVG path: `curved` when it has a curve or arc, otherwise `polygon-<corners>`;
 * `open` when it is not closed. Reads the path data's commands and counts the corners they draw.
 */
function pathOutline(data: string): string {
  const tokens = data.match(PATH_TOKEN) ?? [];
  if (tokens.some((token) => /^[CcSsQqTtAa]$/.test(token))) {
    return 'curved';
  }
  if (!tokens.some((token) => /^[Zz]$/.test(token))) {
    return 'open';
  }
  let corners = 0;
  let command = '';
  let numbers = 0;
  for (const token of tokens) {
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      numbers = 0;
      continue;
    }
    numbers += 1;
    // M, L: a corner per coordinate pair (later pairs after M are lines); H, V: a corner per number.
    if (/^[MmLl]$/.test(command) ? numbers % 2 === 0 : /^[HhVv]$/.test(command)) {
      corners += 1;
    }
  }
  return `polygon-${String(corners)}`;
}

/**
 * The outline family of an icon, read from its drawing's first element. A dashed circle, a circle and an
 * ellipse are one family, so two round icons in one field fail however their dashes or inner marks differ.
 */
function outlineOf(shape: (typeof ICON_SHAPES)[number]): string {
  const { container, unmount } = render(<StatusIcon shape={shape} />);
  const outline = container.querySelector('svg')?.firstElementChild;
  const family = outline === null || outline === undefined ? '' : outlineFamily(outline);
  unmount();
  return family;
}

function outlineFamily(outline: Element): string {
  switch (outline.tagName.toLowerCase()) {
    case 'circle':
    case 'ellipse':
      return 'round';
    case 'rect':
      return outline.getAttribute('width') === outline.getAttribute('height') ? 'square' : 'card';
    case 'path':
      return pathOutline(outline.getAttribute('d') ?? '');
    default:
      return '';
  }
}

/** What one rendered status shows: its id, its icon's shape and its text. */
interface ShownStatus {
  readonly id: string;
  readonly icon: string;
  readonly text: string;
}

function shownStatus(element: HTMLElement): ShownStatus {
  const icon = element.querySelector('svg');
  const textElement = element.querySelector('.hms-banner-status__text');
  return {
    id: element.dataset.status ?? '',
    icon: icon?.getAttribute('data-icon') ?? '',
    text: textElement?.textContent ?? '',
  };
}

/** For each field, banner data that shows each of its statuses. */
const FIELD_VARIANTS: Readonly<Record<string, readonly BannerData[]>> = {
  dob: [
    { dob: { value: '1984', precision: 'year', approximate: true } },
    { dob: undefined },
    { dob: { value: '1984-13', precision: 'month', approximate: false } },
  ],
  allergies: [
    {},
    { allergies: { status: 'nka' } },
    { allergies: { status: 'not-assessed' } },
    { allergies: { status: 'nka', items: [] } },
  ],
  codeStatus: [{}, { codeStatus: { status: 'not-documented' } }, { codeStatus: { status: 'unknown' } }],
  isolation: [{}, { isolation: { status: 'none-recorded' } }, { isolation: undefined }],
  weight: [
    { weight: { status: 'none-recorded' } },
    { weight: { status: 'recorded', value: '0', unit: 'kg' } },
  ],
};

describe('UnitTest:colour-not-only-carrier', () => {
  it('gives every status of a field its own icon shape and its own message', () => {
    for (const [, ids] of byField()) {
      expectAllDistinct(ids.map((id) => specOf(id).icon));
      const messages = ids.map((id) => specOf(id).message).filter((key) => key !== undefined);
      expectAllDistinct(messages);
    }
  });

  for (const locale of UI_LOCALES) {
    it(`gives every status of a field a distinct text in ${locale}`, () => {
      for (const [, ids] of byField()) {
        const texts = ids
          .map((id) => specOf(id).message)
          .filter((key) => key !== undefined)
          .map((key) => CATALOGUES[locale][key]);
        expectAllDistinct(texts);
      }
    });
  }

  it('gives every status of a field an icon of its own outline, read from the drawing', () => {
    for (const shape of ICON_SHAPES) {
      expect(outlineOf(shape), shape).toMatch(/^(round|square|card|polygon-\d+|curved)$/);
    }
    for (const [name, ids] of byField()) {
      expectAllDistinct(
        ids.map((id) => outlineOf(specOf(id).icon)),
        name,
      );
    }
  });

  it('reads outlines from the drawing: corners of a polygon, a curve, a square against a card', () => {
    expect(pathOutline('M8 1.75 14.75 14H1.25Z')).toBe('polygon-3');
    expect(pathOutline('M8 1.25 14.75 8 8 14.75 1.25 8Z')).toBe('polygon-4');
    expect(pathOutline('M5.2 1.25h5.6l3.95 3.95v5.6l-3.95 3.95H5.2l-3.95-3.95V5.2Z')).toBe('polygon-8');
    expect(pathOutline('M8 1 C 1 1 1 9 8 9Z')).toBe('curved');
    expect(pathOutline('M8 6v3.75')).toBe('open');
    expect(outlineOf('missing')).toBe('round');
    expect(outlineOf('none-known')).toBe('round');
    expect(outlineOf('not-assessed')).toBe('square');
    expect(outlineOf('identity-incomplete')).toBe('card');
    expect(outlineOf('isolation')).toBe('curved');
  });

  it('draws every icon shape differently', () => {
    const drawings = ICON_SHAPES.map((shape) => {
      const { container } = render(<StatusIcon shape={shape} />);
      return container.querySelector('svg')?.innerHTML ?? '';
    });
    expectAllDistinct(drawings);
    for (const drawing of drawings) {
      expect(drawing).not.toBe('');
    }
  });

  for (const locale of UI_LOCALES) {
    it(`shows each status with its icon and a text that names it, in ${locale}`, () => {
      for (const id of STATUS_IDS) {
        const spec = specOf(id);
        const { container, unmount } = render(
          <LocaleProvider locale={locale}>
            <BannerStatus status={id}>{spec.message === undefined ? id : undefined}</BannerStatus>
          </LocaleProvider>,
        );
        const element = container.querySelector<HTMLElement>(`[data-status="${id}"]`);
        expect(element).not.toBeNull();
        if (element === null) {
          continue;
        }
        const shown = shownStatus(element);
        expect(shown.icon).toBe(spec.icon);
        expect(element.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(shown.text.trim()).not.toBe('');
        if (spec.message !== undefined) {
          expect(shown.text).toBe(CATALOGUES[locale][spec.message]);
        }
        // The text is exposed to assistive technology: nothing on the way to it is hidden.
        const textElement = element.querySelector('.hms-banner-status__text');
        expect(textElement?.closest('[aria-hidden="true"]')).toBeNull();
        expect(element).toHaveClass(`hms-banner-status--${spec.tone}`);
        unmount();
      }
    });

    it(`shows every variant of a banner field with a distinct icon and text, in ${locale}`, () => {
      for (const [name, variants] of Object.entries(FIELD_VARIANTS)) {
        const shown: ShownStatus[] = [];
        for (const overrides of variants) {
          const { banner, result } = renderBanner(bannerData(overrides), locale);
          const status = field(banner, name).querySelector<HTMLElement>('[data-status]');
          expect(status, `${name} ${JSON.stringify(overrides)}`).not.toBeNull();
          if (status !== null) {
            shown.push(shownStatus(status));
          }
          result.unmount();
        }
        expect(shown.every((status) => status.icon !== '' && status.text.trim() !== '')).toBe(true);
        expectAllDistinct(shown.map((status) => status.id));
        expectAllDistinct(shown.map((status) => status.icon));
        expectAllDistinct(
          shown.map((status) => outlineOf(status.icon as (typeof ICON_SHAPES)[number])),
          name,
        );
        expectAllDistinct(shown.map((status) => status.text));
      }
    });
  }

  it("takes each tone's colours from one role pair of tokens.css, so colour only repeats the tone", () => {
    const css = readBannerCss();
    for (const [tone, textToken, backgroundToken] of [
      ['neutral', '--hms-color-text', '--hms-color-bg'],
      ['info', '--hms-color-info-text', '--hms-color-info-bg'],
      ['warning', '--hms-color-warning-text', '--hms-color-warning-bg'],
      ['danger', '--hms-color-danger-text', '--hms-color-danger-bg'],
    ] as const) {
      const rule = new RegExp(`\\.hms-banner-status--${tone}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      expect(rule).toContain(`color: var(${textToken});`);
      expect(rule).toContain(`background-color: var(${backgroundToken});`);
    }
  });
});
