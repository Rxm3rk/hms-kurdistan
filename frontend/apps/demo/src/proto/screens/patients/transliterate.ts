/**
 * Suggestions for the other name forms from the Sorani spelling, for the registration form. A rough,
 * rule-based transliteration (Sorani writes its vowels, so it goes a long way); it is only ever offered as a
 * suggestion that the clerk checks with the patient, never filled in silently.
 */

/** The vowels Sorani always writes (و and ی are vowels or consonants by position). */
const VOWELS = new Set(['ا', 'ە', 'ێ', 'ۆ']);

const LATIN: Readonly<Record<string, string>> = {
  'ا': 'a',
  'آ': 'a',
  'أ': 'a',
  'إ': 'i',
  'ب': 'b',
  'پ': 'p',
  'ت': 't',
  'ط': 't',
  'ج': 'j',
  'چ': 'ch',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ر': 'r',
  'ڕ': 'r',
  'ز': 'z',
  'ذ': 'z',
  'ض': 'z',
  'ظ': 'z',
  'ژ': 'zh',
  'س': 's',
  'ص': 's',
  'ث': 's',
  'ش': 'sh',
  'غ': 'gh',
  'ف': 'f',
  'ڤ': 'v',
  'ق': 'q',
  'ک': 'k',
  'ك': 'k',
  'گ': 'g',
  'ل': 'l',
  'ڵ': 'l',
  'م': 'm',
  'ن': 'n',
  'ه': 'h',
  'ھ': 'h',
  'ە': 'a',
  'ة': 'a',
  'ێ': 'e',
  'ۆ': 'o',
};

function capitalise(word: string): string {
  return word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`;
}

function latinWord(word: string): string {
  const chars = Array.from(word.replace(/[ئعء]/gu, ''));
  let out = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? '';
    const previous = chars[index - 1];
    const next = chars[index + 1];
    const besideVowel = (previous !== undefined && VOWELS.has(previous)) || (next !== undefined && VOWELS.has(next));
    if (char === 'و') {
      if (next === 'و') {
        out += 'u';
        index += 1;
      } else {
        // A consonant (w) beside a written vowel, otherwise the vowel u.
        out += besideVowel ? 'w' : 'u';
      }
    } else if (char === 'ی' || char === 'ي') {
      // A consonant (y) at the start of a word or beside a written vowel, otherwise the vowel i.
      out += previous === undefined || besideVowel ? 'y' : 'i';
    } else {
      out += LATIN[char] ?? (/[\p{L}\p{N}-]/u.test(char) && !/\p{Script=Arabic}/u.test(char) ? char : '');
    }
  }
  return capitalise(out);
}

/** A Latin form suggested from the Sorani spelling (`کاروان تاهیر بەکر` → `Karwan Tahir Bakr`). */
export function suggestLatin(sorani: string): string {
  return sorani
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0)
    .map(latinWord)
    .filter((word) => word.length > 0)
    .join(' ');
}

const ARABIC: Readonly<Record<string, string>> = {
  'ێ': 'ي',
  'ی': 'ي',
  'ۆ': 'و',
  'ڕ': 'ر',
  'ڵ': 'ل',
  'ک': 'ك',
  'گ': 'ك',
  'پ': 'ب',
  'چ': 'ج',
  'ڤ': 'ف',
};

function arabicWord(word: string): string {
  let rest = word;
  let head = '';
  if (rest.startsWith('عەبدول')) {
    head = 'عبدال';
    rest = rest.slice('عەبدول'.length);
  } else if (rest.startsWith('ئا')) {
    head = 'آ';
    rest = rest.slice(2);
  } else if (rest.startsWith('ئە')) {
    head = 'أ';
    rest = rest.slice(2);
  } else if (rest.startsWith('ئۆ') || rest.startsWith('ئو')) {
    head = 'أو';
    rest = rest.slice(2);
  } else if (rest.startsWith('ئی') || rest.startsWith('ئێ')) {
    head = 'إي';
    rest = rest.slice(2);
  }
  const chars = Array.from(rest.replace(/وو/gu, 'و'));
  let out = '';
  chars.forEach((char, index) => {
    if (char === 'ە') {
      // Sorani writes the short a; Arabic spelling leaves it out inside a word and writes ه at the end.
      out += index === chars.length - 1 ? 'ه' : '';
    } else {
      out += ARABIC[char] ?? char;
    }
  });
  return head + out;
}

/** An Arabic-script form suggested from the Sorani spelling (`ئەحمەد` → `أحمد`); always to be checked. */
export function suggestArabic(sorani: string): string {
  return sorani
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0)
    .map(arabicWord)
    .join(' ');
}

/** True when the text has at least one Arabic-script letter (a Sorani or Arabic name form). */
export function hasArabicScript(text: string): boolean {
  return /\p{Script=Arabic}/u.test(text);
}
