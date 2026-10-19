/**
 * The billing screen (patient-scoped: rendered under the real PatientBanner by the clinical layout).
 *
 * Two tabs:
 * - **Patient invoice**: the open patient's invoice (or an estimated interim bill), charges in IQD, totals in
 *   IQD with the USD equivalent at the fixed demo rate, exemptions with supervisor co-signature, the claim to
 *   the insurer or public coverage, payment in mixed currency with explicit cash rounding, and the 80 mm
 *   receipt preview.
 * - **Cashier desk**: today's takings in IQD and USD, open invoices across the hospital, payments of the day,
 *   the shift's drawer and closing the shift with a cash count and a Z report.
 *
 * `?tab=desk` opens the desk tab. Changes live in the screen's session store (./billing-store.ts); the shared
 * data never changes. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { findStaff } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useSearchParam } from '../../shell/index.ts';
import { Badge, PageHeader, StaffName, Tabs } from '../../ui/index.ts';
import { SHIFT, accountsOf } from './billing-data.ts';
import { useBillingSession } from './billing-store.ts';
import './billing.css';
import { DeskTab, openInvoiceCount } from './desk-tab.tsx';
import { InvoiceTab } from './invoice-tab.tsx';
import { messages } from './messages.ts';
import { RATE_IQD_PER_USD } from './money.ts';

export function BillingScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { patient } = useClinicalPatient();
  const session = useBillingSession();
  const tabParam = useSearchParam('tab');
  const [tabState, setTabState] = useState({ patientId: patient.id, tab: tabParam === 'desk' ? 'desk' : 'invoice' });
  // A new patient (for example opened from the desk's open invoices) lands on their invoice.
  const tab = tabState.patientId === patient.id ? tabState.tab : 'invoice';
  const setTab = (next: string): void => {
    setTabState({ patientId: patient.id, tab: next });
  };
  const accounts = useMemo(() => accountsOf(patient), [patient]);
  const cashier = findStaff(SHIFT.cashierId);
  const openCount = openInvoiceCount(session);

  return (
    <div className="billing-screen" data-patient-id={patient.id}>
      <PageHeader
        icon="receipt"
        eyebrow={
          <span className="billing-eyebrow">
            <span>{f.text(SHIFT.desk)}</span>
            {cashier === undefined ? null : (
              <>
                <span aria-hidden="true">·</span>
                <span>{t.rich('onShift', { name: <StaffName member={cashier} /> })}</span>
              </>
            )}
          </span>
        }
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Badge tone="info" icon="money">
            {t('rateBadge', { rate: f.number(RATE_IQD_PER_USD) })}
          </Badge>
        }
      />
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          {
            id: 'invoice',
            label: t('tabInvoice'),
            content: <InvoiceTab key={patient.id} patient={patient} accounts={accounts} />,
          },
          {
            id: 'desk',
            label: t('tabDesk'),
            badge: f.number(openCount),
            content: (
              <DeskTab
                onShowInvoice={() => {
                  setTab('invoice');
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
