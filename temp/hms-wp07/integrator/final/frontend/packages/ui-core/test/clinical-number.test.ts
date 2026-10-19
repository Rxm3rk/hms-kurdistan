/**
 * ClinicalNumber display rules (docs/specs/modules/design-system.md §2.6 and §9; CTRL-0005-17, CTRL-0005-6;
 * decisions DN-030 and DN-031).
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  formatClinicalNumber,
  formatClinicalQuantity,
  GROUP_SEPARATOR,
  NUMBER_UNIT_SEPARATOR,
  SYNTHETIC_UNIT_DISPLAY_MAP,
} from '../src/index.ts';

const NNBSP = GROUP_SEPARATOR;

function shown(input: string | null | undefined): string {
  const display = formatClinicalNumber(input);
  return display.status === 'valid' ? display.text : `<${display.status}>`;
}

describe('UnitTest:clinical-number-ismp-display-rules', () => {
  it('puts a leading zero before a naked decimal point', () => {
    expect(shown('.5')).toBe('0.5');
    expect(shown('-.25')).toBe('-0.25');
  });

  it('removes trailing zeros after the decimal point, and the point when nothing is left', () => {
    expect(shown('5.0')).toBe('5');
    expect(shown('2.50')).toBe('2.5');
    expect(shown('10.000')).toBe('10');
    expect(shown('0.050')).toBe('0.05');
  });

  it('gives zero one form', () => {
    expect(shown('0')).toBe('0');
    expect(shown('0.0')).toBe('0');
    expect(shown('-0')).toBe('0');
    expect(shown('-0.000')).toBe('0');
    expect(shown('.0')).toBe('0');
    expect(shown('000')).toBe('0');
    expect(formatClinicalNumber('-0')).toEqual({ status: 'valid', text: '0', negative: false, zero: true });
  });

  it('removes redundant leading zeros of the integer part', () => {
    expect(shown('007')).toBe('7');
    expect(shown('00.5')).toBe('0.5');
    expect(shown('-007.10')).toBe('-7.1');
  });

  it('groups integer parts of 1000 and above in threes with U+202F, and never the decimals', () => {
    expect(shown('999')).toBe('999');
    expect(shown('1000')).toBe(`1${NNBSP}000`);
    expect(shown('150000')).toBe(`150${NNBSP}000`);
    expect(shown('1234567.891234')).toBe(`1${NNBSP}234${NNBSP}567.891234`);
    expect(shown('-1000.50')).toBe(`-1${NNBSP}000.5`);
    expect(shown('0001000')).toBe(`1${NNBSP}000`);
    expect(NNBSP).toBe('\u202F');
    expect(shown('1000')).not.toMatch(/[,.\u00A0 ]/u);
  });

  it('keeps a minus sign on a non-zero value', () => {
    expect(formatClinicalNumber('-1.5')).toEqual({
      status: 'valid',
      text: '-1.5',
      negative: true,
      zero: false,
    });
  });

  it('shows anything that is not a plain decimal string as invalid, never guessed or converted', () => {
    const invalid = [
      '1e3',
      '1E3',
      '1,5',
      '1 000',
      `1${NNBSP}000`,
      '\u0660\u066B\u0665', // Arabic-Indic zero, Arabic decimal separator, Arabic-Indic five
      '\u06F5', // Extended Arabic-Indic five
      '+2',
      'text',
      ' 5',
      '5 ',
      '5.',
      '-',
      '.',
      '-.',
      '1.2.3',
      '--1',
      '0x10',
      'Infinity',
      'NaN',
      '\uFF15', // fullwidth five
    ];
    for (const input of invalid) {
      expect(formatClinicalNumber(input), input).toEqual({ status: 'invalid' });
    }
  });

  it('never accepts a JavaScript number, even from a caller outside the type system', () => {
    const fromJavaScript = 0.5 as unknown as string;
    expect(formatClinicalNumber(fromJavaScript)).toEqual({ status: 'invalid' });
  });

  it('shows an empty value as missing ("Not recorded")', () => {
    expect(formatClinicalNumber('')).toEqual({ status: 'missing' });
    expect(formatClinicalNumber(null)).toEqual({ status: 'missing' });
    expect(formatClinicalNumber(undefined)).toEqual({ status: 'missing' });
  });

  it('shows units through the display map: ug as mcg, U and [iU] as units', () => {
    const quantity = (value: string, unit: string) =>
      formatClinicalQuantity(value, unit, SYNTHETIC_UNIT_DISPLAY_MAP);
    expect(quantity('250', 'ug')).toEqual({
      status: 'valid',
      number: '250',
      unit: 'mcg',
      text: `250${NUMBER_UNIT_SEPARATOR}mcg`,
      negative: false,
      zero: false,
    });
    expect(quantity('10', 'U')).toMatchObject({ status: 'valid', unit: 'units', text: '10\u00A0units' });
    expect(quantity('5000', '[iU]')).toMatchObject({
      status: 'valid',
      unit: 'units',
      text: `5${NNBSP}000\u00A0units`,
    });
    expect(quantity('.5', 'mg')).toMatchObject({ status: 'valid', text: '0.5\u00A0mg' });
    for (const [code, display] of [
      ['kg', 'kg'],
      ['g', 'g'],
      ['mL', 'mL'],
      ['L', 'L'],
      ['mmol/L', 'mmol/L'],
      ['%', '%'],
    ] as const) {
      expect(quantity('1', code)).toMatchObject({ status: 'valid', unit: display });
    }
  });

  it('shows the value and an unmapped unit as invalid, never the raw unit code', () => {
    for (const unit of ['IU', 'iu', 'mcg', 'MG', 'ml', 'mg/kg', 'constructor', 'toString', '__proto__', '']) {
      expect(formatClinicalQuantity('5', unit, SYNTHETIC_UNIT_DISPLAY_MAP), unit).toEqual({
        status: 'invalid',
      });
    }
    expect(formatClinicalQuantity('5', null, SYNTHETIC_UNIT_DISPLAY_MAP)).toEqual({ status: 'invalid' });
    expect(formatClinicalQuantity('5', undefined, SYNTHETIC_UNIT_DISPLAY_MAP)).toEqual({ status: 'invalid' });
  });

  it('shows an invalid value with a valid unit as invalid, and a missing value as missing', () => {
    expect(formatClinicalQuantity('1,5', 'mg', SYNTHETIC_UNIT_DISPLAY_MAP)).toEqual({ status: 'invalid' });
    expect(formatClinicalQuantity('', 'mg', SYNTHETIC_UNIT_DISPLAY_MAP)).toEqual({ status: 'missing' });
    expect(formatClinicalQuantity(null, 'mg', SYNTHETIC_UNIT_DISPLAY_MAP)).toEqual({ status: 'missing' });
  });
});

describe('StaticAnalysis:clinical-number-no-arithmetic', () => {
  // design-system §2.6 and §9: clinical-number.ts references none of these (CTRL-0005-6; DN-030). The check
  // reads identifiers with the TypeScript scanner, so the file's comments may name them.
  const FORBIDDEN = new Set([
    'Number',
    'parseFloat',
    'parseInt',
    'Math',
    'toFixed',
    'toPrecision',
    'Intl',
    'NumberFormat',
  ]);
  const source = readFileSync(new URL('../src/clinical-number.ts', import.meta.url), 'utf8');

  function identifiers(text: string): string[] {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
    const found: string[] = [];
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (token === ts.SyntaxKind.Identifier) {
        found.push(scanner.getTokenValue());
      }
    }
    return found;
  }

  it('finds identifiers in TypeScript source (self-check of the scanner)', () => {
    expect(identifiers('// Number\nconst a = Math.max(parseInt(b), 1);')).toEqual([
      'a',
      'Math',
      'max',
      'parseInt',
      'b',
    ]);
  });

  it('names no numeric conversion or arithmetic API in clinical-number.ts', () => {
    const used = identifiers(source).filter((name) => FORBIDDEN.has(name));
    expect(used).toEqual([]);
  });
});
