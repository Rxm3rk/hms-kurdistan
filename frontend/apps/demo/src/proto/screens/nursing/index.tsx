/**
 * The Nursing worklist screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './nursing.css';
import { messages } from './messages.ts';

export function NursingScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="nursing-screen">
      <PageHeader icon="thermometer" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="thermometer" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
