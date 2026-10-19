/**
 * Partograph chart (WHO style): cervical dilation (×) and descent of the head in fifths (○) against hours
 * since the active phase, with the alert line (1 cm per hour from 4 cm) and the action line 4 hours to its
 * right. Time runs left to right in every locale (charts are not mirrored).
 */
import type { ReactNode } from 'react';
import type { LabourWoman, PartographExam } from '../../data/ext/maternity.ts';

export type LineState = 'none' | 'alert' | 'action';

const HOURS = 12;

export function hoursSince(fromIso: string, iso: string): number {
  return (Date.parse(iso) - Date.parse(fromIso)) / 3_600_000;
}

/** Whether the latest dilation is right of the alert or action line. */
export function lineState(w: Pick<LabourWoman, 'activeFromIso' | 'exams' | 'stage'>): LineState {
  if (w.activeFromIso === null || (w.stage !== 'active' && w.stage !== 'second')) {
    return 'none';
  }
  const from = w.activeFromIso;
  let state: LineState = 'none';
  for (const exam of w.exams) {
    const h = hoursSince(from, exam.iso);
    if (h < 0) {
      continue;
    }
    if (exam.dilationCm < 4 + (h - 4) - 0.01) {
      state = 'action';
    } else if (exam.dilationCm < 4 + h - 0.01 && state !== 'action') {
      state = 'alert';
    } else if (exam.dilationCm >= 4 + h) {
      state = 'none';
    }
  }
  return state;
}

export interface PartographProps {
  readonly exams: readonly PartographExam[];
  readonly activeFromIso: string;
  readonly label: string;
  readonly axisHours: string;
  readonly axisCm: string;
  readonly alertLabel: string;
  readonly actionLabel: string;
}

export function Partograph({ exams, activeFromIso, label, axisHours, axisCm, alertLabel, actionLabel }: PartographProps): ReactNode {
  const w = 640;
  const h = 300;
  const left = 44;
  const right = 16;
  const top = 14;
  const bottom = 40;
  const x = (hours: number): number => left + (Math.max(0, Math.min(HOURS, hours)) / HOURS) * (w - left - right);
  const y = (cm: number): number => top + ((10 - cm) / 10) * (h - top - bottom);
  const points = exams.map((e) => ({ hx: hoursSince(activeFromIso, e.iso), e })).filter((p) => p.hx >= -0.01);
  const dilationPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${String(x(p.hx))},${String(y(p.e.dilationCm))}`).join(' ');
  const descentPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${String(x(p.hx))},${String(y(p.e.descentFifths))}`).join(' ');
  return (
    <svg className="maternity-partograph" viewBox={`0 0 ${String(w)} ${String(h)}`} role="img" aria-label={label} dir="ltr">
      {/* Grid */}
      {Array.from({ length: 11 }, (_, cm) => (
        <g key={`y${String(cm)}`}>
          <line x1={left} x2={w - right} y1={y(cm)} y2={y(cm)} className={cm === 4 ? 'maternity-grid maternity-grid--strong' : 'maternity-grid'} />
          <text x={left - 8} y={y(cm) + 4} className="maternity-axis" textAnchor="end">
            {cm}
          </text>
        </g>
      ))}
      {Array.from({ length: HOURS + 1 }, (_, hr) => (
        <g key={`x${String(hr)}`}>
          <line x1={x(hr)} x2={x(hr)} y1={top} y2={h - bottom} className="maternity-grid" />
          <text x={x(hr)} y={h - bottom + 16} className="maternity-axis" textAnchor="middle">
            {hr}
          </text>
        </g>
      ))}
      <text x={(left + w - right) / 2} y={h - 4} className="maternity-axis maternity-axis--title" textAnchor="middle">
        {axisHours}
      </text>
      <text x={12} y={(top + h - bottom) / 2} className="maternity-axis maternity-axis--title" textAnchor="middle" transform={`rotate(-90 12 ${String((top + h - bottom) / 2)})`}>
        {axisCm}
      </text>
      {/* Alert and action lines */}
      <line x1={x(0)} y1={y(4)} x2={x(6)} y2={y(10)} className="maternity-line maternity-line--alert">
        <title>{alertLabel}</title>
      </line>
      <line x1={x(4)} y1={y(4)} x2={x(10)} y2={y(10)} className="maternity-line maternity-line--action">
        <title>{actionLabel}</title>
      </line>
      <text x={x(6) - 4} y={y(10) - 2} className="maternity-axis maternity-line-label" textAnchor="end">
        {alertLabel}
      </text>
      <text x={x(10) + 4} y={y(10) - 2} className="maternity-axis maternity-line-label" textAnchor="start">
        {actionLabel}
      </text>
      {/* Series */}
      {points.length > 1 ? <path d={descentPath} className="maternity-series maternity-series--descent" /> : null}
      {points.length > 1 ? <path d={dilationPath} className="maternity-series maternity-series--dilation" /> : null}
      {points.map((p) => (
        <g key={p.e.iso}>
          <circle cx={x(p.hx)} cy={y(p.e.descentFifths)} r={5} className="maternity-mark maternity-mark--descent">
            <title>{`${p.e.descentFifths}/5`}</title>
          </circle>
          <g transform={`translate(${String(x(p.hx))} ${String(y(p.e.dilationCm))})`} className="maternity-mark maternity-mark--dilation">
            <line x1={-5} y1={-5} x2={5} y2={5} />
            <line x1={-5} y1={5} x2={5} y2={-5} />
            <title>{`${String(p.e.dilationCm)} cm`}</title>
          </g>
        </g>
      ))}
    </svg>
  );
}
