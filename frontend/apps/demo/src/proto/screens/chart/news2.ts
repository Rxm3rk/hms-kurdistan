/**
 * NEWS2 (National Early Warning Score 2, Royal College of Physicians 2017) as the chart screen shows it:
 * one sub-score per parameter, the aggregate, the clinical-risk band and the response it calls for.
 * Uses SpO2 scale 1 only (no patient in the demo has a documented hypercapnic target).
 *
 * The score is calculated here from the recorded observations, so the breakdown always adds up to the total.
 * NEWS2 is not used for under-16s (paediatric early warning scores apply) or for ventilated, sedated
 * patients in intensive care; `news2Applicability` says so instead of showing a misleading number.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import type { Tone } from '../../data/index.ts';
import type { ChartVitals } from './chart-data.ts';

export type News2Parameter = 'rr' | 'spo2' | 'oxygen' | 'sbp' | 'hr' | 'acvpu' | 'temp';

export const NEWS2_PARAMETERS: readonly News2Parameter[] = ['rr', 'spo2', 'oxygen', 'sbp', 'hr', 'acvpu', 'temp'];

export type News2Band = 'zero' | 'low' | 'low-medium' | 'medium' | 'high';

export interface News2Result {
  readonly total: number;
  readonly sub: Readonly<Record<News2Parameter, number>>;
  readonly band: News2Band;
  /** True when one parameter scores 3 (a "red score"). */
  readonly redScore: boolean;
}

function num(value: string): number {
  return Number.parseFloat(value);
}

export function scoreRespRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

export function scoreSpo2Scale1(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

export function scoreSystolic(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

export function scorePulse(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

export function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

export function news2Of(set: ChartVitals): News2Result {
  const sub: Record<News2Parameter, number> = {
    rr: scoreRespRate(num(set.respRate)),
    spo2: scoreSpo2Scale1(num(set.spo2)),
    oxygen: set.oxygen.kind === 'air' ? 0 : 2,
    sbp: scoreSystolic(num(set.systolic)),
    hr: scorePulse(num(set.heartRate)),
    acvpu: set.consciousness === 'A' ? 0 : 3,
    temp: scoreTemperature(num(set.tempC)),
  };
  const total = NEWS2_PARAMETERS.reduce((sum, key) => sum + sub[key], 0);
  const redScore = NEWS2_PARAMETERS.some((key) => sub[key] === 3);
  let band: News2Band;
  if (total >= 7) band = 'high';
  else if (total >= 5) band = 'medium';
  else if (redScore) band = 'low-medium';
  else if (total >= 1) band = 'low';
  else band = 'zero';
  return { total, sub, band, redScore };
}

/** Tone of a risk band (always shown with its text). */
export const NEWS2_BAND_TONE: Readonly<Record<News2Band, Tone>> = {
  zero: 'success',
  low: 'success',
  'low-medium': 'warning',
  medium: 'warning',
  high: 'danger',
};

/** Tone of one parameter's sub-score (0 has none). */
export function subScoreTone(score: number): Tone | undefined {
  if (score >= 3) return 'danger';
  if (score >= 1) return 'warning';
  return undefined;
}

export type News2Applicability = 'applies' | 'paediatric' | 'icu-ventilated';

/** Whether NEWS2 applies to this patient: adults 16 and over, not ventilated in intensive care. */
export function news2Applicability(ageYears: number, latest: ChartVitals | undefined): News2Applicability {
  if (ageYears < 16) {
    return 'paediatric';
  }
  if (latest !== undefined && latest.oxygen.kind === 'ventilator') {
    return 'icu-ventilated';
  }
  return 'applies';
}
