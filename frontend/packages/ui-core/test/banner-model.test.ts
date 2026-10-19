/**
 * The banner data model (docs/specs/modules/design-system.md §2.1 "Data model" and rules 1, 4 and 6; §9).
 * `UnitTest:allergy-status-nka-distinct-from-not-assessed` is CTRL-0016-4's test. The other blocks check the
 * model's identity rules (SI-01, SI-16; DN-029, DN-032); the rendered banner is tested in the design system
 * (slice S5a).
 */
import { describe, expect, it } from 'vitest';
import {
  isDateAtPrecision,
  NAME_FORMS,
  parseBannerData,
  resolveGovernedLabel,
  SYNTHETIC_BANNER_VOCABULARIES,
  type AllergiesField,
} from '../src/index.ts';
import { bannerFor, completeBannerData } from './fixtures.ts';

function withField(field: string, value: unknown): Record<string, unknown> {
  return { ...completeBannerData(), [field]: value };
}

function withoutField(field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(completeBannerData()).filter(([key]) => key !== field));
}

function allergiesOf(value: unknown): AllergiesField {
  return bannerFor(withField('allergies', value)).allergies;
}

const penicillin = { substance: { code: 'SYN-ALG-PENICILLIN', labels: { en: 'Penicillin' } } };
const latex = { substance: { code: 'SYN-ALG-LATEX', labels: {} } };

describe('UnitTest:allergy-status-nka-distinct-from-not-assessed', () => {
  it('parses nka, not-assessed and list as three distinct statuses', () => {
    expect(allergiesOf({ status: 'nka' })).toEqual({ status: 'nka' });
    expect(allergiesOf({ status: 'not-assessed' })).toEqual({ status: 'not-assessed' });
    expect(allergiesOf({ status: 'list', items: [penicillin, latex] })).toEqual({
      status: 'list',
      items: [
        { substance: { code: 'SYN-ALG-PENICILLIN', labels: { en: 'Penicillin' } } },
        { substance: { code: 'SYN-ALG-LATEX', labels: {} } },
      ],
    });
  });

  it('never yields NKA for missing, null, unknown, empty-list, malformed, extra-key or contradictory data', () => {
    const cases: Record<string, unknown> = {
      'missing field': undefined,
      null: null,
      'empty object': {},
      'a bare string "nka"': 'nka',
      'a boolean': false,
      'an array': [],
      'unknown status': { status: 'none' },
      'status in another case': { status: 'NKA' },
      'status with spaces': { status: ' nka' },
      'empty list': { status: 'list', items: [] },
      'list without items': { status: 'list' },
      'items not an array': { status: 'list', items: penicillin },
      'nka with items (contradictory)': { status: 'nka', items: [penicillin] },
      'nka with an empty items list (contradictory)': { status: 'nka', items: [] },
      'not-assessed with items (contradictory)': { status: 'not-assessed', items: [penicillin] },
      'nka with an extra key': { status: 'nka', note: 'checked' },
      'list with an extra key': { status: 'list', items: [penicillin], nka: true },
      'nka flag instead of a status': { nka: true },
      'item without a substance': { status: 'list', items: [{ reaction: penicillin.substance }] },
      'item with an empty code': { status: 'list', items: [{ substance: { code: '', labels: {} } }] },
      'item with an extra key': { status: 'list', items: [{ ...penicillin, room: '12' }] },
      'item with an empty label': {
        status: 'list',
        items: [{ substance: { code: 'SYN-ALG-X', labels: { en: '' } } }],
      },
      'item with a label in an unknown locale': {
        status: 'list',
        items: [{ substance: { code: 'SYN-ALG-X', labels: { fr: 'Pénicilline' } } }],
      },
      'item that is null': { status: 'list', items: [null] },
    };
    for (const [name, value] of Object.entries(cases)) {
      const data = value === undefined ? withoutField('allergies') : withField('allergies', value);
      const allergies = bannerFor(data).allergies;
      expect(allergies, name).toEqual({ status: 'unavailable' });
      expect(allergies.status, name).not.toBe('nka');
    }
  });

  it('makes the whole field unavailable when one item is malformed, never dropping the item', () => {
    const malformed = {
      substance: { code: 'SYN-ALG-ASPIRIN', labels: { en: 'Aspirin' } },
      severity: 'severe',
    };
    expect(allergiesOf({ status: 'list', items: [penicillin, malformed, latex] })).toEqual({
      status: 'unavailable',
    });
  });

  it('keeps every listed allergy, in order', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      substance: { code: `SYN-ALG-${String(index)}`, labels: { en: `Synthetic allergen ${String(index)}` } },
    }));
    const allergies = allergiesOf({ status: 'list', items });
    expect(allergies.status).toBe('list');
    expect(allergies.status === 'list' ? allergies.items.map((item) => item.substance.code) : []).toEqual(
      items.map((item) => item.substance.code),
    );
  });

  it('does not let a bad allergy field affect the other fields', () => {
    const banner = bannerFor(withField('allergies', { status: 'nka', items: [penicillin] }));
    expect(banner.allergies.status).toBe('unavailable');
    expect(banner.errorState).toBe(false);
    expect(banner.weight.status).toBe('recorded');
  });
});

