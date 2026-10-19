import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CATALOGUES,
  REVIEW_STATUSES,
  reviewStatus,
  TRANSLATION_REVIEW,
  UI_LOCALES,
  type MessageKey,
} from '../src/index.ts';
import {
  lintCatalogueDirectory,
  lintCatalogueSources,
  UI_CATALOGUE_LINT_OPTIONS,
  type CatalogueSource,
  type LintOptions,
} from '../src/lint/catalogue-lint.ts';

const messages = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'messages');

const OPTIONS: LintOptions = {
  uiLocales: ['en', 'ckb', 'ar'],
  sourceLocale: 'en',
  reviewMarkedLocales: ['ckb', 'ar'],
};

function source(locale: string, file: string, content: unknown): CatalogueSource {
  return { locale, file, text: JSON.stringify(content, null, 2) };
}

/** Synthetic catalogues with keys a.b and a.c in every locale. */
const CATALOGUE_SOURCES: readonly CatalogueSource[] = ['en', 'ckb', 'ar'].map((locale) =>
  source(locale, `${locale}.json`, { 'a.b': `SYN-${locale}`, 'a.c': `SYN-${locale}` }),
);

function lintReview(reviews: Record<string, unknown>): readonly string[] {
  const reviewSources = Object.entries(reviews).map(([locale, content]) =>
    typeof content === 'string'
      ? { locale, file: `review/${locale}.json`, text: content }
      : source(locale, `review/${locale}.json`, content),
  );
  return lintCatalogueSources(CATALOGUE_SOURCES, OPTIONS, [], reviewSources).errors;
}

const ALL_UNREVIEWED = { 'a.b': 'unreviewed', 'a.c': 'unreviewed' };

describe('the review marking lint (DN-021)', () => {
  it('passes when every ckb and ar message is marked, and counts the unreviewed messages', () => {
    const result = lintCatalogueSources(
      CATALOGUE_SOURCES,
      OPTIONS,
      [],
      [source('ckb', 'review/ckb.json', ALL_UNREVIEWED), source('ar', 'review/ar.json', ALL_UNREVIEWED)],
    );
    expect(result.errors).toEqual([]);
    expect(result.counts).toEqual({ catalogues: 3, keys: 2, messages: 6, unreviewed: 4 });
  });

  it('reports a missing review file', () => {
    expect(lintReview({ ckb: ALL_UNREVIEWED })).toEqual([
      'review/ar.json is missing: every ar message needs a review status (DN-021)',
    ]);
  });

  it('reports a review file for a locale that is not review-marked, and a second one for a locale', () => {
    const errors = lintCatalogueSources(
      CATALOGUE_SOURCES,
      OPTIONS,
      [],
      [
        source('ckb', 'review/ckb.json', ALL_UNREVIEWED),
        source('ar', 'review/ar.json', ALL_UNREVIEWED),
        source('en', 'review/en.json', ALL_UNREVIEWED),
        source('ar', 'review/ar-copy.json', ALL_UNREVIEWED),
      ],
    ).errors;
    expect(errors).toEqual([
      'review/en.json: unexpected review file: the review-marked locales are ckb, ar',
      'review/ar-copy.json: a second review file for locale "ar"',
    ]);
  });

  it('reports a message with no status and a status for a key the catalogue lacks', () => {
    expect(lintReview({ ckb: { 'a.b': 'unreviewed', 'a.gone': 'unreviewed' }, ar: ALL_UNREVIEWED })).toEqual([
      'review/ckb.json: key "a.gone" is not in ckb.json',
      'review/ckb.json: key "a.c" of ckb.json has no review status: mark it "unreviewed" (DN-021)',
    ]);
  });

  it('accepts no status but "unreviewed": a reviewed status waits for the clinician review (OQ-151)', () => {
    expect(REVIEW_STATUSES).toEqual(['unreviewed']);
    expect(
      lintReview({
        ckb: { 'a.b': 'reviewed', 'a.c': 'unreviewed' },
        ar: { 'a.b': 'unreviewed', 'a.c': true },
      }),
    ).toEqual([
      'review/ckb.json: key "a.b": unknown review status "reviewed"; the only status is "unreviewed" until the clinician review records its own (DN-021, OQ-151)',
      'review/ar.json: key "a.c": unknown review status true; the only status is "unreviewed" until the clinician review records its own (DN-021, OQ-151)',
    ]);
  });

  it('reports a review file that is not a flat JSON object, has a BOM or repeats a key', () => {
    const errors = lintReview({
      ckb: '\uFEFF{"a.b": "unreviewed", "a.c": "unreviewed"}',
      ar: '{\n  "a.b": "unreviewed",\n  "a.c": "unreviewed",\n  "a.c": "unreviewed"\n}',
    });
    expect(errors).toEqual([
      'review/ckb.json: starts with a byte order mark: save it as UTF-8 without a BOM',
      'review/ar.json:4: key "a.c" appears more than once; JSON keeps only the last value',
    ]);
    const shapeErrors = lintReview({ ckb: '["unreviewed"]', ar: '{"a.b": ' });
    expect(shapeErrors).toHaveLength(2);
    expect(shapeErrors[0]).toBe(
      'review/ckb.json: a review file must be a JSON object of message keys to review statuses',
    );
    expect(shapeErrors[1]).toMatch(/^review\/ar\.json: not valid JSON: /);
  });

  it('is part of the options the CLI uses for the shipped catalogues', () => {
    expect(UI_CATALOGUE_LINT_OPTIONS.reviewMarkedLocales).toEqual(['ckb', 'ar']);
  });
});

describe('UnitTest:ckb-ar-drafts-marked-unreviewed', () => {
  it('marks every ckb and ar message of the shipped catalogues unreviewed (DN-021, KA-031)', () => {
    for (const locale of ['ckb', 'ar'] as const) {
      const keys = Object.keys(CATALOGUES[locale]).sort();
      expect(Object.keys(TRANSLATION_REVIEW[locale]).sort(), locale).toEqual(keys);
      for (const key of keys) {
        expect(TRANSLATION_REVIEW[locale][key as MessageKey], `${locale} ${key}`).toBe('unreviewed');
        expect(reviewStatus(locale, key as MessageKey), `${locale} ${key}`).toBe('unreviewed');
      }
    }
  });

  it('reports the English source as the source, not as reviewed', () => {
    for (const key of Object.keys(CATALOGUES.en)) {
      expect(reviewStatus('en', key as MessageKey)).toBe('source');
    }
    expect(UI_LOCALES).toEqual(['en', 'ckb', 'ar']);
  });

  it('passes the review marking lint on the shipped directory', () => {
    const result = lintCatalogueDirectory(messages, UI_CATALOGUE_LINT_OPTIONS);
    expect(result.errors).toEqual([]);
    expect(result.counts.unreviewed).toBe(2 * Object.keys(CATALOGUES.en).length);
  });
});
