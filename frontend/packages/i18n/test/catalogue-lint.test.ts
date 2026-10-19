import { describe, expect, it } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import {
  lintCatalogueSources,
  MESSAGE_KEY_PATTERN,
  placeholderSignature,
  type CatalogueSource,
  type LintOptions,
} from '../src/lint/catalogue-lint.ts';

const OPTIONS: LintOptions = {
  uiLocales: ['en', 'ckb', 'ar'],
  sourceLocale: 'en',
  templateOnlyLocales: ['ku-Arab'],
};

/** Synthetic catalogues (SYN- messages, never translations), one JSON object per locale. */
function sources(catalogues: Record<string, Record<string, unknown>>): CatalogueSource[] {
  return Object.entries(catalogues).map(([locale, messages]) => ({
    locale,
    file: `${locale}.json`,
    text: JSON.stringify(messages, null, 2),
  }));
}

function lint(catalogues: Record<string, Record<string, unknown>>): readonly string[] {
  return lintCatalogueSources(sources(catalogues), OPTIONS).errors;
}

/** The same message in all three UI locales. */
const same = (key: string, message: string): Record<string, Record<string, string>> => ({
  en: { [key]: message },
  ckb: { [key]: message },
  ar: { [key]: message },
});

describe('a clean set of catalogues', () => {
  it('passes and counts catalogues, keys and messages', () => {
    const result = lintCatalogueSources(
      sources({
        en: { 'a.one': 'SYN-en {name}', 'a.two': '{n, plural, one {SYN-en #} other {SYN-en #}}' },
        ckb: { 'a.one': 'SYN-ckb {name}', 'a.two': '{n, plural, other {SYN-ckb #}}' },
        ar: {
          'a.one': 'SYN-ar {name}',
          'a.two': '{n, plural, zero {SYN-ar} few {SYN-ar #} other {SYN-ar #}}',
        },
      }),
      OPTIONS,
    );
    expect(result.errors).toEqual([]);
    expect(result.counts).toEqual({ catalogues: 3, keys: 2, messages: 6 });
  });
});

describe('catalogue files', () => {
  it('reports a missing UI catalogue', () => {
    expect(lint({ en: { 'a.b': 'SYN' }, ar: { 'a.b': 'SYN' } })).toEqual([
      'the catalogue for UI locale "ckb" is missing',
    ]);
  });

  it('reports a catalogue for a locale that is not a UI locale, naming template-only locales', () => {
    expect(lint({ ...same('a.b', 'SYN'), 'ku-Arab': { 'a.b': 'SYN' }, fr: { 'a.b': 'SYN' } })).toEqual([
      'ku-Arab.json: unexpected catalogue: the UI locales are en, ckb, ar; ku-Arab is used only for patient-facing templates',
      'fr.json: unexpected catalogue: the UI locales are en, ckb, ar',
    ]);
  });

  it('reports a second catalogue for the same locale', () => {
    const twice: CatalogueSource[] = [
      ...sources(same('a.b', 'SYN')),
      { locale: 'en', file: 'en-copy.json', text: '{"a.b": "SYN"}' },
    ];
    expect(lintCatalogueSources(twice, OPTIONS).errors).toEqual([
      'en-copy.json: a second catalogue for locale "en"',
    ]);
  });

  it('reports text that is not JSON, a byte order mark, a non-object and a repeated key', () => {
    const bad: CatalogueSource[] = [
      { locale: 'en', file: 'en.json', text: '{"a.b": "SYN",}' },
      { locale: 'ckb', file: 'ckb.json', text: '﻿{"a.b": "SYN"}' },
      { locale: 'ar', file: 'ar.json', text: '["SYN"]' },
    ];
    const errors = lintCatalogueSources(bad, OPTIONS).errors;
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^en\.json: not valid JSON: /);
    expect(errors[1]).toBe('ckb.json: starts with a byte order mark: save it as UTF-8 without a BOM');
    expect(errors[2]).toBe('ar.json: a catalogue must be a JSON object of message keys to ICU messages');

    const repeated: CatalogueSource[] = [
      ...sources({ ckb: { 'a.b': 'SYN' }, ar: { 'a.b': 'SYN' } }),
      { locale: 'en', file: 'en.json', text: '{\n  "a.b": "SYN-1",\n  "a.b": "SYN-2"\n}' },
    ];
    expect(lintCatalogueSources(repeated, OPTIONS).errors).toEqual([
      'en.json:3: key "a.b" appears more than once; JSON keeps only the last value',
    ]);
  });
});

