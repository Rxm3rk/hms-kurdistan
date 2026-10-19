/**
 * The dose field's parser: a dose is a number AND a unit ("500 mg"). A number alone is refused, as are
 * error-prone forms (".5", "5.0", "U", "IU", "ug") and units the medicine is not dosed in. Eastern Arabic
 * and Persian digits are read as Western digits. SYNTHETIC RULES FOR THE PROTOTYPE, NOT FOR CLINICAL USE.
 */
import type { DoseUnit, FormularyDrug } from './catalogue.ts';

export type DoseError =
  | 'empty'
  | 'no-unit'
  | 'no-number'
  | 'leading-decimal'
  | 'trailing-zero'
  | 'bad-number'
  | 'zero'
  | 'unknown-unit'
  | 'unsafe-unit'
  | 'unit-not-allowed'
  | 'tenfold';

export type DoseCheck =
  | {
      readonly ok: true;
      /** Decimal string as typed (Western digits). */
      readonly value: string;
      readonly unit: DoseUnit;
      /** True when Eastern Arabic or Persian digits were converted. */
      readonly normalised: boolean;
      /** Above the usual maximum single dose (a warning, not a refusal). */
      readonly aboveMax: boolean;
    }
  | {
      readonly ok: false;
      readonly error: DoseError;
      /** The unit as typed, for the message. */
      readonly unitTyped: string;
      /** The safe spelling, for `unsafe-unit`. */
      readonly safe: string;
    };

const UNIT_ALIASES: Readonly<Record<string, DoseUnit>> = {
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  mcg: 'ug',
  microgram: 'ug',
  micrograms: 'ug',
  units: 'U',
  unit: 'U',
  ml: 'mL',
  millilitre: 'mL',
  millilitres: 'mL',
  mmol: 'mmol',
  millimole: 'mmol',
  millimoles: 'mmol',
};

/** Error-prone abbreviations (ISMP list) and the spelling to use instead. */
const UNSAFE_UNITS: Readonly<Record<string, string>> = {
  u: 'units',
  iu: 'units',
  ug: 'mcg',
  'µg': 'mcg',
  'μg': 'mcg',
  cc: 'mL',
};

/** How each unit is written in the form's hints. */
export const UNIT_TEXT: Readonly<Record<DoseUnit, string>> = {
  mg: 'mg',
  g: 'g',
  ug: 'mcg',
  U: 'units',
  mL: 'mL',
  mmol: 'mmol',
};

/** Factor to the drug's base unit (mg for mass; units and mmol stay as they are). */
const TO_BASE: Readonly<Record<DoseUnit, number>> = { mg: 1, g: 1000, ug: 0.001, U: 1, mL: 1, mmol: 1 };

function westernDigits(input: string): { readonly text: string; readonly changed: boolean } {
  let changed = false;
  const text = input.replace(/[٠-٩۰-۹٫]/gu, (character) => {
    changed = true;
    const code = character.charCodeAt(0);
    if (code === 0x066b) {
      return '.';
    }
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  return { text, changed };
}

/** The dose in the drug's base unit, for comparisons. */
export function doseInBase(value: string, unit: DoseUnit): number {
  return Number(value) * TO_BASE[unit];
}

export function checkDose(raw: string, drug: FormularyDrug): DoseCheck {
  const fail = (error: DoseError, unitTyped = '', safe = ''): DoseCheck => ({ ok: false, error, unitTyped, safe });
  const { text, changed } = westernDigits(raw.trim());
  if (text === '') {
    return fail('empty');
  }
  const match = /^([0-9.,]*)\s*(.*)$/u.exec(text);
  const numberPart = match?.[1] ?? '';
  const unitPart = (match?.[2] ?? '').trim();
  if (numberPart === '') {
    return fail('no-number');
  }
  if (numberPart.includes(',') || (numberPart.match(/\./gu)?.length ?? 0) > 1 || numberPart.endsWith('.')) {
    return fail('bad-number');
  }
  if (numberPart.startsWith('.')) {
    return fail('leading-decimal');
  }
  if (/\.[0-9]*0$/u.test(numberPart)) {
    return fail('trailing-zero');
  }
  if (Number(numberPart) === 0) {
    return fail('zero');
  }
  if (unitPart === '') {
    return fail('no-unit');
  }
  const unitKey = unitPart.toLowerCase();
  const unsafe = UNSAFE_UNITS[unitKey];
  if (unsafe !== undefined) {
    return fail('unsafe-unit', unitPart, unsafe);
  }
  const unit = UNIT_ALIASES[unitKey];
  if (unit === undefined) {
    return fail('unknown-unit', unitPart);
  }
  if (!drug.units.includes(unit)) {
    return fail('unit-not-allowed', unitPart);
  }
  const base = doseInBase(numberPart, unit);
  if (base >= drug.maxSingle.value * 10) {
    return fail('tenfold', unitPart);
  }
  return { ok: true, value: numberPart, unit, normalised: changed, aboveMax: base > drug.maxSingle.value };
}

/** A weight-based dose rounded sensibly, as a decimal string in the base unit. */
export function roundDose(value: number): string {
  if (value >= 100) {
    return String(Math.round(value / 5) * 5);
  }
  if (value >= 10) {
    return String(Math.round(value));
  }
  return String(Math.round(value * 10) / 10);
}
