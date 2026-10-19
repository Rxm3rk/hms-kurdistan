/**
 * The Quality & safety screen (hospital-wide): incident reporting with the RCA workflow, the safety
 * dashboard, JCI 8th-edition chapter readiness and the KRG licensing checklist, and the clinical hazard log
 * with its residual risk matrix. Changes stay in React state. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW, findStaff } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import {
  HAZARDS,
  INCIDENTS,
  JCI_CHAPTERS,
  LAST_SENTINEL_ON,
  LICENCE_ITEMS,
  MONTHLY_INCIDENTS,
  type Harm,
  type Hazard,
  type Incident,
  type IncidentCategory,
  type LicenceItem,
} from '../../data/ext/quality.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  BarChart,
  Button,
  Card,
  Checkbox,
  Code,
  DataTable,
  Dialog,
  Grid,
  KeyValueList,
  Meter,
  PageHeader,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { CATEGORIES, HARMS, HARM_TONE, IncidentsTab, needsRca, useLocationLabel } from './incidents.tsx';
import { messages } from './messages.ts';
import './quality.css';

const LOCATIONS: readonly Incident['location'][] = ['med-a', 'surg-b', 'paeds', 'icu', 'ed', 'theatre', 'lab', 'pharmacy', 'opd'];

function riskLevel(score: number): { readonly key: 'risk_low' | 'risk_medium' | 'risk_high'; readonly tone: Tone } {
  if (score >= 12) {
    return { key: 'risk_high', tone: 'danger' };
  }
  if (score >= 6) {
    return { key: 'risk_medium', tone: 'warning' };
  }
  return { key: 'risk_low', tone: 'success' };
}

export function QualityScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [incidents, setIncidents] = useState<readonly Incident[]>(INCIDENTS);
  const [selectedId, setSelectedId] = useState<string | null>(INCIDENTS[0]?.id ?? null);
  const [licences, setLicences] = useState<readonly LicenceItem[]>(LICENCE_ITEMS);
  const [hazards, setHazards] = useState<readonly Hazard[]>(HAZARDS);
  const [tab, setTab] = useState('incidents');
  const [reporting, setReporting] = useState(false);
  const [openHazard, setOpenHazard] = useState<Hazard | null>(null);

  const open = incidents.filter((i) => i.stage !== 'closed');
  const openWithHarm = open.filter((i) => i.harm !== 'near-miss' && i.harm !== 'none').length;
  const rcas = incidents.filter((i) => i.stage === 'rca').length;
  const sentinelDays = Math.floor((DEMO_NOW.getTime() - Date.parse(`${LAST_SENTINEL_ON}T12:00:00+03:00`)) / 86_400_000);
  const jciMet = JCI_CHAPTERS.reduce((s, c) => s + c.met, 0);
  const jciTotal = JCI_CHAPTERS.reduce((s, c) => s + c.elements, 0);
  const licenceLeft = licences.filter((l) => l.state !== 'done').length;

  return (
    <div className="quality-screen">
      <PageHeader
        icon="check-circle"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="primary" icon="plus" onPress={() => setReporting(true)}>
            {t('reportIncident')}
          </Button>
        }
      >
        <Badge tone="neutral" icon="info" size="sm">
          {t('synthetic')}
        </Badge>
      </PageHeader>

      <Grid min="12rem">
        <StatTile label={t('tileOpen')} value={f.number(open.length)} icon="alert" tone={openWithHarm > 0 ? 'warning' : undefined} hint={t('tileOpenHint', { count: openWithHarm })} onPress={() => setTab('incidents')} />
        <StatTile label={t('tileRca')} value={f.number(rcas)} icon="search" hint={t('tileRcaHint')} onPress={() => setTab('incidents')} />
        <StatTile label={t('tileSentinel')} value={f.number(sentinelDays)} icon="shield" tone="success" hint={t('tileSentinelHint', { date: f.date(LAST_SENTINEL_ON) })} />
        <StatTile
          label={t('tileJci')}
          value={f.percent(jciMet / jciTotal)}
          icon="check-circle"
          hint={t('tileJciHint', { met: f.number(jciMet), total: f.number(jciTotal) })}
          trend={[61, 64, 66, 69, 71, 74, Math.round((jciMet / jciTotal) * 100)]}
          trendLabel={t('tileJci')}
          onPress={() => setTab('accreditation')}
        />
        <StatTile label={t('tileLicence')} value={`${f.number(licences.length - licenceLeft)}/${f.number(licences.length)}`} icon="clipboard" tone={licenceLeft > 0 ? 'warning' : 'success'} hint={t('tileLicenceHint', { count: licenceLeft })} onPress={() => setTab('accreditation')} />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          {
            id: 'incidents',
            label: t('tabIncidents'),
            badge: String(open.length),
            content: (
              <IncidentsTab
                incidents={incidents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={(next) => setIncidents((current) => current.map((i) => (i.id === next.id ? next : i)))}
              />
            ),
          },
          { id: 'dashboard', label: t('tabDashboard'), content: <SafetyDashboard incidents={incidents} /> },
          {
            id: 'accreditation',
            label: t('tabAccreditation'),
            content: (
              <Accreditation
                licences={licences}
                onDone={(id) => {
                  setLicences((current) => current.map((l) => (l.id === id ? { ...l, state: 'done' } : l)));
                  toast({ tone: 'success', title: t('toastLicence') });
                }}
              />
            ),
          },
          { id: 'hazards', label: t('tabHazards'), badge: String(hazards.filter((h) => h.status === 'open').length), content: <HazardLog hazards={hazards} onOpen={setOpenHazard} /> },
        ]}
      />

      <ReportDialog
        isOpen={reporting}
        onOpenChange={setReporting}
        nextId={`SYN-INC-${String(2611 + incidents.length - INCIDENTS.length)}`}
        onSubmit={(incident) => {
          setIncidents((current) => [incident, ...current]);
          setSelectedId(incident.id);
          setTab('incidents');
          toast({ tone: 'success', title: t('toastReported', { id: incident.id }) });
        }}
      />

      <Dialog
        isOpen={openHazard !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpenHazard(null);
          }
        }}
        title={openHazard === null ? '' : t('hazardDialog', { id: openHazard.id })}
        {...(openHazard === null ? {} : { subtitle: f.text(openHazard.hazard) })}
        actions={
          <>
            <Button variant="secondary" onPress={() => setOpenHazard(null)}>
              {t('close')}
            </Button>
            <Button
              variant="primary"
              icon="check"
              onPress={() => {
                if (openHazard !== null) {
                  setHazards((current) => current.map((h) => (h.id === openHazard.id ? { ...h, reviewOn: '2027-01-17' } : h)));
                  toast({ tone: 'success', title: t('toastReviewed', { id: openHazard.id }) });
                }
                setOpenHazard(null);
              }}
            >
              {t('markReviewed')}
            </Button>
          </>
        }
      >
        {openHazard === null ? null : <HazardDetail hazard={openHazard} />}
      </Dialog>
    </div>
  );
}

function SafetyDashboard({ incidents }: { readonly incidents: readonly Incident[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const byCategory = CATEGORIES.map((c) => ({ id: c, label: t(`cat_${c}`), value: incidents.filter((i) => i.category === c).length }))
    .filter((d) => d.value > 0)
    .toSorted((a, b) => b.value - a.value)
    .map((d) => ({ ...d, valueLabel: f.number(d.value) }));
  const byHarm = HARMS.map((h) => {
    const value = incidents.filter((i) => i.harm === h).length;
    return { id: h, label: t(`harm_${h}`), value, valueLabel: f.number(value), ...(needsRca(h) ? { tone: 'warning' as const } : {}) };
  });
  const month = (m: string): string => f.date(`${m}-15`).replace(/^\d+\s/u, '');
  return (
    <div className="qa-dash">
      <Grid min="20rem">
        <Card title={t('byMonth')} subtitle={t('byMonthSubtitle')} icon="chart" footer={t('cultureNote')}>
          <BarChart orientation="vertical" height="9rem" label={t('byMonth')} data={MONTHLY_INCIDENTS.map((m) => ({ id: m.month, label: month(m.month), value: m.reported, valueLabel: f.number(m.reported) }))} />
          <h3 className="qa-h3">{t('withHarm')}</h3>
          <BarChart orientation="vertical" height="5rem" label={t('withHarm')} tone="warning" data={MONTHLY_INCIDENTS.map((m) => ({ id: m.month, label: month(m.month), value: m.harm, valueLabel: f.number(m.harm) }))} />
        </Card>
        <Card title={t('byCategory')} subtitle={t('byCategorySubtitle')} icon="filter">
          <BarChart label={t('byCategory')} data={byCategory} />
        </Card>
        <Card title={t('byHarm')} icon="alert">
          <BarChart label={t('byHarm')} data={byHarm} />
        </Card>
      </Grid>
    </div>
  );
}

function Accreditation({ licences, onDone }: { readonly licences: readonly LicenceItem[]; readonly onDone: (id: string) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const stateTone: Readonly<Record<LicenceItem['state'], Tone>> = { done: 'success', 'in-progress': 'info', 'not-started': 'warning' };
  const columns: readonly Column<LicenceItem>[] = [
    { id: 'item', header: t('colItem'), cell: (l) => f.text(l.item) },
    { id: 'authority', header: t('colAuthority'), cell: (l) => <span className="qa-muted">{f.text(l.authority)}</span> },
    { id: 'due', header: t('colDue'), cell: (l) => f.date(l.due), nowrap: true },
    {
      id: 'owner',
      header: t('colOwner'),
      cell: (l) => {
        const owner = findStaff(l.ownerId);
        return owner === undefined ? '–' : <StaffName member={owner} />;
      },
    },
    {
      id: 'state',
      header: t('colStatus'),
      cell: (l) =>
        l.state === 'done' ? (
          <Badge tone="success" icon="check" size="sm">
            {t('lic_done')}
          </Badge>
        ) : (
          <span className="qa-inline">
            <Badge tone={stateTone[l.state]} size="sm">
              {t(`lic_${l.state}`)}
            </Badge>
            <Button size="sm" variant="ghost" icon="check" onPress={() => onDone(l.id)}>
              {t('markComplete')}
            </Button>
          </span>
        ),
    },
  ];
  return (
    <div className="qa-columns">
      <Card
        title={t('jciTitle')}
        subtitle={t('jciSubtitle')}
        icon="shield"
        actions={
          <Button size="sm" variant="secondary" icon="calendar" onPress={() => toast({ tone: 'success', title: t('toastMock', { date: f.date('2026-11-09') }) })}>
            {t('mockSurvey')}
          </Button>
        }
      >
        <div className="qa-meters">
          {JCI_CHAPTERS.map((c) => {
            const fraction = c.met / c.elements;
            return (
              <div key={c.code} className="qa-chapter">
                <Code className="qa-chapter__code">{c.code}</Code>
                <Meter
                  value={fraction}
                  label={f.text(c.name)}
                  valueLabel={t('chapterValue', { met: c.met, total: c.elements, partial: c.partial })}
                  tone={fraction >= 0.85 ? 'success' : fraction >= 0.75 ? 'accent' : 'warning'}
                />
              </div>
            );
          })}
        </div>
      </Card>
      <Card title={t('krgTitle')} subtitle={t('krgSubtitle', { year: '2027' })} icon="clipboard" flush>
        <DataTable caption={t('licenceTable')} columns={columns} rows={licences} rowKey={(l) => l.id} rowTone={(l) => (l.state === 'not-started' && l.due < '2026-11-30' ? 'warning' : undefined)} dense />
      </Card>
    </div>
  );
}

function HazardLog({ hazards, onOpen }: { readonly hazards: readonly Hazard[]; readonly onOpen: (hazard: Hazard) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const statusTone: Readonly<Record<Hazard['status'], Tone>> = { open: 'warning', mitigated: 'info', accepted: 'neutral', closed: 'success' };
  const score = (l: number, s: number) => {
    const level = riskLevel(l * s);
    return (
      <Badge tone={level.tone} size="sm">
        {t('riskScore', { score: l * s, level: t(level.key) })}
      </Badge>
    );
  };
  const columns: readonly Column<Hazard>[] = [
    { id: 'id', header: t('colId'), cell: (h) => <Code>{h.id}</Code>, nowrap: true },
    {
      id: 'hazard',
      header: t('colHazard'),
      cell: (h) => (
        <span className="qa-stack">
          <span className="qa-strong">{f.text(h.hazard)}</span>
          <span className="qa-muted">{f.text(h.cause)}</span>
        </span>
      ),
    },
    { id: 'initial', header: t('colInitial'), cell: (h) => score(h.likelihood, h.severity), nowrap: true },
    { id: 'residual', header: t('colResidual'), cell: (h) => score(h.residualLikelihood, h.residualSeverity), nowrap: true },
    { id: 'review', header: t('colReview'), cell: (h) => <span className={h.reviewOn < '2026-11-02' ? 'qa-warn' : undefined}>{f.date(h.reviewOn)}</span>, nowrap: true },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (h) => (
        <Badge tone={statusTone[h.status]} size="sm">
          {t(`hz_${h.status}`)}
        </Badge>
      ),
    },
  ];
  const levels = [5, 4, 3, 2, 1];
  return (
    <div className="qa-columns qa-columns--hazards">
      <Card title={t('hazardsTitle')} subtitle={t('hazardsSubtitle')} icon="shield" flush>
        <DataTable caption={t('hazardsTable')} columns={columns} rows={hazards} rowKey={(h) => h.id} onRowAction={onOpen} rowTone={(h) => (h.residualLikelihood * h.residualSeverity >= 12 ? 'danger' : undefined)} dense />
      </Card>
      <Card title={t('matrixTitle')} subtitle={t('matrixSubtitle')} icon="filter">
        <div className="qa-matrix" role="table" aria-label={t('matrixTitle')} dir="ltr">
          {levels.map((l) => (
            <div key={l} className="qa-matrix__row" role="row">
              <span className="qa-matrix__axis" role="rowheader">
                {l}
              </span>
              {[1, 2, 3, 4, 5].map((s) => {
                const count = hazards.filter((h) => h.residualLikelihood === l && h.residualSeverity === s).length;
                const level = riskLevel(l * s);
                return (
                  <span key={s} role="cell" className={`qa-matrix__cell qa-matrix__cell--${level.tone}`} title={t('matrixCell', { l, s, count })} aria-label={t('matrixCell', { l, s, count })}>
                    {count === 0 ? '' : f.number(count)}
                  </span>
                );
              })}
            </div>
          ))}
          <div className="qa-matrix__row" role="row">
            <span className="qa-matrix__axis" />
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className="qa-matrix__axis" role="columnheader">
                {s}
              </span>
            ))}
          </div>
        </div>
        <p className="qa-muted qa-matrix__legend">
          ↑ {t('likelihood')} · → {t('severity')}
        </p>
      </Card>
    </div>
  );
}

function HazardDetail({ hazard }: { readonly hazard: Hazard }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const owner = findStaff(hazard.ownerId);
  return (
    <KeyValueList
      columns={1}
      items={[
        { id: 'cause', label: t('colCause'), value: f.text(hazard.cause) },
        { id: 'controls', label: t('colControls'), value: f.text(hazard.controls) },
        { id: 'initial', label: t('colInitial'), value: `${String(hazard.likelihood)} × ${String(hazard.severity)} = ${String(hazard.likelihood * hazard.severity)} · ${t(riskLevel(hazard.likelihood * hazard.severity).key)}` },
        { id: 'residual', label: t('colResidual'), value: `${String(hazard.residualLikelihood)} × ${String(hazard.residualSeverity)} = ${String(hazard.residualLikelihood * hazard.residualSeverity)} · ${t(riskLevel(hazard.residualLikelihood * hazard.residualSeverity).key)}` },
        { id: 'owner', label: t('colOwner'), value: owner === undefined ? '–' : <StaffName member={owner} /> },
        { id: 'review', label: t('colReview'), value: f.date(hazard.reviewOn) },
        { id: 'status', label: t('colStatus'), value: t(`hz_${hazard.status}`) },
      ]}
    />
  );
}

function ReportDialog({
  isOpen,
  onOpenChange,
  nextId,
  onSubmit,
}: {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly nextId: string;
  readonly onSubmit: (incident: Incident) => void;
}): ReactNode {
  const t = useT(messages);
  const where = useLocationLabel();
  const [category, setCategory] = useState<IncidentCategory>('fall');
  const [harm, setHarm] = useState<Harm>('none');
  const [location, setLocation] = useState<Incident['location']>('med-a');
  const [summary, setSummary] = useState('');
  const [immediate, setImmediate] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('dialogTitle')}
      subtitle={t('dialogSubtitle')}
      size="lg"
      actions={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            isDisabled={summary.trim() === ''}
            onPress={() => {
              const text = (value: string) => ({ en: value, ckb: value, ar: value });
              onSubmit({
                id: nextId,
                reportedIso: '2026-10-19T09:30:00+03:00',
                category,
                harm,
                location,
                reporterId: 'SYN-STF-002',
                patientId: null,
                stage: 'new',
                summary: text(summary.trim()),
                immediateAction: text(immediate.trim() === '' ? '–' : immediate.trim()),
                handlerId: 'SYN-STF-004',
                anonymous,
                actions: [],
              });
              setSummary('');
              setImmediate('');
              setAnonymous(false);
              onOpenChange(false);
            }}
          >
            {t('submit')}
          </Button>
        </>
      }
    >
      <div className="qa-form">
        <div className="qa-form__row">
          <SelectField label={t('fieldCategory')} options={CATEGORIES.map((c) => ({ id: c, label: t(`cat_${c}`) }))} selectedKey={category} onSelectionChange={(id) => setCategory(id as IncidentCategory)} />
          <SelectField label={t('fieldHarm')} options={HARMS.map((h) => ({ id: h, label: t(`harm_${h}`) }))} selectedKey={harm} onSelectionChange={(id) => setHarm(id as Harm)} />
          <SelectField label={t('fieldLocation')} options={LOCATIONS.map((l) => ({ id: l, label: where(l) }))} selectedKey={location} onSelectionChange={(id) => setLocation(id as Incident['location'])} />
        </div>
        {needsRca(harm) ? (
          <Badge tone={HARM_TONE[harm]} icon="alert">
            {t('rcaRequired')}
          </Badge>
        ) : null}
        <TextInput label={t('fieldSummary')} value={summary} onChange={setSummary} multiline isRequired />
        <TextInput label={t('fieldImmediate')} value={immediate} onChange={setImmediate} multiline />
        <Checkbox isSelected={anonymous} onChange={setAnonymous}>
          {t('fieldAnonymous')}
        </Checkbox>
      </div>
    </Dialog>
  );
}