describe('keys and values', () => {
  it('accepts well-formed keys and rejects malformed ones', () => {
    for (const key of ['app.name', 'language.ckb.endonym', 'banner.allergyStatus', 'a.b-c.d1']) {
      expect(MESSAGE_KEY_PATTERN.test(key), key).toBe(true);
    }
    for (const key of ['app', 'App.name', 'app..name', 'app.name.', '.app', 'app.Name', 'app name', '1.a']) {
      expect(MESSAGE_KEY_PATTERN.test(key), key).toBe(false);
    }
    expect(lint(same('App.name', 'SYN'))).toHaveLength(3);
    expect(lint(same('App.name', 'SYN'))[0]).toBe(
      'en.json: key "App.name" is malformed: use dot-separated lower-camel segments, as in "app.name"',
    );
  });

  it('reports a key missing from any UI catalogue, naming the catalogues that have it', () => {
    expect(
      lint({ en: { 'a.b': 'SYN', 'a.c': 'SYN' }, ckb: { 'a.b': 'SYN' }, ar: { 'a.b': 'SYN', 'a.c': 'SYN' } }),
    ).toEqual(['ckb.json: key "a.c" is missing (present in en.json, ar.json)']);
    expect(lint({ en: { 'a.b': 'SYN' }, ckb: { 'a.b': 'SYN', 'a.x': 'SYN' }, ar: { 'a.b': 'SYN' } })).toEqual(
      [
        'en.json: key "a.x" is missing (present in ckb.json)',
        'ar.json: key "a.x" is missing (present in ckb.json)',
      ],
    );
  });

  it('reports empty and whitespace-only messages', () => {
    expect(lint({ en: { 'a.b': 'SYN' }, ckb: { 'a.b': '' }, ar: { 'a.b': ' \n\t ' } })).toEqual([
      'ckb.json: key "a.b": the message is empty',
      'ar.json: key "a.b": the message is empty',
    ]);
  });

  it('reports values that are not strings', () => {
    expect(lint({ en: { 'a.b': 'SYN' }, ckb: { 'a.b': 7 }, ar: { 'a.b': { nested: 'SYN' } } })).toEqual([
      'ckb.json: key "a.b": the value must be a string (catalogues are flat maps of key to message)',
      'ar.json: key "a.b": the value must be a string (catalogues are flat maps of key to message)',
    ]);
  });
});

describe('ICU MessageFormat syntax', () => {
  const cases: readonly (readonly [message: string, kind: string])[] = [
    ['SYN {name', 'EXPECT_ARGUMENT_CLOSING_BRACE'],
    ['SYN {}', 'EMPTY_ARGUMENT'],
    ['{n, plural, one {SYN}}', 'MISSING_OTHER_CLAUSE'],
    ['{n, select, a {SYN}}', 'MISSING_OTHER_CLAUSE'],
    ['{n, plural, one {SYN} one {SYN} other {SYN}}', 'DUPLICATE_PLURAL_ARGUMENT_SELECTOR'],
    ['{n, bogus}', 'INVALID_ARGUMENT_TYPE'],
    ['SYN <b>unclosed', 'UNCLOSED_TAG'],
  ];
  for (const [message, kind] of cases) {
    it(`reports ${kind} for ${JSON.stringify(message)}`, () => {
      const errors = lint({ en: { 'a.b': message }, ckb: { 'a.b': 'SYN' }, ar: { 'a.b': 'SYN' } });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(
        new RegExp(
          `^en\\.json: key "a\\.b": ICU MessageFormat syntax error ${kind} at line \\d+, column \\d+$`,
        ),
      );
    });
  }

  it('accepts quoting, skeletons, select, selectordinal and rich-text tags', () => {
    expect(lint(same('a.b', "SYN '{literal}' {n, number, ::percent} {d, date, ::yyyyMMdd}"))).toEqual([]);
    expect(
      lint(same('a.b', '{g, select, a {SYN} other {SYN}} {p, selectordinal, other {SYN #}} <i>SYN</i>')),
    ).toEqual([]);
  });
});