describe('banner model: identity rules (design-system §2.1 rules 1 and 4; DN-029, DN-032)', () => {
  it('parses a complete record with every field valid', () => {
    const banner = bannerFor(completeBannerData());
    expect(banner.patientId).toEqual({ status: 'valid', value: 'SYN-PAT-0001' });
    expect(banner.mrn).toEqual({ status: 'valid', value: 'SYN-100234-7' });
    expect(banner.photo).toEqual({ status: 'present', src: '/demo/photos/syn-0001.webp' });
    expect(banner.name.order).toEqual(['ckb', 'ar', 'latin']);
    expect(banner.name.flaggedForms).toEqual([]);
    expect(banner.dob).toEqual({
      status: 'valid',
      value: '1984-03-17',
      precision: 'day',
      approximate: false,
      showApproximateFlag: false,
    });
    expect(banner.codeStatus.status).toBe('documented');
    expect(banner.isolation.status).toBe('active');
    expect(banner.weight).toMatchObject({
      status: 'recorded',
      quantity: { text: '72.5\u00A0kg' },
      measuredOn: '2026-10-18',
      source: 'measured',
    });
    expect(banner.errorState).toBe(false);
    expect(banner.identityIncomplete).toBe(false);
    expect(banner.signingBlocked).toBe(false);
  });

  it('has no location field and ignores room, bed and location keys, so none can fill an identifier', () => {
    const data = { ...completeBannerData(), room: '12', bed: '12-B', location: 'Ward 3, bed 4', ward: 'W3' };
    const banner = bannerFor(data);
    expect(Object.keys(banner).sort()).toEqual(
      [
        'allergies',
        'codeStatus',
        'dob',
        'errorState',
        'identityIncomplete',
        'isolation',
        'mrn',
        'name',
        'patientId',
        'photo',
        'signingBlocked',
        'weight',
      ].sort(),
    );
    const serialised = JSON.stringify(banner);
    for (const value of ['12-B', 'Ward 3', 'W3']) {
      expect(serialised).not.toContain(value);
    }
    // With the identifiers missing, a room or bed never stands in for them.
    const withoutIds = {
      room: '12',
      bed: '12-B',
      location: 'Ward 3',
      name: { latin: 'Bed Twelve', ownScript: 'latin' },
    };
    const fallback = bannerFor(withoutIds);
    expect(fallback.patientId.status).toBe('missing');
    expect(fallback.mrn.status).toBe('missing');
    expect(fallback.errorState).toBe(true);
  });

  it('enters the error state when the patient id, the MRN or every name form is missing or invalid', () => {
    expect(bannerFor(withoutField('patientId')).errorState).toBe(true);
    expect(bannerFor(withField('patientId', '')).errorState).toBe(true);
    expect(bannerFor(withField('patientId', 42)).errorState).toBe(true);
    expect(bannerFor(withoutField('mrn')).errorState).toBe(true);
    expect(bannerFor(withField('mrn', 'SYN 100234')).errorState).toBe(true);
    expect(bannerFor(withField('mrn', '\u0661\u0662\u0663')).errorState).toBe(true);
    expect(bannerFor(withoutField('name')).errorState).toBe(true);
    expect(bannerFor(withField('name', { ownScript: 'ckb' })).errorState).toBe(true);
    expect(
      bannerFor(withField('name', { ckb: '', ar: '   ', latin: '\u202E', ownScript: 'ckb' })).errorState,
    ).toBe(true);
    for (const input of [null, undefined, 'SYN-PAT-0001', [], 42]) {
      const banner = parseBannerData(input, SYNTHETIC_BANNER_VOCABULARIES);
      expect(banner.errorState).toBe(true);
      expect(banner.signingBlocked).toBe(true);
      expect(banner.allergies.status).toBe('unavailable');
    }
  });

  it('blocks signing on a missing or invalid date of birth without entering the error state', () => {
    const missing = bannerFor(withoutField('dob'));
    expect(missing.dob).toEqual({ status: 'missing' });
    expect(missing.errorState).toBe(false);
    expect(missing.identityIncomplete).toBe(true);
    expect(missing.signingBlocked).toBe(true);
    for (const dob of [
      { value: '1984-02-30', precision: 'day', approximate: false },
      { value: '1984-13', precision: 'month', approximate: false },
      { value: '1984-01-01', precision: 'year', approximate: true },
      { value: '84', precision: 'year', approximate: true },
      { value: '1984-03-17', precision: 'week', approximate: false },
      { value: '1984-03-17', precision: 'day' },
      { value: '1984-03-17', precision: 'day', approximate: 'no' },
      { value: '1984-03-17', precision: 'day', approximate: false, estimatedFrom: 'age' },
      '1984-03-17',
    ]) {
      const banner = bannerFor(withField('dob', dob));
      expect(banner.dob, JSON.stringify(dob)).toEqual({ status: 'unavailable' });
      expect(banner.signingBlocked).toBe(true);
      expect(banner.identityIncomplete).toBe(true);
      expect(banner.errorState).toBe(false);
    }
  });

  it('accepts an approximate or partial date at its recorded precision and flags it, never as exact', () => {
    const yearOnly = bannerFor(withField('dob', { value: '1950', precision: 'year', approximate: true })).dob;
    expect(yearOnly).toMatchObject({ status: 'valid', value: '1950', showApproximateFlag: true });
    const month = bannerFor(
      withField('dob', { value: '1950-07', precision: 'month', approximate: false }),
    ).dob;
    expect(month).toMatchObject({ status: 'valid', value: '1950-07', showApproximateFlag: true });
    const estimatedDay = bannerFor(
      withField('dob', { value: '1950-03-12', precision: 'day', approximate: true }),
    );
    expect(estimatedDay.dob).toMatchObject({ status: 'valid', showApproximateFlag: true });
    expect(estimatedDay.signingBlocked).toBe(false);
    expect(isDateAtPrecision('2024-02-29', 'day')).toBe(true);
    expect(isDateAtPrecision('2023-02-29', 'day')).toBe(false);
    expect(isDateAtPrecision('1900-02-29', 'day')).toBe(false);
    expect(isDateAtPrecision('2000-02-29', 'day')).toBe(true);
    expect(isDateAtPrecision('0000', 'year')).toBe(false);
  });

  it('flags each missing name form, and shows "Identity incomplete" only for the own-script or Latin form', () => {
    const noLatin = bannerFor(
      withField('name', { ckb: 'هێمن ئازاد', ar: 'هيمن آزاد', ownScript: 'ckb' }),
    ).name;
    expect(noLatin.forms.latin).toEqual({ status: 'missing' });
    expect(noLatin.flaggedForms).toEqual(['latin']);
    expect(noLatin.identityIncomplete).toBe(true);

    const noOwn = bannerFor(
      withField('name', { ar: 'هيمن آزاد', latin: 'Hemin Azad', ownScript: 'ckb' }),
    ).name;
    expect(noOwn.flaggedForms).toEqual(['ckb']);
    expect(noOwn.identityIncomplete).toBe(true);

    const noThird = bannerFor(
      withField('name', { ckb: 'هێمن ئازاد', latin: 'Hemin Azad', ownScript: 'ckb' }),
    );
    expect(noThird.name.flaggedForms).toEqual(['ar']);
    expect(noThird.name.identityIncomplete).toBe(false);
    expect(noThird.identityIncomplete).toBe(false);
    expect(noThird.signingBlocked).toBe(false); // a missing name form alone does not block (DN-032)
  });

  it('puts the own-script form first, and treats Latin as both forms for a Latin-script patient', () => {
    const arabic = bannerFor(
      withField('name', { ckb: 'هێمن', ar: 'هيمن', latin: 'Hemin', ownScript: 'ar' }),
    ).name;
    expect(arabic.order).toEqual(['ar', 'ckb', 'latin']);

    const latinOwn = bannerFor(withField('name', { latin: 'Jane Synthetic Doe', ownScript: 'latin' })).name;
    expect(latinOwn.order).toEqual(['latin', 'ckb', 'ar']);
    expect(latinOwn.identityIncomplete).toBe(false);
    expect(latinOwn.flaggedForms).toEqual(['ckb', 'ar']);

    const unknownScript = bannerFor(
      withField('name', { ckb: 'هێمن', ar: 'هيمن', latin: 'Hemin', ownScript: 'fr' }),
    ).name;
    expect(unknownScript.ownScript).toBeUndefined();
    expect(unknownScript.order).toEqual(NAME_FORMS);
    expect(unknownScript.identityIncomplete).toBe(true);
  });

  it('rejects a name form in the wrong script, with a look-alike letter, or with bidi controls', () => {
    const forms = (name: Record<string, unknown>) =>
      bannerFor(withField('name', { ...name, ownScript: 'ckb' })).name.forms;
    expect(forms({ ckb: 'Hemin' }).ckb).toEqual({ status: 'invalid' });
    expect(forms({ latin: 'هيمن' }).latin).toEqual({ status: 'invalid' });
    expect(forms({ latin: 'Hеmin' }).latin).toEqual({ status: 'invalid' }); // Cyrillic е
    expect(forms({ latin: 'Hemin\u202EnimeH' }).latin).toEqual({ status: 'invalid' }); // right-to-left override
    expect(forms({ ckb: 'هێمن\u2066' }).ckb).toEqual({ status: 'invalid' }); // left-to-right isolate
    expect(forms({ latin: 'Hemin\nAzad' }).latin).toEqual({ status: 'invalid' });
    expect(forms({ latin: 42 }).latin).toEqual({ status: 'invalid' });
    expect(forms({ latin: 'Trauma Zulu-17' }).latin).toEqual({ status: 'valid', text: 'Trauma Zulu-17' });
    expect(forms({ latin: 'Baby of Jane Synthetic' }).latin).toEqual({
      status: 'valid',
      text: 'Baby of Jane Synthetic',
    });
    expect(forms({ latin: '  Hemin  ' }).latin).toEqual({ status: 'valid', text: 'Hemin' });
  });

  it('rejects a name form with a mark of another script, a stray mark, or a hidden or blank character', () => {
    const forms = (name: Record<string, unknown>) =>
      bannerFor(withField('name', { ...name, ownScript: 'ckb' })).name.forms;
    const invalid: Record<string, Record<string, string>> = {
      'Arabic shadda on a Latin name': { latin: 'Heminّ' },
      'Latin acute accent on a Kurdish name': { ckb: 'هێمن́' },
      'Latin acute accent on an Arabic name': { ar: 'هيمن́' },
      'a mark at the start': { latin: '́Hemin' },
      'a mark on a space': { latin: 'Hemin ́Azad' },
      'an enclosing mark': { latin: 'He⃝min' },
      'U+2800 BRAILLE PATTERN BLANK': { latin: 'He⠀min' },
      'U+3000 IDEOGRAPHIC SPACE': { latin: 'He　min' },
      'U+00A0 NO-BREAK SPACE': { latin: 'Hemin Azad' },
      'two spaces in a row': { latin: 'Hemin  Azad' },
      'U+034F COMBINING GRAPHEME JOINER': { latin: 'He͏min' },
      'U+FE0F VARIATION SELECTOR-16': { latin: 'He️min' },
      'U+3164 HANGUL FILLER': { latin: 'Heㅤmin' },
      'ZWNJ in the Latin form': { latin: 'He‌min' },
      'ZWNJ at the start of a word': { ckb: 'هێمن ‌ئازاد' },
      'a symbol': { latin: 'Hemin★' },
      'an Arabic-Indic digit in the Latin form': { latin: 'Zulu-١٧' },
      'Arabic punctuation in the Latin form': { latin: 'Hemin، Azad' },
    };
    for (const [name, value] of Object.entries(invalid)) {
      const [form = 'latin'] = Object.keys(value);
      expect(forms(value)[form as 'ckb' | 'ar' | 'latin'], name).toEqual({ status: 'invalid' });
    }
    // Visible text of the form's own script stays valid; a decomposed letter is shown in its composed form.
    expect(forms({ latin: 'Hêmin' }).latin).toEqual({ status: 'valid', text: 'Hêmin' });
    expect(forms({ latin: 'Hêmin O’Brien' }).latin).toEqual({ status: 'valid', text: 'Hêmin O’Brien' });
    expect(forms({ ar: 'محمّد' }).ar).toEqual({ status: 'valid', text: 'محمّد' });
    expect(forms({ ckb: 'هێمن‌ی' }).ckb).toEqual({ status: 'valid', text: 'هێمن‌ی' });
    expect(forms({ ar: 'زولو-١٧' }).ar).toEqual({ status: 'valid', text: 'زولو-١٧' });
  });

  it('makes the whole name invalid when the name object has an unknown key', () => {
    const banner = bannerFor(
      withField('name', { ckb: 'هێمن', ar: 'هيمن', latin: 'Hemin', ownScript: 'ckb', room: '4' }),
    );
    expect(banner.name.flaggedForms).toEqual(['ckb', 'ar', 'latin']);
    expect(banner.errorState).toBe(true);
  });
});

