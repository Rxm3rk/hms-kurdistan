/**
 * Qty: a clinical number with its unit through the design system's ClinicalNumber (leading zero, no trailing
 * zero, the number and unit kept together left to right inside right-to-left text, "Invalid value" for a
 * malformed value or an unknown unit). PROTO_UNIT_DISPLAY_MAP extends the design system's synthetic unit map
 * with the units the prototype's data uses.
 *
 * Money: an amount in IQD or USD formatted for the current locale, isolated in its own direction.
 */
import { Bdi, ClinicalNumber } from '@hms/design-system';
import { SYNTHETIC_UNIT_DISPLAY_MAP, type UnitDisplayMap } from '@hms/ui-core';
import type { ReactNode } from 'react';
import { formatMoney } from '../i18n/format.ts';
import { useLocale } from '../i18n/use-t.ts';

/** UCUM code to display form (synthetic, NOT FOR CLINICAL USE). */
export const PROTO_UNIT_DISPLAY_MAP: UnitDisplayMap = new Map([
  ...SYNTHETIC_UNIT_DISPLAY_MAP,
  ['umol/L', 'µmol/L'],
  ['mg/L', 'mg/L'],
  ['mg/dL', 'mg/dL'],
  ['g/dL', 'g/dL'],
  ['g/L', 'g/L'],
  ['10*9/L', '×10⁹/L'],
  ['10*12/L', '×10¹²/L'],
  ['kPa', 'kPa'],
  ['mm[Hg]', 'mmHg'],
  ['/min', '/min'],
  ['Cel', '°C'],
  ['cm', 'cm'],
  ['h', 'h'],
  ['mL/h', 'mL/h'],
  ['U/h', 'units/h'],
  ['ug/kg/min', 'mcg/kg/min'],
  ['mg/kg', 'mg/kg'],
  ['mL/kg', 'mL/kg'],
  ['mL/min/{1.73_m2}', 'mL/min/1.73 m²'],
  ['U/L', 'U/L'],
  ['s', 's'],
]);

export interface QtyProps {
  /** Decimal string as stored (`'6.8'`); null or empty shows "Not recorded". */
  readonly value: string | null | undefined;
  /** UCUM code (`'mmol/L'`, `'mg'`, `'Cel'`, `'mm[Hg]'`); omit for a bare number. */
  readonly unit?: string | null;
  readonly className?: string | undefined;
}

export function Qty({ value, unit, className }: QtyProps): ReactNode {
  if (unit === undefined || unit === null || unit === '{ratio}') {
    return <ClinicalNumber value={value} {...(className === undefined ? {} : { className })} />;
  }
  return <ClinicalNumber value={value} unit={unit} unitDisplayMap={PROTO_UNIT_DISPLAY_MAP} {...(className === undefined ? {} : { className })} />;
}

/** Blood pressure as `128/78 mmHg`, each number through ClinicalNumber. */
export function BloodPressure({ systolic, diastolic }: { readonly systolic: string; readonly diastolic: string }): ReactNode {
  return (
    <Bdi dir="ltr" className="ui-nowrap">
      <ClinicalNumber value={systolic} />/<ClinicalNumber value={diastolic} />
      {' '}mmHg
    </Bdi>
  );
}

export interface MoneyProps {
  readonly amount: number;
  readonly currency?: 'IQD' | 'USD';
  readonly className?: string | undefined;
}

/** An amount of money in the current locale's format (en `IQD 1,310,000`, ckb `1,310,000 دینار`). */
export function Money({ amount, currency = 'IQD', className }: MoneyProps): ReactNode {
  const locale = useLocale();
  return (
    <Bdi dir={locale === 'en' ? 'ltr' : 'rtl'} className={['ui-money', className ?? ''].filter(Boolean).join(' ')}>
      {formatMoney(amount, currency, locale)}
    </Bdi>
  );
}

/** A code, identifier or Latin drug name inside any text: isolated left to right. */
export function Code({ children, className }: { readonly children: ReactNode; readonly className?: string | undefined }): ReactNode {
  return (
    <Bdi dir="ltr" className={['ui-code', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </Bdi>
  );
}
