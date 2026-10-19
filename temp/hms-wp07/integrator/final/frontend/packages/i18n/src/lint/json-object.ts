/**
 * Reads one JSON file of the catalogue directory (a catalogue or a review marking) as a flat JSON object,
 * reporting every file-level problem the localisation lint knows: a byte order mark, text that is not
 * JSON, a repeated key (JSON would silently keep only the last value) and a value that is not an object.
 */
import { findDuplicateKeys } from './duplicate-keys.ts';

/** One file to check: its locale, the file name used in messages, and its text. */
export interface CatalogueSource {
  readonly locale: string;
  readonly file: string;
  readonly text: string;
}

/**
 * The file's top-level object, or undefined when it cannot be read as one; the problems go to `errors`.
 * `what` names the expected content in the error for a non-object, for example "a JSON object of message
 * keys to ICU messages".
 */
export function readJsonObject(
  source: CatalogueSource,
  what: string,
  errors: string[],
): Readonly<Record<string, unknown>> | undefined {
  const { file, text } = source;
  if (text.startsWith('\uFEFF')) {
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
    errors.push(`${file}: ${what}`);
    return undefined;
  }
  return data as Readonly<Record<string, unknown>>;
}
