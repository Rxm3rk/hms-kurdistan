/**
 * UnitTest:banner-identifiers-never-room-or-bed (docs/specs/modules/design-system.md §9; SI-01;
 * CTRL-0001-4, not named there yet): input with room, bed and location values renders none of them in the
 * banner, in its text or in any attribute, and no location value can fill a missing identifier (§2.1
 * rule 1).
 */
import { UI_LOCALES } from '@hms/i18n';
import { describe, expect, it } from 'vitest';
import { bannerData, field, renderBanner, statusesIn, type BannerData } from './fixtures.tsx';

const LOCATION_VALUES = [
  'ROOM-4B',
  'BED-12',
  'WARD-7',
  'Surgical ward, bed 12',
  'ژووری ٤',
  'سرير ١٢',
] as const;

const LOCATION_KEYS: BannerData = {
  room: 'ROOM-4B',
  bed: 'BED-12',
  ward: 'WARD-7',
  location: { ward: 'WARD-7', room: 'ROOM-4B', bed: 'BED-12', display: 'Surgical ward, bed 12' },
  roomName: 'ژووری ٤',
  bedLabel: 'سرير ١٢',
};

/** Every string the banner exposes: its text and every attribute value of every element. */
function everythingShown(banner: HTMLElement): string {
  const parts: string[] = [banner.textContent];
  for (const element of [banner, ...banner.querySelectorAll('*')]) {
    for (const attribute of element.attributes) {
      parts.push(attribute.value);
    }
  }
  return parts.join('\n');
}

/**
 * No location value is shown. `recordedMrn`, an MRN that only looks like a location, is taken out of what
 * is shown first: where it appears it is the recorded identifier, not a location.
 */
function expectNoLocation(banner: HTMLElement, recordedMrn?: string): void {
  const all = everythingShown(banner);
  const shown = recordedMrn === undefined ? all : all.replaceAll(recordedMrn, '');
  for (const value of LOCATION_VALUES) {
    expect(shown).not.toContain(value);
  }
  expect(shown).not.toMatch(/ROOM|BED-|WARD/);
}

describe('UnitTest:banner-identifiers-never-room-or-bed', () => {
  for (const locale of UI_LOCALES) {
    describe(`in ${locale}`, () => {
      it('ignores room, bed and location keys beside a complete record', () => {
        const { banner, model } = renderBanner(bannerData(LOCATION_KEYS), locale);
        expectNoLocation(banner);
        for (const key of Object.keys(LOCATION_KEYS)) {
          expect(Object.keys(model)).not.toContain(key);
        }
        expect(field(banner, 'mrn')).toHaveTextContent('SYN-100234-7');
      });

      it('never lets a location fill a missing MRN, name or date of birth', () => {
        const { banner } = renderBanner(
          bannerData({
            ...LOCATION_KEYS,
            mrn: undefined,
            name: undefined,
            dob: undefined,
            identifier: 'BED-12',
          }),
          locale,
        );
        expectNoLocation(banner);
        expect(banner).toHaveAttribute('data-error-state', 'true');
        expect(statusesIn(field(banner, 'mrn'))).toEqual(['mrn.unavailable']);
        expect(statusesIn(field(banner, 'dob'))).toEqual(['dob.missing']);
      });

      it('never shows a location carried inside a banner field', () => {
        const { banner } = renderBanner(
          bannerData({
            name: {
              ckb: 'هێمن ئازاد عومەر کەریم',
              ar: 'هيمن آزاد عمر كريم',
              latin: 'Hêmin Azad Omer Kerîm',
              ownScript: 'ckb',
              room: 'ROOM-4B',
            },
            dob: { value: '1984-03-17', precision: 'day', approximate: false, bed: 'BED-12' },
            isolation: { status: 'none-recorded', ward: 'WARD-7' },
          }),
          locale,
        );
        expectNoLocation(banner);
      });

      it('shows a location-like value only where it is the recorded MRN itself, never from a location key', () => {
        // An MRN that looks like a room and bed is still the recorded identifier: shown exactly as stored,
        // in the MRN's place only, and no location key's value appears beside it.
        const locationLikeMrn = 'ROOM4B-BED12';
        const { banner } = renderBanner(bannerData({ ...LOCATION_KEYS, mrn: locationLikeMrn }), locale);
        const mrn = field(banner, 'mrn').querySelector('bdi');
        expect(mrn?.textContent).toBe(locationLikeMrn);
        const holders = [...banner.querySelectorAll('bdi')].filter(
          (element) => element.textContent === locationLikeMrn,
        );
        expect(holders).toEqual([mrn]);
        expect(everythingShown(banner).split(locationLikeMrn)).toHaveLength(2);
        expectNoLocation(banner, locationLikeMrn);
      });
    });
  }
});
