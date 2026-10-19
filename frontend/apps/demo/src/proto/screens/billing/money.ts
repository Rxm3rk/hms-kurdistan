/**
 * Integer money for the billing screen. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * Rules:
 * - Iraqi dinars are whole numbers (IQD has no subunit in practice); US dollars are integer cents.
 * - No floating-point arithmetic on money: every division is an integer division with an explicit rounding
 *   rule (`divRound`, half away from zero), computed from the remainder (`%` is exact on safe integers).
 * - The rate is the fixed demo rate, 1 USD = 1,310 IQD (EXCHANGE_RATE in the shared data).
 * - Cash in dinars is rounded to the nearest 250 IQD (the smallest note in circulation); the rounding is
 *   always shown as its own line, never hidden in a total.
 */
import { uiIntlLocale } from '@hms/i18n';
import { EXCHANGE_RATE } from '../../data/index.ts';
import { formatNumber, type Locale } from '../../i18n/use-t.ts';

/** Dinars per US dollar (an integer). */
export const RATE_IQD_PER_USD: number = EXCHANGE_RATE.usdToIqd;

/** The smallest Iraqi note in circulation: cash amounts in dinars are multiples of this. */
export const CASH_STEP_IQD = 250;

/** Iraqi notes, largest first. */
export const IQD_NOTES: readonly number[] = [50_000, 25_000, 10_000, 5_000, 1_000, 500, 250];

/** US notes in whole dollars, largest first (counted in cents). */
export const USD_NOTES: readonly number[] = [100, 50, 20, 10, 5, 1];

function assertInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`billing money: ${what} must be a safe integer, got ${String(value)}`);
  }
}

/** Integer quotient and remainder of a non-negative integer by a positive integer, exactly. */
function divMod(numerator: number, denominator: number): { readonly q: number; readonly r: number } {
  const r = numerator % denominator;
  return { q: (numerator - r) / denominator, r };
}

/** `numerator / denominator` rounded half away from zero; integers in, integer out, no floating point. */
export function divRound(numerator: number, denominator: number): number {
  assertInteger(numerator, 'numerator');
  assertInteger(denominator, 'denominator');
  if (denominator <= 0) {
    throw new Error('billing money: denominator must be positive');
  }
  const negative = numerator < 0;
  const { q, r } = divMod(Math.abs(numerator), denominator);
  const rounded = r * 2 >= denominator ? q + 1 : q;
  return negative ? -rounded : rounded;
}

/** `pct` percent of an integer amount, rounded half up: the payer's share, an exemption. */
export function percentOf(amount: number, pct: number): number {
  return divRound(amount * pct, 100);
}

/** The US-dollar equivalent of a dinar amount, in cents, at the demo rate. */
export function usdCentsFromIqd(iqd: number): number {
  return divRound(iqd * 100, RATE_IQD_PER_USD);
}

/** The dinar value of an amount in US cents at the demo rate (half a dinar rounds up). */
export function iqdFromUsdCents(cents: number): number {
  return divRound(cents * RATE_IQD_PER_USD, 100);
}

/**
 * Whole dollars and cents from the shared data's dollar amounts (`Payment.amount`, a JavaScript number with at
 * most two decimals). This is the single boundary conversion; everything after it is integer cents.
 */
export function centsFromDataDollars(dollars: number): number {
  return Math.round(dollars * 100);
}

export type CashTie = 'up' | 'down';

/**
 * A non-negative dinar amount rounded to the nearest 250 IQD. An exact half (125) goes `tie` way: the screen
 * always settles a tie in the patient's favour (more change, less to pay).
 */
export function roundCash(iqd: number, tie: CashTie): number {
  assertInteger(iqd, 'cash amount');
  if (iqd < 0) {
    throw new Error('billing money: cash rounding takes a non-negative amount');
  }
  const { q, r } = divMod(iqd, CASH_STEP_IQD);
  const base = q * CASH_STEP_IQD;
  if (r * 2 > CASH_STEP_IQD) {
    return base + CASH_STEP_IQD;
  }
  if (r * 2 < CASH_STEP_IQD) {
    return base;
  }
  return tie === 'up' ? base + CASH_STEP_IQD : base;
}

