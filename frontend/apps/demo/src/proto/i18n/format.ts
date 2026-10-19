/**
 * Locale-aware formatting for the prototype: money (IQD, USD), numbers, dates, times, ages and relative
 * times, always in the Asia/Baghdad time zone.
 *
 * Digits: the staff UI writes Western digits (0-9) in every locale (OQ-141; @hms/i18n `nu-latn`), so these
 * helpers do too. Month and weekday names follow Kurdistan usage: Sorani uses the Syriac-derived month names
 * (تشرینی یەکەم for October), Arabic the Iraqi ones (تشرين الأول). Times are 24-hour (`09:30`).
 */
import { uiIntlLocale, type UiLocale } from '@hms/i18n';
import { DEMO_NOW, DEMO_TIME_ZONE } from '../data/clock.ts';
import type { Text3 } from '../data/types.ts';

export type Locale = UiLocale;

/** The current locale's form of a Text3. */
export function pickText(text: Text3, locale: Locale): string {
  return text[locale];
}

// ---------------------------------------------------------------------------------------------------------
// Numbers and money
// ---------------------------------------------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(uiIntlLocale(locale), options);
    numberFormats.set(key, format);
  }
  return format;
}

/** A number with the locale's grouping, Western digits: `1,310,000`. */
export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}): string {
  return numberFormat(locale, options).format(value);
}

/** A fraction (0 to 1) as a whole percentage: `82%`. */
export function formatPercent(fraction: number, locale: Locale): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

const CURRENCY_WORD: Readonly<Record<'IQD' | 'USD', Text3>> = {
  IQD: { en: 'IQD', ckb: 'دینار', ar: 'دينار' },
  USD: { en: 'USD', ckb: 'دۆلار', ar: 'دولار' },
};

/** Iraqi dinars, whole: en `IQD 1,310,000`; ckb `1,310,000 دینار`; ar `1,310,000 دينار`. */
export function formatIQD(amount: number, locale: Locale): string {
  const number = formatNumber(Math.round(amount), locale, { maximumFractionDigits: 0 });
  return locale === 'en' ? `IQD ${number}` : `${number} ${CURRENCY_WORD.IQD[locale]}`;
}

/** US dollars with cents: en `USD 1,250.50`; ckb `1,250.50 دۆلار`; ar `1,250.50 دولار`. */
export function formatUSD(amount: number, locale: Locale): string {
  const number = formatNumber(amount, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return locale === 'en' ? `USD ${number}` : `${number} ${CURRENCY_WORD.USD[locale]}`;
}

/** Money in either currency. */
export function formatMoney(amount: number, currency: 'IQD' | 'USD', locale: Locale): string {
  return currency === 'IQD' ? formatIQD(amount, locale) : formatUSD(amount, locale);
}

// ---------------------------------------------------------------------------------------------------------
// Dates and times (Asia/Baghdad)
// ---------------------------------------------------------------------------------------------------------

const MONTHS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ckb: [
    'کانوونی دووەم',
    'شوبات',
    'ئازار',
    'نیسان',
    'ئایار',
    'حوزەیران',
    'تەممووز',
    'ئاب',
    'ئەیلوول',
    'تشرینی یەکەم',
    'تشرینی دووەم',
    'کانوونی یەکەم',
  ],
  ar: ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'],
};

const WEEKDAYS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ckb: ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DEMO_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAY_INDEX: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** A date value: a Date, an ISO instant, or a `YYYY-MM-DD` date (taken as that calendar day). */
export type DateInput = Date | string;

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly weekday: number;
}

function toDate(value: DateInput): Date {
  if (value instanceof Date) {
    return value;
  }
  // A bare calendar date is noon in Baghdad, so the zone never moves it to another day.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+03:00`) : new Date(value);
}

