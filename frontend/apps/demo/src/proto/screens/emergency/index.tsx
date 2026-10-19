/**
 * The Emergency screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './emergency.css';
import { messages } from './messages.ts';

export function EmergencyScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="emergency-screen">
      <PageHeader icon="alert" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="alert" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
