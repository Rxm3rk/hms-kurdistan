/**
 * `LocaleProvider`: the user's UI locale (BUILD-PROMPT.md §6.5 "`dir` comes from the locale", §11.1, §14.7;
 * docs/specs/modules/design-system.md §2.9, §3).
 *
 * - Sets `lang` and `dir` on `<html>`: `en` → `ltr`, `ckb` and `ar` → `rtl`, from `textDirection` in
 *   `@hms/i18n`. Components never set a direction of their own except through `Bdi`.
 * - Supplies react-intl's `IntlProvider` and React Aria's `I18nProvider` with the `ui-intl` locale
 *   (`ckb-u-ca-gregory-nu-latn` and the like), so that every formatter writes Western digits and Gregorian
 *   dates (OQ-141), and with the locale's catalogue.
 * - A language change re-renders in place, without a reload; state below the provider (the patient context
 *   included) is kept.
 * - A missing message is shown as its key (react-intl's fallback, never an empty string) and reported
 *   through `onMessageError` with the error code and the message key only: never the message's values,
 *   which can hold patient data.
 */
import { LOCALES, textDirection, uiIntlLocale, CATALOGUES, type UiLocale } from '@hms/i18n';
import { useLayoutEffect, type ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import { IntlProvider, type IntlConfig } from 'react-intl';

/** What `onMessageError` receives: no message text and no values, so no patient data. */
export interface MessageErrorReport {
  /** react-intl's error code, for example `MISSING_TRANSLATION` or `FORMAT_ERROR`. */
  readonly code: string;
  /** The message key, when the error concerns one message. */
  readonly key: string | undefined;
  readonly locale: UiLocale;
}

export interface LocaleProviderProps {
  readonly locale: UiLocale;
  /**
   * Replaces the locale's catalogue. Development and test builds use it for the in-memory pseudo-locales
   * (§2.9); production code never passes it.
   */
  readonly messages?: Readonly<Record<string, string>>;
  /** Receives message errors without patient data. By default they are written to the console. */
  readonly onMessageError?: (report: MessageErrorReport) => void;
  readonly children?: ReactNode;
}

type IntlError = Parameters<NonNullable<IntlConfig['onError']>>[0];

function defaultReport(report: MessageErrorReport): void {
  console.error(`[i18n] ${report.code} ${report.key ?? ''} (${report.locale})`);
}

function messageKeyOf(error: IntlError): string | undefined {
  if ('descriptor' in error) {
    const id = error.descriptor.id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

export function LocaleProvider({
  locale,
  messages,
  onMessageError = defaultReport,
  children,
}: LocaleProviderProps): ReactNode {
  const intlLocale = uiIntlLocale(locale);
  const lang = LOCALES[locale].tag;
  const dir = textDirection(locale);

  // A layout effect, so the first paint already has the right direction.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
  }, [lang, dir]);

  return (
    <IntlProvider
      locale={intlLocale}
      messages={messages ?? CATALOGUES[locale]}
      onError={(error: IntlError) => {
        onMessageError({ code: error.code, key: messageKeyOf(error), locale });
      }}
    >
      <I18nProvider locale={intlLocale}>{children}</I18nProvider>
    </IntlProvider>
  );
}
