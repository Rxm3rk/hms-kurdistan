/**
 * The patient chart (patient-scoped: rendered under the real PatientBanner by the clinical layout, which
 * shows the patient chooser when no patient is open).
 *
 * - Header: the encounter (ward, bed, day of admission or the clinic visit), responsible doctor, expected
 *   discharge and preferred language, with links to the patient's orders, medication record and laboratory.
 * - Safety strip above the tabs: an unacknowledged critical result, an allergy conflict on an unsigned order,
 *   allergies not assessed.
 * - Tabs: Summary, Notes, Vital signs, Documents, Timeline.
 *
 * Everything the user does (new notes, signing) lives in this screen's state and is dropped when the patient
 * changes: the inner component is keyed by the patient id, so nothing of one patient can show for another.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { Bdi, Message } from '@hms/design-system';
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  ORDER_STATUS_LABEL,
  currentEncounter,
  findStaff,
  getDepartment,
  lengthOfStayDays,
  locationOf,
  ordersOf,
  unacknowledgedCriticals,
  type Patient,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useScreenHref } from '../../shell/index.ts';
import { Badge, Callout, KeyValueList, LinkButton, PageHeader, Qty, StaffName, Tabs } from '../../ui/index.ts';
import './chart.css';
import { chartNotesOf, chartVitalsOf, type ChartNote } from './chart-data.ts';
import { newsViewOf, type ChartMessageKey } from './chart-shared.tsx';
import { DocumentsTab } from './documents-tab.tsx';
import { messages } from './messages.ts';
import { NotesTab, type EditorState } from './notes-tab.tsx';
import { SummaryTab } from './summary-tab.tsx';
import { TimelineTab } from './timeline-tab.tsx';
import { VitalsTab } from './vitals-tab.tsx';

export function ChartScreen(): ReactNode {
  const { patient } = useClinicalPatient();
  return <PatientChart key={patient.id} patient={patient} />;
}

const LANG_KEY: Readonly<Record<Patient['preferredLanguage'], ChartMessageKey>> = { en: 'langEn', ckb: 'langCkb', ar: 'langAr' };

function PatientChart({ patient }: { readonly patient: Patient }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const encounter = currentEncounter(patient.id);
  const vitals = useMemo(() => chartVitalsOf(patient.id), [patient.id]);
  const news = useMemo(() => newsViewOf(patient, vitals), [patient, vitals]);
  const baseNotes = useMemo(() => chartNotesOf(patient.id), [patient.id]);

  const [tab, setTab] = useState('summary');
  const [addedNotes, setAddedNotes] = useState<readonly ChartNote[]>([]);
  const [signedIds, setSignedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [summarySignedIso, setSummarySignedIso] = useState<string | null>(null);

  const notes = useMemo(
    () => [...addedNotes, ...baseNotes].map((note) => (signedIds.has(note.id) ? { ...note, signed: true } : note)),
    [addedNotes, baseNotes, signedIds],
  );
  const drafts = notes.filter((note) => !note.signed).length;

  const where = locationOf(patient.id);
  const attending = findStaff(encounter?.attendingId);
  const inpatient = encounter?.type === 'inpatient';

  const eyebrow =
    encounter === undefined
      ? t('noEncounter')
      : inpatient && where !== undefined
        ? t.rich('eyebrowInpatient', {
            ward: f.text(where.ward.name),
            bed: <Bdi dir="ltr">{where.bedId}</Bdi>,
            day: lengthOfStayDays(encounter) + 1,
          })
        : t('eyebrowOutpatient', { department: f.text(getDepartment(encounter.departmentId).name), time: f.time(encounter.startIso) });
  const primary = encounter?.diagnoses.find((dx) => dx.primary) ?? encounter?.diagnoses[0];

  const kv = [
    ...(encounter === undefined
      ? []
      : [
          {
            id: 'start',
            label: t(inpatient ? 'kvAdmitted' : 'kvVisit'),
            value: <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{f.dateTime(encounter.startIso)}</Bdi>,
          },
        ]),
    ...(inpatient && encounter !== undefined
      ? [
          { id: 'stay', label: t('kvStay'), value: t('stayDays', { count: lengthOfStayDays(encounter) }) },
          {
            id: 'expected',
            label: t('kvExpected'),
            value: encounter.expectedDischargeOn === null ? <span className="chart-muted">{t('notSet')}</span> : f.date(encounter.expectedDischargeOn),
          },
        ]
      : []),
    ...(attending === undefined ? [] : [{ id: 'attending', label: t('kvAttending'), value: <StaffName member={attending} /> }]),
    { id: 'language', label: t('kvLanguage'), value: t(LANG_KEY[patient.preferredLanguage]) },
  ];

  return (
    <div className="chart-screen" data-patient-id={patient.id}>
      <PageHeader
        icon="chart"
        eyebrow={eyebrow}
        title={t('title')}
        subtitle={
          primary === undefined ? undefined : (
            <span className="chart-header__dx">
              {f.text(primary.text)} <Bdi dir="ltr" className="chart-header__code">{primary.code}</Bdi>
            </span>
          )
        }
        actions={
          <div className="chart-header__actions" role="group" aria-label={t('actionsLabel')}>
            <LinkButton size="sm" icon="clipboard" href={href('orders', { patient: patient.id })}>
              <Message id="proto.nav.orders" />
            </LinkButton>
            <LinkButton size="sm" icon="pill" href={href('emar', { patient: patient.id })}>
              <Message id="proto.nav.emar" />
            </LinkButton>
            <LinkButton size="sm" icon="flask" href={href('lab', { patient: patient.id })}>
              <Message id="proto.nav.lab" />
            </LinkButton>
          </div>
        }
      >
        <KeyValueList items={kv} columns={3} className="chart-header__kv" />
      </PageHeader>

      <SafetyStrip patient={patient} />

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        className="chart-tabs"
        items={[
          {
            id: 'summary',
            label: t('tabSummary'),
            content: (
              <SummaryTab
                patient={patient}
                vitals={vitals}
                news={news}
                onShowVitals={() => {
                  setTab('vitals');
                }}
              />
            ),
          },
          {
            id: 'notes',
            label: t('tabNotes'),
            ...(drafts > 0 ? { badge: t('draftsBadge', { count: drafts }) } : {}),
            content: (
              <NotesTab
                patient={patient}
                notes={notes}
                vitals={vitals}
                news={news}
                editor={editor}
                onEditorChange={setEditor}
                onAdd={(note) => {
                  setAddedNotes((current) => [note, ...current]);
                }}
                onSignExisting={(noteId) => {
                  setSignedIds((current) => new Set(current).add(noteId));
                }}
              />
            ),
          },
          { id: 'vitals', label: t('tabVitals'), content: <VitalsTab patient={patient} vitals={vitals} news={news} /> },
          {
            id: 'documents',
            label: t('tabDocuments'),
            content: (
              <DocumentsTab
                patient={patient}
                encounter={encounter}
                summarySignedIso={summarySignedIso}
                onSummarySigned={() => {
                  setSummarySignedIso(DEMO_NOW_ISO);
                }}
              />
            ),
          },
          {
            id: 'timeline',
            label: t('tabTimeline'),
            content: <TimelineTab patient={patient} encounter={encounter} notes={notes} vitals={vitals} news={news} />,
          },
        ]}
      />
    </div>
  );
}

/** Safety messages that must be seen on every tab. */
function SafetyStrip({ patient }: { readonly patient: Patient }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const criticals = unacknowledgedCriticals().filter((result) => result.patientId === patient.id);
  const conflicts = ordersOf(patient.id).filter(
    (order) => (order.status === 'pending-signature' || order.status === 'draft') && order.alerts.some((alert) => alert.tone === 'danger'),
  );
  const notAssessed = patient.allergies.kind === 'not-assessed';
  if (criticals.length === 0 && conflicts.length === 0 && !notAssessed) {
    return null;
  }
  return (
    <div className="chart-safety">
      {criticals.map((result) => (
        <Callout
          key={result.id}
          tone="danger"
          role="alert"
          title={t('criticalTitle')}
          actions={
            <LinkButton size="sm" variant="danger" icon="flask" href={href('lab', { patient: patient.id })}>
              {t('openLab')}
            </LinkButton>
          }
        >
          {t.rich('criticalBody', {
            analyte: <strong>{f.text(result.analyte)}</strong>,
            value: (
              <strong>
                <Qty value={result.value} unit={result.unit} />
              </strong>
            ),
            time: <Bdi dir="ltr">{f.time(result.resultedIso)}</Bdi>,
          })}
        </Callout>
      ))}
      {conflicts.map((order) => (
        <Callout
          key={order.id}
          tone="danger"
          title={t('conflictTitle')}
          actions={
            <LinkButton size="sm" variant="secondary" icon="clipboard" href={href('orders', { patient: patient.id })}>
              {t('openOrders')}
            </LinkButton>
          }
        >
          <span className="chart-safety__order">
            <Bdi dir="ltr" className="chart-safety__drug">
              {order.medication?.drug ?? f.text(order.title)}
            </Bdi>
            <Badge tone="warning" size="sm">
              {f.text(ORDER_STATUS_LABEL[order.status])}
            </Badge>
          </span>
          {order.alerts
            .filter((alert) => alert.tone === 'danger')
            .map((alert, i) => (
              <span key={i} className="chart-safety__reason">
                {f.text(alert.text)}
              </span>
            ))}
        </Callout>
      ))}
      {notAssessed ? (
        <Callout tone="warning" title={t('allergiesUnknownTitle')}>
          {t('allergiesUnknownBody')}
        </Callout>
      ) : null}
    </div>
  );
}
