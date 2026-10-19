/**
 * The clinical-keys rules of the localisation lint (docs/specs/modules/design-system.md §9
 * `UnitTest:clinical-keys-lint`, §10 notes for translators; BUILD-PROMPT.md §6.5, §11.1, §18.9).
 *
 * - Under the clinical key prefixes (`banner.*`, `clinical.*`), a translated (`ckb` or `ar`) message equal
 *   to the source (`en`) message is an error: a clinical label left in English would be read as translated
 *   when it is not. The parsed messages are compared, not their source text, so the spacing of ICU syntax
 *   (`{ weight }`, `{count,plural,...}`) and the order of plural or select branches do not count. In every
 *   literal text the comparison applies Unicode NFC, removes format and other default-ignorable characters
 *   (the bidi marks RLM, LRM and ALM, the bidi embeddings and isolates, ZWSP, ZWNJ, ZWJ, the BOM, the soft
 *   hyphen) and removes white space, so none of these hides an untranslated text. A message that does not
 *   parse is compared on its text, normalised the same way.
 * - A plural (or selectordinal) in a translated message keeps `#`, the rendered count, in every branch when
 *   the key is clinical, or when the source message keeps `#` in every branch of the same argument. Arabic
 *   one and two forms are often written without the numeral, and a clinical count must always show it.
 *   `#` inside a nested plural belongs to that plural, so it does not count for the outer one.
 *
 * It does not check that every CLDR plural category is present (the catalogue lint requires only `other`);
 * the reviewer checks that.
 */
import { TYPE, type MessageFormatElement, type PluralElement } from '@formatjs/icu-messageformat-parser';

/** Key prefixes whose messages are clinical. */
export const CLINICAL_KEY_PREFIXES = ['banner.', 'clinical.'] as const;

/** One parsed message: its text, and its elements when it parsed as ICU MessageFormat. */
export interface ParsedMessage {
  readonly text: string;
  readonly elements: readonly MessageFormatElement[] | null;
}

/** One catalogue's parsed messages. */
export interface CatalogueMessages {
  readonly locale: string;
  readonly file: string;
  readonly messages: ReadonlyMap<string, ParsedMessage>;
}

export interface ClinicalKeysOptions {
  /** The locale the translations are compared with. */
  readonly sourceLocale: string;
  /** The translated locales the rules apply to. */
  readonly translatedLocales: readonly string[];
  /** Key prefixes whose messages are clinical. */
  readonly prefixes: readonly string[];
}

/** True when the key falls under a clinical prefix. */
export function isClinicalKey(key: string, prefixes: readonly string[] = CLINICAL_KEY_PREFIXES): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

/**
 * Format characters (general category Cf: the bidi marks, embeddings, overrides and isolates, ZWSP, ZWNJ, ZWJ,
 * the BOM, the soft hyphen), other default-ignorable code points (such as variation selectors and the
 * combining grapheme joiner) and white space. None of them makes a message a translation.
 */
const IGNORED_IN_COMPARISON = /[\p{Cf}\p{Default_Ignorable_Code_Point}\p{White_Space}]/gu;

/** A literal text as compared: NFC, with every ignored character removed. */
function comparableText(text: string): string {
  return text.normalize('NFC').replace(IGNORED_IN_COMPARISON, '');
}

/** True for an object that is a parsed message element (each has a numeric `type`). */
function isElement(value: unknown): value is MessageFormatElement {
  return (
    typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'number'
  );
}

/**
 * A canonical form of a parsed value for the comparison: source locations dropped, object keys sorted (so
 * plural and select branches compare in any order), literal texts normalised by `comparableText`, and in
 * every element list the literals that are left empty dropped and adjacent literals joined.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isElement)) {
      return canonicalElements(value);
    }
    return value.map(canonical);
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([name]) => name !== 'location')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, item]) => [name, canonical(item)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/** `canonical` for one element list. */
function canonicalElements(elements: readonly MessageFormatElement[]): unknown[] {
  const result: unknown[] = [];
  let text = '';
  const flush = (): void => {
    if (text !== '') {
      result.push({ type: TYPE.literal, value: text });
      text = '';
    }
  };
  for (const element of elements) {
    if (element.type === TYPE.literal) {
      text += comparableText(element.value);
    } else {
      flush();
      result.push(canonical(element));
    }
  }
  flush();
  return result;
}

