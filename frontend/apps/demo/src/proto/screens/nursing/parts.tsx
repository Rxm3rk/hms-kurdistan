/** Small pieces of the Nursing screen. */
import type { ReactNode } from 'react';
import type { News2Result, TaskState } from '../../data/ext/nursing.ts';
import type { Tone } from '../../data/index.ts';
import { useT } from '../../i18n/use-t.ts';
import { Badge } from '../../ui/index.ts';
import { messages } from './messages.ts';

export const BAND_TONE: Readonly<Record<News2Result['band'], Tone>> = {
  low: 'success',
  'low-medium': 'warning',
  medium: 'warning',
  high: 'danger',
};

export function BandBadge({ band }: { readonly band: News2Result['band'] }): ReactNode {
  const t = useT(messages);
  const label = { low: t('bandLow'), 'low-medium': t('bandLowMedium'), medium: t('bandMedium'), high: t('bandHigh') }[band];
  return (
    <Badge tone={BAND_TONE[band]} strong={band === 'high'} size="sm" {...(band === 'low' ? {} : { icon: 'alert' as const })}>
      {label}
    </Badge>
  );
}

export const STATE_TONE: Readonly<Record<TaskState, Tone>> = {
  scheduled: 'neutral',
  due: 'info',
  overdue: 'danger',
  done: 'success',
};

export function StateBadge({ state }: { readonly state: TaskState }): ReactNode {
  const t = useT(messages);
  const label = { scheduled: t('stateScheduled'), due: t('stateDue'), overdue: t('stateOverdue'), done: t('stateDone') }[state];
  return (
    <Badge tone={STATE_TONE[state]} size="sm">
      {label}
    </Badge>
  );
}
