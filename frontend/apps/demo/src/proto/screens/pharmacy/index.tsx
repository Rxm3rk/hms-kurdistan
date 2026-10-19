/**
 * Pharmacy: the inpatient verification queue ranked by STAT and high-alert medicines, dispensing, the
 * outpatient retail counter with IQD and USD, the narcotics register with counts and witnesses, look-alike
 * sound-alike pairs in tall-man lettering, and regional brands mapped to generics. Every change stays in
 * this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  ROUTE_LABEL,
  STAFF,
  findStaff,
  getPatient,
  locationOf,
  type OrderPriority,
  type Tone,
} from '../../data/index.ts';
import {
  GENERICS,
  LASA_PAIRS,
  NARCOTIC_DRUGS,
  NARCOTIC_REGISTER,
  RETAIL_SALES_TODAY,
  RX_QUEUE,
  expectedBalance,
  lasaPartner,
  tallMan,
  type NarcoticEntry,
  type NarcoticEntryType,
  type RxItem,
  type RxStatus,
} from '../../data/ext/pharmacy.ts';
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
  Money,
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
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import './pharmacy.css';
import { RetailCounter } from './pos.tsx';

const STATUS_TONE: Readonly<Record<RxStatus, Tone>> = { pending: 'warning', clarify: 'danger', verified: 'info', dispensed: 'success' };
const STATUS_KEY = { pending: 'stPending', clarify: 'stClarify', verified: 'stVerified', dispensed: 'stDispensed' } as const satisfies Record<RxStatus, string>;
const ENTRY_KEY = { receipt: 'enReceipt', issue: 'enIssue', return: 'enReturn', waste: 'enWaste', count: 'enCount' } as const satisfies Record<NarcoticEntryType, string>;
const ENTRY_TONE: Readonly<Record<NarcoticEntryType, Tone>> = { receipt: 'success', issue: 'info', return: 'accent', waste: 'warning', count: 'neutral' };
const PRIORITY_RANK: Readonly<Record<OrderPriority, number>> = { stat: 0, urgent: 1, routine: 2 };
const PHARMACIST = 'SYN-STF-012';

const UNIT_TEXT: Readonly<Record<string, string>> = { 'ug/kg/min': 'mcg/kg/min', U: 'units', mmol: 'mmol' };

/** Rank: STAT first, then high-alert, then urgent, then oldest. */
function rank(a: RxItem, b: RxItem): number {
  const pa = PRIORITY_RANK[a.priority];
  const pb = PRIORITY_RANK[b.priority];
  if (pa !== pb) {
    return pa - pb;
  }
  if (a.highAlert !== b.highAlert) {
    return a.highAlert ? -1 : 1;
  }
  return a.orderedIso.localeCompare(b.orderedIso);
}

