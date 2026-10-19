/**
 * Blood bank: unit inventory by group, component and expiry; receipts from the public blood banks with
 * relabelling; cross-match requests and issue; the bedside two-person check that starts a transfusion; and
 * transfusion reactions reported to the MOH haemovigilance scheme. Every change stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  DEMO_TODAY,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  findStaff,
  getPatient,
  locationOf,
  type BloodGroup,
  type Tone,
} from '../../data/index.ts';
import {
  BLOOD_GROUPS,
  BLOOD_SOURCES,
  BLOOD_UNITS,
  COMPONENTS,
  RBC_MINIMUM,
  REACTIONS,
  SHIPMENTS,
  XM_REQUESTS,
  type BloodUnit,
  type Component,
  type Reaction,
  type ReactionSeverity,
  type ReactionStatus,
  type ReactionType,
  type Shipment,
  type UnitStatus,
  type XmRequest,
  type XmStatus,
} from '../../data/ext/bloodbank.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
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
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  Toolbar,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { BedsideCheckDialog } from './bedside.tsx';
import './bloodbank.css';
import { messages } from './messages.ts';

const UNIT_TONE: Readonly<Record<UnitStatus, Tone>> = {
  quarantine: 'warning',
  available: 'success',
  crossmatched: 'info',
  issued: 'accent',
  transfusing: 'accent',
  transfused: 'neutral',
  expired: 'danger',
  discarded: 'neutral',
};
const UNIT_KEY = {
  quarantine: 'usQuarantine',
  available: 'usAvailable',
  crossmatched: 'usCrossmatched',
  issued: 'usIssued',
  transfusing: 'usTransfusing',
  transfused: 'usTransfused',
  expired: 'usExpired',
  discarded: 'usDiscarded',
} as const satisfies Record<UnitStatus, string>;
const COMPONENT_KEY = { RBC: 'cmpRbc', FFP: 'cmpFfp', PLT: 'cmpPlt', CRYO: 'cmpCryo' } as const satisfies Record<Component, string>;
const XM_TONE: Readonly<Record<XmStatus, Tone>> = { 'sample-awaited': 'warning', grouping: 'info', crossmatching: 'info', ready: 'success', issued: 'accent', problem: 'danger' };
const XM_KEY = {
  'sample-awaited': 'xmSample',
  grouping: 'xmGrouping',
  crossmatching: 'xmCrossmatching',
  ready: 'xmReady',
  issued: 'xmIssued',
  problem: 'xmProblem',
} as const satisfies Record<XmStatus, string>;
const RX_TYPE_KEY = { febrile: 'rtFebrile', allergic: 'rtAllergic', taco: 'rtTaco', trali: 'rtTrali', haemolytic: 'rtHaemolytic' } as const satisfies Record<ReactionType, string>;
const RX_SEV_KEY = { mild: 'svMild', moderate: 'svModerate', severe: 'svSevere' } as const satisfies Record<ReactionSeverity, string>;
const RX_SEV_TONE: Readonly<Record<ReactionSeverity, Tone>> = { mild: 'info', moderate: 'warning', severe: 'danger' };
const RX_STATUS_KEY = { investigating: 'rsInvestigating', reported: 'rsReported', closed: 'rsClosed' } as const satisfies Record<ReactionStatus, string>;
const RX_STATUS_TONE: Readonly<Record<ReactionStatus, Tone>> = { investigating: 'warning', reported: 'info', closed: 'neutral' };

const STOCK_STATUSES: ReadonlySet<UnitStatus> = new Set(['available', 'crossmatched', 'quarantine']);
const DAY_MS = 86_400_000;

function daysToExpiry(unit: BloodUnit): number {
  return Math.round((Date.parse(`${unit.expiresOn}T12:00:00+03:00`) - Date.parse(`${DEMO_TODAY}T12:00:00+03:00`)) / DAY_MS);
}

export function BloodBankScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();

  const [units, setUnits] = useState<readonly BloodUnit[]>(BLOOD_UNITS);
  const [shipments, setShipments] = useState<readonly Shipment[]>(SHIPMENTS);
  const [requests, setRequests] = useState<readonly XmRequest[]>(XM_REQUESTS);
  const [reactions, setReactions] = useState<readonly Reaction[]>(REACTIONS);
  const [tab, setTab] = useState('inventory');
  const [component, setComponent] = useState<'all' | Component>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | BloodGroup>('all');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedXm, setSelectedXm] = useState<string | null>(null);
  const [bedside, setBedside] = useState<BloodUnit | null>(null);
  const [reporting, setReporting] = useState(false);
  const [rxUnit, setRxUnit] = useState('');
  const [rxType, setRxType] = useState<ReactionType>('febrile');
  const [rxSeverity, setRxSeverity] = useState<ReactionSeverity>('mild');
  const [rxSigns, setRxSigns] = useState('');
  const [nextUnit, setNextUnit] = useState(501);

  const setUnit = (id: string, patch: Partial<BloodUnit>): void => {
    setUnits((current) => current.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };
  const setXm = (id: string, patch: Partial<XmRequest>): void => {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const stock = units.filter((u) => STOCK_STATUSES.has(u.status));
  const rbcAvailable = units.filter((u) => u.component === 'RBC' && u.status === 'available');
  const expiringSoon = stock.filter((u) => daysToExpiry(u) <= 3 && daysToExpiry(u) >= 0);
  const xmOpen = requests.filter((r) => r.status !== 'issued');
  const transfusing = units.filter((u) => u.status === 'transfusing');
  const rxOpen = reactions.filter((r) => r.status === 'investigating');
  const toRelabel = shipments.filter((s) => s.status === 'awaiting-relabel');

  const filteredUnits = useMemo(
    () =>
      units
        .filter((u) => component === 'all' || u.component === component)
        .filter((u) => groupFilter === 'all' || u.group === groupFilter)
        .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn)),
    [units, component, groupFilter],
  );

  const sourceName = (id: string): string => {
    const source = BLOOD_SOURCES.find((s) => s.id === id);
    return source === undefined ? id : f.text(source.name);
  };

  const expiryCell = (u: BloodUnit): ReactNode => {
    const days = daysToExpiry(u);
    if (days < 0) {
      return <Badge tone="danger" size="sm" icon="alert" strong>{t('expired')}</Badge>;
    }
    return (
      <span className="bb-two">
        <span>{f.date(u.expiresOn)}</span>
        <Badge tone={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'neutral'} size="sm">
          {t('daysLeft', { count: days })}
        </Badge>
      </span>
    );
  };

  // ---------------------------------------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------------------------------------

  const matrix = (
    <Card title={t('matrixTitle')} subtitle={t('matrixSubtitle')} icon="droplet" flush>
      <div className="bb-matrix-wrap">
        <table className="bb-matrix">
          <caption className="hms-visually-hidden">{t('matrixTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('group')}</th>
              {COMPONENTS.map((c) => (
                <th key={c} scope="col">
                  {t(COMPONENT_KEY[c])}
                </th>
              ))}
              <th scope="col">{t('rbcVsMinimum')}</th>
            </tr>
          </thead>
          <tbody>
            {BLOOD_GROUPS.map((group) => {
              const rbc = units.filter((u) => u.group === group && u.component === 'RBC' && u.status === 'available').length;
              const min = RBC_MINIMUM[group];
              return (
                <tr key={group}>
                  <th scope="row">
                    <button type="button" className="bb-group-button" onClick={() => { setGroupFilter(group); }}>
                      <span className="bb-group">{group}</span>
                    </button>
                  </th>
                  {COMPONENTS.map((c) => {
                    const n = units.filter((u) => u.group === group && u.component === c && u.status === 'available').length;
                    const soon = units.filter((u) => u.group === group && u.component === c && u.status === 'available' && daysToExpiry(u) <= 3).length;
                    return (
                      <td key={c} className={n === 0 ? 'bb-matrix__zero' : undefined}>
                        <span className="bb-strong">{f.number(n)}</span>
                        {soon > 0 ? <span className="bb-soon"> {t('soonShort', { count: soon })}</span> : null}
                      </td>
                    );
                  })}
                  <td className="bb-matrix__meter">
                    <Meter
                      label={t('rbcMeterLabel', { group })}
                      showText={false}
                      value={rbc / Math.max(1, min * 2)}
                      valueLabel={t('ofMinimum', { n: rbc, min })}
                      tone={rbc < min ? 'danger' : rbc < min * 1.5 ? 'warning' : 'success'}
                    />
                    <span className={rbc < min ? 'bb-below' : 'bb-muted'}>{t('ofMinimum', { n: rbc, min })}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const unitColumns: readonly Column<BloodUnit>[] = [
    {
      id: 'unit',
      header: t('colUnit'),
      nowrap: true,
      cell: (u) => (
        <span className="bb-two">
          <Code>{u.id}</Code>
          <span className="bb-muted">
            <Code>{u.sourceNumber}</Code>
          </span>
        </span>
      ),
    },
    { id: 'group', header: t('group'), cell: (u) => <span className="bb-group">{u.group}</span> },
    { id: 'component', header: t('component'), cell: (u) => <span className="bb-two"><span>{t(COMPONENT_KEY[u.component])}</span><span className="bb-muted"><Code>{`${String(u.volumeMl)} mL`}</Code></span></span> },
    { id: 'expiry', header: t('expires'), cell: expiryCell },
    { id: 'source', header: t('source'), cell: (u) => <span className="bb-muted">{sourceName(u.sourceId)}</span> },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (u) => (
        <span className="bb-two">
          <Badge tone={UNIT_TONE[u.status]} size="sm">{t(UNIT_KEY[u.status])}</Badge>
          {u.patientId === null ? null : <span className="bb-muted">{getPatient(u.patientId).mrn}</span>}
        </span>
      ),
    },
  ];

  const unitDetail = (u: BloodUnit): ReactNode => (
    <Card
      title={<Code>{u.id}</Code>}
      subtitle={`${t(COMPONENT_KEY[u.component])} · ${u.group}`}
      icon="droplet"
      tone={daysToExpiry(u) < 0 ? 'danger' : daysToExpiry(u) <= 3 ? 'warning' : 'neutral'}
      actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedUnit(null); }} />}
    >
      <div className="bb-stack">
        <KeyValueList
          columns={2}
          items={[
            { id: 'status', label: t('colStatus'), value: <Badge tone={UNIT_TONE[u.status]} size="sm">{t(UNIT_KEY[u.status])}</Badge> },
            { id: 'group', label: t('group'), value: <span className="bb-group">{u.group}</span> },
            { id: 'collected', label: t('collected'), value: f.date(u.collectedOn) },
            { id: 'expires', label: t('expires'), value: expiryCell(u) },
            { id: 'source', label: t('source'), value: sourceName(u.sourceId) },
            { id: 'srcno', label: t('sourceNumber'), value: <Code>{u.sourceNumber}</Code> },
            { id: 'ld', label: t('leucodepleted'), value: u.leucodepleted ? t('yes') : t('no') },
            { id: 'irr', label: t('irradiated'), value: u.irradiated ? t('yes') : t('no') },
          ]}
        />
        {u.patientId === null ? null : <PatientInline patient={getPatient(u.patientId)} />}
        <div className="bb-actions">
          {u.status === 'quarantine' ? (
            <Button variant="primary" icon="check" onPress={() => { setUnit(u.id, { status: 'available' }); toast({ tone: 'success', title: t('toastReleased', { id: u.id }) }); }}>
              {t('actRelease')}
            </Button>
          ) : null}
          {u.status === 'issued' ? (
            <Button variant="primary" icon="droplet" onPress={() => { setBedside(u); }}>
              {t('actBedside')}
            </Button>
          ) : null}
          {u.status === 'transfusing' ? (
            <Button variant="primary" icon="check" onPress={() => { setUnit(u.id, { status: 'transfused' }); toast({ tone: 'success', title: t('toastCompleted', { id: u.id }) }); }}>
              {t('actComplete')}
            </Button>
          ) : null}
          {u.status === 'expired' || (u.status === 'available' && daysToExpiry(u) <= 1) ? (
            <Button variant="danger" icon="x" onPress={() => { setUnit(u.id, { status: 'discarded' }); toast({ tone: 'warning', title: t('toastDiscarded', { id: u.id }) }); }}>
              {t('actDiscard')}
            </Button>
          ) : null}
          <Button icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastLabel', { id: u.id }) }); }}>
            {t('actLabel')}
          </Button>
        </div>
      </div>
    </Card>
  );

  const selectedU = units.find((u) => u.id === selectedUnit) ?? null;
  const inventoryTab = (
    <div className="bb-stack">
      {matrix}
      <div className={selectedU === null ? undefined : 'bb-split'}>
        <Card flush>
          <div className="bb-toolbar">
            <Toolbar label={t('filters')}>
              <Segmented
                label={t('component')}
                hideLabel
                value={component}
                onChange={(id) => { setComponent(id as 'all' | Component); }}
                options={[{ id: 'all', label: t('all') }, ...COMPONENTS.map((c) => ({ id: c, label: t(COMPONENT_KEY[c]) }))]}
              />
              <SelectField
                label={t('group')}
                hideLabel
                selectedKey={groupFilter}
                onSelectionChange={(id) => { setGroupFilter(id as 'all' | BloodGroup); }}
                options={[{ id: 'all', label: t('allGroups') }, ...BLOOD_GROUPS.map((g) => ({ id: g, label: g }))]}
              />
            </Toolbar>
            <span className="bb-muted">{t('unitsShown', { count: filteredUnits.length })}</span>
          </div>
          <DataTable
            caption={t('unitsTitle')}
            dense
            columns={unitColumns}
            rows={filteredUnits}
            rowKey={(u) => u.id}
            selectedKey={selectedUnit}
            onRowAction={(u) => { setSelectedUnit(u.id); }}
            rowTone={(u) => (daysToExpiry(u) < 0 && u.status !== 'discarded' ? 'danger' : STOCK_STATUSES.has(u.status) && daysToExpiry(u) <= 3 ? 'warning' : undefined)}
            emptyText={<EmptyState compact icon="droplet" title={t('unitsEmpty')} />}
          />
        </Card>
        {selectedU === null ? null : unitDetail(selectedU)}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------------------------------------

  const relabel = (shipment: Shipment): void => {
    const created: BloodUnit[] = shipment.units.map((item, index) => ({
      id: `SYN-BU-26-${String(nextUnit + index).padStart(5, '0')}`,
      sourceNumber: item.sourceNumber,
      sourceId: shipment.sourceId,
      component: item.component,
      group: item.group,
      volumeMl: item.component === 'RBC' ? 280 : 220,
      collectedOn: DEMO_TODAY,
      expiresOn: item.expiresOn,
      status: 'available',
      patientId: null,
      irradiated: false,
      leucodepleted: true,
    }));
    setUnits((current) => [...current, ...created]);
    setNextUnit((n) => n + shipment.units.length);
    setShipments((current) => current.map((s) => (s.id === shipment.id ? { ...s, status: 'relabelled' } : s)));
    toast({ tone: 'success', title: t('toastRelabelled', { count: created.length }), body: t('toastRelabelledBody') });
  };

  const receiptsTab = (
    <div className="bb-stack">
      <Callout tone="info" title={t('receiptPolicyTitle')}>
        {t('receiptPolicy')}
      </Callout>
      {shipments.map((shipment) => {
        const warm = Number(shipment.arrivalTempC) > 6;
        return (
          <Card
            key={shipment.id}
            title={sourceName(shipment.sourceId)}
            subtitle={
              <>
                <Code>{shipment.id}</Code> · {f.dateTime(shipment.receivedIso)} · {f.text(shipment.courier)}
              </>
            }
            icon="building"
            tone={shipment.status === 'rejected' ? 'danger' : shipment.status === 'awaiting-relabel' ? 'warning' : 'neutral'}
            flush
            actions={
              <span className="bb-row">
                <Badge tone={warm ? 'danger' : 'success'} size="sm" icon="thermometer">
                  {t('arrivalTemp', { temp: shipment.arrivalTempC })}
                </Badge>
                {shipment.status === 'awaiting-relabel' ? (
                  <Button size="sm" variant="primary" icon="printer" onPress={() => { relabel(shipment); }}>
                    {t('actRelabel', { count: shipment.units.length })}
                  </Button>
                ) : (
                  <Badge tone={shipment.status === 'rejected' ? 'danger' : 'success'} size="sm">
                    {shipment.status === 'rejected' ? t('shipRejected') : t('shipRelabelled')}
                  </Badge>
                )}
              </span>
            }
          >
            <DataTable
              caption={shipment.id}
              dense
              rows={shipment.units}
              rowKey={(item) => item.sourceNumber}
              columns={[
                { id: 'src', header: t('sourceNumber'), cell: (item) => <Code>{item.sourceNumber}</Code> },
                { id: 'comp', header: t('component'), cell: (item) => t(COMPONENT_KEY[item.component]) },
                { id: 'group', header: t('group'), cell: (item) => <span className="bb-group">{item.group}</span> },
                { id: 'exp', header: t('expires'), cell: (item) => f.date(item.expiresOn) },
              ]}
            />
            {shipment.status === 'rejected' ? <p className="bb-muted bb-pad">{t('rejectedReason')}</p> : null}
          </Card>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Cross-match
  // ---------------------------------------------------------------------------------------------------------

  const advanceXm = (r: XmRequest): void => {
    if (r.status === 'sample-awaited') {
      setXm(r.id, { status: 'grouping', sampleId: `SYN-SPC-26G${String(110 + requests.indexOf(r))}` });
      toast({ tone: 'info', title: t('toastSample', { id: r.id }) });
    } else if (r.status === 'grouping') {
      setXm(r.id, { status: 'crossmatching', antibodyScreen: 'negative' });
      toast({ tone: 'info', title: t('toastGrouped', { id: r.id }) });
    } else if (r.status === 'crossmatching') {
      const patient = getPatient(r.patientId);
      const pick = units
        .filter((u) => u.component === r.component && u.status === 'available' && (patient.bloodGroup === null ? u.group === 'O-' : u.group === patient.bloodGroup || (r.component === 'RBC' && u.group === 'O-')))
        .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn))
        .slice(0, Math.max(0, r.units - r.unitIds.length));
      const ids = [...r.unitIds, ...pick.map((u) => u.id)];
      for (const u of pick) {
        setUnit(u.id, { status: 'crossmatched', patientId: r.patientId });
      }
      setXm(r.id, { status: 'ready', unitIds: ids });
      toast({ tone: 'success', title: t('toastCompatible', { id: r.id, count: ids.length }) });
    } else if (r.status === 'ready') {
      for (const id of r.unitIds) {
        setUnit(id, { status: 'issued' });
      }
      setXm(r.id, { status: 'issued' });
      toast({ tone: 'success', title: t('toastIssued', { count: r.unitIds.length }), body: t('toastIssuedBody') });
    }
  };

  const xmNextLabel = (status: XmStatus): string | null => {
    switch (status) {
      case 'sample-awaited':
        return t('actSampleReceived');
      case 'grouping':
        return t('actGrouped');
      case 'crossmatching':
        return t('actCrossmatch');
      case 'ready':
        return t('actIssue');
      default:
        return null;
    }
  };

  const selectedR = requests.find((r) => r.id === selectedXm) ?? null;
  const xmDetail = (r: XmRequest): ReactNode => {
    const patient = getPatient(r.patientId);
    const next = xmNextLabel(r.status);
    const by = findStaff(r.requestedById);
    const loc = locationOf(r.patientId);
    return (
      <Card
        title={<Code>{r.id}</Code>}
        subtitle={`${t(COMPONENT_KEY[r.component])} × ${f.number(r.units)}`}
        icon="droplet"
        tone={r.status === 'problem' ? 'danger' : r.priority === 'stat' ? 'warning' : 'neutral'}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedXm(null); }} />}
      >
        <div className="bb-stack">
          <PatientInline patient={patient} secondary />
          {r.status === 'problem' ? (
            <Callout tone="danger" title={t('antibodyTitle')}>
              {t('antibodyBody')}
            </Callout>
          ) : null}
          <KeyValueList
            columns={2}
            items={[
              { id: 'group', label: t('patientGroup'), value: <span className="bb-group">{patient.bloodGroup ?? t('unknownGroup')}</span> },
              { id: 'abs', label: t('antibodyScreen'), value: <Badge size="sm" tone={r.antibodyScreen === 'positive' ? 'danger' : r.antibodyScreen === 'negative' ? 'success' : 'neutral'}>{t(r.antibodyScreen === 'positive' ? 'abPositive' : r.antibodyScreen === 'negative' ? 'abNegative' : 'abPending')}</Badge> },
              { id: 'hb', label: t('hb'), value: r.hb === null ? '—' : <Code>{`${r.hb} g/dL`}</Code> },
              { id: 'sample', label: t('sample'), value: r.sampleId === null ? <Badge tone="warning" size="sm">{t('xmSample')}</Badge> : <Code>{r.sampleId}</Code> },
              { id: 'by', label: t('requestedBy'), value: by === undefined ? '—' : <StaffName member={by} /> },
              { id: 'need', label: t('requiredBy'), value: f.dateTime(r.requiredBy) },
              { id: 'where', label: t('location'), value: loc === undefined ? '—' : `${f.text(loc.ward.name)} · ${loc.bedId}` },
              { id: 'prio', label: t('colPriority'), value: f.text(PRIORITY_LABEL[r.priority]) },
            ]}
          />
          <p className="bb-text">
            <span className="bb-muted">{t('indication')}: </span>
            {f.text(r.indication)}
          </p>
          {r.unitIds.length > 0 ? (
            <div>
              <p className="bb-muted">{t('allocatedUnits')}</p>
              <ul className="bb-unit-list">
                {r.unitIds.map((id) => {
                  const u = units.find((candidate) => candidate.id === id);
                  return (
                    <li key={id} className="bb-row">
                      <Code>{id}</Code>
                      {u === undefined ? null : (
                        <>
                          <span className="bb-group">{u.group}</span>
                          <Badge tone={UNIT_TONE[u.status]} size="sm">{t(UNIT_KEY[u.status])}</Badge>
                          {u.status === 'issued' ? (
                            <Button size="sm" icon="droplet" onPress={() => { setBedside(u); }}>
                              {t('actBedside')}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="bb-actions">
            {next === null ? null : (
              <Button variant="primary" icon="check" onPress={() => { advanceXm(r); }}>
                {next}
              </Button>
            )}
            <Button variant="ghost" iconEnd="arrow-forward" onPress={() => { goTo('chart', { patient: patient.id }); }}>
              {t('actChart')}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const xmTab = (
    <div className={selectedR === null ? undefined : 'bb-split'}>
      <Card title={t('xmTitle')} subtitle={t('xmSubtitle', { count: xmOpen.length })} icon="clipboard" flush>
        <DataTable
          caption={t('xmTitle')}
          rows={requests.toSorted((a, b) => a.requiredBy.localeCompare(b.requiredBy))}
          rowKey={(r) => r.id}
          selectedKey={selectedXm}
          onRowAction={(r) => { setSelectedXm(r.id); }}
          rowTone={(r) => (r.status === 'problem' ? 'danger' : r.priority === 'stat' && r.status !== 'issued' ? 'warning' : undefined)}
          dense
          columns={[
            { id: 'id', header: t('colRequest'), nowrap: true, cell: (r) => <span className="bb-two"><Code>{r.id}</Code><span className="bb-muted">{t('needBy', { time: f.time(r.requiredBy) })}</span></span> },
            { id: 'patient', header: t('colPatient'), cell: (r) => <PatientInline patient={getPatient(r.patientId)} /> },
            { id: 'group', header: t('group'), cell: (r) => <span className="bb-group">{getPatient(r.patientId).bloodGroup ?? '?'}</span> },
            { id: 'what', header: t('component'), cell: (r) => `${t(COMPONENT_KEY[r.component])} × ${f.number(r.units)}` },
            { id: 'prio', header: t('colPriority'), cell: (r) => <Badge tone={PRIORITY_TONE[r.priority]} size="sm" strong={r.priority === 'stat'}>{f.text(PRIORITY_LABEL[r.priority])}</Badge> },
            { id: 'status', header: t('colStatus'), cell: (r) => <Badge tone={XM_TONE[r.status]} size="sm">{t(XM_KEY[r.status])}</Badge> },
          ]}
        />
      </Card>
      {selectedR === null ? null : xmDetail(selectedR)}
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Transfusions and reactions
  // ---------------------------------------------------------------------------------------------------------

  const issuedOrRunning = units.filter((u) => (u.status === 'issued' || u.status === 'transfusing') && u.patientId !== null);
  const transfusionTab = (
    <div className="bb-stack">
      <Card title={t('wardTitle')} subtitle={t('wardSubtitle')} icon="droplet" flush>
        <DataTable
          caption={t('wardTitle')}
          rows={issuedOrRunning}
          rowKey={(u) => u.id}
          emptyText={<EmptyState compact icon="droplet" title={t('wardEmpty')} />}
          columns={[
            { id: 'unit', header: t('colUnit'), cell: (u) => <span className="bb-two"><Code>{u.id}</Code><span className="bb-muted">{t(COMPONENT_KEY[u.component])} · <span className="bb-group">{u.group}</span></span></span> },
            { id: 'patient', header: t('colPatient'), cell: (u) => <PatientInline patient={getPatient(u.patientId ?? '')} /> },
            { id: 'status', header: t('colStatus'), cell: (u) => <Badge tone={UNIT_TONE[u.status]} size="sm">{t(UNIT_KEY[u.status])}</Badge> },
            {
              id: 'act',
              header: t('colAction'),
              align: 'end',
              cell: (u) =>
                u.status === 'issued' ? (
                  <Button size="sm" variant="primary" icon="droplet" onPress={() => { setBedside(u); }}>
                    {t('actBedside')}
                  </Button>
                ) : (
                  <span className="bb-row bb-row--end">
                    <Button size="sm" variant="danger" icon="alert" onPress={() => { setRxUnit(u.id); setRxSigns(''); setReporting(true); }}>
                      {t('actReaction')}
                    </Button>
                    <Button size="sm" icon="check" onPress={() => { setUnit(u.id, { status: 'transfused' }); toast({ tone: 'success', title: t('toastCompleted', { id: u.id }) }); }}>
                      {t('actComplete')}
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Card>
      <Card
        title={t('hvTitle')}
        subtitle={t('hvSubtitle')}
        icon="alert"
        flush
        actions={
          <Button size="sm" variant="danger" icon="plus" onPress={() => { setRxUnit(transfusing[0]?.id ?? ''); setRxSigns(''); setReporting(true); }}>
            {t('actReaction')}
          </Button>
        }
      >
        <DataTable
          caption={t('hvTitle')}
          rows={reactions.toSorted((a, b) => b.onsetIso.localeCompare(a.onsetIso))}
          rowKey={(r) => r.id}
          rowTone={(r) => (r.status === 'investigating' ? 'warning' : undefined)}
          columns={[
            { id: 'id', header: t('colReport'), nowrap: true, cell: (r) => <span className="bb-two"><Code>{r.id}</Code><span className="bb-muted">{f.dateTime(r.onsetIso)}</span></span> },
            { id: 'patient', header: t('colPatient'), cell: (r) => <PatientInline patient={getPatient(r.patientId)} /> },
            {
              id: 'type',
              header: t('colReaction'),
              cell: (r) => (
                <span className="bb-two">
                  <span className="bb-row">
                    <span className="bb-strong">{t(RX_TYPE_KEY[r.type])}</span>
                    <Badge tone={RX_SEV_TONE[r.severity]} size="sm">{t(RX_SEV_KEY[r.severity])}</Badge>
                  </span>
                  <span className="bb-muted">{f.text(r.signs)}</span>
                  <span className="bb-muted">{f.text(r.action)}</span>
                </span>
              ),
            },
            { id: 'unit', header: t('colUnit'), cell: (r) => <Code>{r.unitId}</Code> },
            { id: 'by', header: t('reportedBy'), cell: (r) => { const m = findStaff(r.reportedById); return m === undefined ? '—' : <StaffName member={m} />; } },
            {
              id: 'status',
              header: t('colStatus'),
              cell: (r) =>
                r.status === 'investigating' ? (
                  <span className="bb-two">
                    <Badge tone={RX_STATUS_TONE[r.status]} size="sm">{t(RX_STATUS_KEY[r.status])}</Badge>
                    <Button
                      size="sm"
                      icon="printer"
                      onPress={() => {
                        setReactions((current) => current.map((x) => (x.id === r.id ? { ...x, status: 'reported' } : x)));
                        toast({ tone: 'success', title: t('toastMohSent', { id: r.id }) });
                      }}
                    >
                      {t('actMoh')}
                    </Button>
                  </span>
                ) : (
                  <Badge tone={RX_STATUS_TONE[r.status]} size="sm">{t(RX_STATUS_KEY[r.status])}</Badge>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------------------------------------

  const reactionUnits = units.filter((u) => (u.status === 'transfusing' || u.status === 'transfused') && u.patientId !== null);
  const reactionDialog = reporting ? (
    <Dialog
      isOpen
      onOpenChange={setReporting}
      title={t('rxDialogTitle')}
      subtitle={t('rxDialogSubtitle')}
      actions={
        <>
          <Button onPress={() => { setReporting(false); }}>{t('cancel')}</Button>
          <Button
            variant="danger"
            icon="alert"
            isDisabled={rxUnit === '' || rxSigns.trim() === ''}
            onPress={() => {
              const u = units.find((candidate) => candidate.id === rxUnit);
              if (u === undefined || u.patientId === null) {
                return;
              }
              const signs = rxSigns.trim();
              const entry: Reaction = {
                id: `HV-26-${String(43 + reactions.length - 3).padStart(3, '0')}`,
                patientId: u.patientId,
                unitId: u.id,
                onsetIso: DEMO_NOW_ISO,
                type: rxType,
                severity: rxSeverity,
                signs: { en: signs, ckb: signs, ar: signs },
                action: { en: messages.en.rxStopped, ckb: messages.ckb.rxStopped, ar: messages.ar.rxStopped },
                status: 'investigating',
                reportedById: 'SYN-STF-002',
              };
              setReactions((current) => [entry, ...current]);
              if (u.status === 'transfusing') {
                setUnit(u.id, { status: 'discarded' });
              }
              toast({ tone: 'danger', title: t('toastReaction'), body: t('toastReactionBody') });
              setReporting(false);
            }}
          >
            {t('actReport')}
          </Button>
        </>
      }
    >
      <div className="bb-stack">
        <Callout tone="danger" title={t('rxFirstTitle')}>
          {t('rxFirstBody')}
        </Callout>
        <SelectField
          label={t('colUnit')}
          selectedKey={rxUnit === '' ? null : rxUnit}
          onSelectionChange={setRxUnit}
          options={reactionUnits.map((u) => ({ id: u.id, label: `${u.id} · ${u.group} · ${getPatient(u.patientId ?? '').mrn}` }))}
        />
        <SelectField
          label={t('colReaction')}
          selectedKey={rxType}
          onSelectionChange={(id) => { setRxType(id as ReactionType); }}
          options={(Object.keys(RX_TYPE_KEY) as ReactionType[]).map((key) => ({ id: key, label: t(RX_TYPE_KEY[key]) }))}
        />
        <Segmented
          label={t('severity')}
          value={rxSeverity}
          onChange={(id) => { setRxSeverity(id as ReactionSeverity); }}
          options={(Object.keys(RX_SEV_KEY) as ReactionSeverity[]).map((key) => ({ id: key, label: t(RX_SEV_KEY[key]) }))}
        />
        <TextInput label={t('signs')} value={rxSigns} onChange={setRxSigns} multiline isRequired description={t('signsHint')} />
      </div>
    </Dialog>
  ) : null;

  const bedsideDialog =
    bedside === null ? null : (
      <BedsideCheckDialog
        unit={bedside}
        onCancel={() => { setBedside(null); }}
        onStart={(secondId) => {
          setUnit(bedside.id, { status: 'transfusing' });
          const second = findStaff(secondId);
          toast({ tone: 'success', title: t('toastStarted', { id: bedside.id }), body: second === undefined ? '' : t('toastStartedBody', { name: staffName(second, f.locale) }) });
          setBedside(null);
          setTab('transfusion');
        }}
      />
    );

  return (
    <div className="bb-screen">
      <PageHeader
        icon="droplet"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <>
            <Button icon="building" onPress={() => { setTab('receipts'); }}>
              {t('actReceipts')}
            </Button>
            <Button variant="primary" icon="droplet" onPress={() => { setTab('crossmatch'); }}>
              {t('actCrossmatchQueue')}
            </Button>
          </>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiRbc')} value={f.number(rbcAvailable.length)} unit={t('unitsUnit')} icon="droplet" tone={BLOOD_GROUPS.some((g) => rbcAvailable.filter((u) => u.group === g).length < RBC_MINIMUM[g]) ? 'warning' : 'success'} hint={t('kpiRbcHint')} onPress={() => { setTab('inventory'); setComponent('RBC'); }} />
        <StatTile label={t('kpiExpiring')} value={f.number(expiringSoon.length)} icon="clock" tone={expiringSoon.length > 0 ? 'warning' : 'success'} hint={t('kpiExpiringHint')} onPress={() => { setTab('inventory'); setComponent('all'); setGroupFilter('all'); }} />
        <StatTile label={t('kpiXm')} value={f.number(xmOpen.length)} icon="clipboard" tone={requests.some((r) => r.status === 'problem') ? 'danger' : 'neutral'} hint={t('kpiXmHint', { count: toRelabel.length })} onPress={() => { setTab('crossmatch'); }} />
        <StatTile label={t('kpiTransfusing')} value={f.number(transfusing.length)} icon="activity" hint={t('kpiTransfusingHint')} onPress={() => { setTab('transfusion'); }} />
        <StatTile label={t('kpiReactions')} value={f.number(rxOpen.length)} icon="alert" tone={rxOpen.length > 0 ? 'danger' : 'success'} hint={t('kpiReactionsHint', { count: reactions.length })} onPress={() => { setTab('transfusion'); }} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'inventory', label: t('tabInventory'), badge: f.number(stock.length), content: inventoryTab },
          { id: 'receipts', label: t('tabReceipts'), ...(toRelabel.length > 0 ? { badge: f.number(toRelabel.length) } : {}), content: receiptsTab },
          { id: 'crossmatch', label: t('tabCrossmatch'), badge: f.number(xmOpen.length), content: xmTab },
          { id: 'transfusion', label: t('tabTransfusion'), ...(rxOpen.length > 0 ? { badge: f.number(rxOpen.length) } : {}), content: transfusionTab },
        ]}
      />
      {reactionDialog}
      {bedsideDialog}
    </div>
  );
}