/**
 * True when a translated message is the same as its source message: the same canonical parsed form, or,
 * when either does not parse, the same normalised text.
 */
function sameAsSource(message: ParsedMessage, source: ParsedMessage): boolean {
  if (message.elements === null || source.elements === null) {
    return comparableText(message.text) === comparableText(source.text);
  }
  return JSON.stringify(canonical(message.elements)) === JSON.stringify(canonical(source.elements));
}

/**
 * True when the elements hold a `#` of the enclosing plural: directly or inside a rich-text tag, but not
 * inside a nested plural (whose `#` is its own count). The ICU parser reads `#` in a select branch as
 * literal text, so a select is not searched.
 */
function hasPound(elements: readonly MessageFormatElement[]): boolean {
  return elements.some(
    (element) => element.type === TYPE.pound || (element.type === TYPE.tag && hasPound(element.children)),
  );
}

/** Every plural and selectordinal element, nested ones included. */
function plurals(elements: readonly MessageFormatElement[]): PluralElement[] {
  const found: PluralElement[] = [];
  const visit = (nodes: readonly MessageFormatElement[]): void => {
    for (const node of nodes) {
      if (node.type === TYPE.plural) {
        found.push(node);
        for (const option of Object.values(node.options)) {
          visit(option.value);
        }
      } else if (node.type === TYPE.select) {
        for (const option of Object.values(node.options)) {
          visit(option.value);
        }
      } else if (node.type === TYPE.tag) {
        visit(node.children);
      }
    }
  };
  visit(elements);
  return found;
}

/** The branches of a plural that have no `#`, in the order the message gives them. */
function branchesWithoutPound(plural: PluralElement): string[] {
  return Object.entries(plural.options)
    .filter(([, option]) => !hasPound(option.value))
    .map(([selector]) => selector);
}

/** Argument names of the source message's plurals that keep `#` in every branch. */
function poundEverywhere(elements: readonly MessageFormatElement[] | null | undefined): Set<string> {
  const names = new Set<string>();
  for (const plural of plurals(elements ?? [])) {
    if (branchesWithoutPound(plural).length === 0) {
      names.add(plural.value);
    }
  }
  return names;
}

/** Applies the clinical-keys rules; returns one error per finding. */
export function lintClinicalKeys(
  catalogues: readonly CatalogueMessages[],
  options: ClinicalKeysOptions,
): string[] {
  const errors: string[] = [];
  const source = catalogues.find((catalogue) => catalogue.locale === options.sourceLocale);
  for (const catalogue of catalogues) {
    if (!options.translatedLocales.includes(catalogue.locale)) {
      continue;
    }
    for (const [key, message] of catalogue.messages) {
      const clinical = isClinicalKey(key, options.prefixes);
      const sourceMessage = source?.messages.get(key);
      if (clinical && sourceMessage !== undefined && sameAsSource(message, sourceMessage)) {
        errors.push(
          `${catalogue.file}: key "${key}": the message is the same as in ${source?.file ?? ''}; ` +
            `a clinical message (${options.prefixes.map((prefix) => `${prefix}*`).join(', ')}) must be translated`,
        );
      }
      if (message.elements === null) {
        continue;
      }
      const sourcePound = poundEverywhere(sourceMessage?.elements);
      for (const plural of plurals(message.elements)) {
        if (!clinical && !sourcePound.has(plural.value)) {
          continue;
        }
        const missing = branchesWithoutPound(plural);
        if (missing.length > 0) {
          const reason = clinical
            ? 'a clinical count'
            : `${source?.file ?? options.sourceLocale} keeps # in every branch`;
          errors.push(
            `${catalogue.file}: key "${key}": plural "${plural.value}" has no # in ${missing
              .map((selector) => `"${selector}"`)
              .join(', ')}; ${reason}, so every branch must show the number`,
          );
        }
      }
    }
  }
  return errors;
}
