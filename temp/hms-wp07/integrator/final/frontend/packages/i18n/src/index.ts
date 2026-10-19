/**
 * @hms/i18n: UI locales, their text direction and Intl tags, the ICU MessageFormat catalogues with the
 * review status of their translations, the pseudo-locales and the Sorani letter list (BUILD-PROMPT.md §6.5).
 */
export {
  isPatientTemplateLocale,
  isUiLocale,
  LOCALES,
  PATIENT_TEMPLATE_LOCALES,
  SOURCE_LOCALE,
  TEMPLATE_ONLY_LOCALES,
  textDirection,
  UI_LOCALES,
  type LocaleInfo,
  type PatientTemplateLocale,
  type Script,
  type TextDirection,
  type UiLocale,
} from './locales.ts';
export { CATALOGUES, type Catalogue, type MessageKey } from './catalogues.ts';
export {
  hasNonWesternArabicDigits,
  NON_WESTERN_ARABIC_DIGITS,
  UI_CALENDAR,
  UI_INTL_LOCALES,
  UI_NUMBERING_SYSTEM,
  uiIntlLocale,
  type UiIntlLocale,
} from './ui-intl.ts';
export {
  REVIEW_STATUSES,
  reviewStatus,
  TRANSLATION_REVIEW,
  type ReviewStatus,
  type TranslatedLocale,
} from './review-status.ts';
export {
  isPseudoLocale,
  PSEUDO_EXPANSION,
  PSEUDO_LOCALES,
  pseudoCatalogue,
  pseudoLocalise,
  type PseudoLocale,
  type PseudoLocaleInfo,
  type PseudoTransform,
} from './pseudo.ts';
export {
  ARABIC_FORMS_NOT_IN_SORANI,
  SORANI_LETTERS,
  type SoraniLetter,
  type SoraniLetterPair,
  type SoraniLetters,
} from './sorani-letters.ts';
