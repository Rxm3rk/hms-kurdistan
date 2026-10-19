/**
 * Display form of clinical numerals (BUILD-PROMPT.md §2.1 SI-05 and its acceptance criteria, §6.5;
 * docs/specs/modules/design-system.md §2.6; CTRL-0005-17, read with DN-030 and DN-031).
 *
 * The input is a decimal string exactly as entered or as returned by a knowledge base, never a JavaScript
 * number. The functions work on characters only: they never convert the string to a number, never do
 * arithmetic, never round and never convert a unit (SI-05: no dose arithmetic outside the Dose Engine).
 * They change only the display form, under the ISMP rules:
 *
 * - a leading zero before a decimal point, never a naked decimal (`.5` → `0.5`);
 * - no trailing zero after a decimal point (`5.0` → `5`, `2.50` → `2.5`);
 * - one form of zero (`0.0`, `-0` → `0`);
 * - no redundant leading zeros in the integer part (`007` → `7`);
 * - integer parts of 1000 and above grouped in threes with U+202F NARROW NO-BREAK SPACE (DN-031).
 *
 * Western digits only (ASCII 0-9 and `.`), in every locale (§6.5, §11.1). Anything else, including
 * Arabic-Indic digits, an exponent, a comma, a plus sign or input that is already grouped, is invalid and is
 * shown as "Invalid value", never guessed. The test StaticAnalysis:clinical-number-no-arithmetic checks that
 * this file names no numeric conversion or arithmetic API.
 */

/** U+202F NARROW NO-BREAK SPACE: the group separator of large integer parts (DN-031). */
export const GROUP_SEPARATOR = '\u202F';

/** U+00A0 NO-BREAK SPACE: between a number and its unit, so they never wrap apart. */
export const NUMBER_UNIT_SEPARATOR = '\u00A0';

/** How a clinical numeral is shown. The design system renders `valid` text inside `<bdi dir="ltr">`. */
export type ClinicalNumberDisplay =
  | {
      readonly status: 'valid';
      /** The display form: ASCII digits, at most one `.`, an optional leading `-`, and U+202F separators. */
      readonly text: string;
      /** True when the value is below zero (a `-` remains in `text`). */
      readonly negative: boolean;
      /** True when the value is zero (`text` is `0`). */
      readonly zero: boolean;
    }
  /** The input is not a plain decimal string: shown as "Invalid value" (clinical.number.invalid). */
  | { readonly status: 'invalid' }
  /** No value: shown as "Not recorded" (clinical.value.missing). */
  | { readonly status: 'missing' };

/** A numeral with its unit. `text` joins them with a no-break space, for example `0.5 mg`. */
export type ClinicalQuantityDisplay =
  | {
      readonly status: 'valid';
      readonly number: string;
      readonly unit: string;
      readonly text: string;
      readonly negative: boolean;
      readonly zero: boolean;
    }
  | { readonly status: 'invalid' }
  | { readonly status: 'missing' };

const DIGITS = '0123456789';

function isAsciiDigit(character: string): boolean {
  return character.length === 1 && DIGITS.includes(character);
}

function stripLeadingZeros(digits: string): string {
  let start = 0;
  while (start < digits.length && digits[start] === '0') {
    start += 1;
  }
  return digits.slice(start);
}

function stripTrailingZeros(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits[end - 1] === '0') {
    end -= 1;
  }
  return digits.slice(0, end);
}

/** Groups an integer digit string in threes from the end, with U+202F, when it has four digits or more. */
function groupIntegerDigits(digits: string): string {
  if (digits.length < 4) {
    return digits;
  }
  const groups: string[] = [];
  let end = digits.length;
  while (end > 3) {
    groups.unshift(digits.slice(end - 3, end));
    end -= 3;
  }
  groups.unshift(digits.slice(0, end));
  return groups.join(GROUP_SEPARATOR);
}

/**
 * The display form of a clinical decimal string. Accepts exactly `-?[0-9]*(\.[0-9]+)?` with at least one
 * digit; `null`, `undefined` and the empty string are "missing"; everything else is "invalid".
 */
