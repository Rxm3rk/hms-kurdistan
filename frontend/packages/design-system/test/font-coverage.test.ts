// @vitest-environment node
/**
 * UnitTest:font-coverage (docs/specs/modules/design-system.md §3 "Fonts", §9; BUILD-PROMPT.md §4.1, §11.1):
 * the cmap of the bundled woff2 holds every Sorani letter, every letter variant and the Western digits.
 *
 * The bundled fonts are several woff2 subsets, each with a unicode-range (OQ-156). So, for every required
 * character and both bundled weights, the test does what the browser's font matching does: it walks the
 * families of tokens.css's --hms-font-family in order and, within each, the @font-face rules of
 * src/fonts.css whose unicode-range covers the character, and takes the first whose woff2 cmap has a glyph
 * for it. A character that no bundled face draws, so that only a system font could, fails. The
 * Arabic-script subset must also shape: every Sorani letter takes a joined form after a joining letter, and
 * the dual-joining ones before one.
 *
 * WP-0.8 repeats this check for its prints (OQ-148). The rendered check is E2E:glyph-render (slice S7).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SORANI_LETTERS } from '@hms/i18n';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const FONTS_CSS = readFileSync(new URL('../src/fonts.css', import.meta.url), 'utf8');
const TOKENS_CSS = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const WEIGHTS = [400, 700] as const;

interface Face {
  readonly family: string;
  readonly weight: number;
  readonly url: string;
  readonly ranges: readonly (readonly [number, number])[];
  readonly font: fontkit.Font;
}

function parseRanges(text: string): [number, number][] {
  return text.split(',').map((part) => {
    const range = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i.exec(part.trim());
    if (range === null) {
      throw new Error(`unparsed unicode-range part: ${part}`);
    }
    const [, start = '', end] = range;
    if (start.includes('?')) {
      return [parseInt(start.replace(/\?/g, '0'), 16), parseInt(start.replace(/\?/g, 'F'), 16)];
    }
    return [parseInt(start, 16), parseInt(end ?? start, 16)];
  });
}

function loadFont(url: string): fontkit.Font {
  const font = fontkit.create(readFileSync(require.resolve(url)));
  if ('fonts' in font) {
    throw new Error(`${url} is a font collection, not a font`);
  }
  return font;
}

function parseFaces(css: string): Face[] {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  return blocks.map((block) => {
    const value = (name: string): string => {
      const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(block);
      if (match?.[1] === undefined) {
        throw new Error(`@font-face without ${name}: ${block}`);
      }
      return match[1].trim();
    };
    const sources = [...value('src').matchAll(/url\(\s*'([^']+)'\s*\)\s*format\('([^']+)'\)/g)];
    expect(sources.map((s) => s[2])).toEqual(['woff2']);
    const url = sources[0]?.[1] ?? '';
    return {
      family: value('font-family').replace(/^'|'$/g, ''),
      weight: Number(value('font-weight')),
      url,
      ranges: parseRanges(value('unicode-range')),
      font: loadFont(url),
    };
  });
}

function fontFamilies(css: string): string[] {
  const match = /--hms-font-family:\s*([^;]+);/.exec(css);
  if (match?.[1] === undefined) {
    throw new Error('tokens.css has no --hms-font-family');
  }
  return match[1].split(',').map((family) => family.trim().replace(/^'|'$/g, ''));
}

const GENERIC_FAMILIES = new Set(['sans-serif', 'serif', 'system-ui']);
const faces = parseFaces(FONTS_CSS);
const families = fontFamilies(TOKENS_CSS);
const bundledFamilies = families.filter((family) => !GENERIC_FAMILIES.has(family));

/**
 * The bundled faces the browser would try for a code point at a weight, in order: families in
 * --hms-font-family order, and within a family the faces whose unicode-range covers the code point.
 */
function candidateFaces(codePoint: number, weight: number): Face[] {
  return bundledFamilies.flatMap((family) =>
    faces.filter(
      (f) =>
        f.family === family &&
        f.weight === weight &&
        f.ranges.some(([start, end]) => codePoint >= start && codePoint <= end),
    ),
  );
}

/** The bundled face that draws a code point at a weight: the first candidate whose cmap has it. */
function chosenFace(codePoint: number, weight: number): Face | undefined {
  return candidateFaces(codePoint, weight).find((face) => face.font.hasGlyphForCodePoint(codePoint));
}

const hex = (codePoint: number): string => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
const codePoints = (text: string): number[] => Array.from(text, (c) => c.codePointAt(0) ?? 0);

const soraniLetters = SORANI_LETTERS.letters.map((letter) => letter.char);
const letterVariants = SORANI_LETTERS.pairs.flatMap((pair) => [pair.arabic.char, pair.kurdish.char]);
const westernDigits = '0123456789';

// Beyond the spec's minimum: the whole Sorani alphabet, the Arabic alphabet, the Arabic punctuation and ZWNJ
// that UI text uses, and the Kurdish Latin letters of transliterated names.
const soraniAlphabet = 'ئابپتجچحخدرڕزژسشعغفڤقکگلڵمنھەوۆیێ';
const arabicAlphabet = 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي';
const arabicPunctuation = '،؛؟‌';
const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;()-/%';
const kurdishLatin = 'ÇçÊêÎîŞşÛû';

