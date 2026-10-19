/**
 * Safety cues beside a patient in the home worklists: text and icon in a tone, never colour alone, never
 * truncated. The full detail is on the patient banner once the record is open.
 */
import type { ReactNode } from 'react';
import { ISOLATION_LABEL } from '../../data/index.ts';
import type { Patient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge } from '../../ui/index.ts';
import type { FlagKind } from './derive.ts';
import { messages } from './messages.ts';

export function FlagBadges({ patient, flags }: { readonly patient: Patient; readonly flags: readonly FlagKind[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  if (flags.length === 0) {
    return <span className="home-muted">{t('flagNone')}</span>;
  }
  return (
    <span className="home-flags">
      {flags.map((flag) => {
        switch (flag) {
          case 'critical':
            return (
              <Badge key={flag} tone="danger" strong icon="alert" size="sm">
                {t('flagCritical')}
              </Badge>
            );
          case 'overdue':
            return (
              <Badge key={flag} tone="danger" icon="clock" size="sm">
                {t('flagOverdue')}
              </Badge>
            );
          case 'allergy': {
            const items = patient.allergies.kind === 'list' ? patient.allergies.items : [];
            const first = items[0];
            return (
              <Badge key={flag} tone="danger" icon="alert" size="sm">
                {items.length === 1 && first !== undefined
                  ? t('flagAllergyOne', { substance: f.text(first.substance) })
                  : t('flagAllergyMany', { count: items.length })}
              </Badge>
            );
          }
          case 'allergy-unknown':
            return (
              <Badge key={flag} tone="warning" icon="alert" size="sm">
                {t('flagAllergyUnknown')}
              </Badge>
            );
          case 'isolation': {
            const type = patient.isolation?.types[0];
            return (
              <Badge key={flag} tone="warning" icon="isolation" size="sm">
                {type === undefined ? t('flagIsolation') : f.text(ISOLATION_LABEL[type])}
              </Badge>
            );
          }
          case 'fall':
            return (
              <Badge key={flag} tone="warning" icon="activity" size="sm">
                {t('flagFall')}
              </Badge>
            );
          case 'dnacpr':
            return (
              <Badge key={flag} tone="neutral" icon="heart" size="sm">
                {t('flagDnacpr')}
              </Badge>
            );
        }
      })}
    </span>
  );
}
