/**
 * The Management dashboard (hospital-wide): the owner and managing director's daily view. Receipts by
 * currency (IQD and USD at the visible demo rate), billed against collected, unbilled consumption (leakage)
 * with a worklist to post the missing charges, deposits outstanding, corporate receivables, occupancy by
 * ward, ED and OPD volumes, revenue by department and safety KPIs, all for a chosen period.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW,
  DEMO_TODAY,
  EXCHANGE_RATE,
  WARDS,
  bedCounts,
  getDepartment,
  getPatient,
  getWard,
  occupancy,
  usdToIqd,
} from '../../data/index.ts';
import { DAILY, DEPARTMENT_SHARE, DEPOSITS, SAFETY_KPIS, UNBILLED, type DayFigures, type LeakCategory, type SafetyKpi, type UnbilledItem } from '../../data/ext/dashboard.ts';
import { PAYER_ACCOUNTS } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo, useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  BarChart,
  Button,
  Card,
  Code,
  DataTable,
  Dialog,
  Grid,
  KeyValueList,
  LinkButton,
  Meter,
  PageHeader,
  PatientName,
  Segmented,
  Sparkline,
  StatTile,
  useToast,
  type Column,
} from '../../ui/index.ts';
import './dashboard.css';
import { messages } from './messages.ts';
import { TrendChart } from './trend-chart.tsx';

type Range = 'today' | '7d' | '30d' | '90d';
const RANGE_DAYS: Readonly<Record<Range, number>> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
const CATEGORIES: readonly LeakCategory[] = ['pharmacy', 'supplies', 'laboratory', 'imaging', 'procedure'];

interface Bucket {
  readonly id: string;
  readonly tick: string;
  readonly days: readonly DayFigures[];
}

/** Daily points for up to 14 days, weekly points beyond (so a chart never has more than ~14 points). */
function bucketsOf(days: readonly DayFigures[], todayLabel: string): readonly Bucket[] {
  if (days.length <= 14) {
    return days.map((d) => ({ id: d.date, tick: d.date === DEMO_TODAY ? todayLabel : `${String(Number(d.date.slice(8)))}/${String(Number(d.date.slice(5, 7)))}`, days: [d] }));
  }
  const buckets: Bucket[] = [];
  for (let end = days.length; end > 0; end -= 7) {
    const slice = days.slice(Math.max(0, end - 7), end);
    const first = slice[0];
    if (first !== undefined) {
      buckets.unshift({ id: first.date, tick: `${String(Number(first.date.slice(8)))}/${String(Number(first.date.slice(5, 7)))}`, days: slice });
    }
  }
  return buckets;
}

const sumOf = (days: readonly DayFigures[], pick: (d: DayFigures) => number): number => days.reduce((sum, d) => sum + pick(d), 0);

function kpiOk(kpi: SafetyKpi): boolean {
  return kpi.better === 'lower' ? kpi.value <= kpi.target : kpi.value >= kpi.target;
}

