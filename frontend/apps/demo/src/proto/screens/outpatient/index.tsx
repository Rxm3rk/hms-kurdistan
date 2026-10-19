/**
 * The outpatient screen: today's clinics (Internal medicine, Paediatrics, Cardiology, then the diabetes and
 * surgical clinics) with appointment times and status, the desk's check-in with three-part identification,
 * the waiting-room token screen (simulated) and the walk-in shortcut.
 *
 * Hospital-wide: patients are listed with two identifiers (PatientInline) and open through the window's
 * patient context. The day's changes (check-ins, calls, walk-ins) live in this screen's session store
 * (./state.ts); the shared data is never changed. `?walkin=<patient id>` (from the registration screen)
 * opens the walk-in dialog with that patient.
 */
import { Bdi, PatientIdentity } from '@hms/design-system';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TONE,
  DEMO_NOW_ISO,
  getClinic,
  getStaff,
  minutesFromNow,
  type Appointment,
  type ClinicId,
  type Patient,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo, useOpenPatient, useScreenHref, useSearchParam } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  IconButton,
  LinkButton,
  PageHeader,
  PatientInline,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { identityOf, whereToday } from '../patients/identity.ts';
import { searchPatients } from '../patients/search.ts';
import { findAnyPatient, isSessionPatient, useAllPatients, useSessionPatients } from '../patients/session.ts';
import { IdentityCheckFields, useIdentityCheck } from './identity-check.tsx';
import './outpatient.css';
import { messages } from './messages.ts';
import { QueueDisplay, TokenSlipView } from './queue-display.tsx';
import { addWalkIn, callNext, callPatient, checkIn, completeVisit, isWalkIn, recall, useOpdState, type CallEvent } from './state.ts';

/** Display order: the three main clinics first. */
const CLINIC_ORDER: readonly ClinicId[] = ['clinic-im', 'clinic-paeds', 'clinic-cardio', 'clinic-endo', 'clinic-surg'];

const SHORT_KEY = {
  'clinic-im': 'clinicIm',
  'clinic-paeds': 'clinicPaeds',
  'clinic-cardio': 'clinicCardio',
  'clinic-endo': 'clinicEndo',
  'clinic-surg': 'clinicSurg',
} as const satisfies Record<ClinicId, string>;

type Filter = 'all' | ClinicId;

type DialogState =
  | { readonly kind: 'check-in'; readonly appointmentId: string }
  | { readonly kind: 'walk-in'; readonly patientId: string | null }
  | { readonly kind: 'display' }
  | null;

function waitMinutes(appointment: Appointment): number {
  return appointment.arrivedIso === null ? 0 : Math.max(0, -minutesFromNow(appointment.arrivedIso));
}

// ---------------------------------------------------------------------------------------------------------
// Check-in dialog
// ---------------------------------------------------------------------------------------------------------

function AppointmentSummary({ appointment }: { readonly appointment: Appointment }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const clinic = getClinic(appointment.clinicId);
  return (
    <dl className="outpatient-apptsum">
      <div>
        <dt>{t('colTime')}</dt>
        <dd>
          <Bdi dir="ltr">{f.time(appointment.startIso)}</Bdi> · {t('minutes', { count: appointment.durationMin })}
        </dd>
      </div>
      <div>
        <dt>{t('clinic')}</dt>
        <dd>
          {f.text(clinic.name)} · <Bdi dir="ltr">{clinic.room}</Bdi>
        </dd>
      </div>
      <div>
        <dt>{t('clinician')}</dt>
        <dd>
          <StaffName member={getStaff(appointment.clinicianId)} />
        </dd>
      </div>
      <div>
        <dt>{t('reason')}</dt>
        <dd>
          {f.text(appointment.reason)} · {appointment.visitType === 'new' ? t('visitNew') : t('visitFollowUp')}
        </dd>
      </div>
    </dl>
  );
}

