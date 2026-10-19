/**
 * The patients screen. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './patients.css';
import { messages } from './messages.ts';

export function PatientsScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="patients-screen">
      <PageHeader icon="users" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="users" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
