/**
 * The demo's synthetic fixtures (docs/specs/modules/design-system.md §5; BUILD-PROMPT.md §3.4 item 7,
 * §18.10): every fixture is synthetic and passes the fixture schema; the banner model makes of each exactly
 * what the fixture says it shows (the invalid ones invalid on purpose); and the set covers the cases §5 lists.
 */
import { UI_LOCALES } from '@hms/i18n';
import {
  parseBannerData,
  SYNTHETIC_BANNER_VOCABULARIES,
  type BannerModel,
  type GovernedConcept,
  type NameForm,
} from '@hms/ui-core';
import { describe, expect, it } from 'vitest';
import { DEMO_FIXTURES, demoFixturesSchema, type DemoFixture } from '../src/demo/fixtures.ts';
import { demoModule } from '../src/demo/index.ts';

function modelOf(fixture: DemoFixture): BannerModel {
  return parseBannerData(fixture.data, SYNTHETIC_BANNER_VOCABULARIES);
}

/** What the model shows, in the terms of a fixture's `expect`. */
function observed(model: BannerModel, fixture: DemoFixture): Record<string, unknown> {
  const { expect: expected } = fixture;
  const names: Partial<Record<NameForm, string>> = {};
  for (const form of Object.keys(expected.names ?? {}) as NameForm[]) {
    names[form] = model.name.forms[form].status;
  }
  const result: Record<string, unknown> = {
    errorState: model.errorState,
    signingBlocked: model.signingBlocked,
    identityIncomplete: model.identityIncomplete,
  };
  if (expected.names !== undefined) result.names = names;
  if (expected.mrn !== undefined) result.mrn = model.mrn.status;
  if (expected.photo !== undefined) result.photo = model.photo.status;
  if (expected.dob !== undefined) result.dob = model.dob.status;
  if (expected.approximateDobFlag !== undefined) {
    result.approximateDobFlag = model.dob.status === 'valid' && model.dob.showApproximateFlag;
  }
  if (expected.allergies !== undefined) result.allergies = model.allergies.status;
  if (expected.allergyCount !== undefined) {
    result.allergyCount = model.allergies.status === 'list' ? model.allergies.items.length : 0;
  }
  if (expected.codeStatus !== undefined) result.codeStatus = model.codeStatus.status;
  if (expected.isolation !== undefined) result.isolation = model.isolation.status;
  if (expected.weight !== undefined) result.weight = model.weight.status;
  return result;
}

