import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ARABIC_FORMS_NOT_IN_SORANI,
  CATALOGUES,
  hasNonWesternArabicDigits,
  SORANI_LETTERS,
  UI_LOCALES,
  type MessageKey,
} from '../src/index.ts';
import { lintCatalogueDirectory, UI_CATALOGUE_LINT_OPTIONS } from '../src/lint/catalogue-lint.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const messages = path.join(here, '..', 'src', 'messages');

describe('the shipped UI catalogues', () => {
  it('pass the localisation lint', () => {
    const result = lintCatalogueDirectory(messages, UI_CATALOGUE_LINT_OPTIONS);
    expect(result.errors).toEqual([]);
    expect(result.counts.catalogues).toBe(3);
  });

  it('keep the product name in Latin script in every catalogue', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGUES[locale]['app.name']).toBe('HMS Kurdistan');
    }
  });

  it('show each language under its own name, the same in every catalogue', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGUES[locale]['language.en.endonym']).toBe('English');
      expect(CATALOGUES[locale]['language.ckb.endonym']).toBe('کوردی');
      expect(CATALOGUES[locale]['language.ar.endonym']).toBe('العربية');
    }
  });

  it('write the Sorani endonym with the Kurdish letter forms ک and ی, not Arabic ك and ي (BUILD-PROMPT.md §11.1)', () => {
    const sorani = CATALOGUES.ckb['language.ckb.endonym'];
    expect(sorani).toContain('ک');
    expect(sorani).toContain('ی');
    expect(sorani).not.toMatch(/[كي]/);
  });

  it('hold the shell keys of WP-0.1 and every key of design-system §10, in English as §10 gives it', () => {
    const specified = specifiedMessages();
    expect(specified.size).toBeGreaterThan(100);
    const expectedKeys = [
      'app.name',
      'language.ar.endonym',
      'language.ckb.endonym',
      'language.en.endonym',
      ...specified.keys(),
    ].sort();
    for (const locale of UI_LOCALES) {
      expect(Object.keys(CATALOGUES[locale]).sort(), locale).toEqual(expectedKeys);
    }
    for (const [key, english] of specified) {
      expect(CATALOGUES.en[key as MessageKey], key).toBe(english);
    }
  });

  it('write Sorani with the Kurdish letter forms: no ي or ك outside the language names', () => {
    expect(ARABIC_FORMS_NOT_IN_SORANI).toEqual(['ي', 'ك']);
    for (const [key, message] of Object.entries(CATALOGUES.ckb)) {
      if (isLanguageName(key)) {
        continue;
      }
      for (const letter of ARABIC_FORMS_NOT_IN_SORANI) {
        expect(message.includes(letter), `${key} contains ${letter}`).toBe(false);
      }
    }
  });

  it('write Arabic with the Arabic letter forms: no ی, ک or ە outside the language names', () => {
    const kurdishForms = SORANI_LETTERS.pairs.map((pair) => pair.kurdish.char);
    for (const [key, message] of Object.entries(CATALOGUES.ar)) {
      if (isLanguageName(key)) {
        continue;
      }
      for (const letter of kurdishForms) {
        expect(message.includes(letter), `${key} contains ${letter}`).toBe(false);
      }
    }
  });

  it('use Western digits only (OQ-141)', () => {
    for (const locale of UI_LOCALES) {
      for (const [key, message] of Object.entries(CATALOGUES[locale])) {
        expect(hasNonWesternArabicDigits(message), `${locale} ${key}`).toBe(false);
      }
    }
  });

  it('separate the parts of composed banner values with the Arabic comma in ckb and ar (§10)', () => {
    for (const locale of ['ckb', 'ar'] as const) {
      for (const key of ['banner.weight.value', 'banner.codeStatus.recordedOn'] as const) {
        expect(CATALOGUES[locale][key], `${locale} ${key}`).toContain('،');
        expect(CATALOGUES[locale][key], `${locale} ${key}`).not.toContain(',');
      }
    }
  });
});

/** A language's name for itself, shown the same in every catalogue and so in its own script. */
function isLanguageName(key: string): boolean {
  return /^language\.[a-z-]+\.endonym$/i.test(key);
}

/** The message keys of docs/specs/modules/design-system.md §10 with their English text. */
function specifiedMessages(): Map<string, string> {
  const spec = readFileSync(
    path.join(here, '..', '..', '..', '..', 'docs', 'specs', 'modules', 'design-system.md'),
    'utf8',
  );
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('## 10. '));
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const messages = new Map<string, string>();
  for (const line of lines.slice(start, end)) {
    const match = /^\| `([a-zA-Z0-9.-]+)` \| (.+?) \| .* \|$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      messages.set(match[1], match[2]);
    }
  }
  return messages;
}
