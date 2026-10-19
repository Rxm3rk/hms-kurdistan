/**
 * The Emergency department screen (hospital-wide): quick registration, the configured triage scale (one
 * scale, colour-coded), the live tracking board with waiting times against the triage targets, the stroke /
 * STEMI / sepsis pathway clocks, and the medico-legal case register with police-notification times.
 */
import { useState, type ReactNode } from 'react';
import { findStaff, isKnownPatient } from '../../data/index.ts';
import {
  AREA_LABEL,
  ED_ROWS,
  ED_STATUS_LABEL,
  ED_STATUS_TONE,
  MLC_CASES,
  MLC_STATUS_LABEL,
  MLC_STATUS_TONE,
  MLC_TYPE_LABEL,
  MODE_LABEL,
  PATHWAY_CLOCKS,
  PATHWAY_DEFS,
  TRIAGE_SCALES,
  type EdArea,
  type EdRow,
  type MlcCase,
  type MlcType,
  type PathwayClock,
  type PathwayKind,
  type TriageScaleId,
} from '../../data/ext/emergency.ts';
import { extPatient, unknownName } from '../../data/ext/care-people.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  Icon,
  PageHeader,
  PatientInline,
  PatientName,
  SearchField,
  Segmented,
  StatTile,
  Tabs,
  Toolbar,
  personName,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { DetailDialog, MlcDialog, RegisterDialog, ScaleDialog, type Registration } from './dialogs.tsx';
import './emergency.css';
import { messages } from './messages.ts';
import { isBreaching, minutesBetweenIso, minutesSince, NOW_ISO, TriageChip } from './parts.tsx';

type DialogState =
  | { readonly kind: 'detail'; readonly id: string }
  | { readonly kind: 'register' }
  | { readonly kind: 'scale' }
  | { readonly kind: 'mlc'; readonly id: string }
  | null;

type AreaFilter = 'all' | EdArea;
const AREA_FILTERS: readonly AreaFilter[] = ['all', 'resus', 'majors', 'minors', 'paeds', 'waiting'];

