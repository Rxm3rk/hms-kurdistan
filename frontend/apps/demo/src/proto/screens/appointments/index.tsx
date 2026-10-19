/**
 * The Appointments & queue screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './appointments.css';
import { messages } from './messages.ts';

export function AppointmentsScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="appointments-screen">
      <PageHeader icon="calendar" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="calendar" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
