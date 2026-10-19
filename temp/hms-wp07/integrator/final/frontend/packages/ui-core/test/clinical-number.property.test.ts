/**
 * Property tests of the ClinicalNumber display rules (docs/specs/modules/design-system.md §2.6 and §9,
 * `PropertyTest:clinical-number-*`; CTRL-0005-17). For generated decimal strings: never a naked decimal, never
 * a trailing zero after the point, only ASCII digits (with `.`, `-` and U+202F), and the numeric value
 * otherwise unchanged. The value check compares digit strings padded with zeros, never numbers.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatClinicalNumber, GROUP_SEPARATOR } from '../src/index.ts';

const RUNS = { numRuns: 1000 };

const digit = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
const digits = (maxLength: number) => fc.array(digit, { maxLength }).map((list) => list.join(''));

/** Strings of the accepted form `-?[0-9]*(\.[0-9]+)?` with at least one digit, rich in zeros. */
const decimalString = fc
  .record({
    negative: fc.boolean(),
    integer: fc.oneof(
      digits(12),
      digits(3).map((d) => `000${d}`),
    ),
    fraction: fc.option(
      fc.oneof(
        digits(8).map((d) => `${d}0`),
        digits(8).map((d) => `0${d}`),
      ),
      { nil: undefined },
    ),
  })
  .filter(({ integer, fraction }) => integer.length > 0 || (fraction !== undefined && fraction.length > 0))
  .map(({ negative, integer, fraction }) => {
    const unsigned = fraction === undefined || fraction.length === 0 ? integer : `${integer}.${fraction}`;
    return { input: `${negative ? '-' : ''}${unsigned}`, negative, integer, fraction: fraction ?? '' };
  })
  .filter(({ input }) => !input.endsWith('.') && input !== '-' && input.length > 0);

function displayed(input: string): string {
  const display = formatClinicalNumber(input);
  if (display.status !== 'valid') {
    throw new Error(`expected a valid display for ${JSON.stringify(input)}, got ${display.status}`);
  }
  return display.text;
}

function ungrouped(text: string): string {
  return text.split(GROUP_SEPARATOR).join('');
}

function isZeroDigits(text: string): boolean {
  return /^0*$/u.test(text);
}

describe('PropertyTest:clinical-number-leading-zero', () => {
  it('never shows a naked decimal: a digit always precedes the point', () => {
    fc.assert(
      fc.property(decimalString, ({ input }) => {
        const text = displayed(input);
        expect(text.startsWith('.')).toBe(false);
        expect(text.startsWith('-.')).toBe(false);
        const point = text.indexOf('.');
        if (point !== -1) {
          expect(text[point - 1]).toMatch(/^[0-9]$/u);
        }
      }),
      RUNS,
    );
  });
});

describe('PropertyTest:clinical-number-no-trailing-zero', () => {
  it('never ends with a zero after the decimal point, nor with the point itself', () => {
    fc.assert(
      fc.property(decimalString, ({ input }) => {
        const text = displayed(input);
        expect(text.endsWith('.')).toBe(false);
        if (text.includes('.')) {
          expect(text.endsWith('0')).toBe(false);
        }
      }),
      RUNS,
    );
  });
});

describe('PropertyTest:clinical-number-ascii-digits-only', () => {
  it('shows only ASCII digits, one point, a leading minus and U+202F between groups of three', () => {
    fc.assert(
      fc.property(decimalString, ({ input }) => {
        const text = displayed(input);
        expect(text).toMatch(/^-?[0-9]{1,3}(?:\u202F[0-9]{3})*(?:\.[0-9]+)?$/u);
        const integerDigits = ungrouped(text.replace(/^-/u, '').split('.')[0] ?? '');
        // Grouping starts at four integer digits, never earlier.
        expect(text.includes(GROUP_SEPARATOR)).toBe(integerDigits.length >= 4);
      }),
      RUNS,
    );
  });

  it('rejects any string containing a character outside ASCII digits, `.` and `-`', () => {
    const foreign = fc.constantFrom(
      '\u0660',
      '\u0665',
      '\u066B',
      '\u066C',
      '\u06F0',
      '\u06F5',
      '\u0966',
      '\uFF10',
      ',',
      ' ',
      '\u202F',
      '\u00A0',
      'e',
      'E',
      '+',
      '_',
      'x',
      '\u200F',
    );
    fc.assert(
      fc.property(decimalString, foreign, fc.nat(), ({ input }, character, position) => {
        const at = position % (input.length + 1);
        const corrupted = `${input.slice(0, at)}${character}${input.slice(at)}`;
        expect(formatClinicalNumber(corrupted)).toEqual({ status: 'invalid' });
      }),
      RUNS,
    );
  });
});

describe('PropertyTest:clinical-number-value-unchanged', () => {
  it('keeps the numeric value: the digits match the input once both are padded with zeros', () => {
    fc.assert(
      fc.property(decimalString, ({ input, negative, integer, fraction }) => {
        const display = formatClinicalNumber(input);
        expect(display.status).toBe('valid');
        if (display.status !== 'valid') return;
        const text = ungrouped(display.text);
        const outNegative = text.startsWith('-');
        const [outInteger = '', outFraction = ''] = text.replace(/^-/u, '').split('.');
        const width = Math.max(integer.length, outInteger.length);
        expect(outInteger.padStart(width, '0')).toBe(integer.padStart(width, '0'));
        const places = Math.max(fraction.length, outFraction.length);
        expect(outFraction.padEnd(places, '0')).toBe(fraction.padEnd(places, '0'));
        const zero = isZeroDigits(integer) && isZeroDigits(fraction);
        expect(display.zero).toBe(zero);
        expect(outNegative).toBe(negative && !zero);
        expect(display.negative).toBe(negative && !zero);
      }),
      RUNS,
    );
  });

  it('is idempotent: the display form, ungrouped, displays as itself', () => {
    fc.assert(
      fc.property(decimalString, ({ input }) => {
        const text = displayed(input);
        expect(displayed(ungrouped(text))).toBe(text);
      }),
      RUNS,
    );
  });
});
