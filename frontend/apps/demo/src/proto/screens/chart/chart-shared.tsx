/**
 * Small pieces the chart screen's tabs share: oxygen support and consciousness labels, the 72-hour window's
 * day boundaries, and the per-patient NEWS2 view.
 */
import { ClinicalNumber } from '@hms/design-system';
import type { UnitDisplayMap } from '@hms/ui-core';
import type { ReactNode } from 'react';
import { DEMO_NOW_ISO, daysAgoAt, type Patient } from '../../data/index.ts';
import { formatWeekday, useT, type Locale, type Translate } from '../../i18n/use-t.ts';
import { PROTO_UNIT_DISPLAY_MAP } from '../../ui/index.ts';
import { ageInYears, WINDOW_START_ISO, type ChartVitals, type Consciousness, type OxygenSupport } from './chart-data.ts';
import { messages } from './messages.ts';
import { news2Applicability, news2Of, type News2Applicability, type News2Result } from './news2.ts';

/** The prototype unit map plus litres per minute (oxygen flow). */
export const CHART_UNIT_MAP: UnitDisplayMap = new Map([...PROTO_UNIT_DISPLAY_MAP, ['L/min', 'L/min']]);

/** Oxygen support as text: room air, nasal cannula 2 L/min, ventilator FiO2 40%. */
export function OxygenText({ oxygen }: { readonly oxygen: OxygenSupport }): ReactNode {
  const t = useT(messages);
  switch (oxygen.kind) {
    case 'air':
      return t('oxygenAir');
    case 'nasal':
      return t.rich('oxygenNasal', { flow: <ClinicalNumber value={oxygen.lpm} unit="L/min" unitDisplayMap={CHART_UNIT_MAP} /> });
    case 'mask':
      return t.rich('oxygenMask', { flow: <ClinicalNumber value={oxygen.lpm} unit="L/min" unitDisplayMap={CHART_UNIT_MAP} /> });
    case 'ventilator':
      return t.rich('oxygenVent', { fio2: <ClinicalNumber value={oxygen.fio2} unit="%" unitDisplayMap={CHART_UNIT_MAP} /> });
  }
}

/** Oxygen support as plain text (for note templates). */
export function oxygenPlain(oxygen: OxygenSupport, t: Translate<ChartMessageKey>): string {
  switch (oxygen.kind) {
    case 'air':
      return t('oxygenAir');
    case 'nasal':
      return t('oxygenNasal', { flow: `${oxygen.lpm} L/min` });
    case 'mask':
      return t('oxygenMask', { flow: `${oxygen.lpm} L/min` });
    case 'ventilator':
      return t('oxygenVent', { fio2: `${oxygen.fio2}%` });
  }
}

export type ChartMessageKey = keyof typeof messages.en;

export function acvpuKey(value: Consciousness): ChartMessageKey {
  return `acvpu_${value}`;
}

/** The midnights inside the 72-hour window and the weekday label of each day, oldest first. */
export function windowDays(locale: Locale): {
  readonly startIso: string;
  readonly endIso: string;
  readonly firstDayLabel: string;
  readonly days: readonly { readonly startIso: string; readonly label: string }[];
} {
  const days = [2, 1, 0].map((daysAgo) => {
    const startIso = daysAgoAt(daysAgo, '00:00');
    return { startIso, label: formatWeekday(startIso, locale) };
  });
  return { startIso: WINDOW_START_ISO, endIso: DEMO_NOW_ISO, firstDayLabel: formatWeekday(WINDOW_START_ISO, locale), days };
}

export interface NewsView {
  readonly applicability: News2Applicability;
  /** NEWS2 per observation set (only when NEWS2 applies), same order as the sets. */
  readonly scores: readonly (News2Result | null)[];
  readonly latest: News2Result | null;
}

/** NEWS2 for a patient's observations, or the reason it does not apply. */
export function newsViewOf(patient: Patient, sets: readonly ChartVitals[]): NewsView {
  const applicability = news2Applicability(ageInYears(patient.dob), sets.at(-1));
  const scores = sets.map((set) => (applicability === 'applies' ? news2Of(set) : null));
  return { applicability, scores, latest: scores.at(-1) ?? null };
}
