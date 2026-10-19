/**
 * The patients screen: find a patient (any name form, MRN, phone, national ID or date of birth) and register
 * a new one (three name forms, duplicate check, live banner preview, wristband print preview).
 *
 * Hospital-wide, not patient-scoped: patients are listed with two identifiers (PatientIdentity) and opened
 * through the window's patient context. `?mode=register` opens the registration tab (the outpatient screen's
 * walk-in shortcut adds `&from=walk-in`).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { APPOINTMENTS, BEDS } from '../../data/index.ts';
import { useT } from '../../i18n/use-t.ts';
import { useSearchParam } from '../../shell/index.ts';
import { Button, PageHeader, StatTile, Tabs } from '../../ui/index.ts';
import { FindPatient } from './find-patient.tsx';
import './patients.css';
import { messages } from './messages.ts';
import { EMPTY_DRAFT, RegisterPatient, type CompletedRegistration, type RegistrationDraft } from './register-patient.tsx';
import { useAllPatients, useSessionPatients } from './session.ts';

type TabId = 'find' | 'register';

const IN_CLINIC_TODAY = new Set(APPOINTMENTS.filter((appointment) => appointment.status !== 'cancelled').map((appointment) => appointment.patientId)).size;
const INPATIENTS = BEDS.filter((bed) => bed.state === 'occupied').length;

export function PatientsScreen(): ReactNode {
  const t = useT(messages);
  const mode = useSearchParam('mode');
  const from = useSearchParam('from');
  const patients = useAllPatients();
  const session = useSessionPatients();
  const [tab, setTab] = useState<TabId>(mode === 'register' ? 'register' : 'find');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT);
  const [completed, setCompleted] = useState<CompletedRegistration | null>(null);

  useEffect(() => {
    if (mode === 'register') {
      setTab('register');
    }
  }, [mode]);

  const showPatient = (patientId: string): void => {
    const patient = patients.find((candidate) => candidate.id === patientId);
    setSelectedId(patientId);
    setQuery(patient?.mrn ?? '');
    setTab('find');
  };

  return (
    <div className="patients-screen">
      <PageHeader
        icon="users"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          tab === 'find' ? (
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setTab('register');
              }}
            >
              {t('tabRegister')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon="search"
              onPress={() => {
                setTab('find');
              }}
            >
              {t('tabFind')}
            </Button>
          )
        }
      />
      <div className="patients-stats">
        <StatTile label={t('statOnFile')} value={patients.length} icon="users" hint={t('statOnFileHint')} />
        <StatTile label={t('statInpatients')} value={INPATIENTS} icon="bed" hint={t('statInpatientsHint')} />
        <StatTile label={t('statClinicToday')} value={IN_CLINIC_TODAY} icon="stethoscope" hint={t('statClinicTodayHint')} />
        <StatTile label={t('statSession')} value={session.length} icon="plus" tone={session.length > 0 ? 'success' : 'neutral'} hint={t('statSessionHint')} />
      </div>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={(id) => {
          setTab(id === 'register' ? 'register' : 'find');
        }}
        items={[
          {
            id: 'find',
            label: t('tabFind'),
            content: (
              <FindPatient
                query={query}
                onQueryChange={setQuery}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRegister={() => {
                  setTab('register');
                }}
              />
            ),
          },
          {
            id: 'register',
            label: t('tabRegister'),
            ...(session.length > 0 ? { badge: String(session.length) } : {}),
            content: (
              <RegisterPatient
                draft={draft}
                onDraftChange={setDraft}
                completed={completed}
                onCompletedChange={setCompleted}
                onShowPatient={showPatient}
                fromWalkIn={from === 'walk-in'}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