function CheckInDialog({
  appointment,
  patient,
  onClose,
  onCheckedIn,
}: {
  readonly appointment: Appointment;
  readonly patient: Patient;
  readonly onClose: () => void;
  readonly onCheckedIn: (token: string) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const check = useIdentityCheck(patient, f.locale);
  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      size="lg"
      title={t('checkInTitle')}
      subtitle={t('checkInSubtitle')}
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="ghost"
            icon="alert"
            onPress={() => {
              toast({ tone: 'warning', title: t('cannotConfirmToast'), body: t('cannotConfirmBody') });
              onClose();
            }}
          >
            {t('cannotConfirm')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!check.allMatched}
            onPress={() => {
              onCheckedIn(checkIn(appointment.id));
            }}
          >
            {t('markArrived')}
          </Button>
        </>
      }
    >
      <div className="outpatient-dialog">
        <AppointmentSummary appointment={appointment} />
        <div className="outpatient-dialog__identity">
          <p className="outpatient-dialog__label">{t('bookedPatient')}</p>
          <PatientIdentity model={identityOf(patient)} />
        </div>
        <IdentityCheckFields check={check} />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Walk-in dialog
// ---------------------------------------------------------------------------------------------------------

function WalkInDialog({
  initialPatientId,
  onClose,
  onIssued,
  onRegisterNew,
}: {
  readonly initialPatientId: string | null;
  readonly onClose: () => void;
  readonly onIssued: (token: string, clinicId: ClinicId) => void;
  readonly onRegisterNew: () => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const patients = useAllPatients();
  const session = useSessionPatients();
  const [clinicId, setClinicId] = useState<ClinicId>('clinic-im');
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  const patient = patientId === null ? null : (findAnyPatient(patientId) ?? null);
  const check = useIdentityCheck(patient, f.locale);
  const hits = query.trim() === '' ? [] : searchPatients(patients, query).slice(0, 6);
  const suggestions: readonly Patient[] = query.trim() === '' ? session.toReversed().slice(0, 4) : hits.map((hit) => hit.patient);
  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      size="lg"
      title={t('walkInTitle')}
      subtitle={t('walkInSubtitle')}
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="ghost" icon="plus" onPress={onRegisterNew}>
            {t('registerNew')}
          </Button>
          <Button
            variant="primary"
            icon="printer"
            isDisabled={patient === null || !check.allMatched}
            onPress={() => {
              if (patient !== null) {
                onIssued(addWalkIn(patient.id, clinicId), clinicId);
              }
            }}
          >
            {t('issueToken')}
          </Button>
        </>
      }
    >
      <div className="outpatient-dialog">
        <SelectField
          label={t('walkInClinic')}
          options={CLINIC_ORDER.map((id) => ({ id, label: f.text(getClinic(id).name) }))}
          selectedKey={clinicId}
          onSelectionChange={(id) => {
            const next = CLINIC_ORDER.find((candidate) => candidate === id);
            if (next !== undefined) {
              setClinicId(next);
            }
          }}
        />
        {patient === null ? (
          <div className="outpatient-walkin">
            <SearchField label={t('walkInSearch')} placeholder={t('walkInSearchPlaceholder')} value={query} onChange={setQuery} autoFocus />
            {suggestions.length === 0 ? (
              <EmptyState
                compact
                icon="search"
                title={query.trim() === '' ? t('walkInStart') : t('walkInNone')}
                body={t('walkInNoneBody')}
              />
            ) : (
              <>
                {query.trim() === '' ? <p className="outpatient-dialog__label">{t('registeredToday')}</p> : null}
                <ul className="outpatient-walkin__list">
                  {suggestions.map((candidate) => (
                    <li key={candidate.id} className="outpatient-walkin__item">
                      <PatientInline patient={candidate} secondary />
                      <Button
                        size="sm"
                        variant="secondary"
                        iconEnd="chevron-forward"
                        onPress={() => {
                          setPatientId(candidate.id);
                        }}
                        aria-label={t('selectPatient', { name: personName(candidate.name, f.locale) })}
                      >
                        {t('select')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="outpatient-dialog__identity">
              <div className="outpatient-dialog__identity-head">
                <p className="outpatient-dialog__label">{t('walkInPatient')}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="refresh"
                  onPress={() => {
                    setPatientId(null);
                  }}
                >
                  {t('changePatient')}
                </Button>
              </div>
              <PatientIdentity model={identityOf(patient)} />
            </div>
            {(() => {
              const where = whereToday(patient);
              return where.kind === 'ward' ? (
                <Callout tone="warning" title={t('walkInInpatientTitle')}>
                  {t('walkInInpatient', { ward: f.text(where.ward.name), bed: where.bedId })}
                </Callout>
              ) : null;
            })()}
            <IdentityCheckFields check={check} />
          </>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Clinic card
// ---------------------------------------------------------------------------------------------------------

interface Row {
  readonly appointment: Appointment;
  readonly patient: Patient;
}

function ClinicCard({
  clinicId,
  rows,
  onCheckIn,
  onCall,
  onComplete,
  onCallNext,
}: {
  readonly clinicId: ClinicId;
  readonly rows: readonly Row[];
  readonly onCheckIn: (appointment: Appointment) => void;
  readonly onCall: (appointment: Appointment) => void;
  readonly onComplete: (appointment: Appointment) => void;
  readonly onCallNext: (clinicId: ClinicId) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const openPatient = useOpenPatient();
  const clinic = getClinic(clinicId);
  const waiting = rows.filter((row) => row.appointment.status === 'arrived').length;
  const clinicianId = rows[0]?.appointment.clinicianId;
  const columns: readonly Column<Row>[] = [
    {
      id: 'time',
      header: t('colTime'),
      width: '6.5rem',
      cell: ({ appointment }) => (
        <span className="outpatient-time">
          <Bdi dir="ltr" className="outpatient-time__clock">
            {f.time(appointment.startIso)}
          </Bdi>
          {isWalkIn(appointment) ? (
            <Badge tone="accent" size="sm">
              {t('walkInBadge')}
            </Badge>
          ) : (
            <span className="outpatient-muted">{t('minutes', { count: appointment.durationMin })}</span>
          )}
        </span>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: ({ appointment, patient }) => (
        <span className="outpatient-patient">
          <PatientInline patient={patient} />
          <span className="outpatient-patient__reason">
            {f.text(appointment.reason)} · {appointment.visitType === 'new' ? t('visitNew') : t('visitFollowUp')}
          </span>
          {patient.allergies.kind === 'list' || patient.alerts.some((alert) => alert.text.en.startsWith('Look-alike')) ? (
            <span className="outpatient-patient__flags">
              {patient.allergies.kind === 'list' ? (
                <Badge tone="danger" icon="alert" size="sm" strong>
                  {t('allergy')}: {patient.allergies.items.map((item) => f.text(item.substance)).join(', ')}
                </Badge>
              ) : null}
              {patient.alerts.some((alert) => alert.text.en.startsWith('Look-alike')) ? (
                <Badge tone="warning" icon="users" size="sm">
                  {t('lookAlike')}
                </Badge>
              ) : null}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      width: '10rem',
      cell: ({ appointment }) => (
        <span className="outpatient-status">
          <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]} strong={appointment.status === 'in-consultation'}>
            {f.text(APPOINTMENT_STATUS_LABEL[appointment.status])}
          </Badge>
          {appointment.status === 'arrived' && appointment.arrivedIso !== null ? (
            <span className={waitMinutes(appointment) > 30 ? 'outpatient-wait outpatient-wait--long' : 'outpatient-wait'}>
              {t('waitingSince', { time: f.time(appointment.arrivedIso), count: waitMinutes(appointment) })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'token',
      header: t('colToken'),
      width: '5.5rem',
      align: 'center',
      cell: ({ appointment }) =>
        appointment.queueNumber === null ? (
          <span className="outpatient-muted" aria-label={t('noToken')}>
            —
          </span>
        ) : (
          <Bdi dir="ltr" className="outpatient-token">
            {appointment.queueNumber}
          </Bdi>
        ),
    },
    {
      id: 'actions',
      header: <span className="hms-visually-hidden">{t('colActions')}</span>,
      align: 'end',
      width: '12rem',
      cell: ({ appointment, patient }) => (
        <span className="outpatient-actions">
          {appointment.status === 'booked' ? (
            <Button
              size="sm"
              variant="primary"
              icon="check"
              onPress={() => {
                onCheckIn(appointment);
              }}
            >
              {t('checkIn')}
            </Button>
          ) : appointment.status === 'arrived' ? (
            <Button
              size="sm"
              variant="secondary"
              icon="bell"
              onPress={() => {
                onCall(appointment);
              }}
            >
              {t('callToRoom')}
            </Button>
          ) : appointment.status === 'in-consultation' ? (
            <Button
              size="sm"
              variant="ghost"
              icon="check-circle"
              onPress={() => {
                onComplete(appointment);
              }}
            >
              {t('completeVisit')}
            </Button>
          ) : null}
          {isSessionPatient(patient.id) ? null : (
            <IconButton
              icon="chart"
              size="sm"
              label={t('openRecordOf', { name: personName(patient.name, f.locale) })}
              onPress={() => {
                openPatient(patient.id, 'chart');
              }}
            />
          )}
        </span>
      ),
    },
  ];
  return (
    <Card
      title={f.text(clinic.name)}
      icon="stethoscope"
      className="outpatient-clinic"
      subtitle={
        <span className="outpatient-clinic__sub">
          <span>
            {t('room')} <Bdi dir="ltr">{clinic.room}</Bdi>
          </span>
          {clinicianId === undefined ? null : (
            <>
              <span aria-hidden="true">·</span>
              <StaffName member={getStaff(clinicianId)} />
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{t('appointmentsCount', { count: rows.length })}</span>
        </span>
      }
      actions={
        <span className="outpatient-clinic__actions">
          <Badge tone={waiting > 0 ? 'warning' : 'neutral'} icon="clock">
            {t('waitingCount', { count: waiting })}
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            icon="bell"
            isDisabled={waiting === 0}
            onPress={() => {
              onCallNext(clinicId);
            }}
          >
            {t('callNext')}
          </Button>
        </span>
      }
      flush
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.appointment.id}
        caption={t('tableCaption', { clinic: f.text(clinic.name) })}
        rowTone={({ appointment }) => (appointment.status === 'arrived' && waitMinutes(appointment) > 30 ? 'warning' : appointment.status === 'in-consultation' ? 'info' : undefined)}
        emptyText={t('noAppointments')}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------------------------------------

export function OutpatientScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const href = useScreenHref();
  const goTo = useGoTo();
  const opd = useOpdState();
  useSessionPatients();
  const walkInParam = useSearchParam('walkin');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [announcement, setAnnouncement] = useState('');
  const handledWalkIn = useRef<string | null>(null);
  const pendingRegister = useRef(false);

  // A patient just registered for a walk-in (?walkin=<id>): open the walk-in dialog with them, once.
  useEffect(() => {
    if (walkInParam !== undefined && walkInParam !== handledWalkIn.current && findAnyPatient(walkInParam) !== undefined) {
      handledWalkIn.current = walkInParam;
      setDialog({ kind: 'walk-in', patientId: walkInParam });
    }
  }, [walkInParam]);

  // Go to registration only after the walk-in dialog has released the window's dialog slot.
  useEffect(() => {
    if (dialog === null && pendingRegister.current) {
      pendingRegister.current = false;
      goTo('patients', { mode: 'register', from: 'walk-in' });
    }
  }, [dialog, goTo]);

  const rows: Row[] = opd.appointments.flatMap((appointment) => {
    const patient = findAnyPatient(appointment.patientId);
    return patient === undefined ? [] : [{ appointment, patient }];
  });
  const active = rows.filter((row) => row.appointment.status !== 'cancelled');
  const count = (status: Appointment['status']): number => rows.filter((row) => row.appointment.status === status).length;
  const waitingRows = rows.filter((row) => row.appointment.status === 'arrived');
  const longestWait = waitingRows.reduce((max, row) => Math.max(max, waitMinutes(row.appointment)), 0);
  const clinicsShown = filter === 'all' ? CLINIC_ORDER : [filter];

  const announceCall = (event: CallEvent | null): void => {
    if (event === null) {
      return;
    }
    const clinic = getClinic(event.clinicId);
    const text = t('calledAnnouncement', { token: event.token, room: clinic.room });
    setAnnouncement(text);
    toast({ tone: 'info', title: text, body: t('calledBody') });
  };

  const dialogAppointment = dialog?.kind === 'check-in' ? opd.appointments.find((appointment) => appointment.id === dialog.appointmentId) : undefined;
  const dialogPatient = dialogAppointment === undefined ? undefined : findAnyPatient(dialogAppointment.patientId);

  return (
    <div className="outpatient-screen">
      <PageHeader
        icon="stethoscope"
        eyebrow={f.date(DEMO_NOW_ISO, 'long')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button
              variant="secondary"
              icon="building"
              onPress={() => {
                setDialog({ kind: 'display' });
              }}
            >
              {t('openDisplay')}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setDialog({ kind: 'walk-in', patientId: null });
              }}
            >
              {t('walkInButton')}
            </Button>
          </>
        }
      />

      <div className="outpatient-stats">
        <StatTile label={t('statBooked')} value={active.length} icon="calendar" hint={t('statBookedHint', { count: count('booked') })} />
        <StatTile
          label={t('statWaiting')}
          value={waitingRows.length}
          icon="clock"
          tone={longestWait > 30 ? 'warning' : 'neutral'}
          hint={waitingRows.length === 0 ? t('statWaitingNone') : t('statLongest', { count: longestWait })}
        />
        <StatTile label={t('statInConsultation')} value={count('in-consultation')} icon="stethoscope" tone="accent" />
        <StatTile label={t('statCompleted')} value={count('completed')} icon="check-circle" tone="success" />
        <StatTile label={t('statNoShow')} value={count('no-show')} icon="x" tone={count('no-show') > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="outpatient-top">
        <section className="outpatient-screenblock" aria-label={t('displayTitle')}>
          <div className="outpatient-screenblock__head">
            <h2 className="outpatient-screenblock__title">{t('displayTitle')}</h2>
            <Badge tone="neutral" size="sm">
              {t('simulated')}
            </Badge>
          </div>
          <QueueDisplay state={opd} label={t('displayRegion')} />
          <div className="outpatient-screenblock__controls">
            <Button
              size="sm"
              variant="secondary"
              icon="refresh"
              isDisabled={opd.calls.length === 0}
              onPress={() => {
                announceCall(recall());
              }}
            >
              {t('recall')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="building"
              onPress={() => {
                setDialog({ kind: 'display' });
              }}
            >
              {t('fullScreen')}
            </Button>
          </div>
          <p className="outpatient-hint">{t('displayHint')}</p>
        </section>
        <div className="outpatient-top__side">
          <Card title={t('slipTitle')} icon="printer" headingLevel={2} subtitle={t('slipSubtitle')}>
            {opd.lastSlip === null ? (
              <EmptyState compact icon="printer" title={t('slipNone')} body={t('slipNoneBody')} />
            ) : (
              <TokenSlipView
                token={opd.lastSlip.token}
                clinicId={opd.lastSlip.clinicId}
                iso={opd.lastSlip.iso}
                walkIn={opd.lastSlip.walkIn}
                label={t('slipTitle')}
              />
            )}
          </Card>

          <Card title={t('walkInCardTitle')} icon="plus" headingLevel={2}>
            <p className="outpatient-card-text">{t('walkInCardBody')}</p>
            <div className="outpatient-screenblock__controls">
              <Button
                variant="primary"
                icon="search"
                onPress={() => {
                  setDialog({ kind: 'walk-in', patientId: null });
                }}
              >
                {t('walkInFind')}
              </Button>
              <LinkButton href={href('patients', { mode: 'register', from: 'walk-in' })} variant="secondary" icon="plus">
                {t('registerNew')}
              </LinkButton>
            </div>
          </Card>
        </div>
      </div>

      <div className="outpatient-main">
        <Segmented
          label={t('filterLabel')}
          value={filter}
          onChange={(value) => {
            setFilter(CLINIC_ORDER.find((id) => id === value) ?? 'all');
          }}
          options={[{ id: 'all', label: t('filterAll') }, ...CLINIC_ORDER.map((id) => ({ id, label: t(SHORT_KEY[id]) }))]}
        />
        {clinicsShown.map((clinicId) => (
          <ClinicCard
            key={clinicId}
            clinicId={clinicId}
            rows={rows.filter((row) => row.appointment.clinicId === clinicId).toSorted((a, b) => a.appointment.startIso.localeCompare(b.appointment.startIso) || a.appointment.id.localeCompare(b.appointment.id))}
            onCheckIn={(appointment) => {
              setDialog({ kind: 'check-in', appointmentId: appointment.id });
            }}
            onCall={(appointment) => {
              announceCall(callPatient(appointment.id));
            }}
            onComplete={(appointment) => {
              completeVisit(appointment.id);
              toast({ tone: 'success', title: t('completedToast', { token: appointment.queueNumber ?? '' }) });
            }}
            onCallNext={(clinicId) => {
              announceCall(callNext(clinicId));
            }}
          />
        ))}
      </div>

      <p className="hms-visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {dialog?.kind === 'check-in' && dialogAppointment !== undefined && dialogPatient !== undefined ? (
        <CheckInDialog
          key={dialogAppointment.id}
          appointment={dialogAppointment}
          patient={dialogPatient}
          onClose={() => {
            setDialog(null);
          }}
          onCheckedIn={(token) => {
            setDialog(null);
            const room = getClinic(dialogAppointment.clinicId).room;
            setAnnouncement(t('checkedInToast', { token, room }));
            toast({ tone: 'success', title: t('checkedInToast', { token, room }), body: t('checkedInBody') });
          }}
        />
      ) : null}

      {dialog?.kind === 'walk-in' ? (
        <WalkInDialog
          key={dialog.patientId ?? 'search'}
          initialPatientId={dialog.patientId}
          onClose={() => {
            setDialog(null);
          }}
          onIssued={(token, clinicId) => {
            setDialog(null);
            const room = getClinic(clinicId).room;
            setAnnouncement(t('checkedInToast', { token, room }));
            toast({ tone: 'success', title: t('walkInToast', { token, room }), body: t('checkedInBody') });
          }}
          onRegisterNew={() => {
            pendingRegister.current = true;
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === 'display' ? (
        <Dialog
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setDialog(null);
            }
          }}
          size="lg"
          title={t('displayTitle')}
          subtitle={t('displayDialogSubtitle')}
          actions={
            <>
              <Button
                variant="secondary"
                onPress={() => {
                  setDialog(null);
                }}
              >
                {t('close')}
              </Button>
              <Button
                variant="primary"
                icon="refresh"
                isDisabled={opd.calls.length === 0}
                onPress={() => {
                  announceCall(recall());
                }}
              >
                {t('recall')}
              </Button>
            </>
          }
        >
          <QueueDisplay state={opd} large label={t('displayRegion')} />
        </Dialog>
      ) : null}

    </div>
  );
}