export function PharmacyScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();

  const [queue, setQueue] = useState<readonly RxItem[]>(RX_QUEUE);
  const [register, setRegister] = useState<readonly NarcoticEntry[]>(NARCOTIC_REGISTER);
  const [discrepancies, setDiscrepancies] = useState(0);
  const [sales, setSales] = useState({ count: RETAIL_SALES_TODAY.count, iqd: RETAIL_SALES_TODAY.iqd, usd: RETAIL_SALES_TODAY.usd as number });
  const [tab, setTab] = useState('verify');
  const [view, setView] = useState<'todo' | 'all'>('todo');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drugFilter, setDrugFilter] = useState('all');
  const [counting, setCounting] = useState(false);
  const [countDrug, setCountDrug] = useState('N-MOR');
  const [countQty, setCountQty] = useState('');
  const [countWitness, setCountWitness] = useState('SYN-STF-002');
  const [brandSearch, setBrandSearch] = useState('');

  const update = (id: string, patch: Partial<RxItem>): void => {
    setQueue((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return queue
      .filter((row) => (view === 'todo' ? row.status === 'pending' || row.status === 'clarify' : true))
      .filter((row) => {
        if (needle === '') {
          return true;
        }
        const patient = getPatient(row.patientId);
        return [row.id, row.drug, patient.mrn, patient.name.latin, patient.name.ckb, patient.name.ar].some((part) => part.toLowerCase().includes(needle));
      })
      .toSorted(rank);
  }, [queue, view, search]);

  const selected = queue.find((row) => row.id === selectedId) ?? null;
  const pending = queue.filter((row) => row.status === 'pending');
  const urgentPending = pending.filter((row) => row.priority === 'stat' || row.highAlert);
  const clarify = queue.filter((row) => row.status === 'clarify');
  const toDispense = queue.filter((row) => row.status === 'verified');

  const doseText = (row: RxItem): string => `${row.dose} ${UNIT_TEXT[row.doseUnit] ?? row.doseUnit}`;
  const whereText = (patientId: string): string => {
    const loc = locationOf(patientId);
    return loc === undefined ? t('outpatient') : `${f.text(loc.ward.name)} · ${loc.bedId}`;
  };

  const drugCell = (row: RxItem): ReactNode => {
    const lasa = lasaPartner(row.drug);
    return (
      <span className="ph-two">
        <span className="ph-row">
          <Code className="ph-drug">{tallMan(row.drug)}</Code>
          {row.highAlert ? (
            <Badge tone="danger" size="sm" icon="alert">
              {t('highAlert')}
            </Badge>
          ) : null}
          {lasa === undefined ? null : (
            <Badge tone="warning" size="sm">
              {t('lasa')}
            </Badge>
          )}
        </span>
        <span className="ph-muted">
          <Code>{doseText(row)}</Code> · {f.text(ROUTE_LABEL[row.route])} · {f.text(row.frequency)}
        </span>
      </span>
    );
  };

  const columns: readonly Column<RxItem>[] = [
    {
      id: 'priority',
      header: t('colPriority'),
      cell: (row) => (
        <Badge tone={PRIORITY_TONE[row.priority]} size="sm" strong={row.priority === 'stat'}>
          {f.text(PRIORITY_LABEL[row.priority])}
        </Badge>
      ),
    },
    { id: 'drug', header: t('colMedicine'), cell: drugCell },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (row) => (
        <span className="ph-two">
          <PatientInline patient={getPatient(row.patientId)} />
          <span className="ph-muted">{whereText(row.patientId)}</span>
        </span>
      ),
    },
    {
      id: 'ordered',
      header: t('colOrdered'),
      nowrap: true,
      cell: (row) => (
        <span className="ph-two">
          <span>{f.time(row.orderedIso)}</span>
          <span className="ph-muted">{f.relative(row.orderedIso)}</span>
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <span className="ph-row">
          <Badge tone={STATUS_TONE[row.status]} size="sm">
            {t(STATUS_KEY[row.status])}
          </Badge>
          {row.alerts.length > 0 ? <Badge tone={row.alerts.some((a) => a.tone === 'danger') ? 'danger' : 'warning'} size="sm" icon="alert">{f.number(row.alerts.length)}</Badge> : null}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------------------------------------

  const detail = (row: RxItem): ReactNode => {
    const patient = getPatient(row.patientId);
    const prescriber = findStaff(row.orderedById);
    const lasa = lasaPartner(row.drug);
    return (
      <Card
        title={<Code className="ph-drug ph-drug--lg">{tallMan(row.drug)}</Code>}
        subtitle={<Code>{row.id}</Code>}
        icon="pill"
        tone={row.highAlert ? 'danger' : row.priority === 'stat' ? 'warning' : undefined}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedId(null); }} />}
      >
        <div className="ph-stack">
          <PatientInline patient={patient} secondary />
          {row.highAlert ? (
            <Callout tone="danger" title={t('highAlertTitle')}>
              {t('highAlertBody')}
            </Callout>
          ) : null}
          {row.alerts.map((alert, index) => (
            <Callout key={index} tone={alert.tone}>
              {f.text(alert.text)}
            </Callout>
          ))}
          {lasa === undefined ? null : (
            <Callout tone="warning" title={t('lasaTitle')}>
              <span className="ph-row">
                <Code className="ph-drug">{tallMan(lasa.a)}</Code>
                <span aria-hidden="true">↔</span>
                <Code className="ph-drug">{tallMan(lasa.b)}</Code>
              </span>
              <span className="ph-muted"> {f.text(lasa.risk)}</span>
            </Callout>
          )}
          <KeyValueList
            columns={2}
            items={[
              { id: 'dose', label: t('dose'), value: <Code>{doseText(row)}</Code> },
              { id: 'route', label: t('route'), value: f.text(ROUTE_LABEL[row.route]) },
              { id: 'freq', label: t('frequency'), value: f.text(row.frequency) },
              { id: 'dur', label: t('duration'), value: row.durationDays === null ? t('ongoing') : t('days', { count: row.durationDays }) },
              { id: 'by', label: t('prescriber'), value: prescriber === undefined ? '—' : <StaffName member={prescriber} /> },
              { id: 'when', label: t('colOrdered'), value: f.dateTime(row.orderedIso) },
              { id: 'where', label: t('location'), value: whereText(row.patientId) },
              { id: 'status', label: t('colStatus'), value: <Badge tone={STATUS_TONE[row.status]} size="sm">{t(STATUS_KEY[row.status])}</Badge> },
            ]}
          />
          <div className="ph-actions">
            {row.status === 'pending' || row.status === 'clarify' ? (
              <>
                <Button
                  variant="primary"
                  icon="check"
                  onPress={() => {
                    update(row.id, { status: 'verified' });
                    toast({ tone: 'success', title: t('toastVerified', { drug: tallMan(row.drug) }) });
                  }}
                >
                  {t('actVerify')}
                </Button>
                {row.status === 'pending' ? (
                  <Button
                    icon="phone"
                    onPress={() => {
                      update(row.id, { status: 'clarify' });
                      toast({ tone: 'warning', title: t('toastClarify'), body: t('toastClarifyBody') });
                    }}
                  >
                    {t('actClarify')}
                  </Button>
                ) : null}
              </>
            ) : null}
            {row.status === 'verified' ? (
              <Button
                variant="primary"
                icon="pill"
                onPress={() => {
                  update(row.id, { status: 'dispensed' });
                  toast({ tone: 'success', title: t('toastDispensed', { drug: tallMan(row.drug) }) });
                }}
              >
                {t('actDispense')}
              </Button>
            ) : null}
            <Button variant="ghost" iconEnd="arrow-forward" onPress={() => { goTo('emar', { patient: patient.id }); }}>
              {t('actEmar')}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------------------------------------

  const verifyTab = (
    <div className={selected === null ? undefined : 'ph-split'}>
      <Card flush>
        <div className="ph-toolbar">
          <Toolbar label={t('filters')}>
            <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
            <Segmented
              label={t('show')}
              hideLabel
              value={view}
              onChange={(id) => { setView(id === 'all' ? 'all' : 'todo'); }}
              options={[
                { id: 'todo', label: t('viewTodo') },
                { id: 'all', label: t('viewAll') },
              ]}
            />
          </Toolbar>
          <span className="ph-muted">{t('rankNote')}</span>
        </div>
        <DataTable
          caption={t('queueTitle')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          selectedKey={selectedId}
          onRowAction={(row) => { setSelectedId(row.id); }}
          rowTone={(row) => (row.status === 'clarify' ? 'danger' : row.priority === 'stat' && row.status === 'pending' ? 'warning' : undefined)}
          emptyText={<EmptyState compact icon="check-circle" title={t('queueEmpty')} body={t('queueEmptyBody')} />}
          dense
        />
      </Card>
      {selected === null ? null : detail(selected)}
    </div>
  );

  const dispenseTab = (
    <Card title={t('dispenseTitle')} subtitle={t('dispenseSubtitle', { count: toDispense.length })} icon="pill" flush>
      <DataTable
        caption={t('dispenseTitle')}
        rows={toDispense.toSorted(rank)}
        rowKey={(row) => row.id}
        emptyText={<EmptyState compact icon="check-circle" title={t('dispenseEmpty')} />}
        columns={[
          { id: 'drug', header: t('colMedicine'), cell: drugCell },
          { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={getPatient(row.patientId)} /> },
          { id: 'where', header: t('location'), cell: (row) => whereText(row.patientId) },
          {
            id: 'act',
            header: t('colAction'),
            align: 'end',
            cell: (row) => (
              <span className="ph-row ph-row--end">
                <Button size="sm" icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastLabel', { id: row.id }) }); }}>
                  {t('actLabel')}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon="check"
                  onPress={() => {
                    update(row.id, { status: 'dispensed' });
                    toast({ tone: 'success', title: t('toastDispensed', { drug: tallMan(row.drug) }) });
                  }}
                >
                  {t('actDispense')}
                </Button>
              </span>
            ),
          },
        ]}
      />
    </Card>
  );

  const registerRows = register.filter((entry) => drugFilter === 'all' || entry.drugId === drugFilter).toSorted((a, b) => b.iso.localeCompare(a.iso));
  const narcoticsTab = (
    <div className="ph-stack">
      <Grid min="11rem">
        {NARCOTIC_DRUGS.map((drug) => (
          <StatTile
            key={drug.id}
            label={<Code>{drug.drug}</Code>}
            value={f.number(expectedBalance(register, drug.id))}
            unit={t('ampoules')}
            hint={<Code>{drug.presentation}</Code>}
            icon="lock"
            onPress={() => { setDrugFilter(drug.id); }}
          />
        ))}
      </Grid>
      <Card
        title={t('registerTitle')}
        subtitle={t('registerSubtitle')}
        icon="lock"
        flush
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="check"
            onPress={() => {
              setCountQty('');
              setCounting(true);
            }}
          >
            {t('actCount')}
          </Button>
        }
      >
        <div className="ph-toolbar">
          <SelectField
            label={t('drug')}
            selectedKey={drugFilter}
            onSelectionChange={setDrugFilter}
            options={[{ id: 'all', label: t('allDrugs') }, ...NARCOTIC_DRUGS.map((d) => ({ id: d.id, label: `${d.drug} · ${d.presentation}` }))]}
          />
        </div>
        <DataTable
          caption={t('registerTitle')}
          dense
          rows={registerRows}
          rowKey={(entry) => entry.id}
          rowTone={(entry) => (entry.type === 'count' && entry.qty !== 0 ? 'danger' : undefined)}
          columns={[
            { id: 'when', header: t('colWhen'), nowrap: true, cell: (entry) => f.dateTime(entry.iso) },
            { id: 'drug', header: t('drug'), cell: (entry) => <Code>{NARCOTIC_DRUGS.find((d) => d.id === entry.drugId)?.drug ?? entry.drugId}</Code> },
            { id: 'type', header: t('colType'), cell: (entry) => <Badge size="sm" tone={ENTRY_TONE[entry.type]}>{t(ENTRY_KEY[entry.type])}</Badge> },
            { id: 'qty', header: t('colQty'), align: 'end', cell: (entry) => <Code>{entry.qty > 0 ? `+${String(entry.qty)}` : String(entry.qty)}</Code> },
            { id: 'bal', header: t('colBalance'), align: 'end', cell: (entry) => <span className="ph-strong">{f.number(entry.balance)}</span> },
            {
              id: 'for',
              header: t('colFor'),
              cell: (entry) =>
                entry.patientId === null ? (
                  entry.wardCode === null ? '—' : t('wardStock', { ward: entry.wardCode })
                ) : (
                  <PatientInline patient={getPatient(entry.patientId)} />
                ),
            },
            {
              id: 'by',
              header: t('colByWitness'),
              cell: (entry) => {
                const by = findStaff(entry.byId);
                const witness = findStaff(entry.witnessId);
                return (
                  <span className="ph-two">
                    {by === undefined ? '—' : <StaffName member={by} />}
                    <span className="ph-muted">{witness === undefined ? t('noWitness') : <>{t('witness')}: <StaffName member={witness} /></>}</span>
                  </span>
                );
              },
            },
            { id: 'note', header: t('colNote'), cell: (entry) => (entry.note === null ? '' : <span className="ph-muted">{f.text(entry.note)}</span>) },
          ]}
        />
      </Card>
    </div>
  );

  const lasaTab = (
    <Card title={t('lasaListTitle')} subtitle={t('lasaListSubtitle')} icon="alert" flush>
      <DataTable
        caption={t('lasaListTitle')}
        rows={LASA_PAIRS}
        rowKey={(pair) => `${pair.a}-${pair.b}`}
        columns={[
          { id: 'a', header: t('colDrugA'), cell: (pair) => <Code className="ph-drug ph-drug--lg">{tallMan(pair.a)}</Code> },
          { id: 'b', header: t('colDrugB'), cell: (pair) => <Code className="ph-drug ph-drug--lg">{tallMan(pair.b)}</Code> },
          { id: 'risk', header: t('colRisk'), cell: (pair) => f.text(pair.risk) },
          {
            id: 'queue',
            header: t('colInQueue'),
            align: 'end',
            cell: (pair) => {
              const n = queue.filter((row) => row.status !== 'dispensed' && (row.drug === pair.a || row.drug === pair.b)).length;
              return n === 0 ? <span className="ph-muted">—</span> : <Badge tone="warning" size="sm">{f.number(n)}</Badge>;
            },
          },
        ]}
      />
    </Card>
  );

  const brandNeedle = brandSearch.trim().toLowerCase();
  const brandRows = GENERICS.filter((g) => brandNeedle === '' || g.generic.includes(brandNeedle) || g.brands.some((b) => b.brand.toLowerCase().includes(brandNeedle)));
  const brandsTab = (
    <Card title={t('brandsTitle')} subtitle={t('brandsSubtitle')} icon="clipboard" flush>
      <div className="ph-toolbar">
        <SearchField label={t('search')} hideLabel placeholder={t('brandSearch')} value={brandSearch} onChange={setBrandSearch} />
      </div>
      <DataTable
        caption={t('brandsTitle')}
        rows={brandRows}
        rowKey={(g) => g.generic}
        emptyText={t('brandsEmpty')}
        columns={[
          {
            id: 'generic',
            header: t('colGeneric'),
            cell: (g) => (
              <span className="ph-two">
                <Code className="ph-strong">{tallMan(g.generic)}</Code>
                <span className="ph-muted">
                  <Code>{g.strength}</Code> · {f.text(g.form)} · ATC <Code>{g.atc}</Code>
                </span>
              </span>
            ),
          },
          {
            id: 'brands',
            header: t('colBrands'),
            cell: (g) => (
              <ul className="ph-brands">
                {g.brands.map((b) => (
                  <li key={b.brand} className="ph-brand">
                    <span className="ph-row">
                      <Code className="ph-strong">{b.brand}</Code>
                      {b.onFormulary ? <Badge size="sm" tone="success">{t('formulary')}</Badge> : <Badge size="sm" tone="neutral">{t('nonFormulary')}</Badge>}
                    </span>
                    <span className="ph-muted">
                      <Code>{b.maker}</Code> · {f.text(b.origin)} · <Money amount={b.priceIqd} />
                    </span>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: 'cheapest',
            header: t('colCheapest'),
            align: 'end',
            nowrap: true,
            cell: (g) => {
              const cheapest = g.brands.filter((b) => b.onFormulary).toSorted((a, b) => a.priceIqd - b.priceIqd)[0];
              return cheapest === undefined ? '—' : (
                <span className="ph-two ph-end">
                  <Code>{cheapest.brand}</Code>
                  <Money amount={cheapest.priceIqd} className="ph-muted" />
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Count dialog
  // ---------------------------------------------------------------------------------------------------------

  const expected = expectedBalance(register, countDrug);
  const counted = Number(countQty);
  const countValid = countQty.trim() !== '' && Number.isInteger(counted) && counted >= 0;
  const countDialog = counting ? (
    <Dialog
      isOpen
      onOpenChange={setCounting}
      title={t('countTitle')}
      subtitle={t('countSubtitle')}
      actions={
        <>
          <Button onPress={() => { setCounting(false); }}>{t('cancel')}</Button>
          <Button
            variant="primary"
            icon="lock"
            isDisabled={!countValid || countWitness === PHARMACIST}
            onPress={() => {
              const diff = counted - expected;
              const entry: NarcoticEntry = {
                id: `NR-${String(5510 + register.length)}`,
                drugId: countDrug,
                iso: DEMO_NOW_ISO,
                type: 'count',
                qty: diff,
                balance: counted,
                patientId: null,
                wardCode: null,
                byId: PHARMACIST,
                witnessId: countWitness,
                note: diff === 0 ? null : { en: messages.en.discrepancyNote, ckb: messages.ckb.discrepancyNote, ar: messages.ar.discrepancyNote },
              };
              setRegister((current) => [...current, entry]);
              if (diff === 0) {
                toast({ tone: 'success', title: t('toastCountOk') });
              } else {
                setDiscrepancies((n) => n + 1);
                toast({ tone: 'danger', title: t('toastCountBad', { diff: diff > 0 ? `+${String(diff)}` : String(diff) }), body: t('toastCountBadBody') });
              }
              setDrugFilter(countDrug);
              setCounting(false);
            }}
          >
            {t('actRecordCount')}
          </Button>
        </>
      }
    >
      <div className="ph-stack">
        <SelectField label={t('drug')} selectedKey={countDrug} onSelectionChange={setCountDrug} options={NARCOTIC_DRUGS.map((d) => ({ id: d.id, label: `${d.drug} · ${d.presentation}` }))} />
        <KeyValueList columns={2} items={[{ id: 'exp', label: t('expected'), value: <span className="ph-strong">{f.number(expected)}</span> }]} />
        <TextInput label={t('counted')} value={countQty} onChange={setCountQty} inputMode="numeric" dir="ltr" isRequired />
        {countValid && counted !== expected ? (
          <Callout tone="danger" title={t('mismatchTitle', { diff: f.number(counted - expected) })}>
            {t('mismatchBody')}
          </Callout>
        ) : null}
        <SelectField
          label={t('witness')}
          selectedKey={countWitness}
          onSelectionChange={setCountWitness}
          options={STAFF.filter((s) => s.role === 'nurse' || s.role === 'admin' || s.role === 'pharmacist').map((s) => ({ id: s.id, label: `${staffName(s, f.locale)} · ${f.text(s.title)}` }))}
        />
        {countWitness === PHARMACIST ? <Callout tone="warning">{t('witnessSelf')}</Callout> : null}
      </div>
    </Dialog>
  ) : null;

  return (
    <div className="ph-screen">
      <PageHeader
        icon="pill"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <Button variant="primary" icon="money" onPress={() => { setTab('retail'); }}>
            {t('actRetail')}
          </Button>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiPending')} value={f.number(pending.length)} icon="clipboard" tone={pending.length > 0 ? 'warning' : 'success'} hint={t('kpiPendingHint', { count: toDispense.length })} onPress={() => { setTab('verify'); }} />
        <StatTile label={t('kpiUrgent')} value={f.number(urgentPending.length)} icon="alert" tone={urgentPending.length > 0 ? 'danger' : 'success'} hint={t('kpiUrgentHint')} onPress={() => { setView('todo'); setTab('verify'); }} />
        <StatTile label={t('kpiClarify')} value={f.number(clarify.length)} icon="phone" tone={clarify.length > 0 ? 'danger' : undefined} hint={t('kpiClarifyHint')} />
        <StatTile label={t('kpiRetail')} value={<Money amount={sales.iqd} />} icon="money" hint={t('kpiRetailHint', { count: sales.count, usd: f.usd(sales.usd) })} onPress={() => { setTab('retail'); }} />
        <StatTile label={t('kpiNarcotics')} value={f.number(discrepancies)} icon="lock" tone={discrepancies > 0 ? 'danger' : 'success'} hint={t('kpiNarcoticsHint')} onPress={() => { setTab('narcotics'); }} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'verify', label: t('tabVerify'), badge: f.number(pending.length + clarify.length), content: verifyTab },
          { id: 'dispense', label: t('tabDispense'), badge: f.number(toDispense.length), content: dispenseTab },
          {
            id: 'retail',
            label: t('tabRetail'),
            content: (
              <RetailCounter
                onSale={(iqd, currency, amount) => {
                  setSales((current) => ({ count: current.count + 1, iqd: current.iqd + (currency === 'IQD' ? iqd : 0), usd: current.usd + (currency === 'USD' ? amount : 0) }));
                }}
              />
            ),
          },
          { id: 'narcotics', label: t('tabNarcotics'), content: narcoticsTab },
          { id: 'lasa', label: t('tabLasa'), content: lasaTab },
          { id: 'brands', label: t('tabBrands'), content: brandsTab },
        ]}
      />
      {countDialog}
    </div>
  );
}
