/**
 * The Intl locales of the staff UI (BUILD-PROMPT.md §6.5, §11.1, §18.9 "Digits"; OQ-141).
 *
 * Every UI locale formats with Western digits (`nu-latn`) and the Gregorian calendar (`ca-gregory`): §6.5
 * and §11.1 require Western digits for clinical numerals, and WP-0.7 applies them to every number in the
 * staff workspaces, so a CLDR default such as `ckb`'s Arabic-Indic digits never reaches the screen. The tags
 * are in canonical BCP 47 form, with the Unicode extension keys in alphabetical order, which is what `Intl`
 * reports back. The §6.5 option of Eastern Arabic-Indic digits in patient-facing text is not part of the UI
 * and comes with those surfaces.
 */
import type { UiLocale } from './locales.ts';

/** The Intl locale tag for each UI locale: react-intl's `locale`, and every `Intl` formatter's. */
export const UI_INTL_LOCALES = {
  en: 'en-u-ca-gregory-nu-latn',
  ckb: 'ckb-u-ca-gregory-nu-latn',
  ar: 'ar-u-ca-gregory-nu-latn',
} as const satisfies Record<UiLocale, string>;

export type UiIntlLocale = (typeof UI_INTL_LOCALES)[UiLocale];

/** The numbering system of every UI locale. */
export const UI_NUMBERING_SYSTEM = 'latn';

/** The calendar of every UI locale. */
export const UI_CALENDAR = 'gregory';

/** The Intl locale tag of a UI locale. */
export function uiIntlLocale(locale: UiLocale): UiIntlLocale {
  return UI_INTL_LOCALES[locale];
}

/**
 * Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic (U+06F0–U+06F9) digits: none may appear in the
 * staff UI. Tests and checks use it to find them.
 */
export const NON_WESTERN_ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/u;

/** True when the text holds an Arabic-Indic or Extended Arabic-Indic digit. */
export function hasNonWesternArabicDigits(text: string): boolean {
  return NON_WESTERN_ARABIC_DIGITS.test(text);
}
