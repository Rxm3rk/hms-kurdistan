import { describe, expect, it } from 'vitest';
import { ARABIC_FORMS_NOT_IN_SORANI, SORANI_LETTERS, type SoraniLetter } from '../src/index.ts';

/** The letter's code point as `U+XXXX`. */
function codePointOf(letter: SoraniLetter): string {
  return `U+${(letter.char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}

describe('UnitTest:sorani-letters', () => {
  it('lists the ten Sorani letters exactly once, in the order of the specification', () => {
    const letters = SORANI_LETTERS.letters.map((letter) => letter.char);
    expect(letters).toEqual(['پ', 'چ', 'ژ', 'گ', 'ڤ', 'ڕ', 'ڵ', 'ۆ', 'ێ', 'ە']);
    expect(new Set(letters).size).toBe(10);
  });

  it('lists the three Arabic and Kurdish letter pairs exactly once', () => {
    const pairs = SORANI_LETTERS.pairs.map((pair) => `${pair.arabic.char}/${pair.kurdish.char}`);
    expect(pairs).toEqual(['ي/ی', 'ك/ک', 'ه/ە']);
    expect(new Set(pairs).size).toBe(3);
    expect(new Set(SORANI_LETTERS.pairs.map((pair) => pair.arabic.char)).size).toBe(3);
    expect(new Set(SORANI_LETTERS.pairs.map((pair) => pair.kurdish.char)).size).toBe(3);
  });

  it('gives each entry one code point, in the Arabic block, with the code point it names', () => {
    const entries = [
      ...SORANI_LETTERS.letters,
      ...SORANI_LETTERS.pairs.flatMap((pair) => [pair.arabic, pair.kurdish]),
    ];
    for (const letter of entries) {
      expect(Array.from(letter.char), letter.name).toHaveLength(1);
      expect(letter.char.normalize('NFC'), letter.name).toBe(letter.char);
      expect(codePointOf(letter), letter.name).toBe(letter.codePoint);
      expect(letter.char, letter.name).toMatch(/^[\u0600-\u06FF]$/u);
      expect(letter.name, letter.codePoint).toMatch(/^ARABIC LETTER [A-Z ]+$/);
    }
  });

  it('names the same character the same way wherever it appears (ە is a letter and a pair form)', () => {
    const ae = SORANI_LETTERS.letters.find((letter) => letter.char === 'ە');
    const aePair = SORANI_LETTERS.pairs.find((pair) => pair.kurdish.char === 'ە');
    expect(ae).toEqual({ char: 'ە', codePoint: 'U+06D5', name: 'ARABIC LETTER AE' });
    expect(aePair?.kurdish).toEqual(ae);
  });

  it('marks ي and ك as never Sorani, and ه as a Sorani letter that cannot be swapped for ە blindly', () => {
    expect(SORANI_LETTERS.pairs.map((pair) => [pair.arabic.char, pair.arabicFormInSorani])).toEqual([
      ['ي', false],
      ['ك', false],
      ['ه', true],
    ]);
    expect(ARABIC_FORMS_NOT_IN_SORANI).toEqual(['ي', 'ك']);
  });

  it('keeps every Sorani letter out of the Arabic forms of the pairs', () => {
    const letters = new Set(SORANI_LETTERS.letters.map((letter) => letter.char));
    for (const char of ARABIC_FORMS_NOT_IN_SORANI) {
      expect(letters.has(char), char).toBe(false);
    }
  });
});
