/**
 * Small display parts shared by the lab screen's tabs and dialogs: tube swatch, status and priority badges,
 * where the patient is, result flags, reference ranges and units.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import {
  CONTAINER_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  RESULT_FLAG_LABEL,
  RESULT_FLAG_TONE,
  SPECIMEN_STATUS_LABEL,
  SPECIMEN_STATUS_TONE,
  locationOf,
  type OrderPriority,
  type ResultFlag,
  type Specimen,
  type SpecimenStatus,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, PROTO_UNIT_DISPLAY_MAP, type IconName } from '../../ui/index.ts';
import { flagCode } from './lab-data.ts';
import { messages } from './messages.ts';

/** The cap colour as a small swatch (decorative) followed by the container's name. */
export function TubeSwatch({ container, short = false }: { readonly container: Specimen['container']; readonly short?: boolean }): ReactNode {
  const f = useFormat();
  return (
    <span className={short ? 'lab-tube lab-tube--short' : 'lab-tube'}>
      <span className={`lab-tube__cap lab-tube__cap--${container}`} aria-hidden="true" />
      <span>{f.text(CONTAINER_LABEL[container])}</span>
    </span>
  );
}

const STATUS_ICON: Readonly<Record<SpecimenStatus, IconName>> = {
  ordered: 'clock',
  collected: 'droplet',
  received: 'building',
  'in-progress': 'activity',
  resulted: 'clipboard',
  verified: 'check-circle',
  rejected: 'x',
};

export function StatusBadge({ status }: { readonly status: SpecimenStatus }): ReactNode {
  const f = useFormat();
  return (
    <Badge tone={SPECIMEN_STATUS_TONE[status]} icon={STATUS_ICON[status]} size="sm">
      {f.text(SPECIMEN_STATUS_LABEL[status])}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { readonly priority: OrderPriority }): ReactNode {
  const f = useFormat();
  return (
    <Badge tone={PRIORITY_TONE[priority]} strong={priority === 'stat'} size="sm" {...(priority === 'routine' ? {} : { icon: 'clock' as const })}>
      {f.text(PRIORITY_LABEL[priority])}
    </Badge>
  );
}

/** Ward and bed of an inpatient, or "Outpatient". Never used alone to identify a patient. */
export function LocationText({ patientId }: { readonly patientId: string }): ReactNode {
  const f = useFormat();
  const t = useT(messages);
  const where = locationOf(patientId);
  if (where === undefined) {
    return <span className="lab-muted">{t('outpatient')}</span>;
  }
  return (
    <span className="lab-location">
      <span>{f.text(where.ward.name)}</span>
      <Bdi dir="ltr" className="lab-location__bed">
        {where.bedId}
      </Bdi>
    </span>
  );
}

/** H / L / HH / LL as on a lab report, with the full flag name for screen readers and as a tooltip. */
export function FlagMark({ flag }: { readonly flag: ResultFlag }): ReactNode {
  const f = useFormat();
  const code = flagCode(flag);
  if (code === '') {
    return null;
  }
  const label = f.text(RESULT_FLAG_LABEL[flag]);
  return (
    <span className={`lab-flag lab-flag--${RESULT_FLAG_TONE[flag]}`} title={label}>
      <span aria-hidden="true">
        <Bdi dir="ltr">{code}</Bdi>
      </span>
      <span className="hms-visually-hidden">{label}</span>
    </span>
  );
}

/** The display form of a UCUM unit (`umol/L` → `µmol/L`). */
export function unitText(unit: string | null): string {
  if (unit === null) {
    return '';
  }
  return PROTO_UNIT_DISPLAY_MAP.get(unit) ?? unit;
}

/** The reference range as text: `3.5–5.1`, `< 5`, `> 60`. */
export function rangeText(refLow: string | null, refHigh: string | null): string {
  if (refLow !== null && refHigh !== null) {
    return `${refLow}–${refHigh}`;
  }
  if (refHigh !== null) {
    return `< ${refHigh}`;
  }
  if (refLow !== null) {
    return `> ${refLow}`;
  }
  return '';
}

export function RangeText({ refLow, refHigh }: { readonly refLow: string | null; readonly refHigh: string | null }): ReactNode {
  const text = rangeText(refLow, refHigh);
  return text === '' ? <span className="lab-muted">–</span> : <Bdi dir="ltr" className="lab-num">{text}</Bdi>;
}
