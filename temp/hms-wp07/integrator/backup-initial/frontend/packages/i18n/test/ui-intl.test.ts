import { describe, expect, it } from 'vitest';
import {
  hasNonWesternArabicDigits,
  NON_WESTERN_ARABIC_DIGITS,
  UI_CALENDAR,
  UI_INTL_LOCALES,
  UI_LOCALES,
  UI_NUMBERING_SYSTEM,
  uiIntlLocale,
} from '../src/index.ts';

/** Every Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic (U+06F0–U+06F9) digit. */
const EASTERN_DIGITS = [
  ...Array.from({ length: 10 }, (_, index) => String.fromCodePoint(0x0660 + index)),
  ...Array.from({ length: 10 }, (_, index) => String.fromCodePoint(0x06f0 + index)),
];

const NUMBERS = [0, 1, 7, 10, 60, 99.5, 0.25, 1234567.891, -42, 1e21];
const DATES = [Date.UTC(2026, 9, 19, 13, 5, 9), Date.UTC(1931, 0, 1), Date.UTC(2099, 11, 31, 23, 59, 59)];

describe('UnitTest:ui-intl-western-digits', () => {
  it('resolves the UI locales to the canonical ckb-u-ca-gregory-nu-latn form, and the same for ar and en', () => {
    expect(UI_INTL_LOCALES).toEqual({
      en: 'en-u-ca-gregory-nu-latn',
      ckb: 'ckb-u-ca-gregory-nu-latn',
      ar: 'ar-u-ca-gregory-nu-latn',
    });
    for (const locale of UI_LOCALES) {
      const tag = uiIntlLocale(locale);
      expect(new Intl.Locale(tag).toString(), tag).toBe(tag);
      expect(Intl.getCanonicalLocales(tag), tag).toEqual([tag]);
      const options = new Intl.DateTimeFormat(tag).resolvedOptions();
      expect(options.locale, tag).toBe(tag);
      expect(options.calendar, tag).toBe(UI_CALENDAR);
      expect(options.numberingSystem, tag).toBe(UI_NUMBERING_SYSTEM);
      expect(new Intl.NumberFormat(tag).resolvedOptions().numberingSystem, tag).toBe(UI_NUMBERING_SYSTEM);
    }
  });

  it('keeps the language of each locale, so CLDR data for ckb and ar is used, not a fallback', () => {
    for (const locale of UI_LOCALES) {
      expect(new Intl.Locale(uiIntlLocale(locale)).language).toBe(locale);
      expect(new Intl.NumberFormat(uiIntlLocale(locale)).resolvedOptions().locale).toMatch(
        new RegExp(`^${locale}(-|$)`),
      );
    }
  });

  it('formats numbers, percentages, units, dates, times and relative times with no Eastern Arabic-Indic digit', () => {
    for (const locale of UI_LOCALES) {
      const tag = uiIntlLocale(locale);
      const outputs = [
        ...NUMBERS.map((value) => new Intl.NumberFormat(tag).format(value)),
        ...NUMBERS.map((value) => new Intl.NumberFormat(tag, { style: 'percent' }).format(value)),
        ...NUMBERS.map((value) =>
          new Intl.NumberFormat(tag, { style: 'unit', unit: 'kilogram' }).format(value),
        ),
        ...NUMBERS.map((value) =>
          new Intl.NumberFormat(tag, { style: 'currency', currency: 'IQD' }).format(value),
        ),
        ...DATES.flatMap((date) =>
          (['full', 'long', 'medium', 'short'] as const).map((style) =>
            new Intl.DateTimeFormat(tag, {
              dateStyle: style,
              timeStyle: style,
              timeZone: 'Asia/Baghdad',
            }).format(date),
          ),
        ),
        new Intl.RelativeTimeFormat(tag).format(-60, 'second'),
        new Intl.ListFormat(tag).format(['1', '2', '3']),
        new Intl.PluralRules(tag).select(60),
      ];
      for (const output of outputs) {
        expect(hasNonWesternArabicDigits(output), `${tag}: ${output}`).toBe(false);
      }
      expect(new Intl.NumberFormat(tag, { useGrouping: false }).format(1234567890)).toBe('1234567890');
    }
  });

  it('shows why the tags matter: plain ckb would format Arabic-Indic digits', () => {
    expect(hasNonWesternArabicDigits(new Intl.NumberFormat('ckb').format(60))).toBe(true);
    expect(hasNonWesternArabicDigits(new Intl.NumberFormat(uiIntlLocale('ckb')).format(60))).toBe(false);
  });

  it('detects every Arabic-Indic and Extended Arabic-Indic digit, and no Western one', () => {
    for (const digit of EASTERN_DIGITS) {
      expect(NON_WESTERN_ARABIC_DIGITS.test(`x${digit}x`), digit).toBe(true);
    }
    expect(hasNonWesternArabicDigits('0123456789 ,.%-')).toBe(false);
    expect(hasNonWesternArabicDigits('٫٬')).toBe(false);
  });

  it('keeps the Arabic plural categories, which the catalogues rely on (60 is "many")', () => {
    expect(new Intl.PluralRules(uiIntlLocale('ar')).select(60)).toBe('many');
    expect([...new Intl.PluralRules(uiIntlLocale('ar')).resolvedOptions().pluralCategories].sort()).toEqual([
      'few',
      'many',
      'one',
      'other',
      'two',
      'zero',
    ]);
    expect(new Intl.PluralRules(uiIntlLocale('ckb')).select(1)).toBe('one');
  });
});
