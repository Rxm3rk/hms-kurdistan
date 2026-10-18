/**
 * Locales (BUILD-PROMPT.md §4.1 "Locales [P]", §11.1, §14.7).
 *
 * The UI runs in English (en), Central Kurdish / Sorani (ckb, Arabic script, right to left) and Arabic (ar,
 * right to left), chosen per user. ku-Arab (Badini/Kurmanji in Arabic script) exists only for patient-facing
 * templates, never for the UI, so it has no UI catalogue. ku-Latn is added only if open question Q-K17 says
 * Latin-script Kurmanji output is needed.
 */

export type TextDirection = 'ltr' | 'rtl';
export type Script = 'Latn' | 'Arab';

export interface LocaleInfo {
  /** The BCP 47 language tag. */
  readonly tag: string;
  /** The base text direction; the document's `dir` comes from here (§6.5). */
  readonly dir: TextDirection;
  /** The ISO 15924 script of the locale's text. */
  readonly script: Script;
  /** True for a UI locale; false for a locale used only in patient-facing templates. */
  readonly ui: boolean;
}

/** The UI locales, in the order a language picker lists them. */
export const UI_LOCALES = ['en', 'ckb', 'ar'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

/** Languages of patient-facing output: the UI locales plus Badini in Arabic script (§11.1). */
export const PATIENT_TEMPLATE_LOCALES = ['en', 'ckb', 'ar', 'ku-Arab'] as const;
export type PatientTemplateLocale = (typeof PATIENT_TEMPLATE_LOCALES)[number];

/** The locale the UI catalogues are written in first; the localisation lint compares the others with it. */
export const SOURCE_LOCALE = 'en' satisfies UiLocale;

export const LOCALES = {
  en: { tag: 'en', dir: 'ltr', script: 'Latn', ui: true },
  ckb: { tag: 'ckb', dir: 'rtl', script: 'Arab', ui: true },
  ar: { tag: 'ar', dir: 'rtl', script: 'Arab', ui: true },
  'ku-Arab': { tag: 'ku-Arab', dir: 'rtl', script: 'Arab', ui: false },
} as const satisfies Record<PatientTemplateLocale, LocaleInfo>;

/** Locales used only for patient-facing templates: they never get a UI catalogue. */
export const TEMPLATE_ONLY_LOCALES: readonly PatientTemplateLocale[] = PATIENT_TEMPLATE_LOCALES.filter(
  (locale) => !LOCALES[locale].ui,
);

export function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}

export function isPatientTemplateLocale(value: string): value is PatientTemplateLocale {
  return (PATIENT_TEMPLATE_LOCALES as readonly string[]).includes(value);
}

/** The text direction of a locale, for the `dir` attribute. */
export function textDirection(locale: PatientTemplateLocale): TextDirection {
  return LOCALES[locale].dir;
}