const REQUIRED: readonly (readonly [label: string, text: string])[] = [
  ['the ten Sorani letters of the spec', soraniLetters.join('')],
  ['the Arabic and Kurdish forms of ي/ی, ك/ک and ه/ە', letterVariants.join('')],
  ['the Western digits', westernDigits],
  ['the Sorani alphabet', soraniAlphabet],
  ['the Arabic alphabet', arabicAlphabet],
  ['the Arabic comma, semicolon, question mark and ZWNJ', arabicPunctuation],
  ['Basic Latin letters and punctuation', latin],
  ['the Kurdish Latin letters', kurdishLatin],
];

describe('font-coverage', () => {
  it('bundles woff2 faces for every family of --hms-font-family, at weights 400 and 700', () => {
    expect(bundledFamilies).toEqual(['Noto Sans', 'Noto Sans Arabic']);
    expect(families.at(-1)).toBe('sans-serif');
    for (const family of bundledFamilies) {
      for (const weight of WEIGHTS) {
        expect(
          faces.some((f) => f.family === family && f.weight === weight),
          `${family} ${String(weight)}`,
        ).toBe(true);
      }
    }
  });

  it('reads the spec letter list from @hms/i18n: ten Sorani letters and three letter pairs', () => {
    expect(soraniLetters).toEqual(['پ', 'چ', 'ژ', 'گ', 'ڤ', 'ڕ', 'ڵ', 'ۆ', 'ێ', 'ە']);
    expect(letterVariants).toEqual(['ي', 'ی', 'ك', 'ک', 'ه', 'ە']);
  });

  for (const [label, text] of REQUIRED) {
    it(`has a glyph in the chosen bundled woff2 for ${label}`, () => {
      const missing: string[] = [];
      for (const weight of WEIGHTS) {
        for (const codePoint of codePoints(text)) {
          if (chosenFace(codePoint, weight) === undefined) {
            const tried = candidateFaces(codePoint, weight).map((face) => face.url);
            missing.push(
              `${hex(codePoint)} @${String(weight)}: in no bundled cmap (tried: ${tried.join(', ') || 'none'})`,
            );
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it('pins KA-038: no bundled face draws U+202F, the group separator of ClinicalNumber (DN-031)', () => {
    // Noto Sans latin's unicode-range covers U+202F but its cmap lacks it, so the browser draws this space
    // with a system font. When a bundled face gains it, this test fails: close KA-038 then.
    for (const weight of WEIGHTS) {
      expect(candidateFaces(0x202f, weight).map((face) => face.family)).toEqual(['Noto Sans']);
      expect(chosenFace(0x202f, weight)).toBeUndefined();
    }
  });

  it('draws the Sorani letters and the digits from the intended families', () => {
    for (const weight of WEIGHTS) {
      for (const codePoint of codePoints(soraniLetters.join('') + letterVariants.join(''))) {
        expect(chosenFace(codePoint, weight)?.family, hex(codePoint)).toBe('Noto Sans Arabic');
      }
      for (const codePoint of codePoints(westernDigits)) {
        expect(chosenFace(codePoint, weight)?.family, hex(codePoint)).toBe('Noto Sans');
      }
    }
  });

  it('shapes every Sorani letter: a joined form after a joining letter, and before one when dual-joining', () => {
    // Right-joining Sorani letters join only to the letter before them.
    const rightJoining = new Set(['ژ', 'ڕ', 'ۆ', 'ە']);
    for (const weight of WEIGHTS) {
      const face = chosenFace(codePoints('ب')[0] ?? 0, weight);
      expect(face?.font.availableFeatures).toEqual(expect.arrayContaining(['init', 'medi', 'fina']));
      const font = face?.font;
      if (font === undefined) {
        throw new Error('no Arabic face');
      }
      // Noto Sans Arabic draws a letter as a base glyph plus separate dot marks (its ccmp feature), and the
      // run is in visual order. Unshaped, a letter beside ب keeps all of its isolated glyphs; shaped, its
      // base glyph is replaced by a joined form. So some glyph of the isolated letter must be absent from the
      // joined run.
      const glyphIds = (text: string): Set<number> => {
        const ids = font.layout(text).glyphs.map((glyph) => glyph.id);
        expect(ids, `${text} has no missing glyph`).not.toContain(0);
        return new Set(ids);
      };
      const joins = (letter: string, text: string): boolean => {
        const joined = glyphIds(text);
        return [...glyphIds(letter)].some((id) => !joined.has(id));
      };
      for (const letter of soraniLetters) {
        expect(joins(letter, `ب${letter}`), `${letter} takes its final form after ب`).toBe(true);
        if (!rightJoining.has(letter)) {
          expect(joins(letter, `${letter}ب`), `${letter} takes its initial form before ب`).toBe(true);
          expect(joins(letter, `ب${letter}ب`), `${letter} takes its medial form`).toBe(true);
        }
      }
      // The check can fail: two letters that never join (ا then د) keep their isolated glyphs.
      expect(joins('د', 'اد')).toBe(false);
    }
  });
});
