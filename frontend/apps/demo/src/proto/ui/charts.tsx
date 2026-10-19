/**
 * Small charts drawn with SVG and CSS, coloured from the design-system tokens:
 * - Sparkline: a trend line (2px) with a light area wash and an end dot; no axes. For stat tiles and tables.
 * - BarChart: horizontal bars (categories: wards, clinics) or vertical columns (days). Bars at most 24px
 *   thick, 4px rounded at the data end, square at the baseline; values in text colour at the bar tip.
 * - Meter: a single proportion (occupancy) with the track a light step of the fill's tone.
 *
 * Rules (the dataviz method): colour follows the job. One series uses the accent; status tones
 * (success, warning, danger) are only for states and always come with a text label. Text never takes the
 * data colour. Time runs left to right in every locale (charts are not mirrored); horizontal bars grow from
 * the inline start. Each chart has an accessible name (`label`) and every value is in the DOM or a tooltip.
 */
import { useId, type ReactNode } from 'react';
import type { Tone } from '../data/types.ts';

const TONE_VAR: Readonly<Record<Tone, string>> = {
  neutral: 'var(--hms-color-border)',
  info: 'var(--hms-color-info-border)',
  success: 'var(--hms-color-success-border)',
  warning: 'var(--hms-color-warning-border)',
  danger: 'var(--hms-color-danger-border)',
  accent: 'var(--hms-color-accent-bg)',
};

export interface SparklineProps {
  readonly values: readonly number[];
  /** The chart's accessible name, for example "Admissions, last 7 days". */
  readonly label: string;
  readonly tone?: Tone;
  readonly width?: number;
  readonly height?: number;
  /** Text for each point's tooltip (same length as values), for example the day and value. */
  readonly pointLabels?: readonly string[];
}

export function Sparkline({ values, label, tone = 'accent', width = 120, height = 36, pointLabels }: SparklineProps): ReactNode {
  const gradientId = useId();
  if (values.length < 2) {
    return null;
  }
  const pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number): number => pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number): number => pad + (1 - (v - min) / span) * (height - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${x(values.length - 1).toFixed(1)},${String(height - pad)} L${String(pad)},${String(height - pad)} Z`;
  const last = values.length - 1;
  const colour = TONE_VAR[tone];
  return (
    <svg
      className="ui-sparkline"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      dir="ltr"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={colour} stopOpacity="0.14" />
          <stop offset="1" stopColor={colour} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pointLabels === undefined
        ? null
        : values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent">
              <title>{pointLabels[i] ?? String(v)}</title>
            </circle>
          ))}
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r="4" fill={colour} stroke="var(--hms-color-bg)" strokeWidth="2" />
    </svg>
  );
}

export interface BarDatum {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: number;
  /** The value as shown (formatted, with unit). Defaults to the number. */
  readonly valueLabel?: string;
  /** A state tone for this bar (for example danger above a threshold); the label must say why. */
  readonly tone?: Tone;
}

export interface BarChartProps {
  readonly data: readonly BarDatum[];
  /** The chart's accessible name. */
  readonly label: string;
  /** The scale's top; the largest value by default. */
  readonly max?: number;
  readonly orientation?: 'horizontal' | 'vertical';
  /** Height of the plot for vertical charts, CSS length. */
  readonly height?: string;
  readonly tone?: Tone;
}

export function BarChart({ data, label, max, orientation = 'horizontal', height = '10rem', tone = 'accent' }: BarChartProps): ReactNode {
  const top = max ?? Math.max(1, ...data.map((datum) => datum.value));
  const pct = (value: number): string => `${String(Math.max(0, Math.min(100, (value / top) * 100)))}%`;
  if (orientation === 'vertical') {
    return (
      <figure className="ui-bars ui-bars--vertical" aria-label={label} role="group">
        <div className="ui-bars__plot" style={{ blockSize: height }} dir="ltr">
          {data.map((datum) => (
            <div key={datum.id} className="ui-bars__column" title={datum.valueLabel ?? String(datum.value)}>
              <span className="ui-bars__value">{datum.valueLabel ?? String(datum.value)}</span>
              <span
                className="ui-bars__col-fill"
                style={{ blockSize: pct(datum.value), backgroundColor: TONE_VAR[datum.tone ?? tone] }}
              />
            </div>
          ))}
        </div>
        <div className="ui-bars__axis" dir="ltr">
          {data.map((datum) => (
            <span key={datum.id} className="ui-bars__tick">
              {datum.label}
            </span>
          ))}
        </div>
      </figure>
    );
  }
  return (
    <figure className="ui-bars ui-bars--horizontal" aria-label={label} role="group">
      {data.map((datum) => (
        <div key={datum.id} className="ui-bars__row">
          <span className="ui-bars__label">{datum.label}</span>
          <span className="ui-bars__track" title={datum.valueLabel ?? String(datum.value)}>
            <span className="ui-bars__fill" style={{ inlineSize: pct(datum.value), backgroundColor: TONE_VAR[datum.tone ?? tone] }} />
          </span>
          <span className="ui-bars__value">{datum.valueLabel ?? String(datum.value)}</span>
        </div>
      ))}
    </figure>
  );
}

export interface MeterProps {
  /** 0 to 1. */
  readonly value: number;
  /** Accessible name, for example "Bed occupancy, Medical Ward A". */
  readonly label: string;
  /** The value as shown, for example "75%" or "15 of 20". */
  readonly valueLabel: string;
  readonly tone?: Tone;
  /** Show the label and value above the bar. */
  readonly showText?: boolean;
}

export function Meter({ value, label, valueLabel, tone = 'accent', showText = true }: MeterProps): ReactNode {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={`ui-meter ui-meter--${tone}`}>
      {showText ? (
        <div className="ui-meter__text">
          <span className="ui-meter__label">{label}</span>
          <span className="ui-meter__value">{valueLabel}</span>
        </div>
      ) : null}
      <div
        className="ui-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={valueLabel}
      >
        <span className="ui-meter__fill" style={{ inlineSize: `${String(clamped * 100)}%` }} />
      </div>
    </div>
  );
}
