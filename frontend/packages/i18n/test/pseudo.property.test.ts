import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import {
  CATALOGUES,
  isPseudoLocale,
  PSEUDO_EXPANSION,
  PSEUDO_LOCALES,
  pseudoCatalogue,
  pseudoLocalise,
  type MessageKey,
  type PseudoLocale,
} from '../src/index.ts';
import { placeholderSignature } from '../src/lint/catalogue-lint.ts';

const PSEUDO: readonly PseudoLocale[] = ['en-XA', 'ar-XB'];
const RLO = '\u202E';
const PDF = '\u202C';
/** ASCII letters the expanded pseudo-locale accents. */
const ACCENTABLE = /[acdeghijklnorstuwyzACDEGHIJKLNORSTUWYZ]/u;

/** The message without its literal text: every placeholder, branch, `#` and tag, in order. */
function shape(elements: readonly MessageFormatElement[]): unknown[] {
  const withoutLocation = (_key: string, value: unknown): unknown =>
    _key === 'location' ? undefined : value;
  return elements
    .filter((element) => element.type !== TYPE.literal)
    .map((element) => {
      switch (element.type) {
        case TYPE.argument:
          return ['argument', element.value];
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          return [TYPE[element.type], element.value, JSON.stringify(element.style ?? null, withoutLocation)];
        case TYPE.pound:
          return ['#'];
        case TYPE.tag:
          return ['tag', element.value, shape(element.children)];
        case TYPE.select:
          return [
            'select',
            element.value,
            Object.entries(element.options).map(([selector, option]) => [selector, shape(option.value)]),
          ];
        case TYPE.plural:
          return [
            'plural',
            element.value,
            element.pluralType,
            element.offset,
            Object.entries(element.options).map(([selector, option]) => [selector, shape(option.value)]),
          ];
        default:
          return ['unexpected'];
      }
    });
}

/** The literal texts of a message, in document order. */
function literals(elements: readonly MessageFormatElement[]): string[] {
  return elements.flatMap((element): string[] => {
    switch (element.type) {
      case TYPE.literal:
        return [element.value];
      case TYPE.tag:
        return literals(element.children);
      case TYPE.select:
      case TYPE.plural:
        return Object.values(element.options).flatMap((option) => literals(option.value));
      default:
        return [];
    }
  });
}

const PLAIN_CHARACTERS = [
  ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;()[]-!?/%+*=~|"'),
  ...Array.from('نەخۆشی ئەم پەنجەرەیە العربية'),
  'é',
  '\u00A0',
  '\u202F',
  '😀',
];

/** Literal text: plain characters, escaped apostrophes, an apostrophe inside a word, quoted syntax. */
function literalText(inPlural: boolean): fc.Arbitrary<string> {
  const quoted = inPlural ? ["'{'", "'}'", "'#'", "'<'", "'{}'"] : ["'{'", "'}'", "'<'", "'{}'"];
  return fc
    .array(
      fc.oneof(
        {
          weight: 6,
          arbitrary: fc.string({ unit: fc.constantFrom(...PLAIN_CHARACTERS), minLength: 1, maxLength: 8 }),
        },
        { weight: 1, arbitrary: fc.constant("''") },
        { weight: 1, arbitrary: fc.constant("it's") },
        { weight: 1, arbitrary: fc.constantFrom(...quoted) },
      ),
      { minLength: 1, maxLength: 4 },
    )
    .map((parts) => parts.join(''));
}

const NAMES = ['name', 'count', 'date', 'weight', 'x1'] as const;

const simpleArgument: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...NAMES).map((name) => `{${name}}`),
  fc.constantFrom(...NAMES).map((name) => `{${name}, number}`),
  fc.constant('{n, number, ::percent}'),
  fc.constant('{n, number, integer}'),
  fc.constant('{d, date, short}'),
  fc.constant('{d, date, ::yyyyMMdd}'),
  fc.constant('{t, time}'),
);

/** A random ICU message (as source text) of the given nesting depth. */
function message(depth: number, inPlural: boolean): fc.Arbitrary<string> {
  const pieces: fc.Arbitrary<string>[] = [literalText(inPlural), simpleArgument];
  if (inPlural) {
    pieces.push(fc.constant('#'));
  }
  if (depth > 0) {
    const branch = (plural: boolean): fc.Arbitrary<string> => message(depth - 1, plural);
    pieces.push(
      fc
        .tuple(
          fc.constantFrom('plural', 'selectordinal'),
          fc.constantFrom(...NAMES),
          fc.subarray(['=0', 'zero', 'one', 'two', 'few', 'many']),
          fc.array(branch(true), { minLength: 7, maxLength: 7 }),
        )
        .map(
          ([kind, name, selectors, bodies]) =>
            `{${name}, ${kind}, ${[...selectors, 'other'].map((selector, index) => `${selector} {${bodies[index] ?? ''}}`).join(' ')}}`,
        ),
      fc
        .tuple(
          fc.constantFrom(...NAMES),
          fc.subarray(['a', 'b', 'male']),
          fc.array(branch(false), { minLength: 4, maxLength: 4 }),
        )
        .map(
          ([name, selectors, bodies]) =>
            `{${name}, select, ${[...selectors, 'other'].map((selector, index) => `${selector} {${bodies[index] ?? ''}}`).join(' ')}}`,
        ),
      fc
        .tuple(fc.constantFrom('b', 'i', 'link'), message(depth - 1, inPlural))
        .map(([tag, body]) => `<${tag}>${body}</${tag}>`),
    );
  }
  return fc.array(fc.oneof(...pieces), { maxLength: 5 }).map((parts) => parts.join(''));
}

