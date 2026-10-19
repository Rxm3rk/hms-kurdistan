/**
 * The prototype's own messages: every screen keeps its texts in a `messages.ts` beside it, in English,
 * Sorani Kurdish and Arabic, and reads them with `useT`.
 *
 *   // messages.ts
 *   export const messages = defineMessages({
 *     en:  { title: 'Ward & beds', occupied: '{count, plural, one {# bed occupied} other {# beds occupied}}' },
 *     ckb: { title: 'قاوش و جێگاکان', occupied: '{count, plural, one {# جێگە گیراوە} other {# جێگە گیراون}}' },
 *     ar:  { title: 'الردهات والأسرّة', occupied: '{count, plural, one {سرير واحد مشغول} two {سريران مشغولان} few {# أسرّة مشغولة} many {# سريراً مشغولاً} other {# سرير مشغول}}' },
 *   });
 *
 *   // index.tsx
 *   const t = useT(messages);
 *   <h1>{t('title')}</h1>
 *   <p>{t('occupied', { count: 15 })}</p>
 *   <p>{t.rich('welcome', { name: <Bdi dir="rtl">{name}</Bdi> })}</p>
 *
 * - `defineMessages` makes type checking fail when ckb or ar lacks a key of en, or has one en lacks.
 * - Messages are ICU MessageFormat (plural, select, `{name}` placeholders), formatted by react-intl's own
 *   formatter for the current locale. A key missing at run time falls back to English, then to the key.
 * - The locale is the LocaleProvider's (the frame's language picker, `?locale=`): `useLocale()`.
 * - Formatting helpers (money, dates, times, ages) live in ./format.ts and are re-exported here; the
 *   `useFormat()` hook binds them to the current locale.
 */
import { isUiLocale, type UiLocale } from '@hms/i18n';
import { createElement, Fragment, useMemo, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import type { Text3 } from '../data/types.ts';
import {
  formatAge,
  formatDate,
  formatDateTime,
  formatIQD,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  formatUSD,
  formatWeekday,
  pickText,
  type DateInput,
  type DateStyle,
  type Locale,
} from './format.ts';

export * from './format.ts';

/** A screen's messages: the same keys in en, ckb and ar. */
export interface MessageBundle<K extends string> {
  readonly en: Readonly<Record<K, string>>;
  readonly ckb: Readonly<Record<K, string>>;
  readonly ar: Readonly<Record<K, string>>;
}

/** Declares a message bundle; the keys come from `en`, and ckb and ar must have exactly the same keys. */
export function defineMessages<K extends string>(bundle: {
  readonly en: Readonly<Record<K, string>>;
  readonly ckb: Readonly<Record<NoInfer<K>, string>>;
  readonly ar: Readonly<Record<NoInfer<K>, string>>;
}): MessageBundle<K> {
  return bundle;
}

/** Values for plain-text messages. */
export type MessageVars = Readonly<Record<string, string | number | Date>>;
/** Values for rich messages: React elements too (Bdi, Qty, Money, links). */
export type RichMessageVars = Readonly<Record<string, ReactNode | Date>>;

export interface Translate<K extends string> {
  /** The message as plain text (for aria-label, title, placeholders, and ordinary text). */
  (key: K, vars?: MessageVars): string;
  /** The message with React elements in its placeholders. */
  readonly rich: (key: K, vars: RichMessageVars) => ReactNode;
  /** The current locale. */
  readonly locale: Locale;
}

/** The current UI locale (`en`, `ckb` or `ar`), from the frame's LocaleProvider. */
export function useLocale(): UiLocale {
  const intl = useIntl();
  const base = intl.locale.split('-')[0] ?? 'en';
  return isUiLocale(base) ? base : 'en';
}

/** True when the current locale is written right to left (ckb, ar). */
export function useIsRtl(): boolean {
  return useLocale() !== 'en';
}

/** The translator of one message bundle for the current locale. */
export function useT<K extends string>(messages: MessageBundle<K>): Translate<K> {
  const intl = useIntl();
  const locale = useLocale();
  return useMemo(() => {
    const pattern = (key: K): string => messages[locale][key] ?? messages.en[key] ?? key;
    const format = (key: K, vars: Readonly<Record<string, unknown>> | undefined): unknown => {
      const text = pattern(key);
      if (vars === undefined && !text.includes('{')) {
        return text;
      }
      try {
        return intl.formatters.getMessageFormat(text, intl.locale).format<ReactNode>(vars as Record<string, ReactNode>);
      } catch {
        return text;
      }
    };
    const t = ((key: K, vars?: MessageVars): string => {
      const out = format(key, vars);
      return Array.isArray(out) ? out.join('') : String(out);
    }) as Translate<K>;
    const rich = (key: K, vars: RichMessageVars): ReactNode => {
      const out = format(key, vars);
      if (Array.isArray(out)) {
        return createElement(
          Fragment,
          null,
          ...out.map((part: unknown, index: number) => createElement(Fragment, { key: index }, part as ReactNode)),
        );
      }
      return out as ReactNode;
    };
    return Object.assign(t, { rich, locale });
  }, [intl, locale, messages]);
}

/** The formatting helpers bound to the current locale. */
export interface Formatters {
  readonly locale: Locale;
  /** The current locale's form of a Text3 from the data module. */
  readonly text: (value: Text3) => string;
  readonly iqd: (amount: number) => string;
  readonly usd: (amount: number) => string;
  readonly money: (amount: number, currency: 'IQD' | 'USD') => string;
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly percent: (fraction: number) => string;
  readonly date: (value: DateInput, style?: DateStyle) => string;
  readonly time: (value: DateInput) => string;
  readonly dateTime: (value: DateInput) => string;
  readonly weekday: (value: DateInput) => string;
  readonly relative: (value: DateInput) => string;
  readonly age: (dob: string) => string;
}

export function useFormat(): Formatters {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      text: (value) => pickText(value, locale),
      iqd: (amount) => formatIQD(amount, locale),
      usd: (amount) => formatUSD(amount, locale),
      money: (amount, currency) => formatMoney(amount, currency, locale),
      number: (value, options) => formatNumber(value, locale, options),
      percent: (fraction) => formatPercent(fraction, locale),
      date: (value, style) => formatDate(value, locale, style),
      time: (value) => formatTime(value),
      dateTime: (value) => formatDateTime(value, locale),
      weekday: (value) => formatWeekday(value, locale),
      relative: (value) => formatRelative(value, locale),
      age: (dob) => formatAge(dob, locale),
    }),
    [locale],
  );
}