describe('demo fixtures', () => {
  it('are synthetic, at the top and in the banner data, and pass the fixture schema', () => {
    expect(demoFixturesSchema.safeParse(DEMO_FIXTURES).success).toBe(true);
    for (const fixture of DEMO_FIXTURES) {
      expect(fixture.provenance).toBe('synthetic');
      expect(fixture.data.provenance).toBe('synthetic');
    }
  });

  it('reject a fixture that is not marked synthetic', () => {
    const [first] = DEMO_FIXTURES;
    expect(first).toBeDefined();
    const unmarked = { ...first, provenance: 'real' };
    expect(demoFixturesSchema.safeParse([unmarked]).success).toBe(false);
    const unmarkedData = { ...first, data: { ...first?.data, provenance: undefined } };
    expect(demoFixturesSchema.safeParse([unmarkedData]).success).toBe(false);
  });

  it.each(DEMO_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s: the banner model shows what the fixture says',
    (_id, fixture) => {
      const model = modelOf(fixture);
      expect(observed(model, fixture)).toEqual(fixture.expect);
    },
  );

  it('use the fixture patient id as the banner patient id', () => {
    for (const fixture of DEMO_FIXTURES) {
      const model = modelOf(fixture);
      expect(model.patientId).toEqual({ status: 'valid', value: fixture.patientId });
    }
  });

  it('cover every case of design-system §5', () => {
    const models = DEMO_FIXTURES.map((fixture) => ({ fixture, model: modelOf(fixture) }));
    const some = (test: (model: BannerModel, fixture: DemoFixture) => boolean): boolean =>
      models.some(({ fixture, model }) => test(model, fixture));
    const allFormsValid = (model: BannerModel): boolean =>
      model.name.forms.ckb.status === 'valid' &&
      model.name.forms.ar.status === 'valid' &&
      model.name.forms.latin.status === 'valid';
    const latin = (model: BannerModel): string =>
      model.name.forms.latin.status === 'valid' ? model.name.forms.latin.text : '';

    expect(some((m) => allFormsValid(m) && m.photo.status === 'present' && !m.identityIncomplete)).toBe(true);
    expect(some((m) => m.allergies.status === 'nka')).toBe(true);
    expect(some((m) => m.allergies.status === 'not-assessed')).toBe(true);
    expect(some((m) => m.allergies.status === 'list' && m.allergies.items.length >= 5)).toBe(true);
    expect(some((m, f) => m.allergies.status === 'unavailable' && f.data.allergies === undefined)).toBe(true);
    expect(
      some(
        (m, f) =>
          m.allergies.status === 'unavailable' &&
          (f.data.allergies as { status?: unknown } | undefined)?.status === 'nka',
      ),
    ).toBe(true);
    expect(
      some((m) => m.dob.status === 'valid' && m.dob.precision === 'year' && m.dob.showApproximateFlag),
    ).toBe(true);
    expect(some((m) => m.dob.status === 'unavailable')).toBe(true);
    expect(some((m) => m.dob.status === 'missing')).toBe(true);
    expect(some((m) => m.photo.status === 'absent')).toBe(true);
    expect(some((m) => m.name.forms.latin.status === 'missing' && m.identityIncomplete)).toBe(true);
    expect(some((m) => m.name.forms.ar.status === 'missing' && !m.identityIncomplete)).toBe(true);
    // Long four-part names in Sorani and in Arabic, two of them differing only in the grandfather's name.
    const fourPart = models.filter(({ model }) => latin(model).split(' ').length >= 4);
    expect(fourPart.some(({ model }) => model.name.ownScript === 'ckb')).toBe(true);
    expect(fourPart.some(({ model }) => model.name.ownScript === 'ar')).toBe(true);
    const words = fourPart.map(({ model }) => latin(model).split(' '));
    expect(
      words.some((a) =>
        words.some(
          (b) =>
            a !== b &&
            a.length === b.length &&
            a.filter((word, index) => word !== b[index]).length === 1 &&
            a[2] !== b[2],
        ),
      ),
    ).toBe(true);
    expect(some((m) => m.isolation.status === 'active')).toBe(true);
    expect(some((m, f) => m.isolation.status === 'unavailable' && f.data.isolation !== undefined)).toBe(true);
    expect(some((m) => m.codeStatus.status === 'documented')).toBe(true);
    expect(some((m) => m.codeStatus.status === 'not-documented')).toBe(true);
    expect(some((m) => m.weight.status === 'none-recorded')).toBe(true);
    expect(some((m) => m.weight.status === 'unavailable')).toBe(true);
    // A governed label missing in some locale (shown with "Not translated"), and one with no label at all.
    const concepts = (m: BannerModel): readonly GovernedConcept[] =>
      [
        ...(m.allergies.status === 'list'
          ? m.allergies.items.flatMap((item) => [item.substance, item.reaction, item.severity])
          : []),
        ...(m.isolation.status === 'active' ? m.isolation.precautions : []),
        ...(m.codeStatus.status === 'documented' ? [m.codeStatus.concept] : []),
      ].filter((concept): concept is GovernedConcept => concept !== undefined);
    const labelled = (concept: GovernedConcept): readonly string[] =>
      UI_LOCALES.filter((locale) => concept.labels[locale] !== undefined);
    expect(
      some((m) =>
        concepts(m).some(
          (concept) => labelled(concept).length > 0 && labelled(concept).length < UI_LOCALES.length,
        ),
      ),
    ).toBe(true);
    expect(
      some(
        (m) =>
          m.allergies.status === 'list' &&
          m.allergies.items.some((item) => Object.keys(item.substance.labels).length === 0),
      ),
    ).toBe(true);
    expect(some((m) => m.name.ownScript === 'latin' && m.name.order[0] === 'latin')).toBe(true);
    expect(some((m) => /\d/.test(latin(m)))).toBe(true); // an alias such as "Trauma Zulu-17"
    expect(some((m) => latin(m).startsWith('Baby of '))).toBe(true);
    expect(some((m) => m.errorState)).toBe(true);
  });

  it('the demo directory lists every fixture and loads its banner data, and nothing else', async () => {
    const listed = demoModule.directory.list().map((entry) => entry.patientId);
    expect(listed).toEqual(DEMO_FIXTURES.map((fixture) => fixture.patientId));
    const [first] = DEMO_FIXTURES;
    expect(await demoModule.directory.loadBannerData(first?.patientId ?? '')).toEqual(first?.data);
    expect(await demoModule.directory.loadBannerData('SYN-PAT-9999')).toBeUndefined();
  });
});