export function formatClinicalNumber(input: string | null | undefined): ClinicalNumberDisplay {
  if (input === null || input === undefined || input === '') {
    return { status: 'missing' };
  }
  // A caller outside the type system (plain JavaScript, parsed JSON) may still pass a number: it is
  // invalid, never converted.
  const raw: unknown = input;
  if (typeof raw !== 'string') {
    return { status: 'invalid' };
  }

  let rest = raw;
  let negative = false;
  if (rest.startsWith('-')) {
    negative = true;
    rest = rest.slice(1);
  }

  const point = rest.indexOf('.');
  const integerDigits = point === -1 ? rest : rest.slice(0, point);
  const fractionDigits = point === -1 ? '' : rest.slice(point + 1);

  // A point must be followed by at least one digit (`5.` is invalid), and there is at most one point.
  if (point !== -1 && fractionDigits.length === 0) {
    return { status: 'invalid' };
  }
  for (const character of integerDigits) {
    if (!isAsciiDigit(character)) {
      return { status: 'invalid' };
    }
  }
  for (const character of fractionDigits) {
    if (!isAsciiDigit(character)) {
      return { status: 'invalid' };
    }
  }
  if (integerDigits.length === 0 && fractionDigits.length === 0) {
    return { status: 'invalid' };
  }

  const integerPart = stripLeadingZeros(integerDigits);
  const fractionPart = stripTrailingZeros(fractionDigits);
  const zero = integerPart.length === 0 && fractionPart.length === 0;
  if (zero) {
    return { status: 'valid', text: '0', negative: false, zero: true };
  }

  const integerText = integerPart.length === 0 ? '0' : groupIntegerDigits(integerPart);
  const unsigned = fractionPart.length === 0 ? integerText : `${integerText}.${fractionPart}`;
  return { status: 'valid', text: negative ? `-${unsigned}` : unsigned, negative, zero: false };
}

/**
 * A map from UCUM unit codes to their ISMP-safe display form, in Latin script and never translated. Units
 * missing from the map are never shown as their raw code.
 */
export type UnitDisplayMap = ReadonlyMap<string, string>;

/**
 * SYNTHETIC SAMPLE, NOT FOR CLINICAL USE (§3.4 item 3; content request OQ-152; KA-036). The governed map
 * replaces it before clinical use. `ug`, `U` and `[iU]` are shown as `mcg`, `units` and `units` because ISMP
 * lists `ug`, `U` and `IU` as error-prone abbreviations.
 */
export const SYNTHETIC_UNIT_DISPLAY_MAP: UnitDisplayMap = new Map([
  ['kg', 'kg'],
  ['g', 'g'],
  ['mg', 'mg'],
  ['ug', 'mcg'],
  ['mL', 'mL'],
  ['L', 'L'],
  ['U', 'units'],
  ['[iU]', 'units'],
  ['mmol/L', 'mmol/L'],
  ['%', '%'],
]);

/**
 * The display form of a numeral and its UCUM unit. A missing value is "missing"; an invalid value, or a unit
 * that is missing or not in the display map, makes the whole quantity "invalid".
 */
export function formatClinicalQuantity(
  value: string | null | undefined,
  ucumUnit: string | null | undefined,
  unitDisplayMap: UnitDisplayMap,
): ClinicalQuantityDisplay {
  const number = formatClinicalNumber(value);
  if (number.status === 'missing') {
    return number;
  }
  if (number.status === 'invalid' || typeof ucumUnit !== 'string') {
    return { status: 'invalid' };
  }
  // Map#get, not property access, so a code such as `constructor` never reaches an inherited property.
  const unit = unitDisplayMap.get(ucumUnit);
  if (unit === undefined || unit.length === 0) {
    return { status: 'invalid' };
  }
  return {
    status: 'valid',
    number: number.text,
    unit,
    text: `${number.text}${NUMBER_UNIT_SEPARATOR}${unit}`,
    negative: number.negative,
    zero: number.zero,
  };
}
