/**
 * The UI language choice (BUILD-PROMPT.md §11.1; docs/specs/modules/design-system.md §2.9): English, Sorani
 * or Arabic, each shown by its own name in its own language (`language.*.endonym`). A React Aria radio
 * group, styled as the density control is. Choosing a language changes `?locale=` in place, without a
 * reload; the LocaleProvider then sets `lang` and `dir` on `<html>`, and the patient context is kept.
 */
import { Message } from '@hms/design-system';
import { isUiLocale, LOCALES, UI_LOCALES, type MessageKey, type UiLocale } from '@hms/i18n';
import type { ReactNode } from 'react';
import { Label, RadioButton, RadioField, RadioGroup } from 'react-aria-components';

const ENDONYM: Readonly<Record<UiLocale, MessageKey>> = {
  en: 'language.en.endonym',
  ckb: 'language.ckb.endonym',
  ar: 'language.ar.endonym',
};

export interface LanguagePickerProps {
  readonly locale: UiLocale;
  readonly onChange: (locale: UiLocale) => void;
}

export function LanguagePicker({ locale, onChange }: LanguagePickerProps): ReactNode {
  return (
    <RadioGroup
      className="hms-density-control hms-language-picker"
      orientation="horizontal"
      value={locale}
      onChange={(value) => {
        if (isUiLocale(value)) {
          onChange(value);
        }
      }}
    >
      <Label className="hms-density-control__label">
        <Message id="language.picker.label" />
      </Label>
      <div className="hms-density-control__options">
        {UI_LOCALES.map((option) => (
          <RadioField key={option} value={option} className="hms-density-control__field">
            <RadioButton className="hms-density-control__option">
              <span lang={LOCALES[option].tag}>
                <Message id={ENDONYM[option]} />
              </span>
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  );
}
