/**
 * The orders screen (patient-scoped: rendered under the PatientBanner by the clinical layout). Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { useClinicalPatient } from '../../shell/index.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './orders.css';
import { messages } from './messages.ts';

export function OrdersScreen(): ReactNode {
  const t = useT(messages);
  const { patient } = useClinicalPatient();
  return (
    <div className="orders-screen" data-patient-id={patient.id}>
      <PageHeader icon="clipboard" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="clipboard" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
