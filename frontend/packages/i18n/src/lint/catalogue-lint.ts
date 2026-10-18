/**
 * The localisation lint (BUILD-PROMPT.md §6.5, §14.7, §18.9; fast tier §19.1). It fails when:
 * - a UI locale has no catalogue, or a catalogue exists for a locale that is not a UI locale;
 * - a catalogue is not UTF-8 without a byte order mark, is not valid JSON, repeats a key, is not a flat
 *   object of strings, or has a malformed key;
 * - a key is missing from any UI catalogue;
 * - a message is empty;
 * - a message is not valid ICU MessageFormat (@formatjs/icu-messageformat-parser, with the `other` clause
 *   required in plural and select);
 * - a message's placeholder arguments (names and kinds, including rich-text tags) differ from the same
 *   message in the source locale.
 *
 * It never judges the wording or the translation itself: that is clinician and linguist review [HUMAN].
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { SOURCE_LOCALE, TEMPLATE_ONLY_LOCALES, UI_LOCALES } from '../locales.ts';
import { findDuplicateKeys } from './duplicate-keys.ts';

/** One catalogue to check: its locale, the file name used in messages, and its text. */
export interface CatalogueSource {
  readonly locale: string;
  readonly file: string;
  readonly text: string;
}

export interface LintOptions {
  /** The locales that must each have exactly one catalogue. */
  readonly uiLocales: readonly string[];
  /** The locale whose placeholders the others must match. */
  readonly sourceLocale: string;
  /** Locales that have no UI catalogue on purpose, named in the error for a stray catalogue. */
  readonly templateOnlyLocales?: readonly string[];
}

/** The options for the UI catalogues of BUILD-PROMPT.md §4.1: en, ckb and ar, with en as the source. */
export const UI_CATALOGUE_LINT_OPTIONS: LintOptions = {
  uiLocales: UI_LOCALES,
  sourceLocale: SOURCE_LOCALE,
  templateOnlyLocales: TEMPLATE_ONLY_LOCALES,
};

export interface LintResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly counts: { readonly catalogues: number; readonly keys: number; readonly messages: number };
}

/** Message keys: dot-separated segments, each starting with a lower-case letter, at least two segments. */
export const MESSAGE_KEY_PATTERN = /^[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/;

interface ParsedCatalogue {
  readonly source: CatalogueSource;
  /** Placeholder signature per key; null when the message did not parse. */
  readonly signatures: Map<string, string[] | null>;
}

/** The placeholder arguments of a message, as sorted display strings such as `{count, plural}` or `<b>`. */
export function placeholderSignature(elements: readonly MessageFormatElement[]): string[] {
  const found = new Set<string>();
  const visit = (nodes: readonly MessageFormatElement[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case TYPE.literal:
        case TYPE.pound:
          break;
        case TYPE.argument:
          found.add(`{${node.value}}`);
          break;
        case TYPE.number:
          found.add(`{${node.value}, number}`);
          break;
        case TYPE.date:
          found.add(`{${node.value}, date}`);
          break;
        case TYPE.time:
          found.add(`{${node.value}, time}`);
          break;
        case TYPE.select:
          found.add(`{${node.value}, select}`);
          for (const option of Object.values(node.options)) {
            visit(option.value);
          }
          break;
        case TYPE.plural:
          found.add(`{${node.value}, ${node.pluralType === 'ordinal' ? 'selectordinal' : 'plural'}}`);
          for (const option of Object.values(node.options)) {
            visit(option.value);
          }
          break;
        case TYPE.tag:
          found.add(`<${node.value}>`);
          visit(node.children);
          break;
      }
    }
  };
  visit(elements);
  return [...found].sort();
}

function describeSignature(signature: readonly string[]): string {
  return signature.length === 0 ? 'no placeholders' : signature.join(', ');
}

/** The ICU parser throws a SyntaxError carrying `location`; read it without trusting its shape. */
function syntaxErrorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const location: unknown = (error as Error & { location?: unknown }).location;
  if (typeof location === 'object' && location !== null && 'start' in location) {
    const start: unknown = location.start;
    if (typeof start === 'object' && start !== null && 'line' in start && 'column' in start) {
      return `${error.message} at line ${String(start.line)}, column ${String(start.column)}`;
    }
  }
  return error.message;
}