/** True when a dinar amount can be paid in notes (a multiple of 250). */
export function isCashable(iqd: number): boolean {
  return iqd % CASH_STEP_IQD === 0;
}

/** Notes for an amount, greedily, largest first (`amount` and notes in the same unit). */
export function notesFor(amount: number, notes: readonly number[]): readonly number[] {
  let rest = amount;
  return notes.map((note) => {
    const { q, r } = divMod(rest, note);
    rest = r;
    return q;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Input: what the cashier types (Western, Arabic-Indic or Extended Arabic-Indic digits; the Arabic decimal
// separator; thousands separators and spaces are ignored).
// ---------------------------------------------------------------------------------------------------------

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;
const ARABIC_DECIMAL_SEPARATOR = String.fromCodePoint(0x066b);
const ARABIC_THOUSANDS_SEPARATOR = String.fromCodePoint(0x066c);

/** The typed text with Western digits and `.` as the decimal point; separators and spaces removed. */
export function normaliseTyped(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else if (char === ARABIC_DECIMAL_SEPARATOR) {
      out += '.';
    } else if (char === ',' || char === ARABIC_THOUSANDS_SEPARATOR || /\s/u.test(char)) {
      // thousands separators and spaces: ignored
    } else {
      out += char;
    }
  }
  return out;
}

/** Whole dinars from typed text: '' is 0; anything that is not a whole number is null. */
export function parseIqd(text: string): number | null {
  const value = normaliseTyped(text);
  if (value === '') {
    return 0;
  }
  if (!/^\d{1,10}$/u.test(value)) {
    return null;
  }
  return Number(value);
}

/** US cents from typed dollars ('50', '50.5', '50.25'): '' is 0; more than two decimals is null. */
export function parseUsdCents(text: string): number | null {
  const value = normaliseTyped(text);
  if (value === '') {
    return 0;
  }
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/u.exec(value);
  if (match === null) {
    return null;
  }
  const dollars = Number(match[1] ?? '0');
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  return dollars * 100 + cents;
}

// ---------------------------------------------------------------------------------------------------------
// Display of US cents without floating point (the shared formatter takes a JavaScript number of dollars).
// ---------------------------------------------------------------------------------------------------------

const USD_WORD: Readonly<Record<Locale, string>> = { en: 'USD', ckb: 'دۆلار', ar: 'دولار' };
const decimalSeparators = new Map<Locale, string>();

function decimalSeparator(locale: Locale): string {
  let separator = decimalSeparators.get(locale);
  if (separator === undefined) {
    separator = new Intl.NumberFormat(uiIntlLocale(locale)).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(locale, separator);
  }
  return separator;
}

/** `1,250.50` from 125050 cents, with the locale's grouping (Western digits). */
export function formatCentsNumber(cents: number, locale: Locale): string {
  assertInteger(cents, 'cents');
  const negative = cents < 0;
  const { q, r } = divMod(Math.abs(cents), 100);
  const text = `${formatNumber(q, locale, { maximumFractionDigits: 0 })}${decimalSeparator(locale)}${String(r).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/** US dollars from cents: en `USD 1,250.50`; ckb `1,250.50 دۆلار`; ar `1,250.50 دولار`. */
export function formatUsdCents(cents: number, locale: Locale): string {
  const number = formatCentsNumber(cents, locale);
  return locale === 'en' ? `${USD_WORD.en} ${number}` : `${number} ${USD_WORD[locale]}`;
}

/** A dinar amount as a bare grouped number (`505,500`), for the receipt's columns. */
export function formatIqdNumber(iqd: number, locale: Locale): string {
  assertInteger(iqd, 'dinars');
  return formatNumber(iqd, locale, { maximumFractionDigits: 0 });
}
