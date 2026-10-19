/**
 * UnitTest:locale-sets-dir-and-lang (docs/specs/modules/design-system.md §2.9, §3, §9; BUILD-PROMPT.md §6.5
 * "`dir` comes from the locale"): `<html>` gets `lang` and `dir` for `en`, `ckb` and `ar`, and updates on
 * change.
 *
 * Also checked: react-intl and React Aria receive the ui-intl locale (Western digits, Gregorian calendar;
 * OQ-141) and the locale's catalogue; a language change re-renders in place and keeps component state; a
 * missing message shows its key, never an empty string, and is reported without the message's values.
 */
import { CATALOGUES, UI_LOCALES, type UiLocale } from '@hms/i18n';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { useLocale } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, messageKey, type MessageErrorReport } from '../src/index.ts';

const EXPECTED: Record<UiLocale, { lang: string; dir: 'ltr' | 'rtl'; intl: string }> = {
  en: { lang: 'en', dir: 'ltr', intl: 'en-u-ca-gregory-nu-latn' },
  ckb: { lang: 'ckb', dir: 'rtl', intl: 'ckb-u-ca-gregory-nu-latn' },
  ar: { lang: 'ar', dir: 'rtl', intl: 'ar-u-ca-gregory-nu-latn' },
};

function Probe(): ReactNode {
  const intl = useIntl();
  const aria = useLocale();
  return (
    <dl>
      <dt>{intl.formatMessage({ id: messageKey('app.name') })}</dt>
      <dd data-testid="intl-locale">{intl.locale}</dd>
      <dd data-testid="aria-locale">{aria.locale}</dd>
      <dd data-testid="aria-direction">{aria.direction}</dd>
      <dd data-testid="formatted-number">{intl.formatNumber(1234567.5)}</dd>
      <dd data-testid="formatted-date">{intl.formatDate(Date.UTC(2026, 9, 19), { timeZone: 'UTC' })}</dd>
      <dd data-testid="endonym">
        <FormattedMessage id={messageKey('language.ckb.endonym')} />
      </dd>
    </dl>
  );
}

/** Holds state below the provider, to show a language change keeps it. */
function Counter(): ReactNode {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-testid="counter"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      {count}
    </button>
  );
}

const html = (): HTMLElement => document.documentElement;

afterEach(() => {
  html().removeAttribute('lang');
  html().removeAttribute('dir');
});

describe('locale-sets-dir-and-lang', () => {
  for (const locale of UI_LOCALES) {
    it(`sets lang="${EXPECTED[locale].lang}" and dir="${EXPECTED[locale].dir}" on <html> for ${locale}`, () => {
      render(
        <LocaleProvider locale={locale}>
          <Probe />
        </LocaleProvider>,
      );
      expect(html()).toHaveAttribute('lang', EXPECTED[locale].lang);
      expect(html()).toHaveAttribute('dir', EXPECTED[locale].dir);
    });

    it(`gives react-intl and React Aria the ui-intl locale and the ${locale} catalogue`, () => {
      render(
        <LocaleProvider locale={locale}>
          <Probe />
        </LocaleProvider>,
      );
      expect(screen.getByTestId('intl-locale')).toHaveTextContent(EXPECTED[locale].intl);
      expect(screen.getByTestId('aria-locale')).toHaveTextContent(EXPECTED[locale].intl);
      expect(screen.getByTestId('aria-direction')).toHaveTextContent(EXPECTED[locale].dir);
      expect(screen.getByTestId('endonym')).toHaveTextContent(CATALOGUES[locale]['language.ckb.endonym']);
      // Western digits only, in every locale (OQ-141), the Gregorian year included.
      for (const id of ['formatted-number', 'formatted-date']) {
        const text = screen.getByTestId(id).textContent;
        expect(text).toMatch(/[0-9]/);
        expect(text).not.toMatch(/[٠-٩۰-۹]/);
      }
      expect(screen.getByTestId('formatted-date').textContent).toContain('2026');
    });
  }

  it('updates lang and dir on <html> on every change, in place, keeping state below the provider', async () => {
    const user = userEvent.setup();
    const tree = (locale: UiLocale): ReactNode => (
      <LocaleProvider locale={locale}>
        <Probe />
        <Counter />
      </LocaleProvider>
    );
    const view = render(tree('en'));
    await user.click(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter')).toHaveTextContent('1');

    for (const locale of ['ckb', 'ar', 'en', 'ar'] as const) {
      view.rerender(tree(locale));
      expect(html()).toHaveAttribute('lang', EXPECTED[locale].lang);
      expect(html()).toHaveAttribute('dir', EXPECTED[locale].dir);
      expect(screen.getByTestId('intl-locale')).toHaveTextContent(EXPECTED[locale].intl);
      expect(screen.getByTestId('counter')).toHaveTextContent('1');
    }
  });

  it('shows a missing message as its key and reports it without the values it was given', () => {
    const reports: MessageErrorReport[] = [];
    const missing = 'banner.syntheticMissingKeyForTest';
    function Missing(): ReactNode {
      const intl = useIntl();
      // A value that stands for patient data; it must not reach the report.
      return <p data-testid="missing">{intl.formatMessage({ id: missing }, { name: 'SYN-PATIENT' })}</p>;
    }
    render(
      <LocaleProvider locale="ckb" onMessageError={(report) => reports.push(report)}>
        <Missing />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('missing')).toHaveTextContent(missing);
    expect(reports).toContainEqual({ code: 'MISSING_TRANSLATION', key: missing, locale: 'ckb' });
    expect(JSON.stringify(reports)).not.toContain('SYN-PATIENT');
  });

  it('reports message errors on the console by default, with code and key only', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      function Missing(): ReactNode {
        return <p>{useIntl().formatMessage({ id: 'demo.syntheticMissing' }, { name: 'SYN-PATIENT' })}</p>;
      }
      render(
        <LocaleProvider locale="en">
          <Missing />
        </LocaleProvider>,
      );
      const logged = consoleError.mock.calls.flat().map(String).join('\n');
      expect(logged).toContain('MISSING_TRANSLATION');
      expect(logged).toContain('demo.syntheticMissing');
      expect(logged).not.toContain('SYN-PATIENT');
    } finally {
      consoleError.mockRestore();
    }
  });
});
