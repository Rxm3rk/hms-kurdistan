/**
 * A small single-series trend chart for one test (one y-axis; potassium and creatinine are two charts, never a
 * dual axis). Time runs left to right in every locale and is spaced by real time. The reference range is a
 * light band, the critical limit a dashed line, both labelled in muted text; the line is the accent colour,
 * a critical point is drawn in the danger tone and labelled. Every point has a tooltip with its date, value
 * and flag; the cumulative table beside it is the table view of the same numbers.
 */
import type { ReactNode } from 'react';
import type { TrendPoint } from './lab-data.ts';
import { clockTime, dayMonth } from './lab-data.ts';

export interface TrendChartProps {
  readonly points: readonly TrendPoint[];
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalHigh: number | null;
  readonly criticalLow: number | null;
  /** The chart's accessible name (title, values, direction). */
  readonly label: string;
  /** In-chart label of the reference band, for example "Reference 3.5–5.1". */
  readonly refLabel: string | null;
  /** In-chart label of the critical line, for example "Critical ≥ 6". */
  readonly criticalLabel: string | null;
  /** Tooltip text of a point. */
  readonly pointTitle: (point: TrendPoint) => string;
}

const W = 360;
const H = 176;
const M = { top: 18, end: 18, bottom: 36, start: 40 } as const;

function niceStep(span: number): number {
  const raw = span / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function decimalsOf(step: number): number {
  if (step >= 1) {
    return 0;
  }
  return Math.min(3, Math.ceil(-Math.log10(step)));
}

export function TrendChart({ points, refLow, refHigh, criticalHigh, criticalLow, label, refLabel, criticalLabel, pointTitle }: TrendChartProps): ReactNode {
  if (points.length < 2) {
    return null;
  }
  const values = points.map((point) => point.value);
  const showCriticalHigh = criticalHigh !== null && Math.max(...values) >= criticalHigh * 0.85;
  const showCriticalLow = criticalLow !== null && Math.min(...values) <= criticalLow * 1.15;
  const candidates = [
    ...values,
    ...(refLow === null ? [] : [refLow]),
    ...(refHigh === null ? [] : [refHigh]),
    ...(showCriticalHigh && criticalHigh !== null ? [criticalHigh] : []),
    ...(showCriticalLow && criticalLow !== null ? [criticalLow] : []),
  ];
  let lo = Math.min(...candidates);
  let hi = Math.max(...candidates);
  const pad = (hi - lo || 1) * 0.12;
  lo -= pad;
  hi += pad;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  const decimals = decimalsOf(step);

  const t0 = Date.parse(points[0]?.iso ?? '');
  const t1 = Date.parse(points[points.length - 1]?.iso ?? '');
  const plotW = W - M.start - M.end;
  const plotH = H - M.top - M.bottom;
  const x = (iso: string): number => M.start + (t1 === t0 ? plotW / 2 : ((Date.parse(iso) - t0) / (t1 - t0)) * plotW);
  const y = (v: number): number => M.top + (1 - (v - lo) / (hi - lo)) * plotH;

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.iso).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const bandTop = y(refHigh ?? hi);
  const bandBottom = y(refLow ?? lo);
  const last = points[points.length - 1];
  const showAllTicks = points.length <= 5;

  return (
    <svg className="lab-trend" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={label} direction="ltr">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={M.start} x2={W - M.end} y1={y(tick)} y2={y(tick)} className="lab-trend__grid" />
          <text x={M.start - 6} y={y(tick) + 4} textAnchor="end" className="lab-trend__axis">
            {tick.toFixed(decimals)}
          </text>
        </g>
      ))}
      {refLow !== null || refHigh !== null ? (
        <g>
          <rect x={M.start} y={bandTop} width={plotW} height={Math.max(0, bandBottom - bandTop)} className="lab-trend__band" />
          {refLabel === null ? null : (
            <text x={M.start + 4} y={bandTop + 12} className="lab-trend__note">
              {refLabel}
            </text>
          )}
        </g>
      ) : null}
      {showCriticalHigh && criticalHigh !== null ? (
        <g>
          <line x1={M.start} x2={W - M.end} y1={y(criticalHigh)} y2={y(criticalHigh)} className="lab-trend__critical" />
          {criticalLabel === null ? null : (
            <text x={M.start + 4} y={y(criticalHigh) - 4} className="lab-trend__note">
              {criticalLabel}
            </text>
          )}
        </g>
      ) : null}
      {showCriticalLow && criticalLow !== null ? (
        <line x1={M.start} x2={W - M.end} y1={y(criticalLow)} y2={y(criticalLow)} className="lab-trend__critical" />
      ) : null}
      <path d={path} className="lab-trend__line" />
      {points.map((point, index) => {
        const critical = point.flag === 'critical-high' || point.flag === 'critical-low';
        const showTick = showAllTicks || index === 0 || index === points.length - 1;
        return (
          <g key={point.iso}>
            <circle cx={x(point.iso)} cy={y(point.value)} r="4.5" className={critical ? 'lab-trend__point lab-trend__point--critical' : 'lab-trend__point'} />
            <circle cx={x(point.iso)} cy={y(point.value)} r="13" className="lab-trend__hit">
              <title>{pointTitle(point)}</title>
            </circle>
            {showTick ? (
              <>
                <text x={x(point.iso)} y={H - M.bottom + 15} textAnchor="middle" className="lab-trend__axis">
                  {dayMonth(point.iso)}
                </text>
                <text x={x(point.iso)} y={H - M.bottom + 28} textAnchor="middle" className="lab-trend__axis lab-trend__axis--faint">
                  {clockTime(point.iso)}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      {last === undefined ? null : (
        <text x={x(last.iso) - 8} y={y(last.value) - 9} textAnchor="end" className="lab-trend__value">
          {String(last.value)}
        </text>
      )}
    </svg>
  );
}
