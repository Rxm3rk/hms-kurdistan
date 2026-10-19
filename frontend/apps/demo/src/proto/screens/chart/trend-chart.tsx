/**
 * A small time-series chart for one vital sign over the 72-hour window (SVG, design-system tokens via CSS).
 *
 * - One series, one colour (the accent); the shaded band is the range that scores 0 NEWS2 points.
 * - Time runs left to right in every locale (the figure is `dir="ltr"`); day boundaries are drawn at
 *   midnight with the weekday in the middle of each day.
 * - `line`: a 2px line with 8px markers. `range`: one vertical bar per observation from the low value to the
 *   high value (blood pressure, systolic to diastolic). `bars`: NEWS2 columns coloured by risk band, with the
 *   band named in each tooltip and in the legend under the chart (colour is never the only carrier).
 * - Every point has a tooltip (`<title>`) with its time and value; the table under the charts has them all.
 */
import { useId, type ReactNode } from 'react';
import type { Tone } from '../../data/index.ts';

export interface TrendPoint {
  readonly iso: string;
  /** The value drawn (the high end for `range`). */
  readonly value: number;
  /** The low end for `range` (diastolic). */
  readonly low?: number;
  /** Tooltip text: time and value with unit. */
  readonly label: string;
  /** Bar tone for `bars`. */
  readonly tone?: Tone;
}

export interface TrendChartProps {
  readonly title: string;
  /** The latest value as text, shown beside the title. */
  readonly latest?: ReactNode;
  readonly points: readonly TrendPoint[];
  readonly domain: readonly [number, number];
  readonly ticks: readonly number[];
  /** The NEWS2 0-point range, shaded. */
  readonly band?: readonly [number, number];
  readonly bandLabel?: string;
  /** Dashed reference lines with a label (NEWS2 thresholds). */
  readonly thresholds?: readonly { readonly value: number; readonly label: string }[];
  readonly kind?: 'line' | 'range' | 'bars';
  readonly startIso: string;
  readonly endIso: string;
  /** Midnights inside the window, with the label of the day that starts there. */
  readonly days: readonly { readonly startIso: string; readonly label: string }[];
  /** Label of the first (partial) day. */
  readonly firstDayLabel: string;
  readonly nowLabel: string;
  readonly className?: string;
}

const W = 520;
const H = 176;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const TONE_CLASS: Readonly<Record<Tone, string>> = {
  neutral: 'chart-trend__bar--neutral',
  info: 'chart-trend__bar--info',
  accent: 'chart-trend__bar--accent',
  success: 'chart-trend__bar--success',
  warning: 'chart-trend__bar--warning',
  danger: 'chart-trend__bar--danger',
};

