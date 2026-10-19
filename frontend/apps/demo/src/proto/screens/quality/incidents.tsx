/**
 * The incidents tab: the report worklist and the report detail with its RCA workflow stepper, the stage
 * actions and the corrective actions (add, complete).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_TODAY, findStaff, getPatient, getWard } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import { INCIDENT_STAGES, type Harm, type Incident, type IncidentCategory, type IncidentStage } from '../../data/ext/quality.ts';
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
  IconButton,
  KeyValueList,
  PatientName,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  TextInput,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';

export const CATEGORIES: readonly IncidentCategory[] = ['fall', 'medication', 'infection', 'pressure', 'identification', 'equipment', 'specimen', 'security', 'needlestick', 'communication'];
export const HARMS: readonly Harm[] = ['near-miss', 'none', 'minor', 'moderate', 'severe', 'sentinel'];
export const HARM_TONE: Readonly<Record<Harm, Tone>> = { 'near-miss': 'info', none: 'neutral', minor: 'accent', moderate: 'warning', severe: 'danger', sentinel: 'danger' };
const STAGE_TONE: Readonly<Record<IncidentStage, Tone>> = { new: 'info', triage: 'info', investigation: 'accent', rca: 'warning', actions: 'accent', closed: 'success' };

export function needsRca(harm: Harm): boolean {
  return harm === 'moderate' || harm === 'severe' || harm === 'sentinel';
}

export function useLocationLabel(): (location: Incident['location']) => string {
  const t = useT(messages);
  const f = useFormat();
  return (location) => {
    switch (location) {
      case 'ed':
      case 'theatre':
      case 'lab':
      case 'pharmacy':
      case 'opd':
        return t(`loc_${location}`);
      default:
        return f.text(getWard(location).name);
    }
  };
}

export interface IncidentsTabProps {
  readonly incidents: readonly Incident[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (incident: Incident) => void;
}

export function IncidentsTab({ incidents, selectedId, onSelect, onUpdate }: IncidentsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const where = useLocationLabel();
  const [stage, setStage] = useState<'open' | 'closed' | 'all'>('open');
  const [category, setCategory] = useState<'all' | IncidentCategory>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (stage === 'open' && incident.stage === 'closed') {
        return false;
      }
      if (stage === 'closed' && incident.stage !== 'closed') {
        return false;
      }
      if (category !== 'all' && incident.category !== category) {
        return false;
      }
      if (q === '') {
        return true;
      }
      const patient = incident.patientId === null ? null : getPatient(incident.patientId);
      return [incident.id, f.text(incident.summary), patient?.mrn ?? '', patient?.name.latin ?? '', patient?.name.ckb ?? ''].join(' ').toLowerCase().includes(q);
    });
  }, [incidents, stage, category, query, f]);

  const selected = incidents.find((incident) => incident.id === selectedId) ?? null;

  const columns: readonly Column<Incident>[] = [
    { id: 'id', header: t('colId'), cell: (i) => <Code>{i.id}</Code>, nowrap: true },
    { id: 'reported', header: t('colReported'), cell: (i) => f.relative(i.reportedIso), nowrap: true },
    {
      id: 'summary',
      header: t('colSummary'),
      cell: (i) => (
        <span className="qa-stack">
          <span className="qa-strong">{t(`cat_${i.category}`)}</span>
          <span className="qa-clamp">{f.text(i.summary)}</span>
        </span>
      ),
    },
    { id: 'where', header: t('colLocation'), cell: (i) => where(i.location) },
    {
      id: 'harm',
      header: t('colHarm'),
      cell: (i) => (
        <Badge tone={HARM_TONE[i.harm]} size="sm" {...(needsRca(i.harm) ? { icon: 'alert' as const } : {})}>
          {t(`harm_${i.harm}`)}
        </Badge>
      ),
      nowrap: true,
    },
    {
      id: 'stage',
      header: t('colStage'),
      cell: (i) => (
        <Badge tone={STAGE_TONE[i.stage]} size="sm">
          {t(`stage_${i.stage}`)}
        </Badge>
      ),
      nowrap: true,
    },
  ];

  return (
    <div className="qa-tab">
      <Toolbar label={t('incidentsTable')}>
        <Segmented
          label={t('stageFilter')}
          hideLabel
          options={[
            { id: 'open', label: t('filterOpen') },
            { id: 'closed', label: t('filterClosed') },
            { id: 'all', label: t('filterAll') },
          ]}
          value={stage}
          onChange={(id) => setStage(id as 'open' | 'closed' | 'all')}
        />
        <SelectField
          label={t('categoryFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allCategories') }, ...CATEGORIES.map((c) => ({ id: c, label: t(`cat_${c}`) }))]}
          selectedKey={category}
          onSelectionChange={(id) => setCategory(id as 'all' | IncidentCategory)}
          className="qa-select"
        />
        <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="qa-search" />
      </Toolbar>
      <div className="qa-split">
        <Card flush className="qa-list">
          <DataTable
            caption={t('incidentsTable')}
            columns={columns}
            rows={rows}
            rowKey={(i) => i.id}
            onRowAction={(i) => onSelect(i.id)}
            selectedKey={selectedId}
            rowTone={(i) => (i.harm === 'severe' || i.harm === 'sentinel' ? 'danger' : undefined)}
            emptyText={t('noMatches')}
            dense
          />
        </Card>
        {selected === null ? (
          <Card>
            <EmptyState icon="info" title={t('selectTitle')} body={t('selectBody')} compact />
          </Card>
        ) : (
          <IncidentDetail incident={selected} onUpdate={onUpdate} onClose={() => onSelect(null)} />
        )}
      </div>
    </div>
  );
}

function IncidentDetail({ incident, onUpdate, onClose }: { readonly incident: Incident; readonly onUpdate: (incident: Incident) => void; readonly onClose: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const goTo = useGoTo();
  const where = useLocationLabel();
  const [draft, setDraft] = useState('');
  const index = INCIDENT_STAGES.indexOf(incident.stage);
  // Incidents without a moderate-or-worse harm skip the RCA stage.
  const next = INCIDENT_STAGES.slice(index + 1).find((s) => s !== 'rca' || needsRca(incident.harm));
  const reporter = findStaff(incident.reporterId);
  const handler = findStaff(incident.handlerId);
  const toast = useToast();
  const patientId = incident.patientId;

  return (
    <Card
      title={<Code>{incident.id}</Code>}
      subtitle={`${t(`cat_${incident.category}`)} · ${where(incident.location)}`}
      icon="alert"
      tone={needsRca(incident.harm) ? 'warning' : undefined}
      className="qa-detail"
      actions={<IconButton icon="x" label={t('close')} onPress={onClose} />}
      footer={
        <div className="qa-actions">
          {next === undefined ? null : (
            <Button variant="primary" icon="arrow-forward" onPress={() => {
                onUpdate({ ...incident, stage: next });
                toast({ tone: 'success', title: t('toastAdvanced', { id: incident.id, stage: t(`stage_${next}`) }) });
              }}>
              {t('advanceTo', { stage: t(`stage_${next}`) })}
            </Button>
          )}
          {patientId === null ? null : (
            <Button variant="ghost" icon="chart" onPress={() => goTo('chart', { patient: patientId })}>
              {t('openChart')}
            </Button>
          )}
        </div>
      }
    >
      <div className="qa-detail__body">
        <ol className="qa-stepper" aria-label={t('workflow')}>
          {INCIDENT_STAGES.filter((s) => s !== 'rca' || needsRca(incident.harm)).map((s) => {
            const i = INCIDENT_STAGES.indexOf(s);
            const state = i < index ? 'done' : i === index ? 'current' : 'todo';
            return (
              <li key={s} className={`qa-step qa-step--${state}`} {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}>
                <span className="qa-step__dot" aria-hidden="true" />
                <span>{t(`stage_${s}`)}</span>
              </li>
            );
          })}
        </ol>
        <div className="qa-badges">
          <Badge tone={HARM_TONE[incident.harm]} size="sm">
            {t(`harm_${incident.harm}`)}
          </Badge>
          <Badge tone={STAGE_TONE[incident.stage]} size="sm">
            {t(`stage_${incident.stage}`)}
          </Badge>
        </div>
        {needsRca(incident.harm) ? <Callout tone="warning">{t('rcaRequired')}</Callout> : null}
        <KeyValueList
          columns={1}
          items={[
            { id: 'what', label: t('whatHappened'), value: f.text(incident.summary) },
            { id: 'immediate', label: t('immediateAction'), value: f.text(incident.immediateAction) },
          ]}
        />
        <KeyValueList
          items={[
            { id: 'reported', label: t('colReported'), value: f.dateTime(incident.reportedIso) },
            { id: 'reporter', label: t('reporter'), value: incident.anonymous || reporter === undefined ? t('anonymous') : <StaffName member={reporter} /> },
            { id: 'handler', label: t('handler'), value: handler === undefined ? '–' : <StaffName member={handler} /> },
            {
              id: 'patient',
              label: t('patient'),
              value: incident.patientId === null ? t('noPatient') : <span><PatientName patient={getPatient(incident.patientId)} /> · <Code>{getPatient(incident.patientId).mrn}</Code></span>,
            },
          ]}
        />
        <h3 className="qa-h3">{t('actionsTitle')}</h3>
        {incident.actions.length === 0 ? <p className="qa-muted">{t('actionsEmpty')}</p> : null}
        <ul className="qa-list-plain">
          {incident.actions.map((action) => {
            const owner = findStaff(action.ownerId);
            const late = !action.done && action.due < DEMO_TODAY;
            return (
              <li key={action.id} className="qa-action">
                <span className="qa-stack">
                  <span>{f.text(action.text)}</span>
                  <span className="qa-muted">
                    {owner === undefined ? null : <StaffName member={owner} />} · {t('dueOn', { date: f.date(action.due) })}
                  </span>
                </span>
                {action.done ? (
                  <Badge tone="success" icon="check" size="sm">
                    {t('done')}
                  </Badge>
                ) : (
                  <span className="qa-inline">
                    {late ? (
                      <Badge tone="danger" size="sm">
                        {t('overdue')}
                      </Badge>
                    ) : null}
                    <Button size="sm" variant="secondary" icon="check" onPress={() => onUpdate({ ...incident, actions: incident.actions.map((a) => (a.id === action.id ? { ...a, done: true } : a)) })}>
                      {t('markDone')}
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {incident.stage === 'closed' ? null : (
          <div className="qa-add">
            <TextInput label={t('newAction')} value={draft} onChange={setDraft} className="qa-add__input" />
            <Button
              icon="plus"
              isDisabled={draft.trim() === ''}
              onPress={() => {
                const text = draft.trim();
                onUpdate({
                  ...incident,
                  actions: [...incident.actions, { id: `n${String(incident.actions.length + 1)}`, text: { en: text, ckb: text, ar: text }, ownerId: incident.handlerId, due: '2026-11-02', done: false }],
                });
                setDraft('');
                toast({ tone: 'success', title: t('toastActionAdded', { id: incident.id }) });
              }}
            >
              {t('addAction')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