export function EmergencyScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [rows, setRows] = useState<readonly EdRow[]>(ED_ROWS);
  const [clocks, setClocks] = useState<readonly PathwayClock[]>(PATHWAY_CLOCKS);
  const [mlcCases, setMlcCases] = useState<readonly MlcCase[]>(MLC_CASES);
  const [scaleId, setScaleId] = useState<TriageScaleId>('mts');
  const [area, setArea] = useState<AreaFilter>('all');
  const [triageFilter, setTriageFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('board');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [serial, setSerial] = useState(21);
  const scale = TRIAGE_SCALES[scaleId];
  const nameOf = (row: { readonly patient: EdRow['patient'] }): string => personName(row.patient.name, f.locale);

  // ---- derived -------------------------------------------------------------------------------------
  const waiting = rows.filter((r) => r.seenIso === null);
  const longest = waiting.reduce((max, r) => Math.max(max, minutesSince(r.arrivalIso)), 0);
  const breaching = rows.filter((r) => isBreaching(r, scale));
  const pendingMlc = mlcCases.filter((m) => m.status === 'pending');
  const todaysMlc = mlcCases.filter((m) => m.arrivalIso.startsWith('2026-10-19'));
  const q = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => area === 'all' || r.area === area)
    .filter((r) => triageFilter === null || (triageFilter === 0 ? r.triage === null : r.triage === triageFilter))
    .filter((r) => q === '' || [r.patient.name.latin, r.patient.name.ckb, r.patient.name.ar, r.patient.mrn, f.text(r.complaint)].some((v) => v.toLowerCase().includes(q)))
    .toSorted((a, b) => (a.triage ?? 0) - (b.triage ?? 0) || a.arrivalIso.localeCompare(b.arrivalIso));

  // ---- actions -------------------------------------------------------------------------------------
  const updateRow = (id: string, patch: Partial<EdRow>, message?: string): void => {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (message !== undefined) {
      toast({ tone: 'success', title: message });
    }
  };
  const startPathway = (row: EdRow, kind: PathwayKind): void => {
    setClocks((current) => [...current, { id: `PW-${String(current.length + 1)}`, edId: row.id, kind, startIso: NOW_ISO, done: {} }]);
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, pathways: [...r.pathways, kind] } : r)));
    toast({ tone: 'info', title: t('pathwayStarted', { pathway: f.text(PATHWAY_DEFS[kind].name), name: nameOf(row) }) });
  };
  const openMlc = (row: EdRow, type: MlcType): string => {
    const id = `MLC-2026-0${String(415 + mlcCases.length - MLC_CASES.length)}`;
    setMlcCases((current) => [
      { id, edId: row.id, patient: row.patient, type, arrivalIso: row.arrivalIso, station: null, notifiedIso: null, notifiedById: null, officer: null, policeRef: null, status: 'pending' },
      ...current,
    ]);
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, mlcId: id } : r)));
    return id;
  };
  const register = (reg: Registration): void => {
    const id = `ED-0419-${String(serial).padStart(2, '0')}`;
    const base = extPatient(160 + serial, { sex: reg.sex, age: reg.age, unknown: reg.unknown });
    const patient = reg.unknown
      ? { ...base, name: { ...unknownName(id), ownScript: 'latin' as const } }
      : { ...base, name: { latin: reg.name, ckb: reg.name, ar: reg.name, ownScript: 'latin' as const } };
    const row: EdRow = {
      id,
      patient,
      unknownIdentity: reg.unknown,
      arrivalIso: NOW_ISO,
      mode: reg.mode,
      complaint: reg.complaint === '' ? { en: 'Not recorded yet', ckb: 'هێشتا تۆمار نەکراوە', ar: 'لم تُسجَّل بعد' } : { en: reg.complaint, ckb: reg.complaint, ar: reg.complaint },
      triage: reg.triage,
      triageIso: reg.triage === null ? null : NOW_ISO,
      seenIso: null,
      area: reg.area,
      bay: null,
      status: reg.triage === null ? 'awaiting-triage' : 'awaiting-doctor',
      doctorId: null,
      nurseId: null,
      pathways: reg.pathways,
      mlcId: null,
      vitals: null,
    };
    setSerial((n) => n + 1);
    setRows((current) => [...current, row]);
    setClocks((current) => [...current, ...reg.pathways.map((kind, i) => ({ id: `PW-${String(current.length + i + 1)}`, edId: id, kind, startIso: NOW_ISO, done: {} }))]);
    if (reg.mlc) {
      openMlc(row, reg.mode === 'police' ? 'assault' : 'rta');
    }
    setDialog(null);
    toast({ tone: 'success', title: t('registeredToast', { id, name: personName(patient.name, f.locale) }) });
  };

  // ---- board ---------------------------------------------------------------------------------------
  const columns: readonly Column<EdRow>[] = [
    { id: 'triage', header: t('colTriage'), cell: (r) => <TriageChip level={r.triage} scale={scale} />, nowrap: true },
    { id: 'bay', header: t('colBay'), cell: (r) => (r.bay === null ? <span className="emergency-muted">{f.text(AREA_LABEL[r.area])}</span> : <Code>{r.bay}</Code>), nowrap: true },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (r) => (
        <span className="emergency-cell-stack">
          <PatientInline patient={r.patient} />
          {r.unknownIdentity ? (
            <Badge tone="warning" size="sm" icon="alert">
              {t('unknownBadge')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'arrived',
      header: t('colArrived'),
      nowrap: true,
      cell: (r) => (
        <span className="emergency-cell-stack">
          <Code>{f.time(r.arrivalIso)}</Code>
          <span className="emergency-muted">{f.text(MODE_LABEL[r.mode])}</span>
        </span>
      ),
    },
    {
      id: 'wait',
      header: t('colWait'),
      nowrap: true,
      cell: (r) => {
        const target = scale.categories.find((c) => c.level === r.triage)?.targetMin;
        if (r.seenIso !== null) {
          return (
            <span className="emergency-cell-stack">
              <span>{t('waitMin', { min: minutesSince(r.arrivalIso) })}</span>
              <span className="emergency-muted">{t('seenAfter', { min: minutesBetweenIso(r.arrivalIso, r.seenIso) })}</span>
            </span>
          );
        }
        const breach = isBreaching(r, scale);
        return (
          <span className="emergency-cell-stack">
            <Badge tone={breach ? 'danger' : 'warning'} icon="clock" size="sm" strong={breach}>
              {t('waitMin', { min: minutesSince(r.arrivalIso) })}
            </Badge>
            {target === undefined ? null : <span className="emergency-muted">{t('target', { min: target })}</span>}
          </span>
        );
      },
    },
    { id: 'complaint', header: t('colComplaint'), cell: (r) => f.text(r.complaint) },
    { id: 'status', header: t('colStatus'), cell: (r) => <Badge tone={ED_STATUS_TONE[r.status]} size="sm">{f.text(ED_STATUS_LABEL[r.status])}</Badge> },
    {
      id: 'clinician',
      header: t('colClinician'),
      cell: (r) => {
        const doctor = findStaff(r.doctorId);
        const nurse = findStaff(r.nurseId);
        return (
          <span className="emergency-cell-stack">
            <span>{doctor === undefined ? <span className="emergency-muted">{t('unassigned')}</span> : staffName(doctor, f.locale)}</span>
            {nurse === undefined ? null : <span className="emergency-muted">{staffName(nurse, f.locale)}</span>}
          </span>
        );
      },
    },
    {
      id: 'flags',
      header: t('colFlags'),
      cell: (r) => (
        <span className="emergency-inline">
          {r.pathways.map((kind) => (
            <Badge key={kind} tone="danger" size="sm" icon="clock">
              {kind === 'stemi' ? 'STEMI' : f.text(PATHWAY_DEFS[kind].name).split(' ')[0] ?? kind}
            </Badge>
          ))}
          {r.mlcId === null ? null : (
            <Badge tone="accent" size="sm" icon="shield">
              {t('mlcBadge')}
            </Badge>
          )}
        </span>
      ),
    },
  ];

  const counts = scale.categories.map((c) => ({ category: c, count: rows.filter((r) => r.triage === c.level).length }));
  const untriaged = rows.filter((r) => r.triage === null).length;

  const board = (
    <div className="emergency-stack">
      <Toolbar>
        <Segmented
          label={t('areaFilter')}
          value={area}
          onChange={(id) => {
            setArea(AREA_FILTERS.find((a) => a === id) ?? 'all');
          }}
          options={AREA_FILTERS.map((a) => ({ id: a, label: a === 'all' ? t('allAreas') : f.text(AREA_LABEL[a]) }))}
        />
        <SearchField label={t('search')} placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
      </Toolbar>
      <DataTable
        caption={t('boardCaption')}
        columns={columns}
        rows={visible}
        rowKey={(r) => r.id}
        onRowAction={(r) => {
          setDialog({ kind: 'detail', id: r.id });
        }}
        rowTone={(r) => (isBreaching(r, scale) ? 'danger' : undefined)}
        emptyText={t('boardEmpty')}
        dense
        stickyHeader
      />
    </div>
  );

  // ---- clocks --------------------------------------------------------------------------------------
  const clockView =
    clocks.length === 0 ? (
      <EmptyState icon="clock" title={t('clocksEmpty')} />
    ) : (
      <Grid min="22rem">
        {clocks.map((clock) => {
          const row = rows.find((r) => r.id === clock.edId);
          const def = PATHWAY_DEFS[clock.kind];
          const elapsed = minutesSince(clock.startIso);
          const nextStep = def.steps.find((s) => clock.done[s.id] === undefined);
          const overdue = def.steps.some((s) => clock.done[s.id] === undefined && elapsed > s.targetMin);
          return (
            <Card
              key={clock.id}
              title={f.text(def.name)}
              subtitle={row === undefined ? undefined : `${row.bay ?? f.text(AREA_LABEL[row.area])} · ${row.id}`}
              icon="clock"
              tone={overdue ? 'danger' : 'info'}
              headingLevel={3}
              actions={
                <span className={overdue ? 'emergency-clock emergency-clock--late' : 'emergency-clock'}>
                  <Icon name="clock" /> {t('clockElapsed', { min: elapsed })}
                </span>
              }
              footer={
                nextStep === undefined ? (
                  <Badge tone="success" icon="check-circle">
                    {t('allDone')}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    icon="check"
                    onPress={() => {
                      setClocks((current) => current.map((c) => (c.id === clock.id ? { ...c, done: { ...c.done, [nextStep.id]: NOW_ISO } } : c)));
                      toast({ tone: 'success', title: t('stepRecorded', { step: f.text(nextStep.label), time: f.time(NOW_ISO) }) });
                    }}
                  >
                    {t('recordNow')} · {f.text(nextStep.label)}
                  </Button>
                )
              }
            >
              {row === undefined ? null : (
                <button
                  type="button"
                  className="emergency-clock__patient"
                  onClick={() => {
                    setDialog({ kind: 'detail', id: row.id });
                  }}
                >
                  <PatientName patient={row.patient} /> <span className="emergency-muted">{t('clockStarted', { time: f.time(clock.startIso) })}</span>
                </button>
              )}
              <ol className="emergency-steps">
                {def.steps.map((step) => {
                  const doneIso = clock.done[step.id];
                  let state: ReactNode;
                  let tone: 'success' | 'warning' | 'danger' | 'neutral';
                  if (doneIso !== undefined) {
                    const took = minutesBetweenIso(clock.startIso, doneIso);
                    tone = took <= step.targetMin ? 'success' : 'warning';
                    state = (
                      <>
                        <span>{t('stepDone', { time: f.time(doneIso), min: took })}</span>
                        <Badge tone={tone} size="sm">
                          {took <= step.targetMin ? t('stepOnTime') : t('stepLate')}
                        </Badge>
                      </>
                    );
                  } else if (elapsed > step.targetMin) {
                    tone = 'danger';
                    state = (
                      <Badge tone="danger" size="sm" strong icon="alert">
                        {t('stepOverdue', { min: elapsed - step.targetMin })}
                      </Badge>
                    );
                  } else {
                    tone = 'neutral';
                    state = (
                      <Badge tone="info" size="sm">
                        {t('stepDueIn', { min: step.targetMin - elapsed })}
                      </Badge>
                    );
                  }
                  return (
                    <li key={step.id} className={`emergency-step emergency-step--${tone}`}>
                      <span className="emergency-step__dot" aria-hidden="true" />
                      <span className="emergency-step__body">
                        <span className="emergency-step__label">{f.text(step.label)}</span>
                        <span className="emergency-muted">{t('stepTarget', { min: step.targetMin })}</span>
                      </span>
                      <span className="emergency-step__state">{state}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
      </Grid>
    );

  // ---- MLC -----------------------------------------------------------------------------------------
  const mlcColumns: readonly Column<MlcCase>[] = [
    { id: 'id', header: t('colMlc'), cell: (m) => <Code>{m.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (m) => <PatientInline patient={m.patient} /> },
    { id: 'type', header: t('colType'), cell: (m) => f.text(MLC_TYPE_LABEL[m.type]) },
    { id: 'arrival', header: t('arrival'), cell: (m) => f.dateTime(m.arrivalIso), nowrap: true },
    { id: 'station', header: t('colStation'), cell: (m) => (m.station === null ? '–' : f.text(m.station)) },
    {
      id: 'notified',
      header: t('colNotified'),
      cell: (m) => {
        if (m.notifiedIso === null) {
          return (
            <Badge tone="danger" strong icon="alert" size="sm">
              {t('notYet')} · {t('waitMin', { min: minutesSince(m.arrivalIso) })}
            </Badge>
          );
        }
        const delay = minutesBetweenIso(m.arrivalIso, m.notifiedIso);
        return (
          <span className="emergency-cell-stack">
            <Code>{f.dateTime(m.notifiedIso)}</Code>
            <Badge tone={delay > 30 ? 'warning' : 'success'} size="sm">
              {t('delay', { min: delay })}
            </Badge>
          </span>
        );
      },
    },
    { id: 'officer', header: t('colOfficer'), cell: (m) => (m.officer === null ? '–' : <span className="emergency-cell-stack"><span dir="ltr">{m.officer}</span>{m.policeRef === null ? null : <Code>{m.policeRef}</Code>}</span>) },
    { id: 'status', header: t('status'), cell: (m) => <Badge tone={MLC_STATUS_TONE[m.status]} size="sm">{f.text(MLC_STATUS_LABEL[m.status])}</Badge> },
  ];

  const mlcView = (
    <div className="emergency-stack">
      <Callout tone="info" icon="shield">
        {t('mlcRule')}
      </Callout>
      <DataTable
        caption={t('mlcCaption')}
        columns={mlcColumns}
        rows={mlcCases}
        rowKey={(m) => m.id}
        onRowAction={(m) => {
          setDialog({ kind: 'mlc', id: m.id });
        }}
        rowTone={(m) => (m.status === 'pending' ? 'danger' : undefined)}
        dense
      />
    </div>
  );

  // ---- dialogs -------------------------------------------------------------------------------------
  const close = (): void => {
    setDialog(null);
  };
  let dialogNode: ReactNode = null;
  if (dialog?.kind === 'detail') {
    const row = rows.find((r) => r.id === dialog.id);
    if (row !== undefined) {
      dialogNode = (
        <DetailDialog
          row={row}
          scale={scale}
          activePathways={clocks.filter((c) => c.edId === row.id).map((c) => c.kind)}
          onClose={close}
          onUpdate={(patch, message) => {
            updateRow(row.id, patch, message);
          }}
          onStartPathway={(kind) => {
            startPathway(row, kind);
          }}
          onOpenMlc={() => {
            const id = openMlc(row, row.mode === 'police' ? 'assault' : 'rta');
            toast({ tone: 'warning', title: t('mlcOpened', { id }) });
          }}
          onDischarge={() => {
            setRows((current) => current.filter((r) => r.id !== row.id));
            setClocks((current) => current.filter((c) => c.edId !== row.id));
            close();
            toast({ tone: 'success', title: t('dischargedToast', { name: nameOf(row) }) });
          }}
          onOpenChart={() => {
            close();
            if (isKnownPatient(row.patient.id)) {
              goTo('chart', { patient: row.patient.id });
            }
          }}
        />
      );
    }
  } else if (dialog?.kind === 'register') {
    dialogNode = <RegisterDialog scale={scale} onClose={close} onRegister={register} />;
  } else if (dialog?.kind === 'scale') {
    dialogNode = (
      <ScaleDialog
        scaleId={scaleId}
        onClose={close}
        onChange={(id) => {
          setScaleId(id);
          close();
          toast({ tone: 'success', title: t('scaleSaved', { scale: f.text(TRIAGE_SCALES[id].name) }) });
        }}
      />
    );
  } else if (dialog?.kind === 'mlc') {
    const mlc = mlcCases.find((m) => m.id === dialog.id);
    if (mlc !== undefined) {
      dialogNode = (
        <MlcDialog
          mlc={mlc}
          onClose={close}
          onUpdate={(patch, message) => {
            setMlcCases((current) => current.map((m) => (m.id === mlc.id ? { ...m, ...patch } : m)));
            toast({ tone: 'success', title: message });
          }}
          onPrint={() => {
            toast({ tone: 'info', title: t('printToast') });
          }}
        />
      );
    }
  }

  return (
    <div className="emergency-screen">
      <PageHeader
        icon="alert"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button
              icon="settings"
              onPress={() => {
                setDialog({ kind: 'scale' });
              }}
            >
              {t('scaleButton')}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setDialog({ kind: 'register' });
              }}
            >
              {t('quickReg')}
            </Button>
          </>
        }
      />

      <div className="emergency-kpis">
        <StatTile label={t('kpiInDept')} icon="users" value={f.number(rows.length)} hint={t('kpiInDeptHint', { count: rows.filter((r) => r.status === 'awaiting-bed').length })} />
        <StatTile label={t('kpiWaiting')} icon="clock" tone="warning" value={f.number(waiting.length)} hint={t('kpiWaitingHint', { min: longest })} />
        <StatTile
          label={t('kpiBreach')}
          icon="alert"
          tone={breaching.length > 0 ? 'danger' : 'success'}
          value={f.number(breaching.length)}
          hint={t('kpiBreachHint')}
          onPress={() => {
            setTab('board');
            setArea('all');
          }}
        />
        <StatTile
          label={t('kpiClocks')}
          icon="activity"
          tone="info"
          value={f.number(clocks.filter((c) => PATHWAY_DEFS[c.kind].steps.some((s) => c.done[s.id] === undefined)).length)}
          hint={t('kpiClocksHint')}
          onPress={() => {
            setTab('clocks');
          }}
        />
        <StatTile
          label={t('kpiMlc')}
          icon="shield"
          tone={pendingMlc.length > 0 ? 'danger' : 'success'}
          value={f.number(pendingMlc.length)}
          hint={t('kpiMlcHint', { count: todaysMlc.length })}
          onPress={() => {
            setTab('mlc');
          }}
        />
      </div>

      <div className="emergency-legend" role="group" aria-label={t('legendLabel')}>
        {counts.map(({ category, count }) => (
          <button
            key={category.level}
            type="button"
            aria-pressed={triageFilter === category.level}
            className={`emergency-legend__item emergency-triage--${String(category.level)}${triageFilter === category.level ? ' emergency-legend__item--on' : ''}`}
            onClick={() => {
              setTriageFilter((current) => (current === category.level ? null : category.level));
              setTab('board');
            }}
          >
            <span className="emergency-legend__count">{f.number(count)}</span>
            <span>
              {category.level} · {f.text(category.name)}
            </span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={triageFilter === 0}
          className={`emergency-legend__item emergency-triage--none${triageFilter === 0 ? ' emergency-legend__item--on' : ''}`}
          onClick={() => {
            setTriageFilter((current) => (current === 0 ? null : 0));
            setTab('board');
          }}
        >
          <span className="emergency-legend__count">{f.number(untriaged)}</span>
          <span>{t('notTriaged')}</span>
        </button>
      </div>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'board', label: t('tabBoard'), badge: f.number(visible.length), content: board },
          { id: 'clocks', label: t('tabClocks'), badge: f.number(clocks.length), content: clockView },
          { id: 'mlc', label: t('tabMlc'), badge: f.number(pendingMlc.length), content: mlcView },
        ]}
      />
      {dialogNode}
    </div>
  );
}
