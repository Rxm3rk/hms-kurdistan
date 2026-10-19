/**
 * A Levey–Jennings chart: control results over the last runs against the mean and ±1, ±2, ±3 SD lines.
 * Time runs left to right in every locale. Points that break a Westgard rule are drawn in the warning
 * (1-2s) or danger (rejection) tone, and each point carries a tooltip with its run, value and rule.
 */
import type { ReactNode } from 'react';
import type { QcSeries, WestgardHit } from '../../data/ext/labworklist.ts';

export interface LjChartProps {
  readonly qc: QcSeries;
  readonly hits: readonly WestgardHit[];
  /** Run labels (dates), same length as the values. */
  readonly runLabels: readonly string[];
  readonly label: string;
  readonly meanLabel: string;
  readonly formatValue: (value: number) => string;
}

const WIDTH = 720;
const HEIGHT = 240;
const PAD_START = 64;
const PAD_END = 16;
const PAD_Y = 14;

export function LjChart({ qc, hits, runLabels, label, meanLabel, formatValue }: LjChartProps): ReactNode {
  const n = qc.values.length;
  const x = (i: number): number => PAD_START + (i * (WIDTH - PAD_START - PAD_END)) / Math.max(1, n - 1);
  const y = (value: number): number => {
    const k = (value - qc.mean) / qc.sd;
    const clamped = Math.max(-4, Math.min(4, k));
    return PAD_Y + ((4 - clamped) / 8) * (HEIGHT - 2 * PAD_Y);
  };
  const lines = [3, 2, 1, 0, -1, -2, -3];
  const line = qc.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const hitAt = new Map(hits.map((hit) => [hit.index, hit]));
  return (
    <div className="lw-lj" dir="ltr">
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} className="lw-lj__svg" role="img" aria-label={label}>
        <rect
          x={PAD_START}
          y={y(qc.mean + 2 * qc.sd)}
          width={WIDTH - PAD_START - PAD_END}
          height={y(qc.mean - 2 * qc.sd) - y(qc.mean + 2 * qc.sd)}
          className="lw-lj__band"
        />
        {lines.map((k) => {
          const value = qc.mean + k * qc.sd;
          const cls = k === 0 ? 'lw-lj__mean' : Math.abs(k) === 3 ? 'lw-lj__sd3' : Math.abs(k) === 2 ? 'lw-lj__sd2' : 'lw-lj__sd1';
          return (
            <g key={k}>
              <line x1={PAD_START} x2={WIDTH - PAD_END} y1={y(value)} y2={y(value)} className={cls} />
              <text x={PAD_START - 6} y={y(value) + 4} textAnchor="end" className="lw-lj__tick">
                {k === 0 ? meanLabel : `${k > 0 ? '+' : '−'}${String(Math.abs(k))}SD`}
              </text>
            </g>
          );
        })}
        <path d={line} className="lw-lj__line" />
        {qc.values.map((value, i) => {
          const hit = hitAt.get(i);
          const cls = hit === undefined ? 'lw-lj__point' : hit.reject ? 'lw-lj__point lw-lj__point--reject' : 'lw-lj__point lw-lj__point--warn';
          return (
            <circle key={i} cx={x(i)} cy={y(value)} r={hit === undefined ? 3.5 : 5.5} className={cls}>
              <title>{`${runLabels[i] ?? ''}: ${formatValue(value)}${hit === undefined ? '' : ` (${hit.rule})`}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
