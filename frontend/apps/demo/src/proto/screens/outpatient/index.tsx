/**
 * The outpatient screen. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './outpatient.css';
import { messages } from './messages.ts';

export function OutpatientScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="outpatient-screen">
      <PageHeader icon="stethoscope" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="stethoscope" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
