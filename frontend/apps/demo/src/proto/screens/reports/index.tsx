/**
 * The Reports & returns screen (hospital-wide): KRG and MOH statutory returns with due dates and the
 * prepare → ready → submit flow, the notifiable diseases register, birth and death registers with civil
 * status notification, a DHIS2 aggregate export preview with validation, the report catalogue and a simple
 * report builder. Changes stay in React state. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_TODAY, demoDate, findStaff, getPatient, minutesFromNow } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import {
  BIRTHS,
  CATALOGUE,
  DEATHS,
  DHIS2_DATASET,
  DHIS2_ORG_UNIT,
  DHIS2_PERIOD,
  DHIS2_VALUES,
  NOTIFIABLE,
  RETURNS,
  type Birth,
  type CatalogueReport,
  type Death,
  type Dhis2Value,
  type NotifiableCase,
  type ReportArea,
  type ReturnStatus,
  type StatutoryReturn,
} from '../../data/ext/reports.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Grid,
  Icon,
  PageHeader,
  PatientName,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { ReportBuilder } from './builder.tsx';
import { messages } from './messages.ts';
import './reports.css';

const STATUS_KEY = {
  'not-started': 'st_not_started',
  draft: 'st_draft',
  ready: 'st_ready',
  submitted: 'st_submitted',
  accepted: 'st_accepted',
  overdue: 'st_overdue',
} as const satisfies Record<ReturnStatus, string>;
const STATUS_TONE: Readonly<Record<ReturnStatus, Tone>> = { 'not-started': 'neutral', draft: 'info', ready: 'accent', submitted: 'success', accepted: 'success', overdue: 'danger' };
const WEEK_END = demoDate(-4);

function PatientCell({ patientId }: { readonly patientId: string }): ReactNode {
  const patient = getPatient(patientId);
  return (
    <span className="rpt-stack">
      <PatientName patient={patient} />
      <Code className="rpt-muted">{patient.mrn}</Code>
    </span>
  );
}

export function ReportsScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [tab, setTab] = useState('returns');
  const [returns, setReturns] = useState<readonly StatutoryReturn[]>(RETURNS);
  const [cases, setCases] = useState<readonly NotifiableCase[]>(NOTIFIABLE);
  const [births, setBirths] = useState<readonly Birth[]>(BIRTHS);
  const [deaths, setDeaths] = useState<readonly Death[]>(DEATHS);
  const [catalogue, setCatalogue] = useState<readonly CatalogueReport[]>(CATALOGUE);
  const [returnFilter, setReturnFilter] = useState<'open' | 'all'>('open');

  const open = (r: StatutoryReturn) => r.status !== 'submitted' && r.status !== 'accepted';
  const dueWeek = returns.filter((r) => open(r) && r.due <= WEEK_END);
  const overdue = returns.filter((r) => r.status === 'overdue' || (open(r) && r.due < DEMO_TODAY));
  const recentCases = cases.filter((c) => minutesFromNow(c.diagnosedIso) > -7 * 24 * 60);
  const unnotified = cases.filter((c) => c.notifiedIso === null && c.status !== 'discarded');
  const immediateUnnotified = unnotified.filter((c) => c.cls === 'immediate').length;

  const setReturn = (id: string, status: ReturnStatus): void => setReturns((current) => current.map((r) => (r.id === id ? { ...r, status, ...(status === 'submitted' ? { submittedIso: '2026-10-19T09:30:00+03:00' } : {}) } : r)));

  const returnColumns: readonly Column<StatutoryReturn>[] = [
    { id: 'form', header: t('colForm'), cell: (r) => <Code>{r.form}</Code>, nowrap: true },
    {
      id: 'name',
      header: t('colReturn'),
      cell: (r) => (
        <span className="rpt-stack">
          <span className="rpt-strong">{f.text(r.name)}</span>
          <span className="rpt-muted">
            {t(`fq_${r.frequency}`)} · {f.text(r.period)}
          </span>
        </span>
      ),
    },
    { id: 'to', header: t('colAuthority'), cell: (r) => <span className="rpt-muted">{f.text(r.authority)}</span> },
    {
      id: 'due',
      header: t('colDue'),
      cell: (r) => (
        <span className="rpt-stack">
          <span className={open(r) && r.due < DEMO_TODAY ? 'rpt-danger' : undefined}>{f.date(r.due)}</span>
          {open(r) ? <span className="rpt-muted">{t('dueIn', { when: r.due === DEMO_TODAY ? t('dueToday') : f.relative(r.due) })}</span> : r.submittedIso === null ? null : <span className="rpt-muted">{t('submittedOn', { date: f.date(r.submittedIso) })}</span>}
        </span>
      ),
      nowrap: true,
    },
    { id: 'channel', header: t('colChannel'), cell: (r) => t(`ch_${r.channel}`), nowrap: true },
    {
      id: 'owner',
      header: t('colOwner'),
      cell: (r) => {
        const owner = findStaff(r.ownerId);
        return owner === undefined ? '–' : <StaffName member={owner} />;
      },
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} size="sm" {...(r.status === 'overdue' ? { icon: 'alert' as const } : {})}>
          {t(STATUS_KEY[r.status])}
        </Badge>
      ),
      nowrap: true,
    },
    {
      id: 'action',
      header: <span className="hms-visually-hidden">{t('submit')}</span>,
      cell: (r) => {
        if (r.status === 'not-started' || r.status === 'overdue') {
          return (
            <Button size="sm" variant="secondary" icon="pen" onPress={() => { setReturn(r.id, 'draft'); toast({ tone: 'success', title: t('toastPrepared', { form: r.form }) }); }}>
              {t('prepare')}
            </Button>
          );
        }
        if (r.status === 'draft') {
          return (
            <Button size="sm" variant="secondary" icon="check" onPress={() => { setReturn(r.id, 'ready'); toast({ tone: 'success', title: t('toastReady', { form: r.form }) }); }}>
              {t('markReady')}
            </Button>
          );
        }
        if (r.status === 'ready') {
          return (
            <Button size="sm" variant="primary" icon="arrow-forward" onPress={() => { setReturn(r.id, 'submitted'); toast({ tone: 'success', title: t('toastSubmitted', { form: r.form, channel: t(`ch_${r.channel}`) }) }); }}>
              {t('submit')}
            </Button>
          );
        }
        return <Icon name="check-circle" className="rpt-ok" />;
      },
      align: 'end',
    },
  ];

  const caseColumns: readonly Column<NotifiableCase>[] = [
    { id: 'id', header: t('colCase'), cell: (c) => <Code>{c.id}</Code>, nowrap: true },
    {
      id: 'disease',
      header: t('colDisease'),
      cell: (c) => (
        <span className="rpt-stack">
          <Code className="rpt-strong">{c.disease}</Code>
          <Code className="rpt-muted">{c.icd10}</Code>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (c) => <PatientCell patientId={c.patientId} /> },
    { id: 'onset', header: t('colOnset'), cell: (c) => f.date(c.onset), nowrap: true },
    { id: 'diagnosed', header: t('colDiagnosed'), cell: (c) => f.relative(c.diagnosedIso), nowrap: true },
    {
      id: 'class',
      header: t('colClass'),
      cell: (c) => (
        <Badge tone={c.cls === 'immediate' ? 'danger' : 'neutral'} size="sm" {...(c.cls === 'immediate' ? { icon: 'alert' as const } : {})}>
          {t(`cls_${c.cls}`)}
        </Badge>
      ),
      nowrap: true,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (c) => (
        <Badge tone={c.status === 'confirmed' ? 'warning' : c.status === 'suspected' ? 'info' : 'neutral'} size="sm">
          {t(`ns_${c.status}`)}
        </Badge>
      ),
    },
    {
      id: 'notified',
      header: t('colNotified'),
      cell: (c) =>
        c.notifiedIso !== null ? (
          <span className="rpt-muted">{f.dateTime(c.notifiedIso)}</span>
        ) : c.status === 'discarded' ? (
          '–'
        ) : (
          <Button
            size="sm"
            variant={c.cls === 'immediate' ? 'primary' : 'secondary'}
            icon="bell"
            onPress={() => {
              setCases((current) => current.map((x) => (x.id === c.id ? { ...x, notifiedIso: '2026-10-19T09:30:00+03:00' } : x)));
              toast({ tone: 'success', title: t('toastNotified', { disease: c.disease }) });
            }}
          >
            {t('notifyNow')}
          </Button>
        ),
      align: 'end',
    },
  ];

  const birthColumns: readonly Column<Birth>[] = [
    { id: 'id', header: t('colBirth'), cell: (b) => <Code>{b.id}</Code>, nowrap: true },
    { id: 'mother', header: t('colMother'), cell: (b) => <PatientCell patientId={b.motherId} /> },
    { id: 'born', header: t('colBorn'), cell: (b) => f.dateTime(b.bornIso), nowrap: true },
    { id: 'sex', header: t('colSex'), cell: (b) => t(`sex_${b.sex}`) },
    { id: 'weight', header: t('colWeight'), cell: (b) => <Code className={b.weightG < 2500 ? 'rpt-warn' : undefined}>{t('grams', { value: f.number(b.weightG) })}</Code>, align: 'end', nowrap: true },
    { id: 'mode', header: t('colMode'), cell: (b) => t(`mode_${b.mode}`) },
    { id: 'apgar', header: t('colApgar'), cell: (b) => f.number(b.apgar5), align: 'end' },
    {
      id: 'notified',
      header: t('colNotified'),
      cell: (b) =>
        b.notified ? (
          <Badge tone="success" icon="check" size="sm">
            {t('notified')}
          </Badge>
        ) : (
          <Button size="sm" variant="primary" icon="arrow-forward" onPress={() => { setBirths((current) => current.map((x) => (x.id === b.id ? { ...x, notified: true } : x))); toast({ tone: 'success', title: t('toastBirth', { id: b.id }) }); }}>
            {t('notifyCivil')}
          </Button>
        ),
      align: 'end',
    },
  ];

  const deathColumns: readonly Column<Death>[] = [
    { id: 'id', header: t('colDeath'), cell: (d) => <Code>{d.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (d) => <PatientCell patientId={d.patientId} /> },
    { id: 'died', header: t('colDied'), cell: (d) => f.dateTime(d.diedIso), nowrap: true },
    {
      id: 'cause',
      header: t('colCause'),
      cell: (d) => (
        <span className="rpt-stack">
          <span>{f.text(d.cause)}</span>
          <span className="rpt-muted">
            <Code>{d.icd10}</Code>
            {d.coroner ? ` · ${t('coroner')}` : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'certified',
      header: t('colCertified'),
      cell: (d) => {
        const member = findStaff(d.certifiedById);
        return member === undefined ? '–' : <StaffName member={member} />;
      },
    },
    {
      id: 'notified',
      header: t('colNotified'),
      cell: (d) =>
        d.notified ? (
          <Badge tone="success" icon="check" size="sm">
            {t('notified')}
          </Badge>
        ) : (
          <Button size="sm" variant="primary" icon="arrow-forward" onPress={() => { setDeaths((current) => current.map((x) => (x.id === d.id ? { ...x, notified: true } : x))); toast({ tone: 'success', title: t('toastDeath', { id: d.id }) }); }}>
            {t('notifyCivil')}
          </Button>
        ),
      align: 'end',
    },
  ];

  return (
    <div className="reports-screen">
      <PageHeader icon="printer" eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')}>
        <Badge tone="neutral" icon="info" size="sm">
          {t('synthetic')}
        </Badge>
      </PageHeader>

      <Grid min="12rem">
        <StatTile label={t('tileDueWeek')} value={f.number(dueWeek.length)} icon="calendar" hint={t('tileDueWeekHint', { count: dueWeek.filter((r) => r.status === 'ready').length })} onPress={() => setTab('returns')} />
        <StatTile label={t('tileOverdue')} value={f.number(overdue.length)} icon="alert" tone={overdue.length > 0 ? 'danger' : 'success'} hint={t('tileOverdueHint')} onPress={() => setTab('returns')} />
        <StatTile label={t('tileNotifiable')} value={f.number(recentCases.length)} icon="shield" tone={immediateUnnotified > 0 ? 'danger' : undefined} hint={t('tileNotifiableHint', { count: unnotified.length })} onPress={() => setTab('notifiable')} />
        <StatTile label={t('tileBirths')} value={f.number(births.length)} icon="users" hint={t('tileBirthsHint', { count: births.filter((b) => !b.notified).length })} onPress={() => setTab('registers')} />
        <StatTile label={t('tileDeaths')} value={f.number(deaths.length)} icon="clipboard" hint={t('tileDeathsHint', { count: deaths.filter((d) => !d.notified).length })} onPress={() => setTab('registers')} />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          {
            id: 'returns',
            label: t('tabReturns'),
            badge: String(returns.filter(open).length),
            content: (
              <Card
                flush
                title={t('returnsTable')}
                icon="clipboard"
                actions={
                  <Segmented
                    label={t('statusFilter')}
                    hideLabel
                    options={[
                      { id: 'open', label: t('filterOpen') },
                      { id: 'all', label: t('filterAll') },
                    ]}
                    value={returnFilter}
                    onChange={(id) => setReturnFilter(id as 'open' | 'all')}
                  />
                }
              >
                <DataTable
                  caption={t('returnsTable')}
                  columns={returnColumns}
                  rows={(returnFilter === 'open' ? returns.filter(open) : returns).toSorted((a, b) => a.due.localeCompare(b.due))}
                  rowKey={(r) => r.id}
                  rowTone={(r) => (open(r) && r.due < DEMO_TODAY ? 'danger' : undefined)}
                  dense
                />
              </Card>
            ),
          },
          {
            id: 'notifiable',
            label: t('tabNotifiable'),
            badge: String(unnotified.length),
            content: (
              <div className="rpt-tab">
                {immediateUnnotified > 0 ? (
                  <Callout tone="danger" role="alert">
                    {t('immediateAlert', { count: immediateUnnotified })}
                  </Callout>
                ) : null}
                <Card flush title={t('notifiableTable')} icon="shield">
                  <DataTable
                    caption={t('notifiableTable')}
                    columns={caseColumns}
                    rows={cases}
                    rowKey={(c) => c.id}
                    onRowAction={(c) => goTo('chart', { patient: c.patientId })}
                    rowTone={(c) => (c.cls === 'immediate' && c.notifiedIso === null && c.status !== 'discarded' ? 'danger' : undefined)}
                    dense
                  />
                </Card>
              </div>
            ),
          },
          {
            id: 'registers',
            label: t('tabRegisters'),
            content: (
              <div className="rpt-tab">
                <Card flush title={t('birthsTitle')} icon="users">
                  <DataTable caption={t('birthsTable')} columns={birthColumns} rows={births} rowKey={(b) => b.id} dense />
                </Card>
                <Card flush title={t('deathsTitle')} icon="clipboard">
                  <DataTable caption={t('deathsTable')} columns={deathColumns} rows={deaths} rowKey={(d) => d.id} dense />
                </Card>
              </div>
            ),
          },
          { id: 'dhis2', label: t('tabDhis2'), content: <Dhis2Preview /> },
          { id: 'catalogue', label: t('tabCatalogue'), badge: String(catalogue.length), content: <Catalogue reports={catalogue} /> },
          {
            id: 'builder',
            label: t('tabBuilder'),
            content: (
              <ReportBuilder
                onSave={(name) => {
                  setCatalogue((current) => [
                    { id: `U${String(current.length + 1)}`, name: { en: name, ckb: name, ar: name }, area: 'clinical', schedule: { en: messages.en.onDemand, ckb: messages.ckb.onDemand, ar: messages.ar.onDemand }, lastRunIso: '2026-10-19T09:30:00+03:00', format: 'XLSX', favourite: true },
                    ...current,
                  ]);
                  setTab('catalogue');
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function jumped(v: Dhis2Value): boolean {
  return v.previous > 0 && Math.abs(v.value - v.previous) / v.previous > 0.5;
}

function Dhis2Preview(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [validated, setValidated] = useState(false);
  const [json, setJson] = useState(false);
  const flagged = DHIS2_VALUES.filter(jumped).length;
  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          dataSet: DHIS2_DATASET,
          period: DHIS2_PERIOD,
          orgUnit: DHIS2_ORG_UNIT,
          completeDate: DEMO_TODAY,
          dataValues: DHIS2_VALUES.map((v) => ({ dataElement: v.dataElement, categoryOptionCombo: v.categoryOptionCombo, value: String(v.value) })),
        },
        null,
        2,
      ),
    [],
  );
  const columns: readonly Column<Dhis2Value>[] = [
    {
      id: 'element',
      header: t('colElement'),
      cell: (v) => (
        <span className="rpt-stack">
          <span>{f.text(v.name)}</span>
          <Code className="rpt-muted">{v.dataElement}</Code>
        </span>
      ),
    },
    {
      id: 'coc',
      header: t('colCoc'),
      cell: (v) => (
        <span className="rpt-stack">
          <span>{f.text(v.disaggregation)}</span>
          <Code className="rpt-muted">{v.categoryOptionCombo}</Code>
        </span>
      ),
    },
    { id: 'value', header: t('colValue'), cell: (v) => <span className="rpt-strong">{f.number(v.value)}</span>, align: 'end' },
    { id: 'previous', header: t('colPrevious'), cell: (v) => <span className="rpt-muted">{f.number(v.previous)}</span>, align: 'end' },
    {
      id: 'check',
      header: t('colCheck'),
      cell: (v) =>
        !validated ? (
          '–'
        ) : jumped(v) ? (
          <Badge tone="warning" icon="alert" size="sm">
            {t('checkJump')}
          </Badge>
        ) : (
          <Badge tone="success" icon="check" size="sm">
            {t('checkOk')}
          </Badge>
        ),
      nowrap: true,
    },
  ];
  return (
    <div className="rpt-tab">
      <Card
        flush
        title={t('dhis2Title')}
        subtitle={t('dhis2Subtitle', { dataset: DHIS2_DATASET, orgUnit: DHIS2_ORG_UNIT, period: DHIS2_PERIOD })}
        icon="refresh"
        actions={
          <div className="rpt-actions">
            <Button
              size="sm"
              icon="check"
              onPress={() => {
                setValidated(true);
                toast({ tone: flagged > 0 ? 'warning' : 'success', title: t('toastValidated', { count: flagged }) });
              }}
            >
              {t('validate')}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setJson(!json)}>
              {json ? t('hideJson') : t('showJson')}
            </Button>
            <Button size="sm" variant="primary" icon="arrow-forward" isDisabled={!validated} onPress={() => toast({ tone: 'success', title: t('toastDhis2', { count: DHIS2_VALUES.length }) })}>
              {t('sendDhis2')}
            </Button>
          </div>
        }
      >
        <DataTable caption={t('dhis2Table')} columns={columns} rows={DHIS2_VALUES} rowKey={(v) => `${v.dataElement}.${v.categoryOptionCombo}`} rowTone={(v) => (validated && jumped(v) ? 'warning' : undefined)} dense />
      </Card>
      {json ? (
        <Card title={t('payload')} icon="clipboard">
          <pre className="rpt-json" dir="ltr">
            {payload}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}

function Catalogue({ reports }: { readonly reports: readonly CatalogueReport[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<'all' | ReportArea>('all');
  const areas: readonly ReportArea[] = ['clinical', 'finance', 'operations', 'quality', 'statutory'];
  const rows = reports.filter((r) => (area === 'all' || r.area === area) && (query.trim() === '' || f.text(r.name).toLowerCase().includes(query.trim().toLowerCase())));
  const columns: readonly Column<CatalogueReport>[] = [
    {
      id: 'name',
      header: t('colReport'),
      cell: (r) => (
        <span className="rpt-inline">
          {r.favourite ? <Icon name="check-circle" className="rpt-fav" /> : null}
          <span className="rpt-strong">{f.text(r.name)}</span>
        </span>
      ),
    },
    { id: 'area', header: t('colArea'), cell: (r) => <Badge size="sm">{t(`area_${r.area}`)}</Badge> },
    { id: 'schedule', header: t('colSchedule'), cell: (r) => f.text(r.schedule) },
    { id: 'last', header: t('colLastRun'), cell: (r) => f.relative(r.lastRunIso), nowrap: true },
    { id: 'format', header: t('colFormat'), cell: (r) => <Code>{r.format}</Code> },
    {
      id: 'run',
      header: <span className="hms-visually-hidden">{t('run')}</span>,
      cell: (r) => (
        <Button size="sm" variant="secondary" icon="printer" onPress={() => toast({ tone: 'success', title: t('toastRun', { name: f.text(r.name), format: r.format }) })}>
          {t('run')}
        </Button>
      ),
      align: 'end',
    },
  ];
  return (
    <div className="rpt-tab">
      <Toolbar label={t('catalogueTable')}>
        <SelectField
          label={t('areaFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allAreas') }, ...areas.map((a) => ({ id: a, label: t(`area_${a}`) }))]}
          selectedKey={area}
          onSelectionChange={(id) => setArea(id as 'all' | ReportArea)}
          className="rpt-select"
        />
        <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="rpt-search" />
      </Toolbar>
      <Card flush>
        <DataTable caption={t('catalogueTable')} columns={columns} rows={rows} rowKey={(r) => r.id} dense />
      </Card>
    </div>
  );
}