const icuMessage = message(2, false);

function checkPreserved(source: string, locale: PseudoLocale): void {
  const original = parse(source);
  const pseudo = pseudoLocalise(source, locale);
  const transformed = parse(pseudo);
  expect(shape(transformed)).toEqual(shape(original));
  expect(placeholderSignature(transformed)).toEqual(placeholderSignature(original));
}

describe('PropertyTest:pseudo-locale-preserves-placeholders', () => {
  it('generates valid ICU messages to test with', () => {
    fc.assert(
      fc.property(icuMessage, (source) => {
        expect(() => parse(source, { requiresOtherClause: true })).not.toThrow();
      }),
    );
  });

  it('keeps every placeholder, branch, # and tag of a generated message, in both pseudo-locales', () => {
    fc.assert(
      fc.property(icuMessage, fc.constantFrom(...PSEUDO), (source, locale) => {
        checkPreserved(source, locale);
      }),
      { numRuns: 500 },
    );
  });

  it('keeps the structure of any string the ICU parser accepts', () => {
    const icuish = fc.string({
      unit: fc.constantFrom(
        ...Array.from("ab {}#'<>/,=x"),
        'plural',
        'select',
        'number',
        '{n, plural, other {',
        '}}',
      ),
      maxLength: 30,
    });
    fc.assert(
      fc.property(icuish, fc.constantFrom(...PSEUDO), (source, locale) => {
        try {
          parse(source);
        } catch {
          return;
        }
        checkPreserved(source, locale);
      }),
      { numRuns: 1000 },
    );
  });

  it('expanded (en-XA): brackets the message, accents every ASCII letter and adds 40% to the text', () => {
    fc.assert(
      fc.property(icuMessage, (source) => {
        const pseudo = pseudoLocalise(source, 'en-XA');
        expect(pseudo.startsWith('[')).toBe(true);
        expect(pseudo.endsWith(']')).toBe(true);
        const before = literals(parse(source)).join('');
        const after = literals(parse(pseudo));
        for (const text of after) {
          expect(ACCENTABLE.test(text), text).toBe(false);
        }
        const length = (text: string): number => Array.from(text).length;
        expect(length(after.join(''))).toBeGreaterThanOrEqual(
          length(before) + Math.ceil(length(before) * PSEUDO_EXPANSION),
        );
      }),
    );
  });

  it('mirrored (ar-XB): wraps each literal text in RLO and PDF and changes nothing else', () => {
    fc.assert(
      fc.property(icuMessage, (source) => {
        const pseudo = pseudoLocalise(source, 'ar-XB');
        const strip = (text: string): string => text.replaceAll(RLO, '').replaceAll(PDF, '');
        expect(literals(parse(pseudo)).map(strip)).toEqual(literals(parse(source)).map(strip));
        expect(pseudo.split(RLO).length).toBe(pseudo.split(PDF).length);
        expect(strip(pseudo)).toBe(strip(source));
      }),
    );
  });

  it('builds both pseudo-locales from the shipped en catalogue with the same keys and placeholders', () => {
    for (const locale of PSEUDO) {
      const catalogue = pseudoCatalogue(locale);
      expect(Object.keys(catalogue).sort()).toEqual(Object.keys(CATALOGUES.en).sort());
      for (const [key, english] of Object.entries(CATALOGUES.en)) {
        const pseudo = catalogue[key as MessageKey];
        expect(pseudo, key).not.toBe(english);
        expect(placeholderSignature(parse(pseudo)), `${locale} ${key}`).toEqual(
          placeholderSignature(parse(english)),
        );
      }
    }
  });

  it('describes the pseudo-locales: direction, and the source locale for formatting', () => {
    expect(PSEUDO_LOCALES['en-XA']).toEqual({
      tag: 'en-XA',
      dir: 'ltr',
      transform: 'expanded',
      intlLocale: 'en-u-ca-gregory-nu-latn',
    });
    expect(PSEUDO_LOCALES['ar-XB']).toEqual({
      tag: 'ar-XB',
      dir: 'rtl',
      transform: 'mirrored',
      intlLocale: 'en-u-ca-gregory-nu-latn',
    });
    expect(isPseudoLocale('en-XA')).toBe(true);
    expect(isPseudoLocale('ar-XB')).toBe(true);
    expect(isPseudoLocale('en')).toBe(false);
    expect(isPseudoLocale('toString')).toBe(false);
    expect(pseudoLocalise("SYN it's {name}", 'en-XA')).toBe("[ŠÝÑ íť'š {name} ~~~~]");
    expect(pseudoLocalise("SYN it's {name}", 'ar-XB')).toBe(`${RLO}SYN it's ${PDF}{name}`);
  });
});
