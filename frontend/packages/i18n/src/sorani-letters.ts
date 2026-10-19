/**
 * The Sorani letters and the Arabic and Kurdish letter pairs (BUILD-PROMPT.md §4.1 "Fonts", §11.1, §18.9).
 * The data lives in sorani-letters.json so that other tools read the same list: the design system's
 * font-coverage test, and WP-0.8's print font check and input normalisation.
 *
 * - `letters`: the ten letters Sorani adds to the Arabic alphabet (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە).
 * - `pairs`: an Arabic letter form and the Kurdish form Sorani writes instead (ي/ی, ك/ک, ه/ە). Text typed on
 *   an Arabic keyboard often carries the Arabic form. `arabicFormInSorani` says whether the Arabic form is
 *   also a Sorani letter: ي and ك never occur in Sorani text, so they can always be replaced; ه does (it
 *   writes /h/, while ە writes the vowel /e/), so ه and ە can never be swapped mechanically.
 */
import data from './sorani-letters.json' with { type: 'json' };

export interface SoraniLetter {
  /** The letter, one code point. */
  readonly char: string;
  /** The code point as `U+XXXX`. */
  readonly codePoint: string;
  /** The Unicode character name. */
  readonly name: string;
}

export interface SoraniLetterPair {
  readonly arabic: SoraniLetter;
  readonly kurdish: SoraniLetter;
  /** True when the Arabic form is itself a Sorani letter, so the pair cannot be normalised blindly. */
  readonly arabicFormInSorani: boolean;
}

export interface SoraniLetters {
  readonly letters: readonly SoraniLetter[];
  readonly pairs: readonly SoraniLetterPair[];
}

export const SORANI_LETTERS: SoraniLetters = data;

/** Arabic letter forms that never occur in Sorani text (ي and ك). */
export const ARABIC_FORMS_NOT_IN_SORANI: readonly string[] = SORANI_LETTERS.pairs
  .filter((pair) => !pair.arabicFormInSorani)
  .map((pair) => pair.arabic.char);
