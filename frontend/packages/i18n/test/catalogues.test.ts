import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOGUES, UI_LOCALES } from '../src/index.ts';
import { lintCatalogueDirectory, UI_CATALOGUE_LINT_OPTIONS } from '../src/lint/catalogue-lint.ts';

const messages = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'messages');

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

  it('hold only the shell keys of WP-0.1', () => {
    for (const locale of UI_LOCALES) {
      expect(Object.keys(CATALOGUES[locale]).sort()).toEqual([
        'app.name',
        'language.ar.endonym',
        'language.ckb.endonym',
        'language.en.endonym',
      ]);
    }
  });
});
