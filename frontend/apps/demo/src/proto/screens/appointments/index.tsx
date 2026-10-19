/**
 * The Appointments & queue screen (hospital-wide): a week strip (Saturday to Thursday, Friday the weekend),
 * the clinic calendar grid, the day list, today's token queues with the waiting-room display, and the
 * no-show register. Booking, check-in, calling and no-show marking work in memory.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TONE,
  DEMO_TODAY,
  getPayer,
  iqdToUsd,
  isKnownPatient,
} from '../../data/index.ts';
import type { AppointmentStatus } from '../../data/index.ts';
import {
  APPT_CLINICS,
  APPT_ROWS,
  apptClinic,
  CHANNEL_LABEL,
  FOLLOW_UP_LABEL,
  NO_SHOWS,
  nextTokenNumber,
  slotsOf,
  WEEK_DAYS,
  weekdayOf,
  type ApptRow,
  type NoShowRecord,
} from '../../data/ext/appointments.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  BarChart,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Dialog,
  EmptyState,
  Grid,
  KeyValueList,
  PageHeader,
  PatientInline,
  PatientName,
  SearchField,
  Segmented,
  SelectField,
  StatTile,
  Tabs,
  Toolbar,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import './appointments.css';
import { BookingDialog, type BookingDraft } from './booking-dialog.tsx';
import { messages } from './messages.ts';
import { fromMinutes, minutesBetween, NOW_HHMM, toMinutes } from './shared.ts';

type StatusFilter = 'all' | 'waiting' | 'booked' | 'done' | 'missed';
type TabId = 'calendar' | 'list' | 'queue' | 'noshow';

const FILTER_OF: Readonly<Record<StatusFilter, readonly AppointmentStatus[]>> = {
  all: ['booked', 'arrived', 'in-consultation', 'completed', 'no-show', 'cancelled'],
  waiting: ['arrived', 'in-consultation'],
  booked: ['booked'],
  done: ['completed'],
  missed: ['no-show', 'cancelled'],
};

export function AppointmentsScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [rows, setRows] = useState<readonly ApptRow[]>(APPT_ROWS);
  const [noShows, setNoShows] = useState<readonly NoShowRecord[]>(NO_SHOWS);
  const [day, setDay] = useState(DEMO_TODAY);
  const [clinicFilter, setClinicFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tab, setTab] = useState<TabId>('calendar');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDraft | null>(null);

  const name = (row: { readonly patient: ApptRow['patient'] }): string => personName(row.patient.name, f.locale);
  const update = (id: string, patch: Partial<ApptRow>): void => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  // ---- derived -------------------------------------------------------------------------------------
  const today = rows.filter((row) => row.date === DEMO_TODAY);
  const waitingNow = today.filter((row) => row.status === 'arrived');
  const longestWait = waitingNow.reduce((max, row) => Math.max(max, minutesBetween(row.arrivedAt ?? NOW_HHMM, NOW_HHMM)), 0);
  const seen = today.filter((row) => row.status === 'completed').length;
  const inRoom = today.filter((row) => row.status === 'in-consultation').length;
  const noShowToday = today.filter((row) => row.status === 'no-show').length;
  const pastRows = rows.filter((row) => row.date <= DEMO_TODAY && row.status !== 'booked' && row.status !== 'cancelled');
  const noShowRate = pastRows.length === 0 ? 0 : (pastRows.filter((row) => row.status === 'no-show').length + 6) / (pastRows.length + 60);
  const nextSlot = useMemo(() => {
    let best: { time: string; clinic: string } | null = null;
    for (const clinic of APPT_CLINICS) {
      if (!clinic.days.includes(weekdayOf(DEMO_TODAY))) {
        continue;
      }
      const taken = new Set(rows.filter((r) => r.clinicId === clinic.id && r.date === DEMO_TODAY && r.status !== 'cancelled').map((r) => r.time));
      const free = slotsOf(clinic).find((time) => time >= NOW_HHMM && !taken.has(time));
      if (free !== undefined && (best === null || free < best.time)) {
        best = { time: free, clinic: clinic.id };
      }
    }
    return best;
  }, [rows]);

  const isFriday = weekdayOf(day) === 5;
  const clinicsOfDay = APPT_CLINICS.filter((clinic) => clinic.days.includes(weekdayOf(day)) && (clinicFilter === 'all' || clinic.id === clinicFilter));
  const q = search.trim().toLowerCase();
  const dayRows = rows.filter(
    (row) =>
      row.date === day &&
      (clinicFilter === 'all' || row.clinicId === clinicFilter) &&
      (q === '' || [row.patient.name.latin, row.patient.name.ckb, row.patient.name.ar, row.patient.mrn, row.token ?? ''].some((v) => v.toLowerCase().includes(q))),
  );
  const listRows = dayRows.filter((row) => FILTER_OF[statusFilter].includes(row.status));
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const priorNoShows = (patientId: string): number =>
    Math.max(0, ...rows.filter((r) => r.patient.id === patientId).map((r) => r.priorNoShows), noShows.filter((n) => n.patient.id === patientId).length);

  // ---- actions -------------------------------------------------------------------------------------
  const checkIn = (row: ApptRow): void => {
    const token = nextTokenNumber(row.clinicId, rows);
    update(row.id, { status: 'arrived', arrivedAt: NOW_HHMM, token });
    toast({ tone: 'success', title: t('checkedInToast', { name: name(row), token }) });
  };
  const callIn = (row: ApptRow): void => {
    setRows((current) =>
      current.map((r) => {
        if (r.id === row.id) {
          return { ...r, status: 'in-consultation' };
        }
        return r.clinicId === row.clinicId && r.date === DEMO_TODAY && r.status === 'in-consultation' ? { ...r, status: 'completed' } : r;
      }),
    );
    toast({ tone: 'info', title: t('calledInToast', { name: name(row), room: apptClinic(row.clinicId).room }) });
  };
  const callNext = (clinicId: string): void => {
    const next = rows
      .filter((r) => r.clinicId === clinicId && r.date === DEMO_TODAY && r.status === 'arrived')
      .toSorted((a, b) => (a.token ?? '').localeCompare(b.token ?? ''))[0];
    setRows((current) =>
      current.map((r) => {
        if (next !== undefined && r.id === next.id) {
          return { ...r, status: 'in-consultation' };
        }
        return r.clinicId === clinicId && r.date === DEMO_TODAY && r.status === 'in-consultation' ? { ...r, status: 'completed' } : r;
      }),
    );
    if (next !== undefined) {
      toast({ tone: 'info', title: t('calledToast', { token: next.token ?? '', room: apptClinic(clinicId).room }) });
    }
  };
  const markNoShow = (row: ApptRow): void => {
    update(row.id, { status: 'no-show' });
    setNoShows((current) => [
      { id: `NS-${row.id}`, patient: row.patient, clinicId: row.clinicId, date: row.date, time: row.time, priorNoShows: row.priorNoShows, followUp: 'not-contacted' },
      ...current,
    ]);
    toast({ tone: 'warning', title: t('noShowToast', { name: name(row) }) });
  };

  // ---- columns -------------------------------------------------------------------------------------
  const statusBadge = (status: AppointmentStatus): ReactNode => (
    <Badge tone={APPOINTMENT_STATUS_TONE[status]} size="sm">
      {f.text(APPOINTMENT_STATUS_LABEL[status])}
    </Badge>
  );
  const listColumns: readonly Column<ApptRow>[] = [
    { id: 'time', header: t('colTime'), cell: (row) => <Code>{row.time}</Code>, nowrap: true, width: '5rem' },
    { id: 'token', header: t('colToken'), cell: (row) => (row.token === null ? '–' : <Code className="appointments-token-chip">{row.token}</Code>), nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={row.patient} /> },
    {
      id: 'clinic',
      header: t('colClinic'),
      cell: (row) => (
        <span className="appointments-cell-stack">
          <span>{f.text(apptClinic(row.clinicId).name)}</span>
          <span className="appointments-muted">{personName(apptClinic(row.clinicId).clinician, f.locale)}</span>
        </span>
      ),
    },
    {
      id: 'type',
      header: t('colType'),
      cell: (row) => (
        <Badge tone={row.visitType === 'new' ? 'accent' : 'neutral'} size="sm">
          {row.visitType === 'new' ? t('visitNew') : t('visitFollowUp')}
        </Badge>
      ),
    },
    { id: 'reason', header: t('colReason'), cell: (row) => f.text(row.reason) },
    { id: 'channel', header: t('colChannel'), cell: (row) => f.text(CHANNEL_LABEL[row.channel]) },
    { id: 'status', header: t('colStatus'), cell: (row) => statusBadge(row.status) },
  ];

  const noShowColumns: readonly Column<NoShowRecord>[] = [
    { id: 'date', header: t('colDate'), cell: (row) => `${f.date(row.date)} · ${row.time}`, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={row.patient} /> },
    { id: 'clinic', header: t('colClinic'), cell: (row) => f.text(apptClinic(row.clinicId).name) },
    {
      id: 'prior',
      header: t('colPrior'),
      align: 'end',
      cell: (row) => (
        <span className="appointments-prior">
          {f.number(row.priorNoShows)}
          {row.priorNoShows >= 2 ? (
            <Badge tone="danger" size="sm" icon="alert">
              {t('frequent')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'follow',
      header: t('colFollowUp'),
      cell: (row) => (
        <Badge tone={row.followUp === 'rebooked' ? 'success' : row.followUp === 'not-contacted' ? 'warning' : 'info'} size="sm">
          {f.text(FOLLOW_UP_LABEL[row.followUp])}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('colActions'),
      cell: (row) => (
        <span className="appointments-actions">
          <Button
            size="sm"
            variant="ghost"
            icon="phone"
            isDisabled={row.followUp === 'rebooked'}
            onPress={() => {
              setNoShows((current) => current.map((n) => (n.id === row.id ? { ...n, followUp: 'sms-sent' } : n)));
              toast({ tone: 'success', title: t('smsToast', { name: name(row) }) });
            }}
          >
            {t('sendSms')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="calendar"
            isDisabled={row.followUp === 'rebooked'}
            onPress={() => {
              setNoShows((current) => current.map((n) => (n.id === row.id ? { ...n, followUp: 'rebooked' } : n)));
              setBooking({ patient: row.patient, clinicId: row.clinicId, date: DEMO_TODAY });
            }}
          >
            {t('rebook')}
          </Button>
        </span>
      ),
    },
  ];

  // ---- views ---------------------------------------------------------------------------------------
  const fridayState = <EmptyState icon="calendar" title={t('fridayTitle')} body={t('fridayBody')} />;
  const noClinics = <EmptyState icon="calendar" title={t('noClinicsTitle')} body={t('noClinicsBody')} compact />;

  const calendar = (() => {
    if (isFriday) {
      return fridayState;
    }
    if (clinicsOfDay.length === 0) {
      return noClinics;
    }
    const start = Math.min(...clinicsOfDay.map((c) => toMinutes(c.start)));
    const end = Math.max(...clinicsOfDay.map((c) => toMinutes(c.end)));
    const times: string[] = [];
    for (let m = start - (start % 15); m < end; m += 15) {
      times.push(fromMinutes(m));
    }
    return (
      <div className="appointments-calendar-wrap">
        <div
          className="appointments-calendar"
          role="table"
          aria-label={t('calendarCaption', { date: f.date(day, 'long') })}
          style={{ gridTemplateColumns: `4.5rem repeat(${String(clinicsOfDay.length)}, minmax(11rem, 1fr))` }}
        >
          <div role="row" className="appointments-calendar__row">
            <div role="columnheader" className="appointments-calendar__corner">
              {t('colTime')}
            </div>
            {clinicsOfDay.map((clinic) => (
              <div role="columnheader" key={clinic.id} className="appointments-calendar__head">
                <span className="appointments-calendar__clinic">{f.text(clinic.name)}</span>
                <span className="appointments-muted">
                  {clinic.room} · {personName(clinic.clinician, f.locale)}
                </span>
              </div>
            ))}
          </div>
          {times.map((time) => (
            <div role="row" key={time} className="appointments-calendar__row">
              <div role="rowheader" className={time === NOW_HHMM && day === DEMO_TODAY ? 'appointments-calendar__time appointments-calendar__time--now' : 'appointments-calendar__time'}>
                <Code>{time}</Code>
              </div>
              {clinicsOfDay.map((clinic) => {
                const inSession = slotsOf(clinic).includes(time);
                const row = dayRows.find((r) => r.clinicId === clinic.id && r.time === time && r.status !== 'cancelled');
                if (!inSession) {
                  return <div role="cell" key={clinic.id} className="appointments-calendar__cell appointments-calendar__cell--off" />;
                }
                if (row === undefined) {
                  const past = day < DEMO_TODAY || (day === DEMO_TODAY && time < NOW_HHMM);
                  return (
                    <div role="cell" key={clinic.id} className="appointments-calendar__cell">
                      {past ? null : (
                        <button
                          type="button"
                          className="appointments-free"
                          aria-label={t('bookSlot', { time, clinic: f.text(clinic.name) })}
                          onClick={() => {
                            setBooking({ patient: null, clinicId: clinic.id, date: day });
                          }}
                        >
                          + {t('free')}
                        </button>
                      )}
                    </div>
                  );
                }
                return (
                  <div role="cell" key={clinic.id} className="appointments-calendar__cell">
                    <button
                      type="button"
                      className={`appointments-booking-chip appointments-booking-chip--${row.status}`}
                      onClick={() => {
                        setSelectedId(row.id);
                      }}
                    >
                      <PatientName patient={row.patient} />
                      <span className="appointments-booking-chip__meta">
                        {row.token === null ? '' : `${row.token} · `}
                        {f.text(APPOINTMENT_STATUS_LABEL[row.status])}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  })();

  const list = isFriday ? (
    fridayState
  ) : (
    <div className="appointments-stack">
      <Toolbar>
        <Segmented
          label={t('statusFilter')}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter((['all', 'waiting', 'booked', 'done', 'missed'] as const).find((s) => s === id) ?? 'all');
          }}
          options={[
            { id: 'all', label: t('fAll') },
            { id: 'waiting', label: t('fWaiting') },
            { id: 'booked', label: t('fBooked') },
            { id: 'done', label: t('fDone') },
            { id: 'missed', label: t('fMissed') },
          ]}
        />
      </Toolbar>
      <DataTable
        caption={t('listCaption', { date: f.date(day, 'long') })}
        columns={listColumns}
        rows={listRows}
        rowKey={(row) => row.id}
        onRowAction={(row) => {
          setSelectedId(row.id);
        }}
        rowTone={(row) => (row.status === 'no-show' ? 'warning' : row.status === 'arrived' && minutesBetween(row.arrivedAt ?? NOW_HHMM, NOW_HHMM) > 25 ? 'warning' : undefined)}
        selectedKey={selectedId}
        emptyText={t('emptyList')}
        dense
      />
    </div>
  );

  const todaysClinics = APPT_CLINICS.filter((clinic) => clinic.days.includes(weekdayOf(DEMO_TODAY)) && (clinicFilter === 'all' || clinic.id === clinicFilter));
  const queue =
    day !== DEMO_TODAY ? (
      <EmptyState icon="clock" title={t('queueOnlyToday')} body={t('queueOnlyTodayBody')} />
    ) : (
      <div className="appointments-queue-layout">
        <Grid min="19rem">
          {todaysClinics.map((clinic) => {
            const current = today.find((r) => r.clinicId === clinic.id && r.status === 'in-consultation');
            const waiting = today.filter((r) => r.clinicId === clinic.id && r.status === 'arrived').toSorted((a, b) => (a.token ?? '').localeCompare(b.token ?? ''));
            return (
              <Card
                key={clinic.id}
                title={f.text(clinic.name)}
                subtitle={`${clinic.room} · ${personName(clinic.clinician, f.locale)}`}
                icon="users"
                headingLevel={3}
                actions={<Badge tone={waiting.length > 0 ? 'info' : 'neutral'}>{t('waitingCount', { count: waiting.length })}</Badge>}
                footer={
                  <span className="appointments-actions">
                    <Button
                      size="sm"
                      variant="primary"
                      icon="bell"
                      isDisabled={waiting.length === 0}
                      onPress={() => {
                        callNext(clinic.id);
                      }}
                    >
                      {t('callNext')}
                    </Button>
                    {current === undefined ? null : (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="check"
                        onPress={() => {
                          update(current.id, { status: 'completed' });
                          toast({ tone: 'success', title: t('completedToast', { name: name(current) }) });
                        }}
                      >
                        {t('finishCurrent')}
                      </Button>
                    )}
                  </span>
                }
              >
                <div className="appointments-serving">
                  <span className="appointments-serving__label">{t('nowServing')}</span>
                  {current === undefined ? (
                    <span className="appointments-muted">{t('nobodyServing')}</span>
                  ) : (
                    <button
                      type="button"
                      className="appointments-serving__now"
                      onClick={() => {
                        setSelectedId(current.id);
                      }}
                    >
                      <Code className="appointments-serving__token">{current.token ?? '–'}</Code>
                      <PatientName patient={current.patient} />
                    </button>
                  )}
                </div>
                {waiting.length === 0 ? (
                  <p className="appointments-muted">{t('noOneWaiting')}</p>
                ) : (
                  <ol className="appointments-waitlist">
                    {waiting.map((r) => {
                      const mins = minutesBetween(r.arrivedAt ?? NOW_HHMM, NOW_HHMM);
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="appointments-waitlist__item"
                            onClick={() => {
                              setSelectedId(r.id);
                            }}
                          >
                            <Code className="appointments-token-chip">{r.token ?? '–'}</Code>
                            <PatientName patient={r.patient} />
                            <span className="appointments-muted">{t('arrivedAt', { time: r.arrivedAt ?? '' })}</span>
                            <Badge tone={mins > 25 ? 'warning' : 'neutral'} size="sm" icon="clock">
                              {t('waited', { min: mins })}
                            </Badge>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            );
          })}
        </Grid>
        <Card title={t('displayTitle')} subtitle={t('displaySubtitle')} icon="activity" className="appointments-display-card">
          <div className="appointments-display" aria-live="polite">
            {todaysClinics.map((clinic) => {
              const current = today.find((r) => r.clinicId === clinic.id && r.status === 'in-consultation');
              const next = today
                .filter((r) => r.clinicId === clinic.id && r.status === 'arrived')
                .toSorted((a, b) => (a.token ?? '').localeCompare(b.token ?? ''))[0];
              return (
                <div key={clinic.id} className="appointments-display__row">
                  <span className="appointments-display__room">
                    {t('displayRoom')} {clinic.room}
                  </span>
                  <span className="appointments-display__token">{current?.token ?? '—'}</span>
                  <span className="appointments-display__next">
                    {t('displayNext')}: {next?.token ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );

  const rateByClinic = APPT_CLINICS.map((clinic) => {
    const done = rows.filter((r) => r.clinicId === clinic.id && r.date <= DEMO_TODAY && (r.status === 'completed' || r.status === 'no-show'));
    const missed = done.filter((r) => r.status === 'no-show').length + noShows.filter((n) => n.clinicId === clinic.id && n.date < WEEK_DAYS[0]!).length;
    const rate = done.length === 0 ? 0 : missed / (done.length + missed);
    return { id: clinic.id, label: f.text(clinic.name), value: Math.round(rate * 100), valueLabel: f.percent(rate), tone: rate > 0.15 ? ('warning' as const) : undefined };
  });

  const noShowView = (
    <div className="appointments-noshow">
      <Card title={t('noShowRateTitle')} icon="chart">
        <BarChart label={t('noShowRateTitle')} data={rateByClinic.map(({ tone, ...rest }) => (tone === undefined ? rest : { ...rest, tone }))} max={40} />
        <Callout tone="info">{t('noShowPolicy')}</Callout>
      </Card>
      <DataTable
        caption={t('noShowCaption')}
        showCaption
        columns={noShowColumns}
        rows={noShows.filter((n) => (clinicFilter === 'all' || n.clinicId === clinicFilter) && (q === '' || n.patient.name.latin.toLowerCase().includes(q) || n.patient.mrn.toLowerCase().includes(q)))}
        rowKey={(row) => row.id}
        rowTone={(row) => (row.priorNoShows >= 2 && row.followUp === 'not-contacted' ? 'warning' : undefined)}
        emptyText={t('noShowsEmpty')}
        dense
      />
    </div>
  );

  // ---- detail dialog -------------------------------------------------------------------------------
  const detail = selected === null ? null : (() => {
    const clinic = apptClinic(selected.clinicId);
    const fee = selected.visitType === 'new' ? clinic.feeNewIqd : clinic.feeFollowUpIqd;
    const close = (): void => {
      setSelectedId(null);
    };
    const act = (fn: (row: ApptRow) => void) => (): void => {
      fn(selected);
      close();
    };
    const isToday = selected.date === DEMO_TODAY;
    return (
      <Dialog
        isOpen
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        size="lg"
        title={t('detailTitle', { id: selected.id })}
        subtitle={`${f.text(clinic.name)} · ${f.date(selected.date, 'long')} · ${selected.time}`}
        actions={
          <>
            <Button variant="ghost" onPress={close}>
              {t('close')}
            </Button>
            {isKnownPatient(selected.patient.id) ? (
              <Button
                variant="secondary"
                icon="chart"
                onPress={() => {
                  close();
                  goTo('chart', { patient: selected.patient.id });
                }}
              >
                {t('openChart')}
              </Button>
            ) : null}
            {selected.status === 'booked' ? (
              <>
                <Button
                  variant="danger"
                  onPress={act((row) => {
                    update(row.id, { status: 'cancelled' });
                    toast({ tone: 'info', title: t('cancelledToast') });
                  })}
                >
                  {t('cancelBooking')}
                </Button>
                {isToday && selected.time < NOW_HHMM ? (
                  <Button variant="secondary" onPress={act(markNoShow)}>
                    {t('markNoShow')}
                  </Button>
                ) : null}
                {isToday ? (
                  <Button variant="primary" icon="check" onPress={act(checkIn)}>
                    {t('checkIn')}
                  </Button>
                ) : null}
              </>
            ) : null}
            {selected.status === 'arrived' ? (
              <Button variant="primary" icon="bell" onPress={act(callIn)}>
                {t('callIn')}
              </Button>
            ) : null}
            {selected.status === 'in-consultation' ? (
              <Button
                variant="primary"
                icon="check"
                onPress={act((row) => {
                  update(row.id, { status: 'completed' });
                  toast({ tone: 'success', title: t('completedToast', { name: name(row) }) });
                })}
              >
                {t('complete')}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="appointments-detail">
          <div className="appointments-detail__head">
            <PatientInline patient={selected.patient} secondary />
            {statusBadge(selected.status)}
          </div>
          {selected.priorNoShows >= 2 ? <Callout tone="warning">{t('noShowWarning', { count: selected.priorNoShows })}</Callout> : null}
          <KeyValueList
            columns={2}
            items={[
              { id: 'clinic', label: t('fClinic'), value: `${f.text(clinic.name)} · ${clinic.room}` },
              { id: 'clinician', label: t('fClinician'), value: personName(clinic.clinician, f.locale) },
              { id: 'when', label: t('fWhen'), value: `${f.date(selected.date, 'long')} · ${selected.time} (${f.number(selected.durationMin)}′)` },
              { id: 'type', label: t('fType'), value: selected.visitType === 'new' ? t('visitNew') : t('visitFollowUp') },
              { id: 'reason', label: t('fReason'), value: f.text(selected.reason) },
              { id: 'channel', label: t('fChannel'), value: f.text(CHANNEL_LABEL[selected.channel]) },
              { id: 'payer', label: t('fPayer'), value: f.text(getPayer(selected.payerId).name) },
              { id: 'fee', label: t('fFee'), value: t('feeLine', { iqd: f.iqd(fee), usd: f.usd(iqdToUsd(fee)) }) },
              { id: 'token', label: t('fToken'), value: selected.token === null ? '–' : <Code>{selected.token}</Code> },
              { id: 'arrived', label: t('fArrived'), value: selected.arrivedAt ?? t('notArrived') },
              { id: 'prior', label: t('fPrior'), value: f.number(selected.priorNoShows) },
            ]}
          />
        </div>
      </Dialog>
    );
  })();

  return (
    <div className="appointments-screen">
      <PageHeader
        icon="calendar"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button
              icon="printer"
              onPress={() => {
                toast({ tone: 'info', title: t('printToast') });
              }}
            >
              {t('printList')}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setSelectedId(null);
                setBooking({ patient: null, clinicId: clinicFilter === 'all' ? 'clinic-im' : clinicFilter, date: day });
              }}
            >
              {t('newBooking')}
            </Button>
          </>
        }
      />

      <div className="appointments-kpis">
        <StatTile label={t('kpiBooked')} icon="calendar" value={f.number(today.filter((r) => r.status !== 'cancelled').length)} hint={t('kpiBookedHint', { count: today.filter((r) => r.status === 'cancelled').length })} />
        <StatTile
          label={t('kpiWaiting')}
          icon="users"
          tone={longestWait > 25 ? 'warning' : 'info'}
          value={f.number(waitingNow.length)}
          hint={t('kpiWaitingHint', { min: longestWait })}
          onPress={() => {
            setDay(DEMO_TODAY);
            setTab('queue');
          }}
        />
        <StatTile label={t('kpiSeen')} icon="check-circle" tone="success" value={f.number(seen)} hint={t('kpiSeenHint', { count: inRoom })} />
        <StatTile
          label={t('kpiNoShow')}
          icon="alert"
          tone={noShowToday > 0 ? 'warning' : undefined}
          value={f.number(noShowToday)}
          hint={t('kpiNoShowHint', { rate: f.percent(noShowRate) })}
          onPress={() => {
            setTab('noshow');
          }}
        />
        <StatTile
          label={t('kpiNextSlot')}
          icon="clock"
          value={nextSlot === null ? t('kpiNoSlot') : nextSlot.time}
          hint={nextSlot === null ? undefined : f.text(apptClinic(nextSlot.clinic).name)}
          {...(nextSlot === null
            ? {}
            : {
                onPress: () => {
                  setBooking({ patient: null, clinicId: nextSlot.clinic, date: DEMO_TODAY });
                },
              })}
        />
      </div>

      <section className="appointments-week" aria-label={t('week')}>
        {WEEK_DAYS.map((date) => {
          const friday = weekdayOf(date) === 5;
          const count = rows.filter((r) => r.date === date && r.status !== 'cancelled' && (clinicFilter === 'all' || r.clinicId === clinicFilter)).length;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={date === day}
              className={['appointments-day', date === day ? 'appointments-day--active' : '', friday ? 'appointments-day--weekend' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                setDay(date);
              }}
            >
              <span className="appointments-day__name">{f.weekday(date)}</span>
              <span className="appointments-day__date">{f.date(date)}</span>
              <span className="appointments-day__count">
                {friday ? (
                  <Badge tone="neutral" size="sm">
                    {t('weekend')}
                  </Badge>
                ) : (
                  t('dayCount', { count })
                )}
                {date === DEMO_TODAY ? (
                  <Badge tone="accent" size="sm">
                    {t('today')}
                  </Badge>
                ) : null}
              </span>
            </button>
          );
        })}
      </section>

      <Toolbar>
        <SelectField
          label={t('clinicFilter')}
          options={[{ id: 'all', label: t('allClinics') }, ...APPT_CLINICS.map((c) => ({ id: c.id, label: f.text(c.name) }))]}
          selectedKey={clinicFilter}
          onSelectionChange={setClinicFilter}
        />
        <SearchField label={t('search')} placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
      </Toolbar>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={(id) => {
          setTab((['calendar', 'list', 'queue', 'noshow'] as const).find((x) => x === id) ?? 'calendar');
        }}
        items={[
          { id: 'calendar', label: t('tabCalendar'), content: calendar },
          { id: 'list', label: t('tabList'), badge: f.number(dayRows.length), content: list },
          { id: 'queue', label: t('tabQueue'), badge: f.number(waitingNow.length), content: queue },
          { id: 'noshow', label: t('tabNoShows'), badge: f.number(noShows.filter((n) => n.followUp === 'not-contacted').length), content: noShowView },
        ]}
      />

      {detail}
      {booking === null ? null : (
        <BookingDialog
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setBooking(null);
            }
          }}
          initial={booking}
          rows={rows}
          priorNoShows={priorNoShows}
          onBook={(row) => {
            setRows((current) => [...current, row].toSorted((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
            setBooking(null);
            setDay(row.date);
            toast({
              tone: 'success',
              title: t('bookedToast', { name: personName(row.patient.name, f.locale), date: f.date(row.date), time: row.time }),
              body: t('bookedToastBody', { clinic: f.text(apptClinic(row.clinicId).name), room: apptClinic(row.clinicId).room }),
            });
          }}
        />
      )}
    </div>
  );
}
