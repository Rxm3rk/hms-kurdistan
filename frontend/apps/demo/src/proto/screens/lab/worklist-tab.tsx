/**
 * The lab-wide worklist (every patient): the specimen pipeline with counts per stage (to collect, in transit,
 * received, in analysis, resulted, rejected) as filters, hospital-wide critical results awaiting
 * acknowledgement, and the specimen table. Patients are listed with two identifiers; collecting for another
 * patient opens that patient's record first (the window's "Change patient?" confirmation).
 */
import { useState, type ReactNode } from 'react';
import { ToggleButton } from 'react-aria-components';
import {
  RESULTS,
  RESULT_FLAG_LABEL,
  WARDS,
  bedOfPatient,
  findPatient,
  minutesFromNow,
  type WardId,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  Button,
  Callout,
  Code,
  DataTable,
  Icon,
  PatientInline,
  Qty,
  SearchField,
  Segmented,
  SelectField,
  type Column,
  type IconName,
} from '../../ui/index.ts';
import { PRIORITY_RANK, STAGES, stageOf, type LabSpecimen, type Stage } from './lab-data.ts';
import { LocationText, PriorityBadge, StatusBadge, TubeSwatch } from './lab-parts.tsx';
import type { CriticalAck } from './lab-store.ts';
import { messages } from './messages.ts';

const STAGE_ICON: Readonly<Record<Stage, IconName>> = {
  collect: 'droplet',
  transit: 'arrow-forward',
  received: 'building',
  process: 'activity',
  resulted: 'check-circle',
  rejected: 'x',
};

const STAGE_KEY = {
  collect: 'stageCollect',
  transit: 'stageTransit',
  received: 'stageReceived',
  process: 'stageProcess',
  resulted: 'stageResulted',
  rejected: 'stageRejected',
} as const satisfies Record<Stage, string>;

export interface WorklistTabProps {
  readonly currentPatientId: string;
  readonly specimens: readonly LabSpecimen[];
  readonly acks: Readonly<Record<string, CriticalAck>>;
  readonly collectBlockedReason: string | null;
  readonly onCollect: (specimen: LabSpecimen) => void;
  readonly onReceive: (specimen: LabSpecimen) => void;
  readonly onStart: (specimen: LabSpecimen) => void;
  readonly onReject: (specimen: LabSpecimen) => void;
  readonly onViewResults: (patientId: string) => void;
  readonly onReset: () => void;
}

type WardFilter = 'all' | WardId | 'outpatient';

