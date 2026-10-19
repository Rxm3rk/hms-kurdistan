/**
 * The Operating theatres screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './theatre.css';
import { messages } from './messages.ts';

export function TheatreScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="theatre-screen">
      <PageHeader icon="clock" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="clock" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
