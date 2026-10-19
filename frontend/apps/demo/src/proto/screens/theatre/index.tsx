/**
 * The Operating theatres screen (hospital-wide): theatre lists by room and day, booking into free session
 * time, the interactive WHO surgical safety checklist and the intra-op record whose implants and consumables
 * flow to the charges.
 */
import { useState, type ReactNode } from 'react';
import {
  ANAESTHETISTS,
  caseEnd,
  personText,
  PRIORITY_LABEL,
  procedureOf,
  SIDE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  SURGEONS,
  THEATRE_CASES,
  THEATRE_DAYS,
  THEATRE_ROOMS,
  type TheatreCase,
} from '../../data/ext/theatre.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Code,
  DataTable,
  EmptyState,
  Meter,
  PageHeader,
  PatientInline,
  PatientName,
  Segmented,
  SelectField,
  StatTile,
  Toolbar,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { BookingDialog } from './booking-dialog.tsx';
import { CaseDialog, checklistDone } from './case-dialog.tsx';
import { messages } from './messages.ts';
import './theatre.css';

type DialogState = { readonly kind: 'case'; readonly id: string } | { readonly kind: 'book' } | null;

function toMin(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export function TheatreScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [cases, setCases] = useState<readonly TheatreCase[]>(THEATRE_CASES);
  const [day, setDay] = useState(THEATRE_DAYS[0] ?? '2026-10-19');
  const [roomFilter, setRoomFilter] = useState('all');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [dialog, setDialog] = useState<DialogState>(null);
  const today = THEATRE_DAYS[0] ?? '2026-10-19';

  const todays = cases.filter((c) => c.date === today && c.status !== 'postponed');
  const inTheatre = todays.filter((c) => c.status === 'anaesthesia' || c.status === 'surgery').length;
  const inRecovery = todays.filter((c) => c.status === 'recovery').length;
  const started = todays.filter((c) => c.status !== 'scheduled' && c.status !== 'sent-for');
  const checklistRate = started.length === 0 ? 1 : started.filter((c) => checklistDone(c) === 3 || (c.status !== 'recovery' && c.status !== 'completed')).length / started.length;
  const sessionMin = THEATRE_ROOMS.reduce((sum, r) => sum + toMin(r.end) - toMin(r.start), 0);
  const bookedMin = (date: string, roomId?: string): number =>
    cases.filter((c) => c.date === date && c.status !== 'postponed' && (roomId === undefined || c.roomId === roomId)).reduce((sum, c) => sum + procedureOf(c.procedureId).minutes, 0);
  const toPost = cases.filter((c) => !c.chargesPosted && (c.status === 'recovery' || c.status === 'completed'));

  const rooms = THEATRE_ROOMS.filter((r) => roomFilter === 'all' || r.id === roomFilter);
  const dayCases = cases.filter((c) => c.date === day && (roomFilter === 'all' || c.roomId === roomFilter)).toSorted((a, b) => a.start.localeCompare(b.start));
  const open = (c: TheatreCase): void => {
    setDialog({ kind: 'case', id: c.id });
  };
  const update = (id: string, patch: Partial<TheatreCase>, message?: string): void => {
    setCases((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (message !== undefined) {
      toast({ tone: 'success', title: message });
    }
  };

  const ChecklistDots = ({ c }: { readonly c: TheatreCase }): ReactNode => {
    const phases = [c.signIn, c.timeOut, c.signOut];
    return (
      <span className="theatre-dots" aria-label={`${t('colChecklist')} ${t('checklistShort', { done: checklistDone(c) })}`}>
        {phases.map((p, i) => (
          <span key={i} className={p.confirmedTime === null ? 'theatre-dot' : 'theatre-dot theatre-dot--done'} />
        ))}
      </span>
    );
  };

  const caseCard = (c: TheatreCase): ReactNode => {
    const proc = procedureOf(c.procedureId);
    return (
      <li key={c.id}>
        <button type="button" className={`theatre-case theatre-case--${c.status} theatre-case--${c.priority}`} onClick={() => { open(c); }}>
          <span className="theatre-case__time">
            <Code>
              {c.start}–{caseEnd(c)}
            </Code>
            <Badge tone={STATUS_TONE[c.status]} size="sm">
              {f.text(STATUS_LABEL[c.status])}
            </Badge>
          </span>
          <span className="theatre-case__proc">{f.text(proc.name)}</span>
          <PatientName patient={c.patient} />
          <span className="theatre-muted">
            {f.text(personText(SURGEONS, c.surgeon))} · {f.text(personText(ANAESTHETISTS, c.anaesthetist))}
          </span>
          <span className="theatre-case__foot">
            {c.priority === 'elective' ? null : (
              <Badge tone={c.priority === 'emergency' ? 'danger' : 'warning'} size="sm" icon="alert">
                {f.text(PRIORITY_LABEL[c.priority])}
              </Badge>
            )}
            {c.side === 'none' ? null : (
              <Badge tone="neutral" size="sm">
                {f.text(SIDE_LABEL[c.side])}
              </Badge>
            )}
            <ChecklistDots c={c} />
          </span>
        </button>
      </li>
    );
  };

  const board = (
    <div className="theatre-board" style={{ gridTemplateColumns: `repeat(${String(rooms.length)}, minmax(17rem, 1fr))` }}>
      {rooms.map((room) => {
        const list = dayCases.filter((c) => c.roomId === room.id);
        const total = toMin(room.end) - toMin(room.start);
        const booked = bookedMin(day, room.id);
        return (
          <section key={room.id} className="theatre-room" aria-label={f.text(room.name)}>
            <header className="theatre-room__head">
              <h2 className="theatre-room__title">{f.text(room.name)}</h2>
              <Meter value={Math.min(1, booked / total)} label={f.text(room.name)} valueLabel={t('sessionLine', { start: room.start, end: room.end, booked, total })} tone={booked > total * 0.9 ? 'warning' : 'accent'} />
            </header>
            {list.length === 0 ? <EmptyState compact icon="calendar" title={t('noCases')} /> : <ol className="theatre-cases">{list.map(caseCard)}</ol>}
          </section>
        );
      })}
    </div>
  );

  const columns: readonly Column<TheatreCase>[] = [
    { id: 'time', header: t('colTime'), nowrap: true, cell: (c) => <Code>{`${c.start}–${caseEnd(c)}`}</Code> },
    { id: 'room', header: t('colRoom'), nowrap: true, cell: (c) => <Code>{c.roomId}</Code> },
    { id: 'patient', header: t('colPatient'), cell: (c) => <PatientInline patient={c.patient} /> },
    {
      id: 'proc',
      header: t('colProcedure'),
      cell: (c) => (
        <span className="theatre-cell-stack">
          <span>{f.text(procedureOf(c.procedureId).name)}</span>
          {c.side === 'none' ? null : <span className="theatre-muted">{t('sideLine', { side: f.text(SIDE_LABEL[c.side]) })}</span>}
        </span>
      ),
    },
    {
      id: 'team',
      header: t('colSurgeon'),
      cell: (c) => (
        <span className="theatre-cell-stack">
          <span>{f.text(personText(SURGEONS, c.surgeon))}</span>
          <span className="theatre-muted">{f.text(personText(ANAESTHETISTS, c.anaesthetist))}</span>
        </span>
      ),
    },
    { id: 'priority', header: t('colPriority'), cell: (c) => <Badge tone={c.priority === 'emergency' ? 'danger' : c.priority === 'urgent' ? 'warning' : 'neutral'} size="sm">{f.text(PRIORITY_LABEL[c.priority])}</Badge> },
    { id: 'checklist', header: t('colChecklist'), cell: (c) => <ChecklistDots c={c} /> },
    { id: 'status', header: t('colStatus'), cell: (c) => <Badge tone={STATUS_TONE[c.status]} size="sm">{f.text(STATUS_LABEL[c.status])}</Badge> },
  ];

  let dialogNode: ReactNode = null;
  if (dialog?.kind === 'case') {
    const c = cases.find((x) => x.id === dialog.id);
    if (c !== undefined) {
      dialogNode = (
        <CaseDialog
          theatreCase={c}
          onClose={() => {
            setDialog(null);
          }}
          onUpdate={(patch, message) => {
            update(c.id, patch, message);
          }}
          onOpenChart={() => {
            setDialog(null);
            goTo('chart', { patient: c.patient.id });
          }}
          onOpenBilling={() => {
            setDialog(null);
            goTo('billing', { patient: c.patient.id });
          }}
        />
      );
    }
  } else if (dialog?.kind === 'book') {
    dialogNode = (
      <BookingDialog
        cases={cases}
        initialRoom={roomFilter === 'all' ? 'OT-1' : roomFilter}
        initialDate={day}
        patients={cases.map((c) => c.patient)}
        onClose={() => {
          setDialog(null);
        }}
        onBook={(c) => {
          setCases((current) => [...current, c]);
          setDialog(null);
          setDay(c.date);
          toast({ tone: 'success', title: t('bookedToast', { procedure: f.text(procedureOf(c.procedureId).name), name: personName(c.patient.name, f.locale), date: f.date(c.date), time: c.start }) });
        }}
      />
    );
  }

  return (
    <div className="theatre-screen">
      <PageHeader
        icon="clock"
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
                setDialog({ kind: 'book' });
              }}
            >
              {t('book')}
            </Button>
          </>
        }
      />

      <div className="theatre-kpis">
        <StatTile label={t('kpiCases')} icon="calendar" value={f.number(todays.length)} hint={t('kpiCasesHint', { count: todays.filter((c) => c.priority === 'emergency').length })} />
        <StatTile label={t('kpiNow')} icon="activity" tone="danger" value={f.number(inTheatre)} hint={t('kpiNowHint', { count: inRecovery })} />
        <StatTile label={t('kpiUtil')} icon="chart" value={f.percent(bookedMin(today) / sessionMin)} hint={t('kpiUtilHint')} />
        <StatTile label={t('kpiChecklist')} icon="shield" tone={checklistRate >= 1 ? 'success' : 'warning'} value={f.percent(checklistRate)} hint={t('kpiChecklistHint')} />
        <StatTile
          label={t('kpiCharges')}
          icon="receipt"
          tone={toPost.length > 0 ? 'warning' : 'success'}
          value={f.number(toPost.length)}
          hint={t('kpiChargesHint')}
          {...(toPost[0] === undefined
            ? {}
            : {
                onPress: () => {
                  const first = toPost[0];
                  if (first !== undefined) {
                    setDay(first.date);
                    open(first);
                  }
                },
              })}
        />
      </div>

      <Toolbar>
        <div className="theatre-days" role="group" aria-label={t('day')}>
          {THEATRE_DAYS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === day ? 'primary' : 'secondary'}
              onPress={() => {
                setDay(d);
              }}
            >
              {f.weekday(d)} {f.date(d)}
            </Button>
          ))}
        </div>
        <SelectField label={t('room')} options={[{ id: 'all', label: t('allRooms') }, ...THEATRE_ROOMS.map((r) => ({ id: r.id, label: f.text(r.name) }))]} selectedKey={roomFilter} onSelectionChange={setRoomFilter} />
        <Segmented
          label={t('viewLabel')}
          value={view}
          onChange={(id) => {
            setView(id === 'list' ? 'list' : 'board');
          }}
          options={[
            { id: 'board', label: t('viewBoard') },
            { id: 'list', label: t('viewList') },
          ]}
        />
      </Toolbar>
      <p className="theatre-muted">{t('weekend')}</p>

      {view === 'board' ? (
        board
      ) : (
        <DataTable
          caption={t('listCaption', { date: f.date(day, 'long') })}
          columns={columns}
          rows={dayCases}
          rowKey={(c) => c.id}
          onRowAction={open}
          rowTone={(c) => (c.status === 'surgery' ? 'danger' : c.status === 'postponed' ? 'neutral' : !c.chargesPosted && c.status === 'completed' ? 'warning' : undefined)}
          emptyText={t('noCases')}
        />
      )}
      {dialogNode}
    </div>
  );
}