describe('placeholder arguments', () => {
  it('describes a message by its argument names and kinds, nested ones included', () => {
    const signature = placeholderSignature(
      parse(
        '{g, select, a {<b>{name}</b>} other {{n, plural, other {# {when, date}}}}} {p, selectordinal, other {#}}',
      ),
    );
    expect(signature).toEqual([
      '<b>',
      '{g, select}',
      '{n, plural}',
      '{name}',
      '{p, selectordinal}',
      '{when, date}',
    ]);
  });

  it('reports a renamed, missing or extra placeholder against the source locale', () => {
    expect(
      lint({ en: { 'a.b': 'SYN {name}' }, ckb: { 'a.b': 'SYN {nam}' }, ar: { 'a.b': 'SYN {name} {x}' } }),
    ).toEqual([
      'ckb.json: key "a.b": placeholders ({nam}) differ from en.json ({name})',
      'ar.json: key "a.b": placeholders ({name}, {x}) differ from en.json ({name})',
    ]);
    expect(lint({ en: { 'a.b': 'SYN {name}' }, ckb: { 'a.b': 'SYN' }, ar: { 'a.b': 'SYN {name}' } })).toEqual(
      ['ckb.json: key "a.b": placeholders (no placeholders) differ from en.json ({name})'],
    );
  });

  it('reports a placeholder whose kind differs', () => {
    expect(
      lint({
        en: { 'a.b': 'SYN {n, number}' },
        ckb: { 'a.b': 'SYN {n}' },
        ar: { 'a.b': '{n, plural, other {SYN}}' },
      }),
    ).toEqual([
      'ckb.json: key "a.b": placeholders ({n}) differ from en.json ({n, number})',
      'ar.json: key "a.b": placeholders ({n, plural}) differ from en.json ({n, number})',
    ]);
  });

  it('reports a rich-text tag that differs', () => {
    expect(
      lint({ en: { 'a.b': 'SYN <b>x</b>' }, ckb: { 'a.b': 'SYN <i>x</i>' }, ar: { 'a.b': 'SYN <b>x</b>' } }),
    ).toEqual(['ckb.json: key "a.b": placeholders (<i>) differ from en.json (<b>)']);
  });

  it('compares with the first catalogue that has the key when the source locale lacks it', () => {
    expect(
      lint({
        en: { 'a.c': 'SYN' },
        ckb: { 'a.b': 'SYN {x}', 'a.c': 'SYN' },
        ar: { 'a.b': 'SYN {y}', 'a.c': 'SYN' },
      }),
    ).toEqual([
      'en.json: key "a.b" is missing (present in ckb.json, ar.json)',
      'ar.json: key "a.b": placeholders ({y}) differ from ckb.json ({x})',
    ]);
  });

  it('does not compare a message that failed to parse', () => {
    expect(
      lint({ en: { 'a.b': 'SYN {name}' }, ckb: { 'a.b': 'SYN {name' }, ar: { 'a.b': 'SYN {name}' } }),
    ).toEqual([
      'ckb.json: key "a.b": ICU MessageFormat syntax error EXPECT_ARGUMENT_CLOSING_BRACE at line 1, column 5',
    ]);
  });
});
