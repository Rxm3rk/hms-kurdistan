/** Small pieces of the Emergency screen: the triage chip, wait times and the shared state types. */
import type { ReactNode } from 'react';
import { DEMO_NOW_ISO, minutesFromNow } from '../../data/index.ts';
import type { MlcCase, PathwayClock, EdRow, TriageLevel, TriageScale } from '../../data/ext/emergency.ts';
import { useFormat } from '../../i18n/use-t.ts';

export interface EdState {
  readonly rows: readonly EdRow[];
  readonly clocks: readonly PathwayClock[];
  readonly mlc: readonly MlcCase[];
}

export const NOW_ISO = DEMO_NOW_ISO;

/** Minutes since an instant, at the demo clock. */
export function minutesSince(iso: string): number {
  return Math.max(0, -minutesFromNow(iso));
}

export function minutesBetweenIso(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
}

/** True when a patient not yet seen by a doctor has waited past the target of the category. */
export function isBreaching(row: EdRow, scale: TriageScale): boolean {
  if (row.seenIso !== null || row.triage === null) {
    return row.triage === null && minutesSince(row.arrivalIso) > 15;
  }
  const target = scale.categories.find((c) => c.level === row.triage)?.targetMin ?? 60;
  return minutesSince(row.arrivalIso) > target;
}

export function TriageChip({ level, scale, compact = false }: { readonly level: TriageLevel | null; readonly scale: TriageScale; readonly compact?: boolean }): ReactNode {
  const f = useFormat();
  const category = level === null ? undefined : scale.categories.find((c) => c.level === level);
  if (level === null || category === undefined) {
    return <span className="emergency-triage emergency-triage--none">–</span>;
  }
  return (
    <span className={`emergency-triage emergency-triage--${String(level)}`} title={`${f.text(category.colour)} · ${f.text(category.name)}`}>
      <span className="emergency-triage__level">{level}</span>
      {compact ? null : <span className="emergency-triage__name">{f.text(category.name)}</span>}
    </span>
  );
}
