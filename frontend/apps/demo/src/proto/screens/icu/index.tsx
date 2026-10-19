/**
 * The Intensive care screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './icu.css';
import { messages } from './messages.ts';

export function IcuScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="icu-screen">
      <PageHeader icon="heart" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="heart" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
