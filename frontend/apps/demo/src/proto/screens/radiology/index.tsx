/**
 * Radiology (RIS): the request worklist across X-ray, CT, MRI and ultrasound; protocoling with contrast and
 * pregnancy checks; scheduling per modality room; the report editor with templates; critical findings and
 * their communication; a placeholder link to the PACS viewer. Every change stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  findStaff,
  getPatient,
  hasAllergy,
  isToday,
  locationOf,
  type OrderPriority,
  type Tone,
} from '../../data/index.ts';
import {
  RAD_EXAMS,
  RAD_REQUESTS,
  RAD_ROOMS,
  REPORT_TAT_HOURS,
  REPORT_TEMPLATES,
  SCHEDULE_HOURS,
  findExam,
  type Modality,
  type RadRequest,
  type RadStatus,
} from '../../data/ext/radiology.ts';
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
  IconButton,
  KeyValueList,
  PageHeader,
  PatientInline,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import './radiology.css';

const STATUS_TONE: Readonly<Record<RadStatus, Tone>> = {
  requested: 'warning',
  protocolled: 'info',
  scheduled: 'info',
  arrived: 'accent',
  'in-progress': 'accent',
  completed: 'warning',
  reported: 'info',
  verified: 'success',
};

const STATUS_KEY = {
  requested: 'stRequested',
  protocolled: 'stProtocolled',
  scheduled: 'stScheduled',
  arrived: 'stArrived',
  'in-progress': 'stInProgress',
  completed: 'stCompleted',
  reported: 'stReported',
  verified: 'stVerified',
} as const satisfies Record<RadStatus, string>;

const MODALITY_KEY = { XR: 'modXr', CT: 'modCt', MR: 'modMr', US: 'modUs' } as const satisfies Record<Modality, string>;
const PRIORITY_RANK: Readonly<Record<OrderPriority, number>> = { stat: 0, urgent: 1, routine: 2 };
const RADIOLOGIST = 'SYN-STF-013';

type Filter = 'active' | 'protocol' | 'report' | 'all';

function slotTimes(): readonly string[] {
  const out: string[] = [];
  for (let h = 10; h <= 15; h += 1) {
    for (const m of ['00', '30']) {
      out.push(`${String(h).padStart(2, '0')}:${m}`);
    }
  }
  return out;
}

export function RadiologyScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();

  const [requests, setRequests] = useState<readonly RadRequest[]>(RAD_REQUESTS);
  const [tab, setTab] = useState('worklist');
  const [modality, setModality] = useState<'all' | Modality>('all');
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [protocolFor, setProtocolFor] = useState<RadRequest | null>(null);
  const [protocolChoice, setProtocolChoice] = useState('');
  const [contrastChoice, setContrastChoice] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<RadRequest | null>(null);
  const [roomChoice, setRoomChoice] = useState('');
  const [slotChoice, setSlotChoice] = useState('10:30');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('TPL-GEN');
  const [draft, setDraft] = useState('');
  const [draftCritical, setDraftCritical] = useState(false);
  const [communicated, setCommunicated] = useState<ReadonlyMap<string, string>>(new Map([['SYN-RAD-26-4116', '03:05']]));

  const update = (id: string, patch: Partial<RadRequest>): void => {
    setRequests((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests
      .filter((row) => modality === 'all' || findExam(row.examCode)?.modality === modality)
      .filter((row) => {
        switch (filter) {
          case 'active':
            return row.status !== 'verified' && row.status !== 'reported';
          case 'protocol':
            return row.status === 'requested';
          case 'report':
            return row.status === 'completed' || row.status === 'reported';
          case 'all':
            return true;
        }
      })
      .filter((row) => {
        if (needle === '') {
          return true;
        }
        const patient = getPatient(row.patientId);
        return [row.id, row.examCode, patient.mrn, patient.name.latin, patient.name.ckb, patient.name.ar].some((part) => part.toLowerCase().includes(needle));
      })
      .toSorted((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.scheduledIso ?? a.requestedIso).localeCompare(b.scheduledIso ?? b.requestedIso));
  }, [requests, modality, filter, search]);

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const toProtocol = requests.filter((row) => row.status === 'requested');
  const scheduledToday = requests.filter((row) => (row.status === 'scheduled' || row.status === 'arrived') && row.scheduledIso !== null && isToday(row.scheduledIso));
  const inProgress = requests.filter((row) => row.status === 'in-progress');
  const toReport = requests.filter((row) => row.status === 'completed');
  const toVerify = requests.filter((row) => row.status === 'reported');
  const criticals = requests.filter((row) => row.critical);
  const criticalOpen = criticals.filter((row) => !communicated.has(row.id));

  const examName = (row: RadRequest): string => {
    const exam = findExam(row.examCode);
    return exam === undefined ? row.examCode : f.text(exam.name);
  };

  const whereText = (patientId: string): string => {
    const loc = locationOf(patientId);
    return loc === undefined ? t('outpatient') : `${f.text(loc.ward.name)} · ${loc.bedId}`;
  };

  const roomName = (roomId: string | null): string => {
    const room = RAD_ROOMS.find((candidate) => candidate.id === roomId);
    return room === undefined ? '—' : f.text(room.name);
  };

  const startReport = (row: RadRequest): void => {
    const exam = findExam(row.examCode);
    const template = REPORT_TEMPLATES.find((tpl) => tpl.id === exam?.templateId) ?? REPORT_TEMPLATES[0];
    setEditingId(row.id);
    setTemplateId(template?.id ?? 'TPL-GEN');
    setDraft(row.report ?? template?.body ?? '');
    setDraftCritical(row.critical);
    setTab('reporting');
  };

  const openProtocol = (row: RadRequest): void => {
    const exam = findExam(row.examCode);
    setProtocolChoice(exam?.protocols[0] ?? '');
    setContrastChoice(row.contrast);
    setProtocolFor(row);
  };

  const openSchedule = (row: RadRequest): void => {
    const exam = findExam(row.examCode);
    setRoomChoice(RAD_ROOMS.find((room) => room.modality === exam?.modality)?.id ?? 'XR-1');
    setSlotChoice('10:30');
    setScheduleFor(row);
  };

  const nextAction = (row: RadRequest): { readonly label: string; readonly run: () => void } | null => {
    switch (row.status) {
      case 'requested':
        return { label: t('actProtocol'), run: () => { openProtocol(row); } };
      case 'protocolled':
        return { label: t('actSchedule'), run: () => { openSchedule(row); } };
      case 'scheduled':
        return {
          label: t('actArrived'),
          run: () => {
            update(row.id, { status: 'arrived' });
            toast({ tone: 'info', title: t('toastArrived', { id: row.id }) });
          },
        };
      case 'arrived':
        return {
          label: t('actStart'),
          run: () => {
            update(row.id, { status: 'in-progress' });
            toast({ tone: 'info', title: t('toastStarted', { id: row.id }) });
          },
        };
      case 'in-progress':
        return {
          label: t('actComplete'),
          run: () => {
            update(row.id, { status: 'completed' });
            toast({ tone: 'success', title: t('toastCompleted', { id: row.id }), body: t('toastCompletedBody') });
          },
        };
      case 'completed':
        return { label: t('actReport'), run: () => { startReport(row); } };
      case 'reported':
        return {
          label: t('actVerify'),
          run: () => {
            update(row.id, { status: 'verified' });
            toast({ tone: 'success', title: t('toastVerified', { id: row.id }) });
          },
        };
      case 'verified':
        return null;
    }
  };

  const columns: readonly Column<RadRequest>[] = [
    {
      id: 'acc',
      header: t('colAccession'),
      nowrap: true,
      cell: (row) => (
        <span className="rad-two">
          <Code>{row.id}</Code>
          <span className="rad-muted">{t('requestedAt', { time: f.relative(row.requestedIso) })}</span>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={getPatient(row.patientId)} /> },
    {
      id: 'exam',
      header: t('colExam'),
      cell: (row) => {
        const exam = findExam(row.examCode);
        return (
          <span className="rad-two">
            <span className="rad-row">
              {exam === undefined ? null : <Badge size="sm" tone="neutral">{exam.modality}</Badge>}
              <span>{examName(row)}</span>
            </span>
            <span className="rad-muted">{whereText(row.patientId)}</span>
          </span>
        );
      },
    },
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
      id: 'slot',
      header: t('colSlot'),
      nowrap: true,
      cell: (row) =>
        row.scheduledIso === null ? (
          <span className="rad-muted">—</span>
        ) : (
          <span className="rad-two">
            <span>{isToday(row.scheduledIso) ? f.time(row.scheduledIso) : f.dateTime(row.scheduledIso)}</span>
            <span className="rad-muted">{row.roomId}</span>
          </span>
        ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <span className="rad-badges">
          <Badge tone={STATUS_TONE[row.status]} size="sm">
            {t(STATUS_KEY[row.status])}
          </Badge>
          {row.critical ? (
            <Badge tone="danger" size="sm" icon="alert" strong>
              {t('criticalShort')}
            </Badge>
          ) : null}
          {row.contrast ? <Badge tone="accent" size="sm">{t('contrastShort')}</Badge> : null}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------------------------------------

  const detail = (row: RadRequest): ReactNode => {
    const patient = getPatient(row.patientId);
    const exam = findExam(row.examCode);
    const requester = findStaff(row.requestedById);
    const reporter = findStaff(row.reportedById);
    const contrastAllergy = hasAllergy(patient, 'SYN-ALG-CONTRAST');
    const next = nextAction(row);
    return (
      <Card
        title={examName(row)}
        subtitle={<Code>{row.id}</Code>}
        icon="scan"
        tone={row.critical ? 'danger' : row.priority === 'stat' ? 'warning' : undefined}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedId(null); }} />}
      >
        <div className="rad-stack">
          <PatientInline patient={patient} secondary />
          {row.contrast && contrastAllergy ? (
            <Callout tone="danger" title={t('contrastAllergyTitle')} role="alert">
              {t('contrastAllergyBody')}
            </Callout>
          ) : null}
          {row.pregnancyCheck === 'to-confirm' ? (
            <Callout tone="warning" title={t('pregnancyTitle')}>
              {t('pregnancyBody')}
            </Callout>
          ) : null}
          <KeyValueList
            columns={2}
            items={[
              { id: 'status', label: t('colStatus'), value: <Badge tone={STATUS_TONE[row.status]} size="sm">{t(STATUS_KEY[row.status])}</Badge> },
              { id: 'priority', label: t('colPriority'), value: f.text(PRIORITY_LABEL[row.priority]) },
              { id: 'modality', label: t('modality'), value: exam === undefined ? '—' : t(MODALITY_KEY[exam.modality]) },
              { id: 'where', label: t('location'), value: whereText(row.patientId) },
              { id: 'by', label: t('requestedBy'), value: requester === undefined ? '—' : <StaffName member={requester} /> },
              { id: 'when', label: t('requested'), value: f.dateTime(row.requestedIso) },
              { id: 'protocol', label: t('protocol'), value: row.protocol === null ? <Badge tone="warning" size="sm">{t('notProtocolled')}</Badge> : <Code>{row.protocol}</Code> },
              { id: 'contrast', label: t('contrast'), value: row.contrast ? t('yes') : t('no') },
              { id: 'room', label: t('room'), value: roomName(row.roomId) },
              { id: 'slot', label: t('colSlot'), value: row.scheduledIso === null ? '—' : f.dateTime(row.scheduledIso) },
            ]}
          />
          <div>
            <p className="rad-label">{t('indication')}</p>
            <p className="rad-text">{f.text(row.indication)}</p>
          </div>
          {row.report === null ? null : (
            <div>
              <p className="rad-label">
                {t('report')} {reporter === undefined ? null : <>· <StaffName member={reporter} /></>}
              </p>
              <pre className="rad-report" dir="ltr" lang="en">
                {row.report}
              </pre>
            </div>
          )}
          <div className="rad-actions">
            {next === null ? null : (
              <Button variant="primary" icon="check" onPress={next.run}>
                {next.label}
              </Button>
            )}
            {row.status === 'completed' || row.status === 'reported' || row.status === 'verified' || row.status === 'in-progress' ? (
              <Button icon="scan" onPress={() => { toast({ tone: 'info', title: t('toastPacs'), body: t('toastPacsBody', { id: row.id }) }); }}>
                {t('actPacs')}
              </Button>
            ) : null}
            <Button variant="ghost" iconEnd="arrow-forward" onPress={() => { goTo('orders', { patient: patient.id }); }}>
              {t('actOrders')}
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
    <div className={selected === null ? undefined : 'rad-split'}>
      <Card flush>
        <div className="rad-toolbar">
          <Toolbar label={t('filters')}>
            <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
            <Segmented
              label={t('modality')}
              hideLabel
              value={modality}
              onChange={(id) => { setModality(id as 'all' | Modality); }}
              options={[
                { id: 'all', label: t('modAll') },
                { id: 'XR', label: 'XR' },
                { id: 'CT', label: 'CT' },
                { id: 'MR', label: 'MRI' },
                { id: 'US', label: 'US' },
              ]}
            />
            <SelectField
              label={t('show')}
              hideLabel
              selectedKey={filter}
              onSelectionChange={(id) => { setFilter(id as Filter); }}
              options={[
                { id: 'active', label: t('fActive') },
                { id: 'protocol', label: t('fProtocol') },
                { id: 'report', label: t('fReport') },
                { id: 'all', label: t('fAll') },
              ]}
            />
          </Toolbar>
          <span className="rad-muted">{t('rowsShown', { count: rows.length })}</span>
        </div>
        <DataTable
          caption={t('worklistTitle')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          selectedKey={selectedId}
          onRowAction={(row) => { setSelectedId(row.id); }}
          rowTone={(row) => (row.critical && !communicated.has(row.id) ? 'danger' : row.priority === 'stat' && row.status !== 'verified' ? 'warning' : undefined)}
          emptyText={<EmptyState compact icon="scan" title={t('emptyWorklist')} body={t('emptyWorklistBody')} />}
          dense
        />
      </Card>
      {selected === null ? null : detail(selected)}
    </div>
  );

  const hourOf = (iso: string): string => `${f.time(iso).slice(0, 2)}:00`;
  const scheduleTab = (
    <Card title={t('scheduleTitle')} subtitle={t('scheduleSubtitle', { date: f.date(DEMO_NOW_ISO, 'long') })} icon="calendar" flush>
      <div className="rad-board-wrap">
        <div className="rad-board" style={{ gridTemplateColumns: `minmax(11rem, 14rem) repeat(${String(SCHEDULE_HOURS.length)}, minmax(7.5rem, 1fr))` }}>
          <div className="rad-board__corner">{t('room')}</div>
          {SCHEDULE_HOURS.map((hour) => (
            <div key={hour} className={`rad-board__hour${hour === '09:00' ? ' rad-board__hour--now' : ''}`}>
              {hour}
            </div>
          ))}
          {RAD_ROOMS.map((room) => (
            <div key={room.id} className="rad-board__rowgroup">
              <div className="rad-board__room">
                <span className="rad-strong">{f.text(room.name)}</span>
                <span className="rad-muted">
                  <Code>{room.equipment}</Code>
                </span>
              </div>
              {SCHEDULE_HOURS.map((hour) => {
                const here = requests.filter((row) => row.roomId === room.id && row.scheduledIso !== null && isToday(row.scheduledIso) && hourOf(row.scheduledIso) === hour);
                return (
                  <div key={hour} className="rad-board__cell">
                    {here.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className={`rad-block rad-block--${STATUS_TONE[row.status]}`}
                        onClick={() => {
                          setSelectedId(row.id);
                          setTab('worklist');
                          setFilter('all');
                        }}
                      >
                        <span className="rad-block__time">{row.scheduledIso === null ? '' : f.time(row.scheduledIso)}</span>
                        <span className="rad-block__exam">{row.examCode}</span>
                        <span className="rad-block__status">{t(STATUS_KEY[row.status])}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="rad-muted rad-pad">{t('scheduleHint')}</p>
    </Card>
  );

  const editing = requests.find((row) => row.id === editingId) ?? null;
  const reportQueue = [...toReport, ...toVerify];
  const reportingTab = (
    <div className="rad-split rad-split--report">
      <Card title={t('reportQueueTitle')} subtitle={t('reportQueueSubtitle', { count: reportQueue.length })} icon="clipboard" flush>
        {reportQueue.length === 0 ? (
          <EmptyState compact icon="check-circle" title={t('reportQueueEmpty')} />
        ) : (
          <ul className="rad-list">
            {reportQueue.map((row) => (
              <li key={row.id}>
                <button type="button" className={`rad-list__item${row.id === editingId ? ' rad-list__item--active' : ''}`} onClick={() => { startReport(row); }}>
                  <span className="rad-row">
                    <Badge size="sm" tone="neutral">{findExam(row.examCode)?.modality ?? ''}</Badge>
                    <span className="rad-strong">{examName(row)}</span>
                  </span>
                  <PatientInline patient={getPatient(row.patientId)} />
                  <span className="rad-row">
                    <Badge size="sm" tone={STATUS_TONE[row.status]}>{t(STATUS_KEY[row.status])}</Badge>
                    {row.priority === 'routine' ? null : <Badge size="sm" tone={PRIORITY_TONE[row.priority]}>{f.text(PRIORITY_LABEL[row.priority])}</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing === null ? (
        <Card>
          <EmptyState icon="pen" title={t('editorEmpty')} body={t('editorEmptyBody')} />
        </Card>
      ) : (
        <Card
          title={examName(editing)}
          subtitle={<Code>{editing.id}</Code>}
          icon="pen"
          tone={draftCritical ? 'danger' : undefined}
          actions={
            <Button size="sm" icon="scan" onPress={() => { toast({ tone: 'info', title: t('toastPacs'), body: t('toastPacsBody', { id: editing.id }) }); }}>
              {t('actPacs')}
            </Button>
          }
        >
          <div className="rad-stack">
            <PatientInline patient={getPatient(editing.patientId)} />
            <p className="rad-text">
              <span className="rad-label">{t('indication')}: </span>
              {f.text(editing.indication)}
            </p>
            <div className="rad-row rad-row--end">
              <SelectField
                label={t('template')}
                selectedKey={templateId}
                onSelectionChange={setTemplateId}
                options={REPORT_TEMPLATES.map((tpl) => ({ id: tpl.id, label: f.text(tpl.name) }))}
              />
              <Button
                icon="refresh"
                onPress={() => {
                  const template = REPORT_TEMPLATES.find((tpl) => tpl.id === templateId);
                  if (template !== undefined) {
                    setDraft(template.body);
                  }
                }}
              >
                {t('actInsertTemplate')}
              </Button>
            </div>
            <TextInput label={t('reportText')} value={draft} onChange={setDraft} multiline dir="ltr" description={t('reportTextHint')} className="rad-editor" />
            <Checkbox isSelected={draftCritical} onChange={setDraftCritical}>
              {t('criticalCheckbox')}
            </Checkbox>
            {draftCritical ? (
              <Callout tone="danger" title={t('criticalCalloutTitle')}>
                {t('criticalCalloutBody')}
              </Callout>
            ) : null}
            <div className="rad-actions">
              <Button onPress={() => { update(editing.id, { report: draft }); toast({ tone: 'info', title: t('toastDraft') }); }}>{t('actSaveDraft')}</Button>
              {editing.status === 'reported' ? (
                <Button
                  variant="primary"
                  icon="lock"
                  onPress={() => {
                    update(editing.id, { status: 'verified', report: draft, critical: draftCritical });
                    toast({ tone: 'success', title: t('toastVerified', { id: editing.id }) });
                    setEditingId(null);
                  }}
                >
                  {t('actVerify')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="lock"
                  isDisabled={draft.trim().length < 20}
                  onPress={() => {
                    update(editing.id, { status: 'reported', report: draft, reportedById: RADIOLOGIST, critical: draftCritical });
                    toast({ tone: 'success', title: t('toastSigned', { id: editing.id }), ...(draftCritical ? { body: t('toastSignedCritical') } : {}) });
                    setEditingId(null);
                  }}
                >
                  {t('actSign')}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const criticalTab = (
    <div className="rad-stack">
      <Callout tone={criticalOpen.length > 0 ? 'danger' : 'success'} role={criticalOpen.length > 0 ? 'alert' : 'status'} title={criticalOpen.length > 0 ? t('critOpenTitle', { count: criticalOpen.length }) : t('critAllDone')}>
        {t('critPolicy')}
      </Callout>
      <Card title={t('critTitle')} subtitle={t('critSubtitle')} icon="alert" flush>
        <DataTable
          caption={t('critTitle')}
          rows={criticals}
          rowKey={(row) => row.id}
          rowTone={(row) => (communicated.has(row.id) ? undefined : 'danger')}
          emptyText={<EmptyState compact icon="check-circle" title={t('critEmpty')} />}
          columns={[
            { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={getPatient(row.patientId)} /> },
            { id: 'exam', header: t('colExam'), cell: (row) => <span className="rad-two"><span>{examName(row)}</span><Code>{row.id}</Code></span> },
            {
              id: 'finding',
              header: t('colFinding'),
              cell: (row) => (
                <span className="rad-finding" dir="ltr" lang="en">
                  {(row.report ?? '').split('IMPRESSION:')[1]?.trim() ?? '—'}
                </span>
              ),
            },
            {
              id: 'to',
              header: t('colNotify'),
              cell: (row) => {
                const member = findStaff(row.requestedById);
                return member === undefined ? '—' : <StaffName member={member} />;
              },
            },
            {
              id: 'state',
              header: t('colStatus'),
              cell: (row) => {
                const at = communicated.get(row.id);
                return at === undefined ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon="phone"
                    onPress={() => {
                      setCommunicated((current) => new Map([...current, [row.id, f.time(DEMO_NOW_ISO)]]));
                      toast({ tone: 'success', title: t('toastCommunicated') });
                    }}
                  >
                    {t('actCommunicate')}
                  </Button>
                ) : (
                  <Badge tone="success" icon="check" size="sm">
                    {t('communicatedAt', { time: at })}
                  </Badge>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------------------------------------

  const protocolExam = protocolFor === null ? undefined : findExam(protocolFor.examCode);
  const protocolDialog =
    protocolFor === null ? null : (
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) { setProtocolFor(null); } }}
        title={t('protocolTitle')}
        subtitle={`${examName(protocolFor)} · ${protocolFor.id}`}
        actions={
          <>
            <Button onPress={() => { setProtocolFor(null); }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              icon="check"
              onPress={() => {
                update(protocolFor.id, { status: 'protocolled', protocol: protocolChoice, contrast: contrastChoice });
                toast({ tone: 'success', title: t('toastProtocolled', { id: protocolFor.id }) });
                setProtocolFor(null);
              }}
            >
              {t('actSaveProtocol')}
            </Button>
          </>
        }
      >
        <div className="rad-stack">
          <PatientInline patient={getPatient(protocolFor.patientId)} />
          <p className="rad-text">{f.text(protocolFor.indication)}</p>
          <SelectField
            label={t('protocol')}
            selectedKey={protocolChoice}
            onSelectionChange={setProtocolChoice}
            options={(protocolExam?.protocols ?? []).map((p) => ({ id: p, label: p }))}
          />
          <Checkbox isSelected={contrastChoice} onChange={setContrastChoice}>
            {t('contrastCheckbox')}
          </Checkbox>
          {contrastChoice && hasAllergy(getPatient(protocolFor.patientId), 'SYN-ALG-CONTRAST') ? (
            <Callout tone="danger" title={t('contrastAllergyTitle')} role="alert">
              {t('contrastAllergyBody')}
            </Callout>
          ) : null}
          {contrastChoice ? <Callout tone="info">{t('contrastRenal')}</Callout> : null}
        </div>
      </Dialog>
    );

  const scheduleExam = scheduleFor === null ? undefined : findExam(scheduleFor.examCode);
  const scheduleDialog =
    scheduleFor === null ? null : (
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) { setScheduleFor(null); } }}
        title={t('scheduleDialogTitle')}
        subtitle={`${examName(scheduleFor)} · ${scheduleFor.id}`}
        actions={
          <>
            <Button onPress={() => { setScheduleFor(null); }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              icon="calendar"
              onPress={() => {
                update(scheduleFor.id, { status: 'scheduled', roomId: roomChoice, scheduledIso: `2026-10-19T${slotChoice}:00+03:00` });
                toast({ tone: 'success', title: t('toastScheduled', { id: scheduleFor.id, time: slotChoice }) });
                setScheduleFor(null);
              }}
            >
              {t('actBook')}
            </Button>
          </>
        }
      >
        <div className="rad-stack">
          <PatientInline patient={getPatient(scheduleFor.patientId)} />
          <SelectField
            label={t('room')}
            selectedKey={roomChoice}
            onSelectionChange={setRoomChoice}
            options={RAD_ROOMS.filter((room) => room.modality === scheduleExam?.modality).map((room) => ({ id: room.id, label: `${f.text(room.name)} (${room.equipment})` }))}
          />
          <SelectField
            label={t('slot')}
            selectedKey={slotChoice}
            onSelectionChange={setSlotChoice}
            options={slotTimes().map((time) => {
              const taken = requests.some((row) => row.roomId === roomChoice && row.scheduledIso !== null && isToday(row.scheduledIso) && f.time(row.scheduledIso) === time);
              return { id: time, label: taken ? t('slotTaken', { time }) : time };
            })}
          />
          <p className="rad-muted">{t('durationHint', { minutes: scheduleExam?.durationMin ?? 15 })}</p>
        </div>
      </Dialog>
    );

  const avgTat = (Object.values(REPORT_TAT_HOURS).reduce((a, b) => a + b, 0) / 4).toFixed(1);

  return (
    <div className="rad-screen">
      <PageHeader
        icon="scan"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <>
            <Button icon="scan" onPress={() => { toast({ tone: 'info', title: t('toastPacs'), body: t('toastPacsGeneral') }); }}>
              {t('actPacsHome')}
            </Button>
            <Button variant="primary" icon="pen" onPress={() => { setTab('reporting'); }}>
              {t('actReportingQueue')}
            </Button>
          </>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiProtocol')} value={f.number(toProtocol.length)} icon="clipboard" tone={toProtocol.length > 0 ? 'warning' : 'success'} hint={t('kpiProtocolHint')} onPress={() => { setFilter('protocol'); setTab('worklist'); }} />
        <StatTile label={t('kpiScheduled')} value={f.number(scheduledToday.length)} icon="calendar" hint={t('kpiScheduledHint', { count: inProgress.length })} onPress={() => { setTab('schedule'); }} />
        <StatTile label={t('kpiReport')} value={f.number(toReport.length)} icon="pen" tone={toReport.length > 0 ? 'warning' : 'success'} hint={t('kpiReportHint', { count: toVerify.length })} onPress={() => { setTab('reporting'); }} />
        <StatTile label={t('kpiCritical')} value={f.number(criticalOpen.length)} icon="alert" tone={criticalOpen.length > 0 ? 'danger' : 'success'} hint={t('kpiCriticalHint')} onPress={() => { setTab('critical'); }} />
        <StatTile label={t('kpiTat')} value={f.number(Number(avgTat))} unit={t('hoursUnit')} icon="clock" hint={t('kpiTatHint', { xr: f.number(REPORT_TAT_HOURS.XR), ct: f.number(REPORT_TAT_HOURS.CT), mr: f.number(REPORT_TAT_HOURS.MR), us: f.number(REPORT_TAT_HOURS.US) })} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'worklist', label: t('tabWorklist'), badge: f.number(requests.filter((row) => row.status !== 'verified').length), content: worklistTab },
          { id: 'schedule', label: t('tabSchedule'), content: scheduleTab },
          { id: 'reporting', label: t('tabReporting'), badge: f.number(reportQueue.length), content: reportingTab },
          { id: 'critical', label: t('tabCritical'), ...(criticalOpen.length > 0 ? { badge: f.number(criticalOpen.length) } : {}), content: criticalTab },
        ]}
      />
      {protocolDialog}
      {scheduleDialog}
      <p className="rad-muted">{t('catalogueNote', { count: RAD_EXAMS.length })}</p>
    </div>
  );
}
