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
 *   message in the source locale;
 * - a clinical-keys rule fails (clinical-keys.ts): a `banner.*` or `clinical.*` message left in English, or
 *   a plural that drops `#` where it must keep it;
 * - a translated message has no review status, or an unknown one (review-marking.ts; DN-021).
 *
 * It never judges the wording or the translation itself: that is clinician and linguist review [HUMAN].
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { SOURCE_LOCALE, TEMPLATE_ONLY_LOCALES, UI_LOCALES } from '../locales.ts';
import { CLINICAL_KEY_PREFIXES, lintClinicalKeys, type ParsedMessage } from './clinical-keys.ts';
import { readJsonObject, type CatalogueSource } from './json-object.ts';
import { lintReviewMarking, REVIEW_DIRECTORY, type CatalogueKeys } from './review-marking.ts';

export type { CatalogueSource } from './json-object.ts';

export interface LintOptions {
  /** The locales that must each have exactly one catalogue. */
  readonly uiLocales: readonly string[];
  /** The locale whose placeholders the others must match. */
  readonly sourceLocale: string;
  /** Locales that have no UI catalogue on purpose, named in the error for a stray catalogue. */
  readonly templateOnlyLocales?: readonly string[];
  /** The clinical-keys rules (clinical-keys.ts) for these translated locales; omitted, they do not run. */
  readonly clinicalKeys?: {
    readonly translatedLocales: readonly string[];
    readonly prefixes: readonly string[];
  };
  /**
   * Locales whose every message carries a review status in `review/<locale>.json` (review-marking.ts);
   * omitted, review files are not read.
   */
  readonly reviewMarkedLocales?: readonly string[];
}

/** The locales translated from the source locale: ckb and ar. */
const TRANSLATED_LOCALES: readonly string[] = UI_LOCALES.filter((locale) => locale !== SOURCE_LOCALE);

/**
 * The options for the UI catalogues of BUILD-PROMPT.md §4.1: en, ckb and ar, with en as the source. The
 * clinical-keys rules and the review marking (DN-021) apply to ckb and ar.
 */
export const UI_CATALOGUE_LINT_OPTIONS: LintOptions = {
  uiLocales: UI_LOCALES,
  sourceLocale: SOURCE_LOCALE,
  templateOnlyLocales: TEMPLATE_ONLY_LOCALES,
  clinicalKeys: { translatedLocales: TRANSLATED_LOCALES, prefixes: CLINICAL_KEY_PREFIXES },
  reviewMarkedLocales: TRANSLATED_LOCALES,
};

export interface LintResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly counts: {
    readonly catalogues: number;
    readonly keys: number;
    readonly messages: number;
    /** Messages marked `unreviewed`; present when the options name review-marked locales. */
    readonly unreviewed?: number;
  };
}

/** Message keys: dot-separated segments, each starting with a lower-case letter, at least two segments. */
export const MESSAGE_KEY_PATTERN = /^[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/;

interface ParsedCatalogue {
  readonly source: CatalogueSource;
  /** Placeholder signature per key; null when the message did not parse. */
  readonly signatures: Map<string, string[] | null>;
  /** The string messages, with their elements (null when the message did not parse). */
  readonly messages: Map<string, ParsedMessage>;
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
  const { file } = source;
  const data = readJsonObject(
    source,
    'a catalogue must be a JSON object of message keys to ICU messages',
    errors,
  );
  if (data === undefined) {
    return undefined;
  }
  const signatures = new Map<string, string[] | null>();
  const messages = new Map<string, ParsedMessage>();
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
      const elements = parse(value, { requiresOtherClause: true, shouldParseSkeletons: true });
      signatures.set(key, placeholderSignature(elements));
      messages.set(key, { text: value, elements });
    } catch (error) {
      errors.push(`${file}: key "${key}": ICU MessageFormat syntax error ${syntaxErrorText(error)}`);
      signatures.set(key, null);
      messages.set(key, { text: value, elements: null });
    }
  }
  return { source, signatures, messages };
}

/**
 * Lints catalogue texts already in memory. `initialErrors` are file-level problems found while reading.
 * `reviewSources` are the review files (`review/<locale>.json`), checked when the options name
 * review-marked locales.
 */
export function lintCatalogueSources(
  sources: readonly CatalogueSource[],
  options: LintOptions,
  initialErrors: readonly string[] = [],
  reviewSources: readonly CatalogueSource[] = [],
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

  if (options.clinicalKeys !== undefined) {
    errors.push(
      ...lintClinicalKeys(
        parsed.map((catalogue) => ({
          locale: catalogue.source.locale,
          file: catalogue.source.file,
          messages: catalogue.messages,
        })),
        { sourceLocale: options.sourceLocale, ...options.clinicalKeys },
      ),
    );
  }

  const counts = {
    catalogues: parsed.length,
    keys: allKeys.length,
    messages: parsed.reduce((total, catalogue) => total + catalogue.signatures.size, 0),
  };
  if (options.reviewMarkedLocales === undefined) {
    return { errors, warnings: [], counts };
  }
  const catalogueKeys = new Map<string, CatalogueKeys>(
    parsed.map((catalogue) => [
      catalogue.source.locale,
      { file: catalogue.source.file, keys: new Set(catalogue.signatures.keys()) },
    ]),
  );
  const review = lintReviewMarking(reviewSources, catalogueKeys, options.reviewMarkedLocales);
  errors.push(...review.errors);
  return { errors, warnings: [], counts: { ...counts, unreviewed: review.unreviewed } };
}

/** Reads the .json files of one directory, sorted by name, reporting a file that is not valid UTF-8. */
function readJsonFiles(
  directory: string,
  fileName: (name: string) => string,
  readErrors: string[],
): CatalogueSource[] {
  const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const bytes = readFileSync(path.join(directory, name));
      let text: string;
      try {
        text = strictUtf8.decode(bytes);
      } catch {
        readErrors.push(`${fileName(name)}: not valid UTF-8`);
        text = new TextDecoder('utf-8').decode(bytes);
      }
      return { locale: name.slice(0, -'.json'.length), file: fileName(name), text };
    });
}

/**
 * Lints the catalogue directory: `<locale>.json` for each UI locale and, when the options name
 * review-marked locales, `review/<locale>.json` for each of them. Any other .json file in either directory
 * is reported as unexpected; other files are ignored.
 */
export function lintCatalogueDirectory(directory: string, options: LintOptions): LintResult {
  const readErrors: string[] = [];
  const sources = readJsonFiles(directory, (name) => name, readErrors);
  const reviewDirectory = path.join(directory, REVIEW_DIRECTORY);
  const reviewSources =
    options.reviewMarkedLocales !== undefined &&
    existsSync(reviewDirectory) &&
    statSync(reviewDirectory).isDirectory()
      ? readJsonFiles(reviewDirectory, (name) => `${REVIEW_DIRECTORY}/${name}`, readErrors)
      : [];
  return lintCatalogueSources(sources, options, readErrors, reviewSources);
}
