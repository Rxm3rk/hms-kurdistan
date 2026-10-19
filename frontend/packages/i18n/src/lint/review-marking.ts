/**
 * The review marking of translated catalogues (decision DN-021; content request OQ-151; KA-031).
 *
 * The `ckb` and `ar` texts are drafts that a clinician has not yet reviewed. The catalogue format is a flat
 * map of key to message with no room for metadata, so the status of each message lives beside it, in
 * `review/<locale>.json` in the catalogue directory: a flat JSON object from every message key of that
 * locale's catalogue to its review status. The lint fails when:
 * - a locale that needs marking has no review file, or a review file exists for any other locale;
 * - a review file is not UTF-8 without a byte order mark, is not valid JSON, repeats a key or is not a flat
 *   object;
 * - a message of the catalogue has no status, or the review file names a key the catalogue does not have;
 * - a status is not one of REVIEW_STATUSES.
 *
 * The only status is `unreviewed`. A clinician's review must record who reviewed which text and when, and
 * that format is decided with OQ-151, so no message can be marked reviewed until the lint learns it.
 */
import { readJsonObject, type CatalogueSource } from './json-object.ts';

/** The review statuses a message can have. */
export const REVIEW_STATUSES = ['unreviewed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** The subdirectory of the catalogue directory that holds the review files. */
export const REVIEW_DIRECTORY = 'review';

/** The keys of one parsed catalogue, which its review file must cover exactly. */
export interface CatalogueKeys {
  readonly file: string;
  readonly keys: ReadonlySet<string>;
}

export interface ReviewMarkingResult {
  readonly errors: readonly string[];
  /** The number of messages marked `unreviewed`. */
  readonly unreviewed: number;
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** The file name a review file is reported under, for example `review/ckb.json`. */
export function reviewFileName(locale: string): string {
  return `${REVIEW_DIRECTORY}/${locale}.json`;
}

/**
 * Checks the review files against the catalogues. `catalogues` maps a locale to its parsed catalogue; a
 * locale in `locales` whose catalogue did not parse is checked only for the review file itself.
 */
export function lintReviewMarking(
  reviewSources: readonly CatalogueSource[],
  catalogues: ReadonlyMap<string, CatalogueKeys>,
  locales: readonly string[],
): ReviewMarkingResult {
  const errors: string[] = [];
  let unreviewed = 0;
  const seen = new Set<string>();
  for (const source of reviewSources) {
    if (!locales.includes(source.locale)) {
      errors.push(
        `${source.file}: unexpected review file: the review-marked locales are ${locales.join(', ')}`,
      );
      continue;
    }
    if (seen.has(source.locale)) {
      errors.push(`${source.file}: a second review file for locale "${source.locale}"`);
      continue;
    }
    seen.add(source.locale);
    const marking = readJsonObject(
      source,
      'a review file must be a JSON object of message keys to review statuses',
      errors,
    );
    if (marking === undefined) {
      continue;
    }
    const catalogue = catalogues.get(source.locale);
    for (const [key, status] of Object.entries(marking)) {
      if (!isReviewStatus(status)) {
        errors.push(
          `${source.file}: key "${key}": unknown review status ${JSON.stringify(status)}; the only status is ` +
            `"unreviewed" until the clinician review records its own (DN-021, OQ-151)`,
        );
      } else {
        unreviewed += 1;
      }
      if (catalogue !== undefined && !catalogue.keys.has(key)) {
        errors.push(`${source.file}: key "${key}" is not in ${catalogue.file}`);
      }
    }
    if (catalogue !== undefined) {
      for (const key of [...catalogue.keys].sort()) {
        if (!Object.hasOwn(marking, key)) {
          errors.push(
            `${source.file}: key "${key}" of ${catalogue.file} has no review status: mark it "unreviewed" (DN-021)`,
          );
        }
      }
    }
  }
  for (const locale of locales) {
    if (!seen.has(locale)) {
      errors.push(
        `${reviewFileName(locale)} is missing: every ${locale} message needs a review status (DN-021)`,
      );
    }
  }
  return { errors, unreviewed };
}