export function WorklistTab({
  currentPatientId,
  specimens,
  acks,
  collectBlockedReason,
  onCollect,
  onReceive,
  onStart,
  onReject,
  onViewResults,
  onReset,
}: WorklistTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [stage, setStage] = useState<Stage | null>('collect');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<'all' | 'urgent'>('all');
  const [ward, setWard] = useState<WardFilter>('all');

  const counts = new Map<Stage, LabSpecimen[]>(STAGES.map((s) => [s, []]));
  for (const specimen of specimens) {
    counts.get(stageOf(specimen.status))?.push(specimen);
  }

  const q = query.trim().toLowerCase();
  const rows = specimens
    .filter((specimen) => stage === null || stageOf(specimen.status) === stage)
    .filter((specimen) => priority === 'all' || specimen.priority !== 'routine')
    .filter((specimen) => {
      if (ward === 'all') {
        return true;
      }
      const bed = bedOfPatient(specimen.patientId);
      return ward === 'outpatient' ? bed === undefined : bed?.wardId === ward;
    })
    .filter((specimen) => {
      if (q === '') {
        return true;
      }
      const patient = findPatient(specimen.patientId);
      const haystack = [
        specimen.id,
        patient?.mrn ?? '',
        patient?.name.latin ?? '',
        patient?.name.ckb ?? '',
        patient?.name.ar ?? '',
        f.text(specimen.panel),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .toSorted(
      (a, b) =>
        STAGES.indexOf(stageOf(a.status)) - STAGES.indexOf(stageOf(b.status)) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.orderedIso.localeCompare(b.orderedIso),
    );

  const criticals = RESULTS.filter((result) => result.critical !== null && !result.critical.acknowledged && acks[result.id] === undefined);

  const stageHint = (s: Stage, list: readonly LabSpecimen[]): string => {
    switch (s) {
      case 'collect':
        return t('hintCollect', { count: list.filter((specimen) => specimen.priority !== 'routine').length });
      case 'transit': {
        const oldest = Math.max(0, ...list.map((specimen) => (specimen.collectedIso === null ? 0 : -minutesFromNow(specimen.collectedIso))));
        return list.length === 0 ? t('hintNone') : t('hintTransit', { minutes: oldest });
      }
      case 'received':
        return t('hintReceived');
      case 'process':
        return t('hintProcess');
      case 'resulted':
        return t('hintResulted');
      case 'rejected':
        return t('hintRejected');
    }
  };

  const stageTone = (s: Stage, list: readonly LabSpecimen[]): string => {
    if (s === 'collect' && list.some((specimen) => specimen.priority !== 'routine')) {
      return 'warning';
    }
    if (s === 'rejected' && list.length > 0) {
      return 'danger';
    }
    return 'neutral';
  };

  const timeLine = (specimen: LabSpecimen): ReactNode => {
    switch (stageOf(specimen.status)) {
      case 'collect': {
        const waited = -minutesFromNow(specimen.orderedIso);
        return t('timeOrdered', { time: f.time(specimen.orderedIso), minutes: Math.max(0, waited) });
      }
      case 'transit':
        return specimen.collectedIso === null ? '' : t('timeCollected', { time: f.time(specimen.collectedIso) });
      case 'received':
      case 'process':
        return specimen.receivedIso === null ? '' : t('timeReceived', { time: f.dateTime(specimen.receivedIso) });
      case 'resulted':
        return specimen.resultedIso === null ? '' : t('timeResulted', { time: f.dateTime(specimen.resultedIso) });
      case 'rejected':
        return (
          <span className="lab-danger-text">
            {specimen.rejectionReason === null ? '' : f.text(specimen.rejectionReason)}
            {specimen.rejectedIso === null ? '' : ` · ${f.time(specimen.rejectedIso)}`}
          </span>
        );
    }
  };

  const action = (specimen: LabSpecimen): ReactNode => {
    const isCurrent = specimen.patientId === currentPatientId;
    switch (stageOf(specimen.status)) {
      case 'collect':
        return isCurrent ? (
          <Button size="sm" variant="primary" icon="droplet" isDisabled={collectBlockedReason !== null} onPress={() => { onCollect(specimen); }}>
            {t('collect')}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" iconEnd="chevron-forward" isDisabled={collectBlockedReason !== null} onPress={() => { onCollect(specimen); }}>
            {t('openToCollect')}
          </Button>
        );
      case 'transit':
        return (
          <span className="lab-actions-row">
            <Button size="sm" icon="scan" onPress={() => { onReceive(specimen); }}>
              {t('receive')}
            </Button>
            <Button size="sm" variant="ghost" icon="x" onPress={() => { onReject(specimen); }}>
              {t('reject')}
            </Button>
          </span>
        );
      case 'received':
        return (
          <span className="lab-actions-row">
            <Button size="sm" icon="activity" onPress={() => { onStart(specimen); }}>
              {t('startAnalysis')}
            </Button>
            <Button size="sm" variant="ghost" icon="x" onPress={() => { onReject(specimen); }}>
              {t('reject')}
            </Button>
          </span>
        );
      case 'process':
        return <span className="lab-muted">{t('onAnalyser')}</span>;
      case 'resulted':
        return (
          <Button size="sm" variant="ghost" iconEnd="chevron-forward" onPress={() => { onViewResults(specimen.patientId); }}>
            {isCurrent ? t('viewResults') : t('openResults')}
          </Button>
        );
      case 'rejected': {
        const task = specimens.find((candidate) => candidate.recollectOf === specimen.id);
        return task === undefined ? (
          <span className="lab-muted">{t('noRecollect')}</span>
        ) : (
          <span className="lab-muted">
            {t('recollectTask')} <Code>{task.id}</Code>
          </span>
        );
      }
    }
  };

  const columns: readonly Column<LabSpecimen>[] = [
    { id: 'priority', header: t('colPriority'), cell: (s) => <PriorityBadge priority={s.priority} />, nowrap: true },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (s) => {
        const patient = findPatient(s.patientId);
        return patient === undefined ? (
          <Code>{s.patientId}</Code>
        ) : (
          <span className="lab-wl-patient">
            <PatientInline patient={patient} />
            <span className="lab-wl-patient__tags">
              {s.patientId === currentPatientId ? (
                <Badge tone="accent" size="sm" icon="user">
                  {t('thisPatient')}
                </Badge>
              ) : null}
              {patient.isolation === null ? null : (
                <Badge tone="warning" size="sm" icon="isolation">
                  {t('isolation')}
                </Badge>
              )}
            </span>
          </span>
        );
      },
      width: '30%',
    },
    { id: 'where', header: t('colWhere'), cell: (s) => <LocationText patientId={s.patientId} /> },
    {
      id: 'test',
      header: t('colTest'),
      cell: (s) => (
        <span className="lab-wl-test">
          <span className="lab-strong">{f.text(s.panel)}</span>
          <TubeSwatch container={s.container} short />
          <Code className="lab-muted">{s.id}</Code>
          {s.recollectOf === null ? null : (
            <Badge tone="warning" size="sm" icon="refresh">
              {t('recollection')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (s) => (
        <span className="lab-wl-status">
          <StatusBadge status={s.status} />
          <span className="lab-wl-status__time">{timeLine(s)}</span>
        </span>
      ),
    },
    { id: 'action', header: t('colAction'), cell: action, align: 'end' },
  ];

  const wardOptions = [
    { id: 'all', label: t('allWards') },
    ...WARDS.map((w) => ({ id: w.id, label: f.text(w.name) })),
    { id: 'outpatient', label: t('outpatient') },
  ];

  return (
    <div className="lab-worklist">
      <p className="lab-muted lab-worklist__intro">
        <Icon name="building" size="1em" /> {t('worklistIntro')}
      </p>

      <div className="lab-stages" role="group" aria-label={t('stagesLabel')}>
        {STAGES.map((s) => {
          const list = counts.get(s) ?? [];
          return (
            <ToggleButton
              key={s}
              className={`lab-stage lab-stage--${stageTone(s, list)}`}
              isSelected={stage === s}
              onChange={(selected) => {
                setStage(selected ? s : null);
              }}
            >
              <span className="lab-stage__top">
                <Icon name={STAGE_ICON[s]} />
                <span className="lab-stage__label">{t(STAGE_KEY[s])}</span>
              </span>
              <span className="lab-stage__count">{list.length}</span>
              <span className="lab-stage__hint">{stageHint(s, list)}</span>
            </ToggleButton>
          );
        })}
      </div>

      {criticals.length === 0 ? null : (
        <Callout tone="danger" icon="alert" title={t('wlCriticalTitle', { count: criticals.length })}>
          <ul className="lab-plain-list">
            {criticals.map((result) => {
              const patient = findPatient(result.patientId);
              return (
                <li key={result.id} className="lab-wl-critical">
                  {patient === undefined ? null : <PatientInline patient={patient} />}
                  <span className="lab-strong">
                    {f.text(result.analyte)} <Qty value={result.value} unit={result.unit} /> · {f.text(RESULT_FLAG_LABEL[result.flag])}
                  </span>
                  {result.patientId === currentPatientId ? (
                    <span className="lab-muted">{t('shownAbove')}</span>
                  ) : (
                    <Button size="sm" variant="danger" iconEnd="chevron-forward" onPress={() => { onViewResults(result.patientId); }}>
                      {t('openRecord')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Callout>
      )}

      <div className="lab-filters">
        <SearchField className="lab-filters__search" label={t('searchLabel')} value={query} onChange={setQuery} placeholder={t('searchPlaceholder')} />
        <Segmented
          label={t('priority')}
          options={[
            { id: 'all', label: t('allPriorities') },
            { id: 'urgent', label: t('urgentOnly') },
          ]}
          value={priority}
          onChange={(value) => {
            setPriority(value === 'urgent' ? 'urgent' : 'all');
          }}
        />
        <SelectField
          label={t('ward')}
          options={wardOptions}
          selectedKey={ward}
          onSelectionChange={(value) => {
            setWard(value === 'all' || value === 'outpatient' || WARDS.some((w) => w.id === value) ? (value as WardFilter) : 'all');
          }}
        />
        <p className="lab-filters__count" aria-live="polite">
          {stage === null ? t('showingAll', { count: rows.length }) : t('showingStage', { count: rows.length, stage: t(STAGE_KEY[stage]) })}
        </p>
      </div>

      {collectBlockedReason === null ? null : (
        <p className="lab-muted lab-worklist__intro">
          <Icon name="lock" size="1em" /> {collectBlockedReason}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        caption={t('worklistCaption')}
        rowTone={(s) => (s.status === 'rejected' ? 'danger' : s.status === 'ordered' && s.priority === 'stat' ? 'warning' : undefined)}
        emptyText={t('worklistEmpty')}
        stickyHeader
      />

      <Callout tone="neutral" icon="info" actions={<Button variant="ghost" size="sm" icon="refresh" onPress={onReset}>{t('resetDemo')}</Button>}>
        {t('worklistNote')}
      </Callout>
    </div>
  );
}
