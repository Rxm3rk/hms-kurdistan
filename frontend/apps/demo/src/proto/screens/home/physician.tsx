/**
 * Home for the physician (Dr. Shilan Kareem): the critical result to acknowledge, her inpatients with their
 * safety cues, what waits for her signature or co-signature, and today's Internal Medicine Clinic.
 */
import { useState, type ReactNode } from 'react';
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TONE,
  NOTE_KIND_LABEL,
  RESULT_FLAG_LABEL,
  appointmentsOfClinic,
  findPatient,
  findStaff,
  getClinic,
  lengthOfStayDays,
  locationOf,
} from '../../data/index.ts';
import type { Appointment, AppointmentStatus } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient, useRole, useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  LinkButton,
  PatientInline,
  Qty,
  StaffName,
  StatTile,
  type Column,
} from '../../ui/index.ts';
import { criticalRows, myInpatients, signQueue, type MyPatientRow, type SignItem } from './derive.ts';
import { FlagBadges } from './flags.tsx';
import { messages } from './messages.ts';

const CLINIC_ID = 'clinic-im';
const FIRST_ROWS = 8;
const STATUS_SUMMARY: readonly AppointmentStatus[] = ['booked', 'arrived', 'in-consultation', 'completed', 'no-show'];

export function PhysicianHome(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const openPatient = useOpenPatient();
  const { user } = useRole();
  const [showAll, setShowAll] = useState(false);

  const criticals = criticalRows();
  const patients = myInpatients(user.id);
  const flagged = patients.filter((row) => row.flags.length > 0).length;
  const queue = signQueue(user.id);
  const conflicts = queue.filter((item) => item.kind === 'order' && item.conflict).length;
  const clinic = getClinic(CLINIC_ID);
  const appointments = appointmentsOfClinic(CLINIC_ID).filter((appointment) => appointment.status !== 'cancelled');
  const waiting = appointments.filter((appointment) => appointment.status === 'arrived').length;
  const clinician = findStaff(appointments[0]?.clinicianId);
  const firstCritical = criticals[0];
  const firstSign = queue[0];
  const visible = showAll ? patients : patients.slice(0, FIRST_ROWS);

  const patientColumns: readonly Column<MyPatientRow>[] = [
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={row.patient} /> },
    {
      id: 'location',
      header: t('colLocation'),
      cell: (row) => {
        const location = locationOf(row.patient.id);
        return location === undefined ? (
          <span className="home-muted">{t('outpatient')}</span>
        ) : (
          <span className="home-two-line">
            <span>{f.text(location.ward.name)}</span>
            <span className="home-muted">
              {t('bed')} <Code>{location.bedId}</Code>
            </span>
          </span>
        );
      },
    },
    {
      id: 'diagnosis',
      header: t('colDiagnosis'),
      cell: (row) => {
        const diagnosis = row.encounter.diagnoses.find((candidate) => candidate.primary) ?? row.encounter.diagnoses[0];
        return diagnosis === undefined ? (
          <span className="home-muted">{t('notRecorded')}</span>
        ) : (
          <span className="home-two-line">
            <span>{f.text(diagnosis.text)}</span>
            <span className="home-muted">
              <Code>{diagnosis.code}</Code>
            </span>
          </span>
        );
      },
    },
    { id: 'stay', header: t('colStay'), nowrap: true, cell: (row) => t('stayDay', { day: lengthOfStayDays(row.encounter) + 1 }) },
    { id: 'flags', header: t('colFlags'), cell: (row) => <FlagBadges patient={row.patient} flags={row.flags} /> },
  ];

  const clinicColumns: readonly Column<Appointment>[] = [
    { id: 'time', header: t('colTime'), nowrap: true, cell: (row) => <span className="home-num">{f.time(row.startIso)}</span> },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInlineById id={row.patientId} /> },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge tone={APPOINTMENT_STATUS_TONE[row.status]} size="sm">
          {f.text(APPOINTMENT_STATUS_LABEL[row.status])}
        </Badge>
      ),
    },
  ];

  return (
    <>
      {criticals.map((row) => (
        <Callout
          key={row.result.id}
          tone="danger"
          role="alert"
          title={t('criticalTitle')}
          actions={
            <Button
              variant="danger"
              icon="flask"
              onPress={() => {
                openPatient(row.patient.id, 'lab');
              }}
            >
              {t('criticalAction')}
            </Button>
          }
        >
          <div className="home-critical">
            <p className="home-critical__value">
              <strong>
                {f.text(row.result.analyte)} <Qty value={row.result.value} unit={row.result.unit} />
              </strong>
              <Badge tone="danger" strong size="sm">
                {f.text(RESULT_FLAG_LABEL[row.result.flag])}
              </Badge>
              {row.result.refLow !== null && row.result.refHigh !== null ? (
                <span className="home-muted">
                  {t.rich('criticalRange', {
                    low: <Qty value={row.result.refLow} unit={row.result.unit} />,
                    high: <Qty value={row.result.refHigh} unit={row.result.unit} />,
                  })}
                </span>
              ) : null}
            </p>
            <PatientInline patient={row.patient} secondary />
            <p className="home-muted">
              {t.rich('criticalMeta', {
                time: f.time(row.result.resultedIso),
                name: (() => {
                  const verifier = findStaff(row.specimen?.verifiedById);
                  return verifier === undefined ? t('theLab') : <StaffName member={verifier} />;
                })(),
                minutes: row.waitingMin,
              })}
            </p>
          </div>
        </Callout>
      ))}

      <Grid min="14rem">
        <StatTile
          label={t('tileCritical')}
          value={f.number(criticals.length)}
          tone={criticals.length > 0 ? 'danger' : 'success'}
          icon="alert"
          hint={criticals.length > 0 ? t('tileCriticalHint') : t('tileCriticalNone')}
          href={firstCritical === undefined ? href('lab') : href('lab', { patient: firstCritical.patient.id })}
        />
        <StatTile
          label={t('tileMyPatients')}
          value={f.number(patients.length)}
          icon="bed"
          hint={t('tileMyPatientsHint', { count: flagged })}
          href={href('ward')}
        />
        <StatTile
          label={t('tileToSign')}
          value={f.number(queue.length)}
          tone={queue.length > 0 ? 'warning' : 'success'}
          icon="pen"
          hint={conflicts > 0 ? t('tileToSignConflict', { count: conflicts }) : t('tileToSignHint')}
          href={
            firstSign === undefined
              ? href('orders')
              : href(firstSign.kind === 'order' ? 'orders' : 'chart', { patient: firstSign.patient.id })
          }
        />
        <StatTile
          label={t('tileClinic')}
          value={f.number(appointments.length)}
          icon="stethoscope"
          hint={t('tileClinicHint', { count: waiting })}
          href={href('outpatient')}
        />
      </Grid>

      <div className="home-columns">
        <Card
          title={t('myPatientsTitle')}
          subtitle={t('myPatientsSubtitle', { count: patients.length })}
          icon="users"
          flush
          actions={
            patients.length > FIRST_ROWS ? (
              <Button
                variant="ghost"
                size="sm"
                icon={showAll ? 'minus' : 'plus'}
                onPress={() => {
                  setShowAll((value) => !value);
                }}
              >
                {showAll ? t('showFewer') : t('showAll', { count: patients.length })}
              </Button>
            ) : undefined
          }
          footer={t('rowHintChart')}
        >
          <DataTable
            caption={t('myPatientsTitle')}
            columns={patientColumns}
            rows={visible}
            rowKey={(row) => row.patient.id}
            rowTone={(row) => (row.flags.includes('critical') ? 'danger' : undefined)}
            onRowAction={(row) => {
              openPatient(row.patient.id, 'chart');
            }}
            emptyText={t('myPatientsEmpty')}
          />
        </Card>

        <div className="home-side">
          <Card title={t('signTitle')} subtitle={t('signSubtitle')} icon="pen" {...(conflicts > 0 ? { tone: 'danger' as const } : {})}>
            {queue.length === 0 ? (
              <EmptyState compact icon="check-circle" title={t('signEmpty')} />
            ) : (
              <ul className="home-list">
                {queue.map((item) => (
                  <SignQueueItem key={item.id} item={item} />
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t('clinicTitle', { clinic: f.text(clinic.name) })}
            subtitle={
              clinician === undefined
                ? t('clinicRoom', { room: clinic.room })
                : t.rich('clinicSubtitle', { room: <Code>{clinic.room}</Code>, name: <StaffName member={clinician} /> })
            }
            icon="stethoscope"
            flush
            footer={
              <LinkButton href={href('outpatient')} variant="ghost" size="sm" iconEnd="arrow-forward">
                {t('openOutpatients')}
              </LinkButton>
            }
          >
            <div className="home-status-row">
              {STATUS_SUMMARY.map((status) => {
                const count = appointments.filter((appointment) => appointment.status === status).length;
                return count === 0 ? null : (
                  <Badge key={status} tone={APPOINTMENT_STATUS_TONE[status]} size="sm">
                    {f.text(APPOINTMENT_STATUS_LABEL[status])}: {f.number(count)}
                  </Badge>
                );
              })}
            </div>
            <DataTable
              caption={t('clinicTitle', { clinic: f.text(clinic.name) })}
              columns={clinicColumns}
              rows={appointments}
              rowKey={(row) => row.id}
              dense
              onRowAction={(row) => {
                openPatient(row.patientId, 'chart');
              }}
              emptyText={t('clinicEmpty')}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function PatientInlineById({ id }: { readonly id: string }): ReactNode {
  const patient = findPatient(id);
  return patient === undefined ? <Code>{id}</Code> : <PatientInline patient={patient} />;
}

function SignQueueItem({ item }: { readonly item: SignItem }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const openPatient = useOpenPatient();
  const author = findStaff(item.authorId);
  const authorName = author === undefined ? <Code>{item.authorId}</Code> : <StaffName member={author} />;
  if (item.kind === 'order') {
    const medication = item.order.medication;
    return (
      <li className={item.conflict ? 'home-list__item home-list__item--danger' : 'home-list__item'}>
        <div className="home-list__main">
          <p className="home-list__title">
            {medication === null ? (
              f.text(item.order.title)
            ) : (
              <>
                <Code>{medication.drug}</Code> <Qty value={medication.dose} unit={medication.doseUnit} />
              </>
            )}
          </p>
          <p className="home-muted">{t.rich('signOrderBy', { name: authorName, time: f.time(item.iso) })}</p>
          <PatientInline patient={item.patient} />
          {item.conflict ? (
            <Badge tone="danger" strong icon="alert">
              {t('signConflict')}
            </Badge>
          ) : (
            <Badge tone="warning" icon="pen" size="sm">
              {t('signNeedsSignature')}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={item.conflict ? 'danger' : 'secondary'}
          icon="clipboard"
          onPress={() => {
            openPatient(item.patient.id, 'orders');
          }}
        >
          {t('signReviewOrder')}
        </Button>
      </li>
    );
  }
  return (
    <li className="home-list__item">
      <div className="home-list__main">
        <p className="home-list__title">{f.text(item.note.title)}</p>
        <p className="home-muted">
          {item.own
            ? t('signOwnNote', { kind: f.text(NOTE_KIND_LABEL[item.note.kind]), time: f.time(item.iso) })
            : t.rich('signNoteBy', { kind: f.text(NOTE_KIND_LABEL[item.note.kind]), name: authorName, time: f.time(item.iso) })}
        </p>
        <PatientInline patient={item.patient} />
        <Badge tone="warning" icon="pen" size="sm">
          {item.own ? t('signNeedsSignature') : t('signNeedsCosign')}
        </Badge>
      </div>
      <Button
        size="sm"
        icon="chart"
        onPress={() => {
          openPatient(item.patient.id, 'chart');
        }}
      >
        {t('signOpenNote')}
      </Button>
    </li>
  );
}