export function DashboardScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const goTo = useGoTo();
  const href = useScreenHref();
  const toast = useToast();
  const [range, setRange] = useState<Range>('7d');
  const [leaks, setLeaks] = useState<readonly UnbilledItem[]>(UNBILLED);
  const [category, setCategory] = useState<'all' | LeakCategory>('all');
  const [openLeak, setOpenLeak] = useState<UnbilledItem | null>(null);
  const [asked, setAsked] = useState<ReadonlySet<string>>(new Set());

  const days = useMemo(() => DAILY.slice(-RANGE_DAYS[range]), [range]);
  // For "today" the charts still show the last 7 days so there is a line to read; the totals are today's.
  const chartDays = range === 'today' ? DAILY.slice(-7) : days;
  const buckets = bucketsOf(chartDays, t('range_today'));
  const period = t(`range_${range}`);

  const billed = sumOf(days, (d) => d.billedIqd);
  const collected = sumOf(days, (d) => d.collectedIqd);
  const cashIqd = sumOf(days, (d) => d.cashIqd);
  const cashUsd = sumOf(days, (d) => d.cashUsd);
  const usdShare = usdToIqd(cashUsd) / Math.max(1, cashIqd + usdToIqd(cashUsd));
  const leakTotal = leaks.reduce((sum, l) => sum + l.amountIqd, 0);
  const depositsShort = DEPOSITS.filter((d) => d.paidIqd < d.requiredIqd);
  const depositTotal = depositsShort.reduce((sum, d) => sum + d.requiredIqd - d.paidIqd, 0);
  const corporate = PAYER_ACCOUNTS.reduce((sum, p) => sum + p.ageing.d0to30 + p.ageing.d31to60 + p.ageing.d61to90 + p.ageing.d90plus, 0);
  const corporate90 = PAYER_ACCOUNTS.reduce((sum, p) => sum + p.ageing.d90plus, 0);
  const millions = (v: number): string => `${f.number(v / 1_000_000, { maximumFractionDigits: 1 })}M`;

  const shownLeaks = category === 'all' ? leaks : leaks.filter((l) => l.category === category);
  const post = (items: readonly UnbilledItem[]): void => {
    const ids = new Set(items.map((i) => i.id));
    setLeaks((current) => current.filter((l) => !ids.has(l.id)));
  };

  const leakColumns: readonly Column<UnbilledItem>[] = [
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (l) => (
        <span className="dash-stack">
          <PatientName patient={getPatient(l.patientId)} />
          <Code className="dash-muted">{getPatient(l.patientId).mrn}</Code>
        </span>
      ),
    },
    { id: 'ward', header: t('colWard'), cell: (l) => f.text(getWard(l.wardId).name) },
    {
      id: 'item',
      header: t('colItem'),
      cell: (l) => (
        <span className="dash-stack">
          <span>{f.text(l.item)}</span>
          <span className="dash-muted">
            {t(`cat_${l.category}`)} · ×{f.number(l.quantity)}
          </span>
        </span>
      ),
    },
    { id: 'source', header: t('colSource'), cell: (l) => <span className="dash-muted">{f.text(l.source)}</span> },
    { id: 'age', header: t('colAge'), cell: (l) => f.relative(l.consumedIso), nowrap: true },
    { id: 'amount', header: t('colAmount'), cell: (l) => f.iqd(l.amountIqd), align: 'end', nowrap: true },
  ];

  const depositColumns: readonly Column<(typeof DEPOSITS)[number]>[] = [
    { id: 'patient', header: t('colPatient'), cell: (d) => <PatientName patient={getPatient(d.patientId)} /> },
    { id: 'ward', header: t('colWard'), cell: (d) => f.text(getWard(d.wardId).name) },
    { id: 'admitted', header: t('colAdmitted'), cell: (d) => f.date(d.admittedOn), nowrap: true },
    { id: 'short', header: t('colShort'), cell: (d) => <span className="dash-strong">{f.iqd(d.requiredIqd - d.paidIqd)}</span>, align: 'end', nowrap: true },
    {
      id: 'action',
      header: <span className="hms-visually-hidden">{t('askTopUp')}</span>,
      cell: (d) =>
        asked.has(d.id) ? (
          <Badge tone="info" size="sm" icon="check">
            {t('asked')}
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon="phone"
            onPress={() => {
              setAsked(new Set([...asked, d.id]));
              toast({ tone: 'success', title: t('toastTopUp') });
            }}
          >
            {t('askTopUp')}
          </Button>
        ),
      align: 'end',
    },
  ];

  const kpiColumns: readonly Column<SafetyKpi>[] = [
    {
      id: 'kpi',
      header: t('colKpi'),
      cell: (k) => (
        <span className="dash-stack">
          <span>{f.text(k.label)}</span>
          <span className="dash-muted">{f.text(k.unit)}</span>
        </span>
      ),
    },
    { id: 'value', header: t('colValue'), cell: (k) => <span className="dash-strong">{f.number(k.value, { minimumFractionDigits: k.decimals, maximumFractionDigits: k.decimals })}</span>, align: 'end' },
    { id: 'target', header: t('colTarget'), cell: (k) => `${k.better === 'lower' ? '≤' : '≥'} ${f.number(k.target)}`, align: 'end', nowrap: true },
    {
      id: 'trend',
      header: t('colTrend'),
      cell: (k) => <Sparkline values={k.weeks} label={t('trendOf', { kpi: f.text(k.label) })} tone={kpiOk(k) ? 'accent' : 'warning'} width={96} height={26} />,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (k) =>
        kpiOk(k) ? (
          <Badge tone="success" icon="check" size="sm">
            {t('onTarget')}
          </Badge>
        ) : (
          <Badge tone="warning" icon="alert" size="sm">
            {t('offTarget')}
          </Badge>
        ),
      nowrap: true,
    },
  ];

  const allOccupancy = occupancy();

  return (
    <div className="dashboard-screen">
      <PageHeader
        icon="activity"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="secondary" icon="printer" onPress={() => toast({ tone: 'success', title: t('toastPrint', { period }) })}>
            {t('printPack')}
          </Button>
        }
      >
        <div className="dash-header-row">
          <Segmented
            label={t('rangeLabel')}
            options={(['today', '7d', '30d', '90d'] as const).map((r) => ({ id: r, label: t(`range_${r}`) }))}
            value={range}
            onChange={(id) => setRange(id as Range)}
          />
          <div className="dash-badges">
            <Badge tone="neutral" icon="clock" size="sm">
              {t('asOf', { date: f.date(DEMO_NOW), time: f.time(DEMO_NOW) })}
            </Badge>
            <Badge tone="info" icon="money" size="sm">
              {f.text(EXCHANGE_RATE.note)}
            </Badge>
            <Badge tone="neutral" icon="info" size="sm">
              {t('synthetic')}
            </Badge>
          </div>
        </div>
      </PageHeader>

      <Grid min="11.5rem">
        <StatTile label={t('tileIqd')} value={f.iqd(cashIqd)} icon="money" trend={chartDays.map((d) => d.cashIqd)} trendLabel={t('trendIqd')} hint={period} />
        <StatTile label={t('tileUsd')} value={f.usd(cashUsd)} icon="money" hint={t('tileUsdHint', { amount: f.iqd(usdToIqd(cashUsd)) })} />
        <StatTile
          label={t('tileCollection')}
          value={f.percent(collected / Math.max(1, billed))}
          icon="check-circle"
          tone={collected / Math.max(1, billed) < 0.85 ? 'warning' : undefined}
          hint={t('tileCollectionHint', { collected: millions(collected), billed: millions(billed) })}
        />
        <StatTile label={t('tileLeakage')} value={f.iqd(leakTotal)} icon="alert" tone={leakTotal > 0 ? 'danger' : 'success'} hint={t('tileLeakageHint', { count: leaks.length })} />
        <StatTile label={t('tileDeposits')} value={f.iqd(depositTotal)} icon="receipt" tone="warning" hint={t('tileDepositsHint', { count: depositsShort.length })} />
        <StatTile label={t('tileReceivables')} value={f.iqd(corporate)} icon="building" hint={t('tileReceivablesHint', { amount: millions(corporate90) })} href={href('insurance')} />
      </Grid>

      <div className="dash-columns">
        <Card title={t('revenueTitle')} subtitle={t('revenueSubtitle', { period })} icon="chart" footer={t('chartNote')} className="dash-wide">
          <TrendChart
            label={t('revenueTitle')}
            ticks={buckets.map((b) => b.tick)}
            series={[
              { id: 'billed', label: t('billed'), values: buckets.map((b) => sumOf(b.days, (d) => d.billedIqd)), colour: 'var(--hms-color-border-strong)', dashed: true },
              { id: 'collected', label: t('collected'), values: buckets.map((b) => sumOf(b.days, (d) => d.collectedIqd)), colour: 'var(--hms-color-accent-bg)' },
            ]}
            format={millions}
            pointLabel={(series, tick, value) => t('pointLabel', { series, tick, value })}
          />
        </Card>
        <Card title={t('currencyTitle')} subtitle={t('currencySubtitle', { period })} icon="money">
          <div className="dash-currency">
            <div className="dash-currency__row">
              <span className="dash-stack">
                <span className="dash-muted">{t('iqdReceipts')}</span>
                <span className="dash-figure">{f.iqd(cashIqd)}</span>
              </span>
              <Sparkline values={buckets.map((b) => sumOf(b.days, (d) => d.cashIqd))} label={t('iqdReceipts')} width={120} height={36} />
            </div>
            <div className="dash-currency__row">
              <span className="dash-stack">
                <span className="dash-muted">{t('usdReceipts')}</span>
                <span className="dash-figure">{f.usd(cashUsd)}</span>
                <span className="dash-muted">≈ {f.iqd(usdToIqd(cashUsd))}</span>
              </span>
              <Sparkline values={buckets.map((b) => sumOf(b.days, (d) => d.cashUsd))} label={t('usdReceipts')} width={120} height={36} />
            </div>
            <Meter value={usdShare} label={t('usdShare', { percent: f.percent(usdShare) })} valueLabel={f.percent(usdShare)} />
          </div>
        </Card>
      </div>

      <div className="dash-columns">
        <Card
          title={t('leakageTitle')}
          subtitle={t('leakageSubtitle')}
          icon="alert"
          tone={leaks.length > 0 ? 'danger' : undefined}
          flush
          className="dash-wide"
          actions={
            <Button
              size="sm"
              variant="primary"
              icon="check"
              isDisabled={shownLeaks.length === 0}
              onPress={() => {
                const amount = shownLeaks.reduce((sum, l) => sum + l.amountIqd, 0);
                toast({ tone: 'success', title: t('toastPostedAll', { count: shownLeaks.length, amount: f.iqd(amount) }) });
                post(shownLeaks);
              }}
            >
              {t('postAll')}
            </Button>
          }
        >
          <div className="dash-filter">
            <Segmented
              label={t('category')}
              hideLabel
              options={[{ id: 'all', label: t('all') }, ...CATEGORIES.map((c) => ({ id: c, label: t(`cat_${c}`) }))]}
              value={category}
              onChange={(id) => setCategory(id as 'all' | LeakCategory)}
            />
          </div>
          <DataTable caption={t('leakageTable')} columns={leakColumns} rows={shownLeaks} rowKey={(l) => l.id} onRowAction={setOpenLeak} emptyText={t('leakEmpty')} dense />
        </Card>
        <Card
          title={t('depositsTitle')}
          subtitle={t('depositsSubtitle')}
          icon="receipt"
          flush
          actions={
            <LinkButton href={href('cashier')} size="sm" variant="ghost" iconEnd="arrow-forward">
              {t('openCashier')}
            </LinkButton>
          }
        >
          <DataTable caption={t('depositsTable')} columns={depositColumns} rows={depositsShort} rowKey={(d) => d.id} emptyText={t('depositsEmpty')} dense />
        </Card>
      </div>

      <Grid min="20rem">
        <Card
          title={t('occupancyTitle')}
          subtitle={t('occupancySubtitle', { percent: f.percent(allOccupancy) })}
          icon="bed"
          actions={
            <LinkButton href={href('ward')} size="sm" variant="ghost" iconEnd="arrow-forward">
              {t('openWard')}
            </LinkButton>
          }
        >
          <div className="dash-meters">
            {WARDS.map((ward) => {
              const counts = bedCounts(ward.id);
              const fraction = occupancy(ward.id);
              return (
                <Meter
                  key={ward.id}
                  value={fraction}
                  label={f.text(ward.name)}
                  valueLabel={t('occupancyValue', { occupied: counts.occupied, usable: counts.total - counts.blocked, percent: f.percent(fraction) })}
                  tone={fraction >= 0.9 ? 'danger' : fraction >= 0.85 ? 'warning' : 'accent'}
                />
              );
            })}
          </div>
        </Card>
        <Card title={t('edTitle')} subtitle={t('activitySubtitle', { total: f.number(sumOf(days, (d) => d.edVisits)) })} icon="alert">
          <BarChart
            orientation="vertical"
            height="8rem"
            label={t('edTitle')}
            data={buckets.map((b) => {
              const v = sumOf(b.days, (d) => d.edVisits);
              return { id: b.id, label: b.tick, value: v, valueLabel: f.number(v) };
            })}
          />
        </Card>
        <Card title={t('opdTitle')} subtitle={t('activitySubtitle', { total: f.number(sumOf(days, (d) => d.opdVisits)) })} icon="stethoscope">
          <BarChart
            orientation="vertical"
            height="8rem"
            label={t('opdTitle')}
            data={buckets.map((b) => {
              const v = sumOf(b.days, (d) => d.opdVisits);
              return { id: b.id, label: b.tick, value: v, valueLabel: f.number(v) };
            })}
          />
        </Card>
      </Grid>

      <div className="dash-columns">
        <Card
          title={t('safetyTitle')}
          subtitle={t('safetySubtitle')}
          icon="shield"
          flush
          className="dash-wide"
          actions={
            <LinkButton href={href('quality')} size="sm" variant="ghost" iconEnd="arrow-forward">
              {t('openQuality')}
            </LinkButton>
          }
        >
          <DataTable caption={t('safetyTable')} columns={kpiColumns} rows={SAFETY_KPIS} rowKey={(k) => k.id} rowTone={(k) => (kpiOk(k) ? undefined : 'warning')} dense />
        </Card>
        <Card title={t('deptTitle')} subtitle={t('deptSubtitle')} icon="building">
          <BarChart
            label={t('deptTitle')}
            data={DEPARTMENT_SHARE.map((d) => ({ id: d.id, label: f.text(getDepartment(d.id).name), value: d.share * billed, valueLabel: millions(d.share * billed) }))}
          />
        </Card>
      </div>

      <Dialog
        isOpen={openLeak !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenLeak(null);
          }
        }}
        title={openLeak === null ? '' : t('leakDialog', { id: openLeak.id })}
        {...(openLeak === null ? {} : { subtitle: f.text(openLeak.item) })}
        actions={
          openLeak === null ? undefined : (
            <>
              <Button variant="secondary" onPress={() => setOpenLeak(null)}>
                {t('close')}
              </Button>
              <Button
                variant="ghost"
                icon="receipt"
                onPress={() => {
                  const patientId = openLeak.patientId;
                  setOpenLeak(null);
                  goTo('billing', { patient: patientId });
                }}
              >
                {t('openBilling')}
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  post([openLeak]);
                  setOpenLeak(null);
                  toast({ tone: 'warning', title: t('toastWrittenOff') });
                }}
              >
                {t('writeOff')}
              </Button>
              <Button
                variant="primary"
                icon="check"
                onPress={() => {
                  post([openLeak]);
                  setOpenLeak(null);
                  toast({ tone: 'success', title: t('toastPosted', { amount: f.iqd(openLeak.amountIqd) }) });
                }}
              >
                {t('postCharge')}
              </Button>
            </>
          )
        }
      >
        {openLeak === null ? null : (
          <KeyValueList
            items={[
              { id: 'patient', label: t('colPatient'), value: <span><PatientName patient={getPatient(openLeak.patientId)} /> · <Code>{getPatient(openLeak.patientId).mrn}</Code></span> },
              { id: 'ward', label: t('colWard'), value: f.text(getWard(openLeak.wardId).name) },
              { id: 'code', label: t('category'), value: <span>{t(`cat_${openLeak.category}`)} · <Code>{openLeak.code}</Code></span> },
              { id: 'qty', label: t('quantity'), value: f.number(openLeak.quantity) },
              { id: 'used', label: t('consumedAt'), value: `${f.dateTime(openLeak.consumedIso)} (${f.relative(openLeak.consumedIso)})` },
              { id: 'source', label: t('colSource'), value: f.text(openLeak.source) },
              { id: 'amount', label: t('colAmount'), value: <span className="dash-strong">{f.iqd(openLeak.amountIqd)}</span> },
            ]}
          />
        )}
      </Dialog>
    </div>
  );
}
