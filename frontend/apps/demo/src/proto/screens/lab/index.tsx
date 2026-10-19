/**
 * The lab screen (patient-scoped: rendered under the PatientBanner by the clinical layout). Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { useClinicalPatient } from '../../shell/index.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './lab.css';
import { messages } from './messages.ts';

export function LabScreen(): ReactNode {
  const t = useT(messages);
  const { patient } = useClinicalPatient();
  return (
    <div className="lab-screen" data-patient-id={patient.id}>
      <PageHeader icon="flask" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="flask" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