function parseCatalogue(source: CatalogueSource, errors: string[]): ParsedCatalogue | undefined {
  const { file, text } = source;
  if (text.startsWith('﻿')) {
    errors.push(`${file}: starts with a byte order mark: save it as UTF-8 without a BOM`);
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    errors.push(`${file}: not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  for (const duplicate of findDuplicateKeys(text)) {
    errors.push(
      `${file}:${String(duplicate.line)}: key "${duplicate.key}" appears more than once; JSON keeps only the last value`,
    );
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push(`${file}: a catalogue must be a JSON object of message keys to ICU messages`);
    return undefined;
  }
  const signatures = new Map<string, string[] | null>();
  for (const [key, value] of Object.entries(data)) {
    if (!MESSAGE_KEY_PATTERN.test(key)) {
      errors.push(
        `${file}: key "${key}" is malformed: use dot-separated lower-camel segments, as in "app.name"`,
      );
    }
    if (typeof value !== 'string') {
      errors.push(
        `${file}: key "${key}": the value must be a string (catalogues are flat maps of key to message)`,
      );
      signatures.set(key, null);
      continue;
    }
    if (value.trim() === '') {
      errors.push(`${file}: key "${key}": the message is empty`);
      signatures.set(key, null);
      continue;
    }
    try {
      signatures.set(
        key,
        placeholderSignature(parse(value, { requiresOtherClause: true, shouldParseSkeletons: true })),
      );
    } catch (error) {
      errors.push(`${file}: key "${key}": ICU MessageFormat syntax error ${syntaxErrorText(error)}`);
      signatures.set(key, null);
    }
  }
  return { source, signatures };
}

/** Lints catalogue texts already in memory. `initialErrors` are file-level problems found while reading. */
export function lintCatalogueSources(
  sources: readonly CatalogueSource[],
  options: LintOptions,
  initialErrors: readonly string[] = [],
): LintResult {
  const errors: string[] = [...initialErrors];
  const parsed: ParsedCatalogue[] = [];

  const seen = new Set<string>();
  for (const source of sources) {
    if (!options.uiLocales.includes(source.locale)) {
      const templateOnly = options.templateOnlyLocales?.includes(source.locale) === true;
      errors.push(
        `${source.file}: unexpected catalogue: the UI locales are ${options.uiLocales.join(', ')}` +
          (templateOnly ? `; ${source.locale} is used only for patient-facing templates` : ''),
      );
      continue;
    }
    if (seen.has(source.locale)) {
      errors.push(`${source.file}: a second catalogue for locale "${source.locale}"`);
      continue;
    }
    seen.add(source.locale);
    const catalogue = parseCatalogue(source, errors);
    if (catalogue !== undefined) {
      parsed.push(catalogue);
    }
  }
  for (const locale of options.uiLocales) {
    if (!seen.has(locale)) {
      errors.push(`the catalogue for UI locale "${locale}" is missing`);
    }
  }

  const allKeys = [...new Set(parsed.flatMap((catalogue) => [...catalogue.signatures.keys()]))].sort();
  for (const catalogue of parsed) {
    for (const key of allKeys) {
      if (!catalogue.signatures.has(key)) {
        const holders = parsed
          .filter((other) => other.signatures.has(key))
          .map((other) => other.source.file)
          .join(', ');
        errors.push(`${catalogue.source.file}: key "${key}" is missing (present in ${holders})`);
      }
    }
  }

  const reference = parsed.find((catalogue) => catalogue.source.locale === options.sourceLocale);
  for (const key of allKeys) {
    const referenceSignature = reference?.signatures.get(key);
    const base =
      referenceSignature !== undefined && referenceSignature !== null
        ? { file: reference?.source.file ?? '', signature: referenceSignature }
        : parsed
            .map((catalogue) => ({ file: catalogue.source.file, signature: catalogue.signatures.get(key) }))
            .find((entry): entry is { file: string; signature: string[] } => Array.isArray(entry.signature));
    if (base === undefined) {
      continue;
    }
    for (const catalogue of parsed) {
      const signature = catalogue.signatures.get(key);
      if (catalogue.source.file === base.file || signature === undefined || signature === null) {
        continue;
      }
      if (signature.join('\n') !== base.signature.join('\n')) {
        errors.push(
          `${catalogue.source.file}: key "${key}": placeholders (${describeSignature(signature)}) differ from ` +
            `${base.file} (${describeSignature(base.signature)})`,
        );
      }
    }
  }

  return {
    errors,
    warnings: [],
    counts: {
      catalogues: parsed.length,
      keys: allKeys.length,
      messages: parsed.reduce((total, catalogue) => total + catalogue.signatures.size, 0),
    },
  };
}

/**
 * Lints the catalogue directory: `<locale>.json` for each UI locale. Any other .json file there is reported
 * as unexpected; other files are ignored.
 */
export function lintCatalogueDirectory(directory: string, options: LintOptions): LintResult {
  const readErrors: string[] = [];
  const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
  const sources = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const bytes = readFileSync(path.join(directory, name));
      let text: string;
      try {
        text = strictUtf8.decode(bytes);
      } catch {
        readErrors.push(`${name}: not valid UTF-8`);
        text = new TextDecoder('utf-8').decode(bytes);
      }
      return { locale: name.slice(0, -'.json'.length), file: name, text };
    });
  return lintCatalogueSources(sources, options, readErrors);
}
