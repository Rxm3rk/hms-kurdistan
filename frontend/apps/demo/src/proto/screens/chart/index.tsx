/**
 * The chart screen (patient-scoped: rendered under the PatientBanner by the clinical layout). Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { useClinicalPatient } from '../../shell/index.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './chart.css';
import { messages } from './messages.ts';

export function ChartScreen(): ReactNode {
  const t = useT(messages);
  const { patient } = useClinicalPatient();
  return (
    <div className="chart-screen" data-patient-id={patient.id}>
      <PageHeader icon="chart" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="chart" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
