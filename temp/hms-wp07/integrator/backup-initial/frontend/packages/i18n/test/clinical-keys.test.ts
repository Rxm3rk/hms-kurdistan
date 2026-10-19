import { describe, expect, it } from 'vitest';
import {
  lintCatalogueSources,
  UI_CATALOGUE_LINT_OPTIONS,
  type CatalogueSource,
  type LintOptions,
} from '../src/lint/catalogue-lint.ts';
import { CLINICAL_KEY_PREFIXES, isClinicalKey } from '../src/lint/clinical-keys.ts';

/** The UI options without the review marking, so that each case shows only the clinical-keys findings. */
const OPTIONS: LintOptions = {
  uiLocales: ['en', 'ckb', 'ar'],
  sourceLocale: 'en',
  clinicalKeys: { translatedLocales: ['ckb', 'ar'], prefixes: CLINICAL_KEY_PREFIXES },
};

/** Synthetic catalogues (SYN- messages, never translations), one JSON object per locale. */
function lint(
  catalogues: Record<string, Record<string, string>>,
  options: LintOptions = OPTIONS,
): readonly string[] {
  const sources: CatalogueSource[] = Object.entries(catalogues).map(([locale, messages]) => ({
    locale,
    file: `${locale}.json`,
    text: JSON.stringify(messages, null, 2),
  }));
  return lintCatalogueSources(sources, options).errors;
}