export function TrendChart({
  title,
  latest,
  points,
  domain,
  ticks,
  band,
  bandLabel,
  thresholds = [],
  kind = 'line',
  startIso,
  endIso,
  days,
  firstDayLabel,
  nowLabel,
  className,
}: TrendChartProps): ReactNode {
  const clipId = useId();
  const t0 = Date.parse(startIso);
  const t1 = Date.parse(endIso);
  const [d0, d1] = domain;
  const x = (iso: string): number => PAD_L + ((Date.parse(iso) - t0) / (t1 - t0)) * PLOT_W;
  const clamp = (v: number): number => Math.max(d0, Math.min(d1, v));
  const y = (v: number): number => PAD_T + (1 - (clamp(v) - d0) / (d1 - d0)) * PLOT_H;
  const baseline = PAD_T + PLOT_H;

  const linePath =
    kind === 'line' && points.length > 0
      ? points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.iso).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
      : null;
  const last = points.at(-1);

  // Day segments: [window start, first midnight), [midnight, next midnight), …, [last midnight, end].
  const boundaries = [startIso, ...days.map((day) => day.startIso), endIso];
  const dayLabels = [firstDayLabel, ...days.map((day) => day.label)];

  return (
    <figure className={['chart-trend', className ?? ''].filter(Boolean).join(' ')} dir="ltr" role="group" aria-label={title}>
      <figcaption className="chart-trend__caption">
        <span className="chart-trend__title">{title}</span>
        {latest === undefined ? null : <span className="chart-trend__latest">{latest}</span>}
      </figcaption>
      <svg className="chart-trend__svg" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={title}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD_L} y={PAD_T - 6} width={PLOT_W} height={PLOT_H + 12} />
          </clipPath>
        </defs>
        {band === undefined ? null : (
          <g className="chart-trend__band">
            <rect x={PAD_L} y={y(band[1])} width={PLOT_W} height={Math.max(0, y(band[0]) - y(band[1]))} />
            {bandLabel === undefined ? null : (
              <text x={PAD_L + 4} y={y(band[1]) + 11} className="chart-trend__band-label">
                {bandLabel}
              </text>
            )}
          </g>
        )}
        {ticks.map((tick) => (
          <g key={tick} className="chart-trend__tick">
            <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={y(tick)} y2={y(tick)} />
            <text x={PAD_L - 6} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {thresholds.map((threshold) => (
          <g key={threshold.value} className="chart-trend__threshold">
            <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={y(threshold.value)} y2={y(threshold.value)} />
            <text x={PAD_L + PLOT_W - 2} y={y(threshold.value) - 3} textAnchor="end">
              {threshold.label}
            </text>
          </g>
        ))}
        {days.map((day) => (
          <line key={day.startIso} className="chart-trend__midnight" x1={x(day.startIso)} x2={x(day.startIso)} y1={PAD_T} y2={baseline} />
        ))}
        {dayLabels.map((label, i) => {
          const from = boundaries[i] ?? startIso;
          const to = boundaries[i + 1] ?? endIso;
          const width = x(to) - x(from);
          return width < 34 ? null : (
            <text key={`${label}-${from}`} className="chart-trend__day" x={(x(from) + x(to)) / 2} y={H - 10} textAnchor="middle">
              {label}
            </text>
          );
        })}
        <line className="chart-trend__axis" x1={PAD_L} x2={PAD_L + PLOT_W} y1={baseline} y2={baseline} />
        <text className="chart-trend__now" x={PAD_L + PLOT_W} y={H - 10} textAnchor="end">
          {nowLabel}
        </text>
        <g clipPath={`url(#${clipId})`}>
          {linePath === null ? null : <path className="chart-trend__line" d={linePath} />}
          {kind === 'range'
            ? points.map((point) => {
                const cx = x(point.iso);
                const top = y(point.value);
                const bottom = y(point.low ?? point.value);
                return (
                  <g key={point.iso} className="chart-trend__range">
                    <line x1={cx} x2={cx} y1={top} y2={bottom} />
                    <line x1={cx - 4} x2={cx + 4} y1={top} y2={top} />
                    <line x1={cx - 4} x2={cx + 4} y1={bottom} y2={bottom} />
                  </g>
                );
              })
            : null}
          {kind === 'bars'
            ? points.map((point) => {
                const cx = x(point.iso);
                const top = y(point.value);
                const height = Math.max(2, baseline - top);
                return (
                  <rect
                    key={point.iso}
                    className={['chart-trend__bar', TONE_CLASS[point.tone ?? 'accent']].join(' ')}
                    x={cx - 4}
                    y={baseline - height}
                    width={8}
                    height={height}
                    rx={2}
                  />
                );
              })
            : null}
          {kind === 'line'
            ? points.map((point) => <circle key={point.iso} className="chart-trend__dot" cx={x(point.iso)} cy={y(point.value)} r={4} />)
            : null}
        </g>
        {last === undefined ? null : (
          <text
            className="chart-trend__direct"
            x={Math.min(x(last.iso), PAD_L + PLOT_W - 2)}
            y={Math.max(PAD_T + 9, y(last.value) - 9)}
            textAnchor="end"
          >
            {kind === 'range' ? `${String(last.value)}/${String(last.low ?? '')}` : String(last.value)}
          </text>
        )}
        {points.map((point) => (
          <circle key={`hit-${point.iso}`} className="chart-trend__hit" cx={x(point.iso)} cy={y(point.value)} r={10}>
            <title>{point.label}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
