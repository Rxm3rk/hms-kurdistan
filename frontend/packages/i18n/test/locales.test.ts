import { describe, expect, it } from 'vitest';
import {
  isPatientTemplateLocale,
  isUiLocale,
  LOCALES,
  PATIENT_TEMPLATE_LOCALES,
  SOURCE_LOCALE,
  TEMPLATE_ONLY_LOCALES,
  textDirection,
  UI_LOCALES,
} from '../src/index.ts';

describe('locales (BUILD-PROMPT.md §4.1)', () => {
  it('has exactly en, ckb and ar as UI locales', () => {
    expect(UI_LOCALES).toEqual(['en', 'ckb', 'ar']);
    expect(SOURCE_LOCALE).toBe('en');
  });

  it('runs English left to right and Sorani and Arabic right to left, in Arabic script', () => {
    expect(textDirection('en')).toBe('ltr');
    expect(textDirection('ckb')).toBe('rtl');
    expect(textDirection('ar')).toBe('rtl');
    expect(LOCALES.en.script).toBe('Latn');
    expect(LOCALES.ckb.script).toBe('Arab');
    expect(LOCALES.ar.script).toBe('Arab');
  });

  it('keeps ku-Arab for patient-facing templates only, never the UI', () => {
    expect(PATIENT_TEMPLATE_LOCALES).toEqual(['en', 'ckb', 'ar', 'ku-Arab']);
    expect(LOCALES['ku-Arab']).toEqual({ tag: 'ku-Arab', dir: 'rtl', script: 'Arab', ui: false });
    expect(isUiLocale('ku-Arab')).toBe(false);
    expect(isPatientTemplateLocale('ku-Arab')).toBe(true);
    expect(TEMPLATE_ONLY_LOCALES).toEqual(['ku-Arab']);
  });

  it('marks exactly the UI locales as UI locales', () => {
    const uiFlagged = Object.values(LOCALES)
      .filter((locale) => locale.ui)
      .map((locale) => locale.tag);
    expect(uiFlagged).toEqual([...UI_LOCALES]);
    for (const locale of UI_LOCALES) {
      expect(isUiLocale(locale)).toBe(true);
      expect(LOCALES[locale].tag).toBe(locale);
    }
    expect(isUiLocale('ku-Latn')).toBe(false);
    expect(isUiLocale('EN')).toBe(false);
  });
});