/** Calendar parts of an instant in Asia/Baghdad. */
export function zonedParts(value: DateInput): ZonedParts {
  const parts = partsFormat.formatToParts(toDate(value));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export type DateStyle = 'short' | 'medium' | 'long' | 'iso';

/**
 * A date in Asia/Baghdad.
 * - `short`: `19/10/2026` (every locale)
 * - `medium` (default): en `19 Oct 2026`; ckb `19 تشرینی یەکەم 2026`; ar `19 تشرين الأول 2026`
 * - `long`: en `Monday, 19 October 2026`; ckb `دووشەممە، 19 تشرینی یەکەم 2026`; ar `الاثنين، 19 تشرين الأول 2026`
 * - `iso`: `2026-10-19`
 */
export function formatDate(value: DateInput, locale: Locale, style: DateStyle = 'medium'): string {
  const p = zonedParts(value);
  if (style === 'iso') {
    return `${String(p.year)}-${pad2(p.month)}-${pad2(p.day)}`;
  }
  if (style === 'short') {
    return `${pad2(p.day)}/${pad2(p.month)}/${String(p.year)}`;
  }
  const monthName = MONTHS[locale][p.month - 1] ?? '';
  const month = locale === 'en' && style === 'medium' ? monthName.slice(0, 3) : monthName;
  const date = `${String(p.day)} ${month} ${String(p.year)}`;
  if (style === 'medium') {
    return date;
  }
  const weekday = WEEKDAYS[locale][p.weekday] ?? '';
  return locale === 'en' ? `${weekday}, ${date}` : `${weekday}، ${date}`;
}

/** A time in Asia/Baghdad, 24-hour: `09:30`. */
export function formatTime(value: DateInput, _locale?: Locale): string {
  const p = zonedParts(value);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Date and time: en `19 Oct 2026, 09:30`; ckb/ar with the Arabic comma. */
export function formatDateTime(value: DateInput, locale: Locale): string {
  const separator = locale === 'en' ? ', ' : '، ';
  return `${formatDate(value, locale, 'medium')}${separator}${formatTime(value)}`;
}

/** The weekday name. */
export function formatWeekday(value: DateInput, locale: Locale): string {
  return WEEKDAYS[locale][zonedParts(value).weekday] ?? '';
}

const RELATIVE: Readonly<
  Record<Locale, { readonly now: string; readonly inMin: string; readonly agoMin: string; readonly inHour: string; readonly agoHour: string; readonly inDay: string; readonly agoDay: string }>
> = {
  en: { now: 'now', inMin: 'in {n} min', agoMin: '{n} min ago', inHour: 'in {n} h', agoHour: '{n} h ago', inDay: 'in {n} d', agoDay: '{n} d ago' },
  ckb: {
    now: 'ئێستا',
    inMin: '{n} خولەکی تر',
    agoMin: '{n} خولەک لەمەوبەر',
    inHour: '{n} کاتژمێری تر',
    agoHour: '{n} کاتژمێر لەمەوبەر',
    inDay: '{n} ڕۆژی تر',
    agoDay: '{n} ڕۆژ لەمەوبەر',
  },
  ar: {
    now: 'الآن',
    inMin: 'بعد {n} دقيقة',
    agoMin: 'قبل {n} دقيقة',
    inHour: 'بعد {n} ساعة',
    agoHour: 'قبل {n} ساعة',
    inDay: 'بعد {n} يوم',
    agoDay: 'قبل {n} يوم',
  },
};

/** Time from the demo clock: `in 30 min`, `2 h ago`, `3 d ago`. */
export function formatRelative(value: DateInput, locale: Locale, now: Date = DEMO_NOW): string {
  const minutes = Math.round((toDate(value).getTime() - now.getTime()) / 60000);
  const words = RELATIVE[locale];
  const abs = Math.abs(minutes);
  if (abs < 1) {
    return words.now;
  }
  const future = minutes > 0;
  const fill = (pattern: string, n: number): string => pattern.replace('{n}', formatNumber(n, locale));
  if (abs < 60) {
    return fill(future ? words.inMin : words.agoMin, abs);
  }
  if (abs < 48 * 60) {
    return fill(future ? words.inHour : words.agoHour, Math.round(abs / 60));
  }
  return fill(future ? words.inDay : words.agoDay, Math.round(abs / (24 * 60)));
}

const AGE_UNIT: Readonly<Record<Locale, { readonly y: string; readonly m: string; readonly d: string }>> = {
  en: { y: '{n} y', m: '{n} mo', d: '{n} d' },
  ckb: { y: '{n} ساڵ', m: '{n} مانگ', d: '{n} ڕۆژ' },
  ar: { y: '{n} سنة', m: '{n} شهر', d: '{n} يوم' },
};

/**
 * Age from a date of birth (`YYYY-MM-DD`, `YYYY-MM` or `YYYY`) at the demo clock: years from 2 years,
 * months under 2 years, days under 1 month. en `55 y`, `3 mo`, `1 d`.
 */
export function formatAge(dob: string, locale: Locale, now: Date = DEMO_NOW): string {
  const [y = '1900', m = '07', d = '01'] = dob.split('-');
  const birth = { year: Number(y), month: Number(m), day: Number(d) };
  const today = zonedParts(now);
  let months = (today.year - birth.year) * 12 + (today.month - birth.month);
  if (today.day < birth.day) {
    months -= 1;
  }
  const unit = AGE_UNIT[locale];
  const fill = (pattern: string, n: number): string => pattern.replace('{n}', formatNumber(n, locale));
  if (months >= 24) {
    return fill(unit.y, Math.floor(months / 12));
  }
  if (months >= 1) {
    return fill(unit.m, months);
  }
  const days = Math.max(
    0,
    Math.round((toDate(`${y}-${m}-${d}`).getTime() - toDate(`${String(today.year)}-${pad2(today.month)}-${pad2(today.day)}`).getTime()) / -86_400_000),
  );
  return fill(unit.d, days);
}
