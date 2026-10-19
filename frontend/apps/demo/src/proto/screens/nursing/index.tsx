/**
 * The Nursing shift brain-sheet (hospital-wide, per ward): one card per patient with the tasks due, overdue,
 * PRN-eligible, changed since handover and escalations; the task list; NEWS2 by patient with the vitals
 * capture dialog (nurse validation); and the I-PASS handover.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { getStaff, getWard, isKnownPatient, ISOLATION_LABEL } from '../../data/index.ts';
import type { WardId } from '../../data/index.ts';
import {
  brainPatients,
  ipassDefault,
  news2,
  obsFrequencyHours,
  SEVERITY_LABEL,
  tasksOf,
  WARD_NURSES,
  WARD_OPTIONS,
  type BrainPatient,
  type IllnessSeverity,
  type IpassEntry,
  type NurseTask,
  type NursingObs,
  type TaskState,
} from '../../data/ext/nursing.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  DataTable,
  Dialog,
  EmptyState,
  Grid,
  Icon,
  Meter,
  PageHeader,
  PatientInline,
  PatientName,
  Segmented,
  SelectField,
  StatTile,
  Tabs,
  TextInput,
  Toolbar,
  personName,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import './nursing.css';
import { BandBadge, StateBadge } from './parts.tsx';
import { VitalsDialog } from './vitals-dialog.tsx';

type Filter = 'due' | 'overdue' | 'prn' | 'changed' | 'escalations' | 'all' | 'done';
const FILTERS: readonly Filter[] = ['due', 'overdue', 'prn', 'changed', 'escalations', 'all', 'done'];
type DialogState = { readonly kind: 'vitals'; readonly patientId: string | null } | { readonly kind: 'patient'; readonly patientId: string } | null;

const NOW = '09:30';

function addHours(hhmm: string, hours: number): string {
  const total = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + Math.round(hours * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function NursingScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [wardId, setWardId] = useState<WardId>('med-a');
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [tab, setTab] = useState('sheet');
  const [filter, setFilter] = useState<Filter>('due');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [obsOverride, setObsOverride] = useState<Readonly<Record<string, { readonly obs: NursingObs; readonly previous: number }>>>({});
  const [stateOverride, setStateOverride] = useState<Readonly<Record<string, TaskState>>>({});
  const [extraTasks, setExtraTasks] = useState<readonly NurseTask[]>([]);
  const [ipass, setIpass] = useState<Readonly<Record<string, IpassEntry>>>({});
  const [receiver, setReceiver] = useState('SYN-STF-019');

  const me = WARD_NURSES[wardId][0] ?? 'SYN-STF-002';
  const ward = getWard(wardId);
  const basePatients = useMemo(() => brainPatients(wardId), [wardId]);
  const baseTasks = useMemo(() => tasksOf(basePatients), [basePatients]);
  const allPatients: readonly BrainPatient[] = basePatients.map((bp) => {
    const o = obsOverride[bp.patient.id];
    return o === undefined ? bp : { ...bp, obs: o.obs, previousNews2: o.previous };
  });
  const patients = allPatients.filter((bp) => scope === 'all' || bp.nurseId === me);
  const ids = new Set(patients.map((bp) => bp.patient.id));
  const key = (task: NurseTask): string => `${wardId}:${task.id}`;
  const allTasks: readonly NurseTask[] = [...baseTasks, ...extraTasks.filter((task) => basePatients.some((bp) => bp.patient.id === task.patientId))].map((task) => {
    const state = stateOverride[key(task)];
    return state === undefined ? task : { ...task, state };
  });
  const tasks = allTasks.filter((task) => ids.has(task.patientId));
  const open = tasks.filter((task) => task.state !== 'done');
  const isPrnNow = (task: NurseTask): boolean => task.prn && (task.prnEligibleFrom ?? '00:00') <= NOW;
  const groups: Readonly<Record<Filter, readonly NurseTask[]>> = {
    due: open.filter((task) => task.state === 'due' && !task.prn),
    overdue: open.filter((task) => task.state === 'overdue' && task.kind !== 'escalation'),
    prn: open.filter(isPrnNow),
    changed: open.filter((task) => task.changed !== null),
    escalations: open.filter((task) => task.kind === 'escalation'),
    all: open.filter((task) => !task.prn || isPrnNow(task)),
    done: tasks.filter((task) => task.state === 'done'),
  };
  const bpOf = (patientId: string): BrainPatient | undefined => allPatients.find((bp) => bp.patient.id === patientId);
  const nameOf = (patientId: string): string => {
    const bp = bpOf(patientId);
    return bp === undefined ? patientId : personName(bp.patient.name, f.locale);
  };

  const completeTask = (task: NurseTask): void => {
    setStateOverride((current) => ({ ...current, [key(task)]: 'done' }));
    if (task.kind === 'escalation') {
      toast({ tone: 'success', title: t('escalationDone', { name: nameOf(task.patientId) }) });
    } else {
      toast({ tone: 'success', title: t('taskDone', { task: task.drugLine ?? f.text(task.title), name: nameOf(task.patientId) }) });
    }
  };

  const saveObs = (patientId: string, obs: NursingObs): void => {
    const bp = bpOf(patientId);
    const previous = bp === undefined ? 0 : news2(bp.obs).total;
    const score = news2(obs);
    setObsOverride((current) => ({ ...current, [patientId]: { obs, previous } }));
    // The due observation task is done.
    const obsTask = allTasks.find((task) => task.patientId === patientId && task.kind === 'observation' && task.state !== 'done');
    if (obsTask !== undefined) {
      setStateOverride((current) => ({ ...current, [key(obsTask)]: 'done' }));
    }
    const nextDue = addHours(NOW, obsFrequencyHours(score));
    const added: NurseTask[] = [
      { id: `NX-${patientId}-${String(Date.now())}-o`, patientId, time: nextDue, kind: 'observation', title: { en: 'Observations and NEWS2', ckb: 'پشکنینی نیشانە ژیانییەکان و NEWS2', ar: 'العلامات الحيوية وNEWS2' }, drugLine: null, state: 'scheduled', prn: false, prnEligibleFrom: null, changed: null, highAlert: false },
    ];
    if (score.total >= 5) {
      added.push({
        id: `NX-${patientId}-${String(Date.now())}-e`,
        patientId,
        time: NOW,
        kind: 'escalation',
        title: { en: `Escalate to doctor: NEWS2 ${String(score.total)}`, ckb: `ئاگادارکردنەوەی پزیشک: NEWS2 ${String(score.total)}`, ar: `تصعيد إلى الطبيب: NEWS2 ${String(score.total)}` },
        drugLine: null,
        state: 'overdue',
        prn: false,
        prnEligibleFrom: null,
        changed: null,
        highAlert: true,
      });
    }
    setExtraTasks((current) => [...current, ...added]);
    setDialog(null);
    toast({ tone: score.total >= 5 ? 'warning' : 'success', title: t('savedToast', { name: nameOf(patientId), score: score.total }), ...(score.total >= 5 ? { body: t('escalationAdded') } : {}) });
  };

  // ---- task table ----------------------------------------------------------------------------------
  const taskLabel = (task: NurseTask): ReactNode => (
    <span className="nursing-task">
      <span>{f.text(task.title)}</span>
      {task.drugLine === null ? null : <Code className="nursing-drug">{task.drugLine}</Code>}
      <span className="nursing-inline">
        {task.highAlert && task.kind !== 'escalation' ? (
          <Badge tone="danger" size="sm" icon="alert">
            {t('highAlert')}
          </Badge>
        ) : null}
        {task.changed === null ? null : (
          <Badge tone="accent" size="sm" icon="refresh">
            {f.text(task.changed)}
          </Badge>
        )}
      </span>
    </span>
  );
  const actionFor = (task: NurseTask): ReactNode => {
    if (task.state === 'done') {
      return <Icon name="check-circle" className="nursing-done-icon" />;
    }
    if (task.kind === 'observation') {
      return (
        <Button
          size="sm"
          variant="secondary"
          icon="thermometer"
          onPress={() => {
            setDialog({ kind: 'vitals', patientId: task.patientId });
          }}
        >
          {t('record')}
        </Button>
      );
    }
    if (task.prn && !isPrnNow(task)) {
      return <span className="nursing-muted">{t('prnFrom', { time: task.prnEligibleFrom ?? '' })}</span>;
    }
    return (
      <Button
        size="sm"
        variant={task.kind === 'escalation' ? 'danger' : 'secondary'}
        icon={task.kind === 'escalation' ? 'phone' : 'check'}
        onPress={() => {
          completeTask(task);
        }}
      >
        {task.kind === 'escalation' ? t('acknowledge') : task.prn ? t('givePrn') : t('complete')}
      </Button>
    );
  };
  const taskColumns: readonly Column<NurseTask>[] = [
    { id: 'time', header: t('colTime'), nowrap: true, cell: (task) => (task.time === null ? <Badge tone="info" size="sm">PRN</Badge> : <Code>{task.time}</Code>) },
    { id: 'bed', header: t('colBed'), nowrap: true, cell: (task) => <Code>{bpOf(task.patientId)?.bedId ?? ''}</Code> },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (task) => {
        const bp = bpOf(task.patientId);
        return bp === undefined ? null : <PatientInline patient={bp.patient} />;
      },
    },
    { id: 'task', header: t('colTask'), cell: taskLabel },
    { id: 'state', header: t('colState'), cell: (task) => (task.prn && task.state !== 'done' ? <Badge tone={isPrnNow(task) ? 'success' : 'neutral'} size="sm">{isPrnNow(task) ? t('prnNow') : t('prnFrom', { time: task.prnEligibleFrom ?? '' })}</Badge> : <StateBadge state={task.state} />) },
    { id: 'action', header: t('colAction'), cell: actionFor },
  ];

  const filterLabel: Readonly<Record<Filter, string>> = {
    due: t('fDue'),
    overdue: t('fOverdue'),
    prn: t('fPrn'),
    changed: t('fChanged'),
    escalations: t('fEscalations'),
    all: t('fAll'),
    done: t('fDone'),
  };

  const taskView = (
    <div className="nursing-stack">
      <Toolbar>
        <Segmented
          label={t('filter')}
          value={filter}
          onChange={(id) => {
            setFilter(FILTERS.find((x) => x === id) ?? 'due');
          }}
          options={FILTERS.map((x) => ({ id: x, label: `${filterLabel[x]} (${f.number(groups[x].length)})` }))}
        />
      </Toolbar>
      <DataTable
        caption={t('tasksCaption')}
        columns={taskColumns}
        rows={groups[filter]}
        rowKey={(task) => task.id}
        rowTone={(task) => (task.kind === 'escalation' && task.state !== 'done' ? 'danger' : task.state === 'overdue' ? 'warning' : undefined)}
        emptyText={t('tasksEmpty')}
        dense
      />
    </div>
  );

  // ---- brain-sheet cards ---------------------------------------------------------------------------
  const sheet = (
    <Grid min="21rem">
      {patients.map((bp) => {
        const score = news2(bp.obs);
        const mine = open.filter((task) => task.patientId === bp.patient.id);
        const due = mine.filter((task) => task.state === 'due' && !task.prn).length;
        const overdue = mine.filter((task) => task.state === 'overdue' && task.kind !== 'escalation').length;
        const prn = mine.filter(isPrnNow).length;
        const changed = mine.filter((task) => task.changed !== null).length;
        const escalation = mine.some((task) => task.kind === 'escalation');
        const next = mine.filter((task) => !task.prn && task.kind !== 'escalation').slice(0, 3);
        const trend = score.total > bp.previousNews2 ? t('trendUp', { prev: bp.previousNews2 }) : score.total < bp.previousNews2 ? t('trendDown', { prev: bp.previousNews2 }) : t('trendSame');
        const allergies = bp.patient.allergies;
        return (
          <Card
            key={bp.patient.id}
            className="nursing-card"
            {...(escalation ? { tone: 'danger' as const } : overdue > 0 ? { tone: 'warning' as const } : {})}
            headingLevel={3}
            title={
              <span className="nursing-card__title">
                <Code className="nursing-bed">{bp.bedId}</Code>
                <PatientName patient={bp.patient} />
              </span>
            }
            subtitle={`${f.text(bp.diagnosis)} · ${t('dayOfStay', { day: bp.dayOfStay })}`}
            actions={
              <span className="nursing-news">
                <span className={`nursing-news__score nursing-score--${score.band}`}>{t('news2', { score: score.total })}</span>
                <span className="nursing-muted">
                  <Icon name={score.total > bp.previousNews2 ? 'arrow-forward' : 'activity'} size="0.9em" /> {trend}
                </span>
              </span>
            }
            footer={
              <span className="nursing-inline">
                <Button
                  size="sm"
                  variant="primary"
                  icon="thermometer"
                  onPress={() => {
                    setDialog({ kind: 'vitals', patientId: bp.patient.id });
                  }}
                >
                  {t('vitals')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="clipboard"
                  onPress={() => {
                    setDialog({ kind: 'patient', patientId: bp.patient.id });
                  }}
                >
                  {t('openPatient')}
                </Button>
                {isKnownPatient(bp.patient.id) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="chart"
                    onPress={() => {
                      goTo('chart', { patient: bp.patient.id });
                    }}
                  >
                    {t('openChart')}
                  </Button>
                ) : null}
              </span>
            }
          >
            <div className="nursing-chips">
              {escalation ? (
                <Badge tone="danger" strong icon="alert" size="sm">
                  {t('escalate')}
                </Badge>
              ) : null}
              {overdue > 0 ? <Badge tone="danger" size="sm">{t('chipOverdue', { count: overdue })}</Badge> : null}
              {due > 0 ? <Badge tone="info" size="sm">{t('chipDue', { count: due })}</Badge> : null}
              {prn > 0 ? <Badge tone="success" size="sm">{t('chipPrn', { count: prn })}</Badge> : null}
              {changed > 0 ? <Badge tone="accent" size="sm" icon="refresh">{t('chipChanged', { count: changed })}</Badge> : null}
              {bp.patient.isolation === null ? null : (
                <Badge tone="warning" size="sm" icon="isolation">
                  {t('isolation')}: {bp.patient.isolation.types.map((type) => f.text(ISOLATION_LABEL[type])).join(', ')}
                </Badge>
              )}
              {allergies.kind === 'list' ? (
                <Badge tone="danger" size="sm" icon="alert">
                  {t('allergy')}: {allergies.items.map((a) => f.text(a.substance)).join(', ')}
                </Badge>
              ) : null}
            </div>
            <p className="nursing-label">{t('nextTasks')}</p>
            {next.length === 0 ? (
              <p className="nursing-muted">{t('noTasksLeft')}</p>
            ) : (
              <ul className="nursing-checklist">
                {next.map((task) => (
                  <li key={task.id} className={`nursing-checklist__item nursing-checklist__item--${task.state}`}>
                    <Checkbox
                      isSelected={false}
                      onChange={() => {
                        if (task.kind === 'observation') {
                          setDialog({ kind: 'vitals', patientId: task.patientId });
                        } else {
                          completeTask(task);
                        }
                      }}
                    >
                      <span className="nursing-checklist__text">
                        <Code>{task.time ?? ''}</Code> {task.drugLine ?? f.text(task.title)}
                      </span>
                    </Checkbox>
                    <StateBadge state={task.state} />
                  </li>
                ))}
              </ul>
            )}
            <p className="nursing-muted">{staffName(getStaff(bp.nurseId), f.locale)}</p>
          </Card>
        );
      })}
    </Grid>
  );

  // ---- NEWS2 table ---------------------------------------------------------------------------------
  const scored = (value: ReactNode, score: number): ReactNode => <span className={`nursing-cell nursing-part--${String(Math.min(score, 3))}`}>{value}</span>;
  const newsColumns: readonly Column<BrainPatient>[] = [
    { id: 'bed', header: t('colBed'), nowrap: true, cell: (bp) => <Code>{bp.bedId}</Code> },
    { id: 'patient', header: t('colPatient'), cell: (bp) => <PatientInline patient={bp.patient} /> },
    { id: 'last', header: t('colLast'), nowrap: true, cell: (bp) => <Code>{bp.obs.time}</Code> },
    { id: 'rr', header: t('colRr'), align: 'end', cell: (bp) => scored(bp.obs.rr, news2(bp.obs).parts.rr) },
    { id: 'spo2', header: t('colSpo2'), align: 'end', cell: (bp) => scored(`${String(bp.obs.spo2)}%${bp.obs.onOxygen ? ` ${t('onO2')}` : ''}`, Math.max(news2(bp.obs).parts.spo2, news2(bp.obs).parts.air)) },
    { id: 'bp', header: t('colBp'), align: 'end', cell: (bp) => scored(<bdi dir="ltr">{`${String(bp.obs.sys)}/${String(bp.obs.dia)}`}</bdi>, news2(bp.obs).parts.sys) },
    { id: 'hr', header: t('colHr'), align: 'end', cell: (bp) => scored(bp.obs.hr, news2(bp.obs).parts.hr) },
    { id: 'acvpu', header: t('colAcvpu'), align: 'center', cell: (bp) => scored(bp.obs.acvpu, news2(bp.obs).parts.acvpu) },
    { id: 'temp', header: t('colTemp'), align: 'end', cell: (bp) => scored(bp.obs.temp.toFixed(1), news2(bp.obs).parts.temp) },
    {
      id: 'score',
      header: t('colScore'),
      cell: (bp) => {
        const s = news2(bp.obs);
        return (
          <span className="nursing-task">
            <span className={`nursing-news__score nursing-score--${s.band}`}>{s.total}</span>
            <BandBadge band={s.band} />
          </span>
        );
      },
    },
    {
      id: 'freq',
      header: t('colFreq'),
      cell: (bp) => {
        const hours = obsFrequencyHours(news2(bp.obs));
        return hours < 1 ? t('freqContinuous') : hours === 1 ? t('freqHourly') : t('freqHours', { hours });
      },
    },
    {
      id: 'next',
      header: t('colNext'),
      nowrap: true,
      cell: (bp) => {
        const next = addHours(bp.obs.time, obsFrequencyHours(news2(bp.obs)));
        return (
          <Badge tone={next < NOW ? 'danger' : 'neutral'} size="sm" icon="clock">
            {next}
          </Badge>
        );
      },
    },
    {
      id: 'action',
      header: t('colAction'),
      cell: (bp) => (
        <Button
          size="sm"
          variant="secondary"
          icon="thermometer"
          onPress={() => {
            setDialog({ kind: 'vitals', patientId: bp.patient.id });
          }}
        >
          {t('record')}
        </Button>
      ),
    },
  ];
  const newsView = (
    <DataTable
      caption={t('newsCaption')}
      columns={newsColumns}
      rows={patients.toSorted((a, b) => news2(b.obs).total - news2(a.obs).total)}
      rowKey={(bp) => bp.patient.id}
      rowTone={(bp) => (news2(bp.obs).band === 'high' ? 'danger' : news2(bp.obs).band === 'medium' ? 'warning' : undefined)}
      dense
    />
  );

  // ---- handover ------------------------------------------------------------------------------------
  const entryOf = (bp: BrainPatient): IpassEntry => ipass[bp.patient.id] ?? ipassDefault(bp, tasks, f.locale);
  const setEntry = (bp: BrainPatient, patch: Partial<IpassEntry>): void => {
    setIpass((current) => ({ ...current, [bp.patient.id]: { ...entryOf(bp), ...patch } }));
  };
  const confirmed = patients.filter((bp) => entryOf(bp).confirmed).length;
  const nurseOptions = WARD_NURSES[wardId].concat(['SYN-STF-019', 'SYN-STF-015']).filter((id, i, all) => all.indexOf(id) === i);
  const handover = (
    <div className="nursing-stack">
      <Callout tone="info" title="I-PASS">
        {t('handoverIntro')}
      </Callout>
      <Toolbar>
        <SelectField label={t('receiver')} options={nurseOptions.map((id) => ({ id, label: staffName(getStaff(id), f.locale) }))} selectedKey={receiver} onSelectionChange={setReceiver} />
        <div className="nursing-progress">
          <Meter value={patients.length === 0 ? 0 : confirmed / patients.length} label={t('handoverProgress', { done: confirmed, total: patients.length })} valueLabel={t('handoverProgress', { done: confirmed, total: patients.length })} tone={confirmed === patients.length ? 'success' : 'accent'} />
        </div>
        <Button
          variant="primary"
          icon="pen"
          onPress={() => {
            if (confirmed < patients.length) {
              toast({ tone: 'warning', title: t('handoverMissing') });
            } else {
              toast({ tone: 'success', title: t('handoverDone', { count: patients.length }) });
            }
          }}
        >
          {t('completeHandover')}
        </Button>
      </Toolbar>
      <div className="nursing-ipass-list">
        {patients.map((bp) => {
          const entry = entryOf(bp);
          return (
            <Card
              key={bp.patient.id}
              headingLevel={3}
              tone={entry.severity === 'unstable' ? 'danger' : entry.severity === 'watcher' ? 'warning' : 'success'}
              title={
                <span className="nursing-card__title">
                  <Code className="nursing-bed">{bp.bedId}</Code>
                  <PatientName patient={bp.patient} />
                </span>
              }
              actions={
                entry.confirmed ? (
                  <Badge tone="success" icon="check-circle">
                    {t('readBack')}
                  </Badge>
                ) : undefined
              }
            >
              <div className="nursing-ipass">
                <div className="nursing-ipass__letter">I</div>
                <Segmented
                  label={t('severity')}
                  value={entry.severity}
                  onChange={(id) => {
                    setEntry(bp, { severity: (['stable', 'watcher', 'unstable'] as const).find((s) => s === id) ?? 'stable' });
                  }}
                  options={(['stable', 'watcher', 'unstable'] as const satisfies readonly IllnessSeverity[]).map((s) => ({ id: s, label: f.text(SEVERITY_LABEL[s]) }))}
                />
                <div className="nursing-ipass__letter">P</div>
                <TextInput label={t('summary')} value={entry.summary} onChange={(v) => { setEntry(bp, { summary: v }); }} multiline />
                <div className="nursing-ipass__letter">A</div>
                <TextInput label={t('actions')} value={entry.actions} onChange={(v) => { setEntry(bp, { actions: v }); }} multiline />
                <div className="nursing-ipass__letter">S</div>
                <TextInput label={t('awareness')} value={entry.awareness} onChange={(v) => { setEntry(bp, { awareness: v }); }} multiline />
                <div className="nursing-ipass__letter">S</div>
                <div className="nursing-stack nursing-stack--tight">
                  <TextInput label={t('synthesis')} placeholder={t('synthesisPlaceholder')} value={entry.synthesis} onChange={(v) => { setEntry(bp, { synthesis: v }); }} />
                  <Checkbox isSelected={entry.confirmed} onChange={(on) => { setEntry(bp, { confirmed: on }); }}>
                    {t('readBack')}
                  </Checkbox>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // ---- dialogs -------------------------------------------------------------------------------------
  let dialogNode: ReactNode = null;
  if (dialog?.kind === 'vitals') {
    dialogNode = (
      <VitalsDialog
        patients={allPatients}
        initialPatientId={dialog.patientId}
        nurseId={me}
        onClose={() => {
          setDialog(null);
        }}
        onSave={saveObs}
      />
    );
  } else if (dialog?.kind === 'patient') {
    const bp = bpOf(dialog.patientId);
    if (bp !== undefined) {
      const score = news2(bp.obs);
      const mine = allTasks.filter((task) => task.patientId === bp.patient.id);
      dialogNode = (
        <Dialog
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setDialog(null);
            }
          }}
          size="lg"
          title={t('patientTitle', { bed: bp.bedId })}
          subtitle={`${f.text(bp.diagnosis)} · ${t('dayOfStay', { day: bp.dayOfStay })}`}
          actions={
            <>
              <Button
                variant="ghost"
                onPress={() => {
                  setDialog(null);
                }}
              >
                {t('close')}
              </Button>
              <Button
                variant="primary"
                icon="thermometer"
                onPress={() => {
                  setDialog({ kind: 'vitals', patientId: bp.patient.id });
                }}
              >
                {t('recordObs')}
              </Button>
            </>
          }
        >
          <div className="nursing-stack">
            <div className="nursing-dialog-head">
              <PatientInline patient={bp.patient} secondary />
              <span className="nursing-inline">
                <span className={`nursing-news__score nursing-score--${score.band}`}>{t('news2', { score: score.total })}</span>
                <BandBadge band={score.band} />
              </span>
            </div>
            <p className="nursing-muted">
              {t('lastObs', { time: bp.obs.time })} · RR {bp.obs.rr} · SpO2 {bp.obs.spo2}% · BP <bdi dir="ltr">{bp.obs.sys}/{bp.obs.dia}</bdi> · HR {bp.obs.hr} · {bp.obs.temp.toFixed(1)} °C · {bp.obs.acvpu}
            </p>
            <DataTable caption={t('tasksCaption')} columns={taskColumns.filter((c) => c.id !== 'patient' && c.id !== 'bed')} rows={mine} rowKey={(task) => task.id} dense />
          </div>
        </Dialog>
      );
    }
  }

  const tone = (n: number, kind: 'danger' | 'warning'): { tone?: 'danger' | 'warning' } => (n > 0 ? { tone: kind } : {});

  return (
    <div className="nursing-screen">
      <PageHeader
        icon="thermometer"
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
              {t('printSheet')}
            </Button>
            <Button
              variant="primary"
              icon="thermometer"
              onPress={() => {
                setDialog({ kind: 'vitals', patientId: null });
              }}
            >
              {t('recordObs')}
            </Button>
          </>
        }
      >
        <Toolbar>
          <SelectField
            label={t('ward')}
            options={WARD_OPTIONS.map((id) => ({ id, label: f.text(getWard(id).name) }))}
            selectedKey={wardId}
            onSelectionChange={(id) => {
              setWardId(WARD_OPTIONS.find((w) => w === id) ?? 'med-a');
            }}
          />
          <Segmented
            label={t('scope')}
            value={scope}
            onChange={(id) => {
              setScope(id === 'mine' ? 'mine' : 'all');
            }}
            options={[
              { id: 'all', label: t('scopeAll') },
              { id: 'mine', label: t('scopeMine') },
            ]}
          />
          <span className="nursing-muted">
            {f.text(ward.name)} · {t('kpiPatients', { count: patients.length })} · {t('myName', { name: staffName(getStaff(me), f.locale) })}
          </span>
        </Toolbar>
      </PageHeader>

      <div className="nursing-kpis">
        <StatTile label={t('kpiDue')} icon="clock" tone="info" value={f.number(groups.due.length)} onPress={() => { setTab('tasks'); setFilter('due'); }} />
        <StatTile label={t('kpiOverdue')} icon="alert" {...tone(groups.overdue.length, 'warning')} value={f.number(groups.overdue.length)} onPress={() => { setTab('tasks'); setFilter('overdue'); }} />
        <StatTile label={t('kpiPrn')} icon="pill" value={f.number(groups.prn.length)} onPress={() => { setTab('tasks'); setFilter('prn'); }} />
        <StatTile label={t('kpiChanged')} icon="refresh" value={f.number(groups.changed.length)} onPress={() => { setTab('tasks'); setFilter('changed'); }} />
        <StatTile label={t('kpiEscalations')} icon="bell" {...tone(groups.escalations.length, 'danger')} value={f.number(groups.escalations.length)} hint={t('kpiEscalationsHint')} onPress={() => { setTab('tasks'); setFilter('escalations'); }} />
      </div>

      {patients.length === 0 ? (
        <EmptyState icon="bed" title={t('noTasksLeft')} />
      ) : (
        <Tabs
          aria-label={t('tabsLabel')}
          selectedKey={tab}
          onSelectionChange={setTab}
          items={[
            { id: 'sheet', label: t('tabSheet'), badge: f.number(patients.length), content: sheet },
            { id: 'tasks', label: t('tabTasks'), badge: f.number(groups.due.length + groups.overdue.length), content: taskView },
            { id: 'news', label: t('tabNews'), badge: f.number(patients.filter((bp) => news2(bp.obs).total >= 5).length), content: newsView },
            { id: 'handover', label: t('tabHandover'), badge: `${f.number(confirmed)}/${f.number(patients.length)}`, content: handover },
          ]}
        />
      )}
      {dialogNode}
    </div>
  );
}