describe('banner model: other fields (design-system §2.1)', () => {
  it('shows a missing or invalid photo as no photo, and accepts only same-origin sources', () => {
    expect(bannerFor(withField('photo', { status: 'absent' })).photo).toEqual({ status: 'absent' });
    for (const photo of [
      undefined,
      { status: 'present' },
      { status: 'present', src: 'https://example.org/p.jpg' },
      { status: 'present', src: '//example.org/p.jpg' },
      { status: 'present', src: 'javascript:alert(1)' },
      { status: 'present', src: 'data:text/html;base64,AAAA' },
      { status: 'absent', src: '/p.jpg' },
    ]) {
      const data = photo === undefined ? withoutField('photo') : withField('photo', photo);
      expect(bannerFor(data).photo, JSON.stringify(photo)).toEqual({ status: 'unavailable' });
    }
    expect(
      bannerFor(withField('photo', { status: 'present', src: 'data:image/png;base64,iVBORw0KGgo=' })).photo
        .status,
    ).toBe('present');
  });

  it('distinguishes "no dated weight" from "weight unavailable"', () => {
    expect(bannerFor(withField('weight', { status: 'none-recorded' })).weight).toEqual({
      status: 'none-recorded',
    });
    const recorded = { status: 'recorded', unit: 'kg', measuredOn: '2026-10-18', source: 'stated' };
    for (const weight of [
      undefined,
      null,
      { ...recorded, value: '0' },
      { ...recorded, value: '0.000' },
      { ...recorded, value: '-3' },
      { ...recorded, value: '70,5' },
      { ...recorded, value: '\u0667\u0660' },
      { ...recorded, value: '70', unit: 'lb' },
      { ...recorded, value: '70', measuredOn: undefined },
      { ...recorded, value: '70', measuredOn: '2026-13-01' },
      { ...recorded, value: '70', source: 'guessed' },
      { status: 'recorded', value: '70', unit: 'kg', source: 'measured' },
      { status: 'none-recorded', value: '70' },
    ]) {
      const data = weight === undefined ? withoutField('weight') : withField('weight', weight);
      expect(bannerFor(data).weight, JSON.stringify(weight)).toEqual({ status: 'unavailable' });
    }
    expect(bannerFor(withField('weight', { ...recorded, value: '.8' })).weight).toMatchObject({
      status: 'recorded',
      quantity: { text: '0.8\u00A0kg' },
    });
  });

  it('shows an unknown code-status or isolation code as unavailable, and "none" as its own state', () => {
    expect(bannerFor(withField('codeStatus', { status: 'not-documented' })).codeStatus).toEqual({
      status: 'not-documented',
    });
    expect(
      bannerFor(
        withField('codeStatus', {
          status: 'documented',
          concept: { code: 'SYN-CS-UNKNOWN', labels: {} },
          recordedOn: '2026-10-01',
        }),
      ).codeStatus,
    ).toEqual({ status: 'unavailable' });
    expect(bannerFor(withoutField('codeStatus')).codeStatus).toEqual({ status: 'unavailable' });
    expect(bannerFor(withField('isolation', { status: 'none-recorded' })).isolation).toEqual({
      status: 'none-recorded',
    });
    expect(
      bannerFor(
        withField('isolation', {
          status: 'active',
          precautions: [
            { code: 'SYN-ISO-CONTACT', labels: {} },
            { code: 'SYN-ISO-UNKNOWN', labels: {} },
          ],
        }),
      ).isolation,
    ).toEqual({ status: 'unavailable' });
    expect(bannerFor(withField('isolation', { status: 'active', precautions: [] })).isolation).toEqual({
      status: 'unavailable',
    });
  });

  it('never reads inherited properties of the input', () => {
    const inherited = Object.create(completeBannerData()) as Record<string, unknown>;
    const banner = bannerFor(inherited);
    expect(banner.patientId.status).toBe('missing');
    expect(banner.allergies.status).toBe('unavailable');
  });

  it('never takes a status from a polluted Object.prototype, at any depth: missing data never yields NKA', () => {
    const polluted = Object.prototype as Record<string, unknown>;
    const fields = ['allergies', 'codeStatus', 'isolation', 'photo', 'weight'] as const;
    const statuses = ['nka', 'not-assessed', 'not-documented', 'none-recorded', 'absent'];
    const results: { readonly label: string; readonly status: string }[] = [];
    for (const status of statuses) {
      const keys = { status, items: [penicillin], en: 'Polluted label', reaction: penicillin.substance };
      for (const [key, value] of Object.entries(keys)) {
        polluted[key] = value;
      }
      try {
        for (const field of fields) {
          for (const [shape, data] of [
            ['empty object', withField(field, {})],
            ['missing field', withoutField(field)],
            ['from JSON', JSON.parse(JSON.stringify(withField(field, {}))) as unknown],
          ] as const) {
            results.push({ label: `${status}: ${field} ${shape}`, status: bannerFor(data)[field].status });
          }
        }
        const listed = bannerFor(withField('allergies', { status: 'list', items: [latex] })).allergies;
        results.push({
          label: `${status}: an item without a reaction or labels takes none`,
          status: JSON.stringify(listed),
        });
      } finally {
        for (const key of Object.keys(keys)) {
          Reflect.deleteProperty(polluted, key);
        }
      }
    }
    for (const { label, status } of results) {
      if (label.endsWith('takes none')) {
        expect(status, label).toBe(JSON.stringify({ status: 'list', items: [latex] }));
      } else {
        expect(status, label).toBe('unavailable');
      }
    }
  });

  it('never reads a nested value that is inherited, a getter, a class instance, a hole or a cycle', () => {
    let getterCalls = 0;
    const getterStatus = {
      get status(): string {
        getterCalls += 1;
        return 'nka';
      },
    };
    class Allergies {
      readonly status = 'nka';
    }
    const withHole: unknown[] = [penicillin];
    withHole[2] = latex;
    const cycle: Record<string, unknown> = { code: 'SYN-ALG-X' };
    cycle.labels = cycle;
    const throwing = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('synthetic proxy failure');
        },
      },
    );
    const cases: Record<string, unknown> = {
      'inherited status': Object.create({ status: 'nka' }) as unknown,
      'inherited status, own items': Object.assign(Object.create({ status: 'list' }) as object, {
        items: [penicillin],
      }),
      'a getter': getterStatus,
      'a class instance': new Allergies(),
      'a __proto__ key from JSON': JSON.parse('{"__proto__": {"status": "nka"}}') as unknown,
      'an array with a hole': { status: 'list', items: withHole },
      'an item that is inherited': { status: 'list', items: [Object.create(penicillin)] },
      'a cycle': { status: 'list', items: [{ substance: cycle }] },
      'a proxy that throws': throwing,
      'a function': () => ({ status: 'nka' }),
    };
    for (const [name, value] of Object.entries(cases)) {
      expect(allergiesOf(value), name).toEqual({ status: 'unavailable' });
    }
    expect(getterCalls).toBe(0);
    expect(
      bannerFor(withField('codeStatus', Object.create({ status: 'not-documented' }))).codeStatus,
    ).toEqual({
      status: 'unavailable',
    });
    expect(bannerFor(withField('isolation', Object.create({ status: 'none-recorded' }))).isolation).toEqual({
      status: 'unavailable',
    });
    expect(bannerFor(withField('photo', Object.create({ status: 'absent' }))).photo).toEqual({
      status: 'unavailable',
    });
    expect(bannerFor(withField('weight', Object.create({ status: 'none-recorded' }))).weight).toEqual({
      status: 'unavailable',
    });
    expect(
      bannerFor(withField('name', Object.create({ latin: 'Hemin', ownScript: 'latin' }))).name.anyValid,
    ).toBe(false);
    // A whole input that is a class instance or a proxy that throws reads as no data: the error state.
    expect(
      bannerFor(
        new (class {
          readonly patientId = 'SYN-PAT-0001';
        })(),
      ).errorState,
    ).toBe(true);
    expect(bannerFor(throwing).errorState).toBe(true);
  });
});

describe('governed labels (design-system §2.1 rule 6)', () => {
  it('uses the user locale, else another locale marked untranslated, else the code marked untranslated', () => {
    const concept = { code: 'SYN-ALG-PENICILLIN', labels: { en: 'Penicillin', ar: 'بنسلين' } };
    expect(resolveGovernedLabel(concept, 'ar')).toEqual({ text: 'بنسلين', lang: 'ar', untranslated: false });
    expect(resolveGovernedLabel(concept, 'ckb')).toEqual({
      text: 'Penicillin',
      lang: 'en',
      untranslated: true,
    });
    expect(resolveGovernedLabel({ code: 'SYN-ALG-X', labels: { ar: 'مادة' } }, 'en')).toEqual({
      text: 'مادة',
      lang: 'ar',
      untranslated: true,
    });
    expect(resolveGovernedLabel({ code: 'SYN-ALG-X', labels: {} }, 'en')).toEqual({
      text: 'SYN-ALG-X',
      lang: 'zxx',
      untranslated: true,
    });
  });
});
