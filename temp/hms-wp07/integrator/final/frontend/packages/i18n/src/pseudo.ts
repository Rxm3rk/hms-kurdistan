/**
 * Pseudo-locales for development and test builds (docs/specs/modules/design-system.md §2.9; BUILD-PROMPT.md
 * §14.7, §18.9). They are built in memory from the source (`en`) catalogue, never stored as catalogue
 * files: the localisation lint accepts catalogues only for the UI locales.
 *
 * - `en-XA`, expanded: ASCII letters become accented Latin letters, each message is wrapped in `[` and `]`,
 *   and padding adds 40% to its text, so hard-coded text (no accents, no brackets) and truncation (a missing
 *   `]`) stand out.
 * - `ar-XB`, mirrored: each run of literal text is wrapped in RIGHT-TO-LEFT OVERRIDE and POP DIRECTIONAL
 *   FORMATTING, and the locale's direction is `rtl`, so a layout that does not mirror stands out.
 *
 * Only literal text changes: every placeholder, plural or select branch, `#` and rich-text tag stays as it
 * is (PropertyTest:pseudo-locale-preserves-placeholders). The transformation edits the message source
 * within the spans the ICU parser reports for literal text, and inserts only characters that are not ICU
 * syntax, so the quoting of the original message keeps its meaning. Messages are formatted with the
 * source locale's Intl tag, because their plural branches are the source's.
 */
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { CATALOGUES, type Catalogue, type MessageKey } from './catalogues.ts';
import type { TextDirection } from './locales.ts';
import { UI_INTL_LOCALES } from './ui-intl.ts';

export type PseudoTransform = 'expanded' | 'mirrored';

export interface PseudoLocaleInfo {
  /** The BCP 47 tag, for `lang`: a private-use region (XA, XB) as Android and Chromium use. */
  readonly tag: string;
  /** The document direction. */
  readonly dir: TextDirection;
  /** How the source messages are transformed. */
  readonly transform: PseudoTransform;
  /** The Intl locale for formatting: the source locale's, because the plural branches are the source's. */
  readonly intlLocale: string;
}

export const PSEUDO_LOCALES = {
  'en-XA': { tag: 'en-XA', dir: 'ltr', transform: 'expanded', intlLocale: UI_INTL_LOCALES.en },
  'ar-XB': { tag: 'ar-XB', dir: 'rtl', transform: 'mirrored', intlLocale: UI_INTL_LOCALES.en },
} as const satisfies Record<string, PseudoLocaleInfo>;

export type PseudoLocale = keyof typeof PSEUDO_LOCALES;

export function isPseudoLocale(value: string): value is PseudoLocale {
  return Object.hasOwn(PSEUDO_LOCALES, value);
}

/** The share of extra text the expanded pseudo-locale adds to a message's literal text. */
export const PSEUDO_EXPANSION = 0.4;

const RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const POP_DIRECTIONAL_FORMATTING = '\u202C';
const PADDING_GROUP = '~~~~~';

/**
 * ASCII letters and their accented forms (Latin-1 Supplement and Latin Extended-A), position by position.
 * Letters with no such form (b, f, m, p, q, v, x) stay as they are.
 */
const PLAIN_LETTERS = 'acdeghijklnorstuwyzACDEGHIJKLNORSTUWYZ';
const ACCENTED_LETTERS = 'áçďéğĥíĵķľñóŕšťúŵýžÁÇĎÉĞĤÍĴĶĽÑÓŔŠŤÚŴÝŽ';
const ACCENTED: ReadonlyMap<string, string> = new Map(
  Array.from(PLAIN_LETTERS).map((letter, index) => [letter, ACCENTED_LETTERS.charAt(index)]),
);

/** The [start, end) offsets (UTF-16) of every literal text in the message source, nested ones included. */
function literalSpans(elements: readonly MessageFormatElement[]): [number, number][] {
  const spans: [number, number][] = [];
  const visit = (nodes: readonly MessageFormatElement[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case TYPE.literal:
          if (node.location === undefined) {
            throw new Error('pseudo-locale: the ICU parser gave no location for literal text');
          }
          spans.push([node.location.start.offset, node.location.end.offset]);
          break;
        case TYPE.select:
        case TYPE.plural:
          for (const option of Object.values(node.options)) {
            visit(option.value);
          }
          break;
        case TYPE.tag:
          visit(node.children);
          break;
        default:
          break;
      }
    }
  };
  visit(elements);
  return spans.sort((a, b) => a[0] - b[0]);
}

function accent(text: string): string {
  return text.replace(/[A-Za-z]/gu, (letter) => ACCENTED.get(letter) ?? letter);
}

/** Padding of about PSEUDO_EXPANSION times the literal length, in breakable groups so it can wrap. */
function padding(literalLength: number): string {
  const length = Math.max(1, Math.ceil(literalLength * PSEUDO_EXPANSION));
  const groups: string[] = [];
  for (let remaining = length; remaining > 0; remaining -= PADDING_GROUP.length) {
    groups.push(PADDING_GROUP.slice(0, Math.min(remaining, PADDING_GROUP.length)));
  }
  return ` ${groups.join(' ')}`;
}

/**
 * The message in a pseudo-locale. Throws if the message is not valid ICU MessageFormat; the catalogue
 * lint guarantees that for the shipped catalogues.
 */
export function pseudoLocalise(message: string, locale: PseudoLocale): string {
  const spans = literalSpans(parse(message, { captureLocation: true }));
  const transform = PSEUDO_LOCALES[locale].transform;
  let result = '';
  let position = 0;
  let literalLength = 0;
  for (const [start, end] of spans) {
    result += message.slice(position, start);
    const literal = message.slice(start, end);
    literalLength += Array.from(literal).length;
    result +=
      transform === 'expanded'
        ? accent(literal)
        : `${RIGHT_TO_LEFT_OVERRIDE}${literal}${POP_DIRECTIONAL_FORMATTING}`;
    position = end;
  }
  result += message.slice(position);
  return transform === 'expanded' ? `[${result}${padding(literalLength)}]` : result;
}

/** A whole catalogue in a pseudo-locale, built from the source catalogue (by default the shipped `en`). */
export function pseudoCatalogue(locale: PseudoLocale, source: Catalogue = CATALOGUES.en): Catalogue {
  const result: Partial<Record<MessageKey, string>> = {};
  for (const [key, message] of Object.entries(source) as [MessageKey, string][]) {
    result[key] = pseudoLocalise(message, locale);
  }
  return result as Catalogue;
}
