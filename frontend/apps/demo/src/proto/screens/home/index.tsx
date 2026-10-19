/**
 * Home: a role-aware dashboard on the demo clock (Monday 19 October 2026, 09:30, Asia/Baghdad).
 * - Physician: the critical result to acknowledge, her inpatients, what waits for her signature, her clinic.
 * - Nurse: ward census, medication round due in the next hour, overdue tasks, isolation and fall risk.
 * - Cashier: today's takings in IQD and USD, open invoices, payments, the demo exchange rate.
 * - Administrator: hospital figures, bed occupancy per ward, a (simulated) system health panel, audit.
 * Every tile opens the screen it summarises. SYNTHETIC DATA ONLY.
 */
import type { ReactNode } from 'react';
import { DEMO_NOW_ISO, HOSPITAL, ROLE_LABEL } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { ROLE_IDS, useRole } from '../../shell/index.ts';
import { PageHeader, Segmented, StaffName } from '../../ui/index.ts';
import { AdminHome } from './admin-home.tsx';
import { CashierHome } from './cashier.tsx';
import './home.css';
import { messages } from './messages.ts';
import { NurseHome } from './nurse.tsx';
import { PhysicianHome } from './physician.tsx';

export function HomeScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { roleId, user, setRole } = useRole();
  const roleOptions = ROLE_IDS.map((id) => ({ id, label: f.text(ROLE_LABEL[id]) }));

  return (
    <div className="home-screen">
      <PageHeader
        icon="home"
        eyebrow={`${f.date(DEMO_NOW_ISO, 'long')} · ${f.time(DEMO_NOW_ISO)}`}
        title={t.rich('greeting', { name: <StaffName member={user} /> })}
        subtitle={t('subtitle', { title: f.text(user.title), hospital: f.text(HOSPITAL.name) })}
      >
        <Segmented
          label={t('viewFor')}
          options={roleOptions}
          value={roleId}
          onChange={(id) => {
            const next = ROLE_IDS.find((candidate) => candidate === id);
            if (next !== undefined) {
              setRole(next);
            }
          }}
        />
      </PageHeader>
      {roleId === 'physician' ? <PhysicianHome /> : roleId === 'nurse' ? <NurseHome /> : roleId === 'cashier' ? <CashierHome /> : <AdminHome />}
    </div>
  );
}
