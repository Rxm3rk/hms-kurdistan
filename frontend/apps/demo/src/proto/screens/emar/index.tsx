/**
 * The emar screen (patient-scoped: rendered under the PatientBanner by the clinical layout). Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { useClinicalPatient } from '../../shell/index.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './emar.css';
import { messages } from './messages.ts';

export function EmarScreen(): ReactNode {
  const t = useT(messages);
  const { patient } = useClinicalPatient();
  return (
    <div className="emar-screen" data-patient-id={patient.id}>
      <PageHeader icon="pill" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="pill" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
