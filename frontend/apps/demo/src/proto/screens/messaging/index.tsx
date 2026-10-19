/**
 * The Patient messaging screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './messaging.css';
import { messages } from './messages.ts';

export function MessagingScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="messaging-screen">
      <PageHeader icon="phone" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="phone" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