describe('UnitTest:clinical-keys-lint', () => {
  it('treats banner.* and clinical.* as clinical, and nothing else', () => {
    expect(CLINICAL_KEY_PREFIXES).toEqual(['banner.', 'clinical.']);
    for (const key of ['banner.allergies.nka', 'banner.x', 'clinical.number.invalid']) {
      expect(isClinicalKey(key), key).toBe(true);
    }
    for (const key of ['bannerx.a', 'sign.title', 'app.name', 'demo.banner.title', 'clinicalx.a']) {
      expect(isClinicalKey(key), key).toBe(false);
    }
  });

  it('is part of the options the CLI uses for the shipped catalogues', () => {
    expect(UI_CATALOGUE_LINT_OPTIONS.clinicalKeys).toEqual({
      translatedLocales: ['ckb', 'ar'],
      prefixes: CLINICAL_KEY_PREFIXES,
    });
  });

  it('fails a ckb or ar clinical message equal to the English one', () => {
    expect(
      lint({
        en: { 'banner.a': 'SYN-en', 'clinical.b': 'SYN-en {x}' },
        ckb: { 'banner.a': 'SYN-en', 'clinical.b': 'SYN-ckb {x}' },
        ar: { 'banner.a': 'SYN-ar', 'clinical.b': 'SYN-en {x}' },
      }),
    ).toEqual([
      'ckb.json: key "banner.a": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
      'ar.json: key "clinical.b": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
    ]);
  });

  it('is not fooled by extra white space or a different Unicode normalisation form', () => {
    const decomposed = 'SYN-e\u0301'; // e + COMBINING ACUTE ACCENT, the NFD form of U+00E9
    expect(
      lint({
        en: { 'banner.a': 'SYN  en ', 'banner.b': 'SYN-\u00E9' },
        ckb: { 'banner.a': 'SYN en', 'banner.b': decomposed },
        ar: { 'banner.a': 'SYN-ar', 'banner.b': 'SYN-ar' },
      }),
    ).toEqual([
      'ckb.json: key "banner.a": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
      'ckb.json: key "banner.b": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
    ]);
  });

  it('is not fooled by bidi marks, zero-width or other format characters', () => {
    // U+200F RIGHT-TO-LEFT MARK, U+061C ARABIC LETTER MARK, U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH
    // NON-JOINER, U+2067 RIGHT-TO-LEFT ISOLATE with U+2069 POP DIRECTIONAL ISOLATE, U+FEFF, U+00AD SOFT HYPHEN.
    expect(
      lint({
        en: {
          'banner.a': 'SYN-en',
          'banner.b': 'SYN-en',
          'banner.c': 'SYN-en {x}',
          'banner.d': 'SYN-en',
          'clinical.e': 'SYN-en {x}',
        },
        ckb: {
          'banner.a': 'SYN-en\u200F',
          'banner.b': 'SYN\u200B-en',
          'banner.c': '\u2067SYN-en\u2069 {x}',
          'banner.d': 'SYN-ckb',
          'clinical.e': 'SYN-ckb {x}',
        },
        ar: {
          'banner.a': '\u061CSYN-en',
          'banner.b': 'SYN-ar',
          'banner.c': 'SYN-ar {x}',
          'banner.d': 'SY\u00ADN-\u200Cen\uFEFF',
          'clinical.e': 'SYN-en {x}\u200F',
        },
      }),
    ).toEqual(
      [
        ['ckb', 'banner.a'],
        ['ckb', 'banner.b'],
        ['ckb', 'banner.c'],
        ['ar', 'banner.a'],
        ['ar', 'banner.d'],
        ['ar', 'clinical.e'],
      ].map(
        ([locale, key]) =>
          `${locale ?? ''}.json: key "${key ?? ''}": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated`,
      ),
    );
  });

  it('compares the parsed messages, so ICU syntax spacing and branch order do not hide an English text', () => {
    expect(
      lint({
        en: {
          'banner.a': '{weight} ({source}, {date})',
          'banner.b': '{count, plural, one {# SYN-en} other {# SYN-ens}}',
          'banner.c': '{g, select, male {SYN-en m} other {SYN-en o}}',
          'banner.d': '{d, date, short} SYN-en',
          'banner.e': 'SYN-en {x}',
        },
        ckb: {
          'banner.a': '{ weight } ({source}, {date})',
          'banner.b': '{count,plural,one{# SYN-en}other{# SYN-ens}}',
          'banner.c': '{g, select, other {SYN-en o} male {SYN-en m}}',
          'banner.d': '{ d , date , short }SYN-en',
          'banner.e': 'SYN-ckb {x}',
        },
        ar: {
          'banner.a': '{weight} ({source}\u060C {date})',
          'banner.b': '{count, plural, one {# SYN-ar} other {# SYN-ar}}',
          'banner.c': '{g, select, male {SYN-ar} other {SYN-ar}}',
          'banner.d': '{d, date, short} SYN-ar',
          'banner.e': 'SYN-ar {x}',
        },
      }),
    ).toEqual(
      ['banner.a', 'banner.b', 'banner.c', 'banner.d'].map(
        (key) =>
          `ckb.json: key "${key}": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated`,
      ),
    );
  });

  it('falls back to the normalised text when a message does not parse', () => {
    expect(
      lint({
        en: { 'banner.a': 'SYN-en {' },
        ckb: { 'banner.a': 'SYN-en\u200F {' },
        ar: { 'banner.a': 'SYN-ar {' },
      }).filter((error) => error.includes('must be translated')),
    ).toEqual([
      'ckb.json: key "banner.a": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
    ]);
  });

  it('allows an English message outside the clinical keys, and an English source equal to itself', () => {
    expect(
      lint({
        en: { 'app.name': 'SYN Latin name', 'sign.title': 'SYN-en' },
        ckb: { 'app.name': 'SYN Latin name', 'sign.title': 'SYN-en' },
        ar: { 'app.name': 'SYN Latin name', 'sign.title': 'SYN-en' },
      }),
    ).toEqual([]);
  });

  it('fails an ar plural with a clinical count that drops # in any branch', () => {
    expect(
      lint({
        en: { 'banner.count': '{count, plural, one {SYN-en #} other {SYN-en #}}' },
        ckb: { 'banner.count': '{count, plural, one {SYN-ckb #} other {SYN-ckb #}}' },
        ar: {
          'banner.count':
            '{count, plural, zero {SYN-ar} one {SYN-ar} two {SYN-ar} few {SYN-ar #} many {SYN-ar #} other {SYN-ar #}}',
        },
      }),
    ).toEqual([
      'ar.json: key "banner.count": plural "count" has no # in "zero", "one", "two"; a clinical count, so every branch must show the number',
    ]);
  });

  it('requires # in every branch of a clinical plural even when the English drops it', () => {
    expect(
      lint({
        en: { 'clinical.count': '{n, plural, one {SYN-en one} other {SYN-en #}}' },
        ckb: { 'clinical.count': '{n, plural, one {SYN-ckb one} other {SYN-ckb #}}' },
        ar: { 'clinical.count': '{n, plural, one {SYN-ar #} other {SYN-ar #}}' },
      }),
    ).toEqual([
      'ckb.json: key "clinical.count": plural "n" has no # in "one"; a clinical count, so every branch must show the number',
    ]);
  });

  it('outside the clinical keys, requires # where the English keeps it in every branch', () => {
    expect(
      lint({
        en: {
          'sign.reason': '{s, plural, one {SYN-en #} other {SYN-en #}}',
          'demo.loose': '{s, plural, one {SYN-en one} other {SYN-en #}}',
        },
        ckb: {
          'sign.reason': '{s, plural, one {SYN-ckb #} other {SYN-ckb #}}',
          'demo.loose': '{s, plural, one {SYN-ckb} other {SYN-ckb #}}',
        },
        ar: {
          'sign.reason': '{s, plural, two {SYN-ar} other {SYN-ar #}}',
          'demo.loose': '{s, plural, two {SYN-ar} other {SYN-ar #}}',
        },
      }),
    ).toEqual([
      'ar.json: key "sign.reason": plural "s" has no # in "two"; en.json keeps # in every branch, so every branch must show the number',
    ]);
  });

  it('counts # inside a rich-text tag, but not the # of a nested plural', () => {
    expect(
      lint({
        en: {
          'banner.n': '{n, plural, one {<b>SYN-en #</b> {m, plural, other {SYN-en #}}} other {SYN-en #}}',
        },
        ckb: {
          'banner.n': '{n, plural, one {<b>SYN-ckb #</b> {m, plural, other {SYN-ckb #}}} other {SYN-ckb #}}',
        },
        ar: { 'banner.n': '{n, plural, one {<b>SYN-ar</b> {m, plural, other {SYN-ar #}}} other {SYN-ar #}}' },
      }),
    ).toEqual([
      'ar.json: key "banner.n": plural "n" has no # in "one"; a clinical count, so every branch must show the number',
    ]);
  });

  it('does not count a # in a select branch, which the ICU parser reads as text', () => {
    expect(
      lint({
        en: { 'banner.n': '{n, plural, one {{g, select, other {SYN-en #}}} other {SYN-en #}}' },
        ckb: { 'banner.n': '{n, plural, one {SYN-ckb # {g, select, other {SYN-ckb}}} other {SYN-ckb #}}' },
        ar: { 'banner.n': '{n, plural, one {{g, select, other {SYN-ar #}}} other {SYN-ar #}}' },
      }),
    ).toEqual([
      'ar.json: key "banner.n": plural "n" has no # in "one"; a clinical count, so every branch must show the number',
    ]);
  });

  it('checks selectordinal like plural', () => {
    expect(
      lint({
        en: { 'clinical.rank': '{r, selectordinal, other {SYN-en #}}' },
        ckb: { 'clinical.rank': '{r, selectordinal, other {SYN-ckb #}}' },
        ar: { 'clinical.rank': '{r, selectordinal, other {SYN-ar}}' },
      }),
    ).toEqual([
      'ar.json: key "clinical.rank": plural "r" has no # in "other"; a clinical count, so every branch must show the number',
    ]);
  });

  it('does not run when the options leave it out', () => {
    expect(
      lint(
        {
          en: { 'banner.a': 'SYN-en' },
          ckb: { 'banner.a': 'SYN-en' },
          ar: { 'banner.a': '{n, plural, other {SYN-ar}}' },
        },
        { uiLocales: ['en', 'ckb', 'ar'], sourceLocale: 'en' },
      ),
    ).toEqual(['ar.json: key "banner.a": placeholders ({n, plural}) differ from en.json (no placeholders)']);
  });
});
