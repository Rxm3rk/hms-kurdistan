/**
 * The hospital-wide laboratory worklist: specimen accessioning by barcode, worklists per section
 * (haematology, biochemistry, microbiology), analyser status, quality control on a Levey–Jennings chart with
 * Westgard rules, the critical-result call log with read-back to in-house and outside doctors, and
 * turnaround time per test. Every change stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  findStaff,
  getPatient,
  locationOf,
  minutesFromNow,
  type OrderPriority,
} from '../../data/index.ts';
import {
  ACCESSIONS,
  ANALYSERS,
  CRITICAL_CALLS,
  QC_RUN_DAYS,
  QC_SERIES,
  TAT_STATS,
  findLabTest,
  westgard,
  type Accession,
  type AccessionStatus,
  type Analyser,
  type AnalyserState,
  type CriticalCall,
  type LabSection,
} from '../../data/ext/labworklist.ts';
import { useFormat, useLocale, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  BarChart,
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
  IconButton,
  KeyValueList,
  Meter,
  PageHeader,
  PatientInline,
  Qty,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  Toolbar,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import type { Tone } from '../../data/index.ts';
import { LjChart } from './lj-chart.tsx';
import './labworklist.css';
import { messages } from './messages.ts';

const STATUS_TONE: Readonly<Record<AccessionStatus, Tone>> = {
  'awaiting-receipt': 'warning',
  received: 'info',
  'on-analyser': 'accent',
  resulted: 'info',
  verified: 'success',
  rejected: 'danger',
};

const STATUS_KEY = {
  'awaiting-receipt': 'stAwaiting',
  received: 'stReceived',
  'on-analyser': 'stOnAnalyser',
  resulted: 'stResulted',
  verified: 'stVerified',
  rejected: 'stRejected',
} as const satisfies Record<AccessionStatus, string>;

const SECTION_KEY = {
  haematology: 'secHaem',
  biochemistry: 'secBiochem',
  microbiology: 'secMicro',
} as const satisfies Record<LabSection, string>;

const ANALYSER_TONE: Readonly<Record<AnalyserState, Tone>> = { running: 'success', 'qc-due': 'warning', maintenance: 'info', down: 'danger' };
const ANALYSER_KEY = { running: 'anRunning', 'qc-due': 'anQcDue', maintenance: 'anMaintenance', down: 'anDown' } as const satisfies Record<AnalyserState, string>;

const PRIORITY_RANK: Readonly<Record<OrderPriority, number>> = { stat: 0, urgent: 1, routine: 2 };
const OPEN: ReadonlySet<AccessionStatus> = new Set(['awaiting-receipt', 'received', 'on-analyser', 'resulted']);
const DEFAULT_ANALYSER: Readonly<Record<LabSection, string>> = { haematology: 'AN-XN1000', biochemistry: 'AN-C311', microbiology: 'AN-BACT' };
const LAB_USER = 'SYN-STF-011';

const REJECT_REASONS = ['rjHaemolysed', 'rjClotted', 'rjUnlabelled', 'rjInsufficient', 'rjWrongTube'] as const;

function targetMin(accession: Accession): number {
  const targets = accession.tests.map((code) => {
    const test = findLabTest(code);
    if (test === undefined) {
      return 60;
    }
    return accession.priority === 'stat' ? test.tatStatMin : test.tatRoutineMin;
  });
  return Math.max(...targets);
}

function elapsedMin(accession: Accession): number {
  return -minutesFromNow(accession.receivedIso ?? accession.collectedIso);
}

export function LabWorklistScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const locale = useLocale();
  const toast = useToast();
  const goTo = useGoTo();

  const [accessions, setAccessions] = useState<readonly Accession[]>(ACCESSIONS);
  const [analysers, setAnalysers] = useState<readonly Analyser[]>(ANALYSERS);
  const [calls, setCalls] = useState<readonly CriticalCall[]>(CRITICAL_CALLS);
  const [tab, setTab] = useState('worklist');
  const [section, setSection] = useState<'all' | LabSection>('all');
  const [view, setView] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scan, setScan] = useState('');
  const [scanResult, setScanResult] = useState<{ readonly tone: Tone; readonly text: string } | null>(null);
  const [qcId, setQcId] = useState<string>('QC-CREA-1');
  const [qcHeld, setQcHeld] = useState<ReadonlySet<string>>(new Set());
  const [callTarget, setCallTarget] = useState<CriticalCall | null>(null);
  const [readBack, setReadBack] = useState(false);
  const [receiver, setReceiver] = useState('');
  const [rejecting, setRejecting] = useState<Accession | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('rjHaemolysed');

  const update = (id: string, patch: Partial<Accession>): void => {
    setAccessions((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return accessions
      .filter((row) => section === 'all' || row.section === section)
      .filter((row) => view === 'all' || OPEN.has(row.status))
      .filter((row) => {
        if (needle === '') {
          return true;
        }
        const patient = getPatient(row.source.patientId);
        return [row.id, patient.mrn, patient.name.latin, patient.name.ckb, patient.name.ar, ...row.tests].some((part) => part.toLowerCase().includes(needle));
      })
      .toSorted((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.collectedIso.localeCompare(b.collectedIso));
  }, [accessions, section, view, search]);

  const selected = accessions.find((row) => row.id === selectedId) ?? null;
  const awaiting = accessions.filter((row) => row.status === 'awaiting-receipt');
  const inProgress = accessions.filter((row) => row.status === 'received' || row.status === 'on-analyser');
  const statOpen = accessions.filter((row) => row.priority === 'stat' && OPEN.has(row.status));
  const callsPending = calls.filter((call) => call.calledIso === null);
  const totalTat = TAT_STATS.reduce((sum, stat) => sum + stat.count, 0);
  const withinTat = TAT_STATS.reduce((sum, stat) => sum + stat.count * stat.withinTarget, 0) / totalTat;

  const sourceText = (row: Accession): string => {
    switch (row.source.kind) {
      case 'ward': {
        const loc = locationOf(row.source.patientId);
        return loc === undefined ? t('srcWard') : `${f.text(loc.ward.name)} · ${loc.bedId}`;
      }
      case 'opd':
        return f.text(row.source.clinic);
      case 'er':
        return t('srcEr');
      case 'external':
        return t('srcExternal', { name: personName(row.source.doctor.name, locale) });
    }
  };

  const testChips = (codes: readonly string[]): ReactNode => (
    <span className="lw-chips">
      {codes.map((code) => (
        <Code key={code} className="lw-chip">
          {code}
        </Code>
      ))}
    </span>
  );

  const tatCell = (row: Accession): ReactNode => {
    if (!OPEN.has(row.status)) {
      return <span className="lw-muted">—</span>;
    }
    const elapsed = elapsedMin(row);
    const target = targetMin(row);
    const tone: Tone = elapsed > target ? 'danger' : elapsed > target * 0.75 ? 'warning' : 'neutral';
    return (
      <Badge tone={tone} size="sm" {...(tone === 'danger' ? { icon: 'clock' as const } : {})}>
        {t('tatOf', { elapsed: f.number(elapsed), target: f.number(target) })}
      </Badge>
    );
  };

  const columns: readonly Column<Accession>[] = [
    {
      id: 'barcode',
      header: t('colBarcode'),
      nowrap: true,
      cell: (row) => (
        <span className="lw-two">
          <Code>{row.id}</Code>
          <span className="lw-muted">{t('collectedAt', { time: f.time(row.collectedIso) })}</span>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={getPatient(row.source.patientId)} /> },
    {
      id: 'source',
      header: t('colSource'),
      cell: (row) => (
        <span className="lw-two">
          <span>{sourceText(row)}</span>
          <span className="lw-muted">{t(SECTION_KEY[row.section])}</span>
        </span>
      ),
    },
    { id: 'tests', header: t('colTests'), cell: (row) => testChips(row.tests) },
    {
      id: 'priority',
      header: t('colPriority'),
      cell: (row) => (
        <Badge tone={PRIORITY_TONE[row.priority]} size="sm" strong={row.priority === 'stat'}>
          {f.text(PRIORITY_LABEL[row.priority])}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <span className="lw-badges">
          <Badge tone={STATUS_TONE[row.status]} size="sm">
            {t(STATUS_KEY[row.status])}
          </Badge>
          {row.critical ? (
            <Badge tone="danger" icon="alert" size="sm" strong>
              {t('critical')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    { id: 'tat', header: t('colTat'), nowrap: true, align: 'end', cell: tatCell },
  ];

  const receive = (row: Accession): void => {
    update(row.id, { status: 'received', receivedIso: DEMO_NOW_ISO });
    toast({ tone: 'success', title: t('toastReceived', { id: row.id }) });
  };

  const advance = (row: Accession): void => {
    if (row.status === 'awaiting-receipt') {
      receive(row);
    } else if (row.status === 'received') {
      update(row.id, { status: 'on-analyser', analyserId: DEFAULT_ANALYSER[row.section] });
      toast({ tone: 'info', title: t('toastLoaded', { id: row.id }) });
    } else if (row.status === 'on-analyser') {
      update(row.id, { status: 'resulted' });
      toast({ tone: 'info', title: t('toastResulted', { id: row.id }) });
    } else if (row.status === 'resulted') {
      update(row.id, { status: 'verified' });
      toast({ tone: 'success', title: t('toastVerified', { id: row.id }) });
    }
  };

  const advanceLabel = (status: AccessionStatus): string | null => {
    switch (status) {
      case 'awaiting-receipt':
        return t('actReceive');
      case 'received':
        return t('actLoad');
      case 'on-analyser':
        return t('actResult');
      case 'resulted':
        return t('actVerify');
      default:
        return null;
    }
  };

  const doScan = (): void => {
    const code = scan.trim().toUpperCase();
    if (code === '') {
      return;
    }
    const row = accessions.find((candidate) => candidate.id === code);
    if (row === undefined) {
      setScanResult({ tone: 'danger', text: t('scanUnknown', { id: code }) });
    } else if (row.status !== 'awaiting-receipt') {
      setScanResult({ tone: 'warning', text: t('scanAlready', { id: code, status: t(STATUS_KEY[row.status]) }) });
    } else {
      receive(row);
      setScanResult({ tone: 'success', text: t('scanOk', { id: code, tests: row.tests.join(', ') }) });
    }
    setScan('');
  };

  // ---------------------------------------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------------------------------------

  const detail = (row: Accession): ReactNode => {
    const patient = getPatient(row.source.patientId);
    const orderer = findStaff(row.orderedById);
    const analyser = analysers.find((candidate) => candidate.id === row.analyserId);
    const next = advanceLabel(row.status);
    return (
      <Card
        title={<Code>{row.id}</Code>}
        subtitle={t(SECTION_KEY[row.section])}
        icon="flask"
        tone={row.critical ? 'danger' : row.priority === 'stat' ? 'warning' : 'neutral'}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedId(null); }} />}
      >
        <div className="lw-detail">
          <PatientInline patient={patient} secondary />
          {row.critical ? (
            <Callout tone="danger" title={t('criticalTitle')} role="note">
              {t('criticalBody')}
            </Callout>
          ) : null}
          {row.note === null ? null : <Callout tone={row.status === 'rejected' ? 'danger' : 'info'}>{f.text(row.note)}</Callout>}
          <KeyValueList
            columns={2}
            items={[
              { id: 'status', label: t('colStatus'), value: <Badge tone={STATUS_TONE[row.status]} size="sm">{t(STATUS_KEY[row.status])}</Badge> },
              { id: 'priority', label: t('colPriority'), value: f.text(PRIORITY_LABEL[row.priority]) },
              { id: 'source', label: t('colSource'), value: sourceText(row) },
              { id: 'orderer', label: t('orderedBy'), value: orderer === undefined ? (row.source.kind === 'external' ? personName(row.source.doctor.name, locale) : '—') : <StaffName member={orderer} /> },
              { id: 'collected', label: t('collected'), value: f.time(row.collectedIso) },
              { id: 'received', label: t('received'), value: row.receivedIso === null ? '—' : f.time(row.receivedIso) },
              { id: 'analyser', label: t('analyser'), value: analyser === undefined ? '—' : <Code>{analyser.model}</Code> },
              { id: 'tat', label: t('colTat'), value: tatCell(row) },
            ]}
          />
          <div>
            <p className="lw-label">{t('colTests')}</p>
            <ul className="lw-test-list">
              {row.tests.map((code) => {
                const test = findLabTest(code);
                return (
                  <li key={code}>
                    <Code>{code}</Code> {test === undefined ? null : <span>{f.text(test.name)}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="lw-actions">
            {next === null ? null : (
              <Button variant="primary" icon="check" onPress={() => { advance(row); }}>
                {next}
              </Button>
            )}
            <Button icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastLabel', { id: row.id }) }); }}>
              {t('actPrintLabel')}
            </Button>
            {OPEN.has(row.status) ? (
              <Button variant="danger" icon="x" onPress={() => { setRejecting(row); }}>
                {t('actReject')}
              </Button>
            ) : null}
            <Button variant="ghost" iconEnd="arrow-forward" onPress={() => { goTo('lab', { patient: patient.id }); }}>
              {t('actOpenResults')}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------------------------------------

  const worklistTab = (
    <div className={selected === null ? 'lw-single' : 'lw-split'}>
      <Card flush>
        <div className="lw-toolbar">
          <Toolbar label={t('filters')}>
            <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
            <Segmented
              label={t('section')}
              hideLabel
              value={section}
              onChange={(id) => { setSection(id as 'all' | LabSection); }}
              options={[
                { id: 'all', label: t('secAll') },
                { id: 'haematology', label: t('secHaem') },
                { id: 'biochemistry', label: t('secBiochem') },
                { id: 'microbiology', label: t('secMicro') },
              ]}
            />
            <Segmented
              label={t('view')}
              hideLabel
              value={view}
              onChange={(id) => { setView(id as 'open' | 'all'); }}
              options={[
                { id: 'open', label: t('viewOpen') },
                { id: 'all', label: t('viewAll') },
              ]}
            />
          </Toolbar>
          <span className="lw-muted">{t('rowsShown', { count: rows.length })}</span>
        </div>
        <DataTable
          caption={t('worklistTitle')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          selectedKey={selectedId}
          onRowAction={(row) => { setSelectedId(row.id); }}
          rowTone={(row) => (row.critical && OPEN.has(row.status) ? 'danger' : row.status === 'rejected' ? 'neutral' : row.priority === 'stat' && OPEN.has(row.status) ? 'warning' : undefined)}
          emptyText={<EmptyState compact icon="flask" title={t('emptyWorklist')} body={t('emptyWorklistBody')} />}
          dense
        />
      </Card>
      {selected === null ? null : detail(selected)}
    </div>
  );

  const accessionTab = (
    <div className="lw-split lw-split--even">
      <Card title={t('scanTitle')} subtitle={t('scanSubtitle')} icon="scan">
        <div className="lw-scan">
          <TextInput
            label={t('scanLabel')}
            value={scan}
            onChange={setScan}
            placeholder="SYN-SPC-260104"
            dir="ltr"
            description={t('scanHint')}
          />
          <Button variant="primary" icon="check" onPress={doScan} isDisabled={scan.trim() === ''}>
            {t('actReceive')}
          </Button>
        </div>
        {scanResult === null ? null : (
          <Callout tone={scanResult.tone} role="status">
            {scanResult.text}
          </Callout>
        )}
        <p className="lw-muted lw-hint">{t('scanDemoHint')}</p>
      </Card>
      <Card title={t('awaitingTitle')} subtitle={t('awaitingSubtitle', { count: awaiting.length })} icon="clock" flush>
        {awaiting.length === 0 ? (
          <EmptyState compact icon="check-circle" title={t('awaitingEmpty')} />
        ) : (
          <ul className="lw-list">
            {awaiting
              .toSorted((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
              .map((row) => (
                <li key={row.id} className="lw-list__item">
                  <div className="lw-two">
                    <span className="lw-row">
                      <Code>{row.id}</Code>
                      <Badge tone={PRIORITY_TONE[row.priority]} size="sm" strong={row.priority === 'stat'}>
                        {f.text(PRIORITY_LABEL[row.priority])}
                      </Badge>
                    </span>
                    <PatientInline patient={getPatient(row.source.patientId)} />
                    <span className="lw-muted">
                      {sourceText(row)} · {t('collectedAt', { time: f.time(row.collectedIso) })}
                    </span>
                  </div>
                  <Button size="sm" onPress={() => { receive(row); }}>
                    {t('actReceive')}
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );

  const analysersTab = (
    <Grid min="18rem">
      {analysers.map((analyser) => (
        <Card
          key={analyser.id}
          title={<Code>{analyser.model}</Code>}
          subtitle={t(SECTION_KEY[analyser.section])}
          icon="activity"
          tone={analyser.state === 'running' ? undefined : ANALYSER_TONE[analyser.state]}
          actions={
            <Badge tone={ANALYSER_TONE[analyser.state]} size="sm">
              {t(ANALYSER_KEY[analyser.state])}
            </Badge>
          }
        >
          <div className="lw-detail">
            <KeyValueList
              columns={2}
              items={[
                { id: 'samples', label: t('samplesToday'), value: f.number(analyser.samplesToday) },
                { id: 'queue', label: t('queue'), value: f.number(analyser.queue) },
                { id: 'qc', label: t('lastQc'), value: f.relative(analyser.lastQcIso) },
                { id: 'id', label: t('analyserId'), value: <Code>{analyser.id}</Code> },
              ]}
            />
            <Meter
              label={t('reagent')}
              value={analyser.reagentLevel}
              valueLabel={f.percent(analyser.reagentLevel)}
              tone={analyser.reagentLevel < 0.25 ? 'danger' : analyser.reagentLevel < 0.5 ? 'warning' : 'success'}
            />
            {analyser.note === null ? null : <p className="lw-muted">{f.text(analyser.note)}</p>}
            <div className="lw-actions">
              <Button
                size="sm"
                icon="check"
                isDisabled={analyser.state === 'running' && minutesFromNow(analyser.lastQcIso) > -12 * 60}
                onPress={() => {
                  setAnalysers((current) =>
                    current.map((item) => (item.id === analyser.id ? { ...item, state: 'running', lastQcIso: DEMO_NOW_ISO, note: null } : item)),
                  );
                  toast({ tone: 'success', title: t('toastQcRun', { model: analyser.model }) });
                }}
              >
                {t('actRunQc')}
              </Button>
              <Button size="sm" variant="ghost" icon="refresh" onPress={() => { toast({ tone: 'info', title: t('toastReagent', { model: analyser.model }) }); }}>
                {t('actReagent')}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </Grid>
  );

  const qc = QC_SERIES.find((candidate) => candidate.id === qcId) ?? QC_SERIES[0];
  const qcTab =
    qc === undefined ? null : (
      (() => {
        const hits = westgard(qc);
        const lastHit = hits.find((hit) => hit.index === qc.values.length - 1);
        const analyser = analysers.find((candidate) => candidate.id === qc.analyserId);
        const held = qcHeld.has(qc.id);
        const test = findLabTest(qc.testCode);
        return (
          <div className="lw-stack">
            <Card
              title={t('qcTitle')}
              subtitle={t('qcSubtitle')}
              icon="chart"
              actions={
                <SelectField
                  label={t('qcSeries')}
                  hideLabel
                  selectedKey={qc.id}
                  onSelectionChange={setQcId}
                  options={QC_SERIES.map((item) => ({
                    id: item.id,
                    label: `${item.testCode === 'CBC' ? 'HGB' : item.testCode} · ${t('qcLevel', { level: item.level })} · ${analysers.find((a) => a.id === item.analyserId)?.model ?? ''}`,
                  }))}
                />
              }
            >
              <div className="lw-qc-meta">
                <span>
                  {t('qcAnalyte')} <Code>{qc.testCode === 'CBC' ? 'HGB' : qc.testCode}</Code> {test === undefined || qc.testCode === 'CBC' ? null : `(${f.text(test.name)})`}
                </span>
                <span>
                  {t('qcLot')} <Code>{qc.lot}</Code>
                </span>
                <span>
                  {t('qcMean')} <Qty value={String(qc.mean)} unit={qc.unit} />
                </span>
                <span>
                  {t('qcSd')} <Qty value={String(qc.sd)} unit={qc.unit} />
                </span>
                {analyser === undefined ? null : (
                  <span>
                    {t('analyser')} <Code>{analyser.model}</Code>
                  </span>
                )}
              </div>
              <LjChart
                qc={qc}
                hits={hits}
                runLabels={QC_RUN_DAYS.map((iso) => f.date(iso))}
                label={t('qcChartLabel', { analyte: qc.testCode, level: qc.level })}
                meanLabel={t('qcMeanShort')}
                formatValue={(value) => f.number(value)}
              />
              <div className="lw-legend">
                <span><span className="lw-legend__dot" /> {t('legendOk')}</span>
                <span><span className="lw-legend__dot lw-legend__dot--warn" /> {t('legendWarn')}</span>
                <span><span className="lw-legend__dot lw-legend__dot--reject" /> {t('legendReject')}</span>
              </div>
            </Card>
            {lastHit?.reject === true ? (
              <Callout
                tone="danger"
                title={t('qcRejectTitle', { rule: lastHit.rule })}
                role="alert"
                actions={
                  held ? (
                    <Badge tone="danger" icon="lock">{t('qcHeldBadge')}</Badge>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      icon="lock"
                      onPress={() => {
                        setQcHeld((current) => new Set([...current, qc.id]));
                        toast({ tone: 'warning', title: t('toastQcHold', { analyte: qc.testCode }) });
                      }}
                    >
                      {t('actHoldResults')}
                    </Button>
                  )
                }
              >
                {t('qcRejectBody')}
              </Callout>
            ) : (
              <Callout tone="success" title={t('qcAcceptTitle')}>
                {t('qcAcceptBody')}
              </Callout>
            )}
            <Card title={t('qcRulesTitle')} subtitle={t('qcRulesSubtitle')} icon="alert" flush>
              <DataTable
                caption={t('qcRulesTitle')}
                dense
                rows={hits.toReversed()}
                rowKey={(hit) => `${String(hit.index)}-${hit.rule}`}
                rowTone={(hit) => (hit.reject ? 'danger' : 'warning')}
                emptyText={t('qcNoHits')}
                columns={[
                  { id: 'run', header: t('qcRun'), nowrap: true, cell: (hit) => f.date(QC_RUN_DAYS[hit.index] ?? DEMO_NOW_ISO) },
                  { id: 'value', header: t('qcValue'), cell: (hit) => <Qty value={String(qc.values[hit.index] ?? '')} unit={qc.unit} /> },
                  { id: 'rule', header: t('qcRule'), cell: (hit) => <Code>{hit.rule}</Code> },
                  {
                    id: 'outcome',
                    header: t('qcOutcome'),
                    cell: (hit) => (
                      <Badge tone={hit.reject ? 'danger' : 'warning'} size="sm">
                        {hit.reject ? t('qcRejectShort') : t('qcWarnShort')}
                      </Badge>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        );
      })()
    );

  const callColumns: readonly Column<CriticalCall>[] = [
    {
      id: 'result',
      header: t('colResult'),
      cell: (call) => (
        <span className="lw-two">
          <span className="lw-row">
            <Code>{call.testCode === 'CBC' ? 'HGB' : call.testCode}</Code>
            <Qty value={call.value} unit={call.unit} className="lw-strong" />
          </span>
          <span className="lw-muted">
            <Code>{call.accessionId}</Code> · {f.time(call.resultedIso)}
          </span>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (call) => <PatientInline patient={getPatient(call.patientId)} /> },
    {
      id: 'recipient',
      header: t('colRecipient'),
      cell: (call) => {
        if (call.recipient.kind === 'staff') {
          const member = findStaff(call.recipient.staffId);
          return (
            <span className="lw-two">
              {member === undefined ? '—' : <StaffName member={member} />}
              <Badge tone="info" size="sm">{t('recipientInternal')}</Badge>
            </span>
          );
        }
        return (
          <span className="lw-two">
            <span>{personName(call.recipient.doctor.name, locale)}</span>
            <span className="lw-muted">{f.text(call.recipient.doctor.clinic)}</span>
            <Badge tone="accent" size="sm">{t('recipientExternal')}</Badge>
          </span>
        );
      },
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (call) => {
        if (call.calledIso === null) {
          const waited = -minutesFromNow(call.resultedIso);
          return (
            <span className="lw-two">
              <Badge tone="danger" icon="alert" size="sm" strong>{t('callPending')}</Badge>
              <span className="lw-muted">{t('callWaiting', { minutes: f.number(waited), attempts: call.attempts })}</span>
            </span>
          );
        }
        const by = findStaff(call.calledById);
        return (
          <span className="lw-two">
            <Badge tone="success" icon="check" size="sm">{call.readBack ? t('callReadBack') : t('callNotified')}</Badge>
            <span className="lw-muted">
              {f.dateTime(call.calledIso)} {by === undefined ? null : <>· <StaffName member={by} /></>}
            </span>
          </span>
        );
      },
    },
    {
      id: 'action',
      header: t('colAction'),
      align: 'end',
      cell: (call) =>
        call.calledIso === null ? (
          <Button
            size="sm"
            variant="primary"
            icon="phone"
            onPress={() => {
              setReadBack(false);
              setReceiver('');
              setCallTarget(call);
            }}
          >
            {t('actCall')}
          </Button>
        ) : null,
    },
  ];

  const criticalTab = (
    <div className="lw-stack">
      {callsPending.length > 0 ? (
        <Callout tone="danger" role="alert" title={t('callsPendingTitle', { count: callsPending.length })}>
          {t('callsPolicy')}
        </Callout>
      ) : (
        <Callout tone="success" title={t('callsAllDone')}>{t('callsPolicy')}</Callout>
      )}
      <Card title={t('callsTitle')} subtitle={t('callsSubtitle')} icon="phone" flush>
        <DataTable
          caption={t('callsTitle')}
          columns={callColumns}
          rows={calls.toSorted((a, b) => (a.calledIso === null ? 0 : 1) - (b.calledIso === null ? 0 : 1) || b.resultedIso.localeCompare(a.resultedIso))}
          rowKey={(call) => call.id}
          rowTone={(call) => (call.calledIso === null ? 'danger' : undefined)}
        />
      </Card>
    </div>
  );

  const tatTab = (
    <div className="lw-split lw-split--even">
      <Card title={t('tatTitle')} subtitle={t('tatSubtitle')} icon="clock" flush>
        <DataTable
          caption={t('tatTitle')}
          dense
          rows={TAT_STATS}
          rowKey={(stat) => stat.code}
          rowTone={(stat) => (stat.withinTarget < 0.8 ? 'warning' : undefined)}
          columns={[
            {
              id: 'test',
              header: t('colTest'),
              cell: (stat) => {
                const test = findLabTest(stat.code);
                return (
                  <span className="lw-two">
                    <Code>{stat.code}</Code>
                    <span className="lw-muted">{test === undefined ? '' : f.text(test.name)}</span>
                  </span>
                );
              },
            },
            { id: 'count', header: t('colCount'), align: 'end', cell: (stat) => f.number(stat.count) },
            { id: 'target', header: t('colTarget'), align: 'end', nowrap: true, cell: (stat) => t('minutes', { count: findLabTest(stat.code)?.tatRoutineMin ?? 0 }) },
            { id: 'median', header: t('colMedian'), align: 'end', nowrap: true, cell: (stat) => t('minutes', { count: stat.medianMin }) },
            { id: 'p90', header: t('colP90'), align: 'end', nowrap: true, cell: (stat) => t('minutes', { count: stat.p90Min }) },
            {
              id: 'within',
              header: t('colWithin'),
              width: '9rem',
              cell: (stat) => (
                <Meter
                  label={t('colWithin')}
                  showText={false}
                  value={stat.withinTarget}
                  valueLabel={f.percent(stat.withinTarget)}
                  tone={stat.withinTarget < 0.8 ? 'warning' : 'success'}
                />
              ),
            },
            { id: 'pct', header: '%', align: 'end', cell: (stat) => f.percent(stat.withinTarget) },
          ]}
        />
      </Card>
      <Card title={t('tatChartTitle')} subtitle={t('tatChartSubtitle')} icon="chart">
        <BarChart
          label={t('tatChartTitle')}
          max={1}
          data={TAT_STATS.map((stat) => ({
            id: stat.code,
            label: <Code>{stat.code}</Code>,
            value: stat.withinTarget,
            valueLabel: f.percent(stat.withinTarget),
            ...(stat.withinTarget < 0.8 ? { tone: 'warning' as const } : {}),
          }))}
        />
        <p className="lw-muted lw-hint">{t('tatNote')}</p>
      </Card>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------------------------------------

  const callItems = (call: CriticalCall): readonly { readonly id: string; readonly label: string; readonly value: ReactNode }[] => {
    const recipient = call.recipient;
    if (recipient.kind === 'staff') {
      const member = findStaff(recipient.staffId);
      return [
        { id: 'to', label: t('colRecipient'), value: member === undefined ? '—' : <StaffName member={member} /> },
        { id: 'phone', label: t('phone'), value: <Code>{member?.phone ?? '—'}</Code> },
      ];
    }
    return [
      { id: 'to', label: t('colRecipient'), value: personName(recipient.doctor.name, locale) },
      { id: 'phone', label: t('phone'), value: <Code>{recipient.doctor.phone}</Code> },
      { id: 'clinic', label: t('clinic'), value: f.text(recipient.doctor.clinic) },
    ];
  };

  const callDialog =
    callTarget === null ? null : (
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) { setCallTarget(null); } }}
        title={t('callDialogTitle')}
        subtitle={t('callDialogSubtitle')}
        actions={
          <>
            <Button onPress={() => { setCallTarget(null); }}>{t('cancel')}</Button>
            <Button
              onPress={() => {
                setCalls((current) => current.map((call) => (call.id === callTarget.id ? { ...call, attempts: call.attempts + 1 } : call)));
                toast({ tone: 'warning', title: t('toastNoAnswer') });
                setCallTarget(null);
              }}
            >
              {t('actNoAnswer')}
            </Button>
            <Button
              variant="primary"
              icon="check"
              isDisabled={!readBack || receiver.trim() === ''}
              onPress={() => {
                setCalls((current) =>
                  current.map((call) => (call.id === callTarget.id ? { ...call, calledIso: DEMO_NOW_ISO, calledById: LAB_USER, readBack: true } : call)),
                );
                toast({ tone: 'success', title: t('toastCalled'), body: t('toastCalledBody', { name: receiver.trim() }) });
                setCallTarget(null);
              }}
            >
              {t('actRecordCall')}
            </Button>
          </>
        }
      >
        <div className="lw-detail">
          <Callout tone="danger" title={t('callScript')}>
            <span className="lw-row">
              <Code>{callTarget.testCode === 'CBC' ? 'HGB' : callTarget.testCode}</Code>
              <Qty value={callTarget.value} unit={callTarget.unit} className="lw-strong" />
            </span>
          </Callout>
          <PatientInline patient={getPatient(callTarget.patientId)} />
          <KeyValueList
            columns={2}
            items={callItems(callTarget)}
          />
          <TextInput label={t('receiverName')} value={receiver} onChange={setReceiver} isRequired description={t('receiverHint')} />
          <Checkbox isSelected={readBack} onChange={setReadBack}>
            {t('readBackConfirm')}
          </Checkbox>
        </div>
      </Dialog>
    );

  const rejectDialog =
    rejecting === null ? null : (
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) { setRejecting(null); } }}
        title={t('rejectTitle', { id: rejecting.id })}
        actions={
          <>
            <Button onPress={() => { setRejecting(null); }}>{t('cancel')}</Button>
            <Button
              variant="danger"
              icon="x"
              onPress={() => {
                const reason = REJECT_REASONS.find((key) => key === rejectReason) ?? 'rjHaemolysed';
                update(rejecting.id, {
                  status: 'rejected',
                  note: { en: messages.en[reason], ckb: messages.ckb[reason], ar: messages.ar[reason] },
                });
                toast({ tone: 'warning', title: t('toastRejected', { id: rejecting.id }), body: t('toastRejectedBody') });
                setRejecting(null);
              }}
            >
              {t('actReject')}
            </Button>
          </>
        }
      >
        <SelectField
          label={t('rejectReason')}
          selectedKey={rejectReason}
          onSelectionChange={setRejectReason}
          options={REJECT_REASONS.map((key) => ({ id: key, label: t(key) }))}
        />
      </Dialog>
    );

  return (
    <div className="lw-screen">
      <PageHeader
        icon="flask"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <Button variant="primary" icon="scan" onPress={() => { setTab('accession'); }}>
            {t('actAccession')}
          </Button>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiAwaiting')} value={f.number(awaiting.length)} icon="clock" tone={awaiting.length > 0 ? 'warning' : 'success'} hint={t('kpiAwaitingHint')} onPress={() => { setTab('accession'); }} />
        <StatTile label={t('kpiInProgress')} value={f.number(inProgress.length)} icon="flask" hint={t('kpiInProgressHint')} onPress={() => { setTab('worklist'); }} />
        <StatTile label={t('kpiStat')} value={f.number(statOpen.length)} icon="alert" tone={statOpen.length > 0 ? 'danger' : 'success'} hint={t('kpiStatHint')} onPress={() => { setView('open'); setTab('worklist'); }} />
        <StatTile label={t('kpiCalls')} value={f.number(callsPending.length)} icon="phone" tone={callsPending.length > 0 ? 'danger' : 'success'} hint={t('kpiCallsHint')} onPress={() => { setTab('critical'); }} />
        <StatTile label={t('kpiTat')} value={f.percent(withinTat)} icon="activity" tone={withinTat < 0.85 ? 'warning' : 'success'} hint={t('kpiTatHint')} trend={[0.82, 0.84, 0.81, 0.86, 0.85, 0.83, withinTat]} trendLabel={t('kpiTat')} onPress={() => { setTab('tat'); }} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'worklist', label: t('tabWorklist'), badge: f.number(accessions.filter((row) => OPEN.has(row.status)).length), content: worklistTab },
          { id: 'accession', label: t('tabAccession'), badge: f.number(awaiting.length), content: accessionTab },
          { id: 'analysers', label: t('tabAnalysers'), content: analysersTab },
          { id: 'qc', label: t('tabQc'), content: qcTab },
          { id: 'critical', label: t('tabCritical'), ...(callsPending.length > 0 ? { badge: f.number(callsPending.length) } : {}), content: criticalTab },
          { id: 'tat', label: t('tabTat'), content: tatTab },
        ]}
      />
      {callDialog}
      {rejectDialog}
    </div>
  );
}
