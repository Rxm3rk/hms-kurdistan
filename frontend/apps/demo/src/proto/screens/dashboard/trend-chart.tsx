/**
 * A two-series line chart for the dashboard (billed against collected, both in dinars on one axis). Built
 * locally because the shared kit has single-series charts only. Rules from the kit's chart notes: 2px lines,
 * recessive grid, time runs left to right in every locale (the plot is not mirrored), a legend with direct
 * end labels, text in text colours, and every value in a tooltip (an invisible hit target per point).
 */
import type { ReactNode } from 'react';

export interface TrendSeries {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
  /** A CSS colour (a design-system token). */
  readonly colour: string;
  readonly dashed?: boolean;
}

export interface TrendChartProps {
  readonly label: string;
  readonly series: readonly TrendSeries[];
  /** One label per point (x axis). */
  readonly ticks: readonly string[];
  /** Formats a value for the axis and tooltips. */
  readonly format: (value: number) => string;
  /** Tooltip text of a point. */
  readonly pointLabel: (seriesLabel: string, tick: string, value: string) => string;
  readonly height?: number;
}

const WIDTH = 640;
const PAD = { top: 12, end: 16, bottom: 26, start: 64 };

export function TrendChart({ label, series, ticks, format, pointLabel, height = 220 }: TrendChartProps): ReactNode {
  const count = ticks.length;
  const all = series.flatMap((s) => s.values);
  if (count < 2 || all.length === 0) {
    return null;
  }
  const max = Math.max(...all) * 1.08;
  const plotW = WIDTH - PAD.start - PAD.end;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number): number => PAD.start + (i * plotW) / (count - 1);
  const y = (v: number): number => PAD.top + (1 - v / max) * plotH;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const tickEvery = Math.ceil(count / 10);

  return (
    <figure className="dash-trend" aria-label={label} role="group">
      <div className="dash-trend__legend">
        {series.map((s) => (
          <span key={s.id} className="dash-trend__key">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.colour} strokeWidth="2" strokeDasharray={s.dashed === true ? '4 3' : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(height)}`} className="dash-trend__svg" dir="ltr" role="img" aria-label={label}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.start} x2={WIDTH - PAD.end} y1={y(g)} y2={y(g)} className="dash-trend__grid" />
            <text x={PAD.start - 6} y={y(g)} className="dash-trend__axis" textAnchor="end" dominantBaseline="middle">
              {format(g)}
            </text>
          </g>
        ))}
        {ticks.map((tick, i) =>
          i % tickEvery === 0 || i === count - 1 ? (
            <text key={`${tick}-${String(i)}`} x={x(i)} y={height - 8} className="dash-trend__axis" textAnchor="middle">
              {tick}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          const last = s.values.length - 1;
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed === true ? '5 4' : undefined} />
              <circle cx={x(last)} cy={y(s.values[last] ?? 0)} r="4" fill={s.colour} stroke="var(--hms-color-bg)" strokeWidth="2" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="9" fill="transparent">
                  <title>{pointLabel(s.label, ticks[i] ?? '', format(v))}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
