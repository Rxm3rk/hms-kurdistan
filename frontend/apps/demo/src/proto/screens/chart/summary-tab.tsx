/**
 * Summary tab: latest vital signs with 72-hour trends, the NEWS2 early-warning score with its band, the
 * response it calls for and the points by parameter, the problem list, allergies (reaction and severity) and
 * the active medicines.
 */
import type { ReactNode } from 'react';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  ROUTE_LABEL,
  SEVERITY_LABEL,
  findStaff,
  ordersOf,
  type Order,
  type Patient,
  type Tone,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  BloodPressure,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  Icon,
  Qty,
  Sparkline,
  StaffName,
  StatTile,
  TextLink,
  type Column,
} from '../../ui/index.ts';
import { problemsOf, type ChartVitals, type Problem, type ProblemStatus } from './chart-data.ts';
import { OxygenText, acvpuKey, type ChartMessageKey, type NewsView } from './chart-shared.tsx';
import { messages } from './messages.ts';
import { NEWS2_BAND_TONE, NEWS2_PARAMETERS, subScoreTone, type News2Parameter, type News2Result } from './news2.ts';

const ACTIVE_STATUSES: ReadonlySet<Order['status']> = new Set(['active', 'in-progress', 'on-hold', 'pending-signature']);

export interface SummaryTabProps {
  readonly patient: Patient;
  readonly vitals: readonly ChartVitals[];
  readonly news: NewsView;
  readonly onShowVitals: () => void;
}

export function SummaryTab({ patient, vitals, news, onShowVitals }: SummaryTabProps): ReactNode {
  return (
    <div className="chart-summary">
      <div className="chart-summary__main">
        <LatestVitals vitals={vitals} news={news} onShowVitals={onShowVitals} />
        <ProblemsCard patientId={patient.id} />
        <MedicinesCard patientId={patient.id} />
      </div>
      <div className="chart-summary__side">
        <News2Card vitals={vitals} news={news} />
        <AllergiesCard patient={patient} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Latest vital signs
// ---------------------------------------------------------------------------------------------------------

function nums(vitals: readonly ChartVitals[], pick: (set: ChartVitals) => string | null): number[] {
  return vitals.map(pick).filter((value): value is string => value !== null).map((value) => Number.parseFloat(value));
}

function LatestVitals({ vitals, news, onShowVitals }: { readonly vitals: readonly ChartVitals[]; readonly news: NewsView; readonly onShowVitals: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const latest = vitals.at(-1);
  if (latest === undefined) {
    return (
      <Card title={t('vitalsTitle')} icon="activity">
        <EmptyState compact icon="activity" title={t('noVitals')} body={t('noVitalsBody')} />
      </Card>
    );
  }
  const sub = news.latest?.sub;
  const recorder = findStaff(latest.recordedById);
  const pointsHint = (param: News2Parameter): ReactNode => {
    const points = sub?.[param];
    return points === undefined || points === 0 ? undefined : t('newsPoints', { points });
  };
  const tone = (param: News2Parameter): Tone | undefined => (sub === undefined ? undefined : subScoreTone(sub[param]));
  const trendOf = (name: string, values: readonly number[]) =>
    values.length >= 2 ? { trend: values, trendLabel: t('trendLabel', { name }) } : {};
  const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
    (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;
  const painValues = nums(vitals, (set) => set.painScore);

  return (
    <Card
      title={t('vitalsTitle')}
      icon="activity"
      subtitle={t.rich('vitalsSubtitle', {
        time: f.time(latest.iso),
        name: recorder === undefined ? '' : <StaffName member={recorder} />,
      })}
      actions={
        <Button size="sm" variant="ghost" iconEnd="chevron-forward" onPress={onShowVitals}>
          {t('seeAllVitals')}
        </Button>
      }
    >
      <Grid min="10.5rem" gap="sm">
        <StatTile
          label={t('bp')}
          icon="heart"
          value={<BloodPressure systolic={latest.systolic} diastolic={latest.diastolic} />}
          {...optional('hint', pointsHint('sbp'))}
          {...optional('tone', tone('sbp'))}
          {...trendOf(t('bp'), nums(vitals, (set) => set.systolic))}
        />
        <StatTile
          label={t('hr')}
          icon="activity"
          value={<Qty value={latest.heartRate} unit="/min" />}
          {...optional('hint', pointsHint('hr'))}
          {...optional('tone', tone('hr'))}
          {...trendOf(t('hr'), nums(vitals, (set) => set.heartRate))}
        />
        <StatTile
          label={t('spo2')}
          icon="droplet"
          value={<Qty value={latest.spo2} unit="%" />}
          hint={
            <span className="chart-tile-hint">
              <OxygenText oxygen={latest.oxygen} />
              {pointsHint('spo2') === undefined && pointsHint('oxygen') === undefined ? null : (
                <span> · {t('newsPoints', { points: (sub?.spo2 ?? 0) + (sub?.oxygen ?? 0) })}</span>
              )}
            </span>
          }
          {...optional('tone', tone('spo2'))}
          {...trendOf(t('spo2'), nums(vitals, (set) => set.spo2))}
        />
        <StatTile
          label={t('temp')}
          icon="thermometer"
          value={<Qty value={latest.tempC} unit="Cel" />}
          {...optional('hint', pointsHint('temp'))}
          {...optional('tone', tone('temp'))}
          {...trendOf(t('temp'), nums(vitals, (set) => set.tempC))}
        />
        <StatTile
          label={t('rr')}
          icon="activity"
          value={<Qty value={latest.respRate} unit="/min" />}
          {...optional('hint', pointsHint('rr'))}
          {...optional('tone', tone('rr'))}
          {...trendOf(t('rr'), nums(vitals, (set) => set.respRate))}
        />
        <StatTile
          label={t('newsParam_acvpu')}
          icon="user"
          value={t(acvpuKey(latest.consciousness))}
          hint={`${t('pain')}: ${latest.painScore === null ? t('newsNotApplicable') : t('painValue', { score: latest.painScore })}`}
          {...optional('tone', tone('acvpu') ?? (Number.parseFloat(latest.painScore ?? '0') >= 7 ? 'warning' : undefined))}
          {...trendOf(t('pain'), painValues)}
        />
      </Grid>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// NEWS2
// ---------------------------------------------------------------------------------------------------------

function paramValue(param: News2Parameter, set: ChartVitals): ReactNode {
  switch (param) {
    case 'rr':
      return <Qty value={set.respRate} unit="/min" />;
    case 'spo2':
      return <Qty value={set.spo2} unit="%" />;
    case 'oxygen':
      return <OxygenText oxygen={set.oxygen} />;
    case 'sbp':
      return <Qty value={set.systolic} unit="mm[Hg]" />;
    case 'hr':
      return <Qty value={set.heartRate} unit="/min" />;
    case 'acvpu':
      return <AcvpuText set={set} />;
    case 'temp':
      return <Qty value={set.tempC} unit="Cel" />;
  }
}

function AcvpuText({ set }: { readonly set: ChartVitals }): ReactNode {
  const t = useT(messages);
  return t(acvpuKey(set.consciousness));
}

function News2Card({ vitals, news }: { readonly vitals: readonly ChartVitals[]; readonly news: NewsView }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const latestSet = vitals.at(-1);
  if (latestSet === undefined) {
    return (
      <Card title={t('newsTitle')} icon="alert">
        <p className="chart-muted">{t('newsNoData')}</p>
      </Card>
    );
  }
  if (news.applicability !== 'applies' || news.latest === null) {
    return (
      <Card title={t('newsTitle')} icon="alert">
        <div className="chart-news__score-row">
          <span className="chart-news__score chart-news__score--na">{t('newsNotApplicable')}</span>
        </div>
        <Callout tone="info">{t(news.applicability === 'paediatric' ? 'newsPaediatric' : 'newsIcu')}</Callout>
      </Card>
    );
  }
  const result: News2Result = news.latest;
  const tone = NEWS2_BAND_TONE[result.band];
  const series = news.scores.filter((score): score is News2Result => score !== null).map((score) => score.total);
  const bandKey = `newsBand_${result.band}` as ChartMessageKey;
  const responseKey = `newsResponse_${result.band}` as ChartMessageKey;
  return (
    <Card title={t('newsTitle')} icon="alert" tone={tone}>
      <div className="chart-news">
        <div className="chart-news__score-row">
          <span className={`chart-news__score chart-news__score--${tone}`}>
            <span className="hms-visually-hidden">NEWS2 </span>
            {result.total}
          </span>
          <div className="chart-news__band">
            <Badge tone={tone} strong={result.band === 'high' || result.band === 'medium'} icon={tone === 'success' ? 'check-circle' : 'alert'}>
              {t(bandKey)}
            </Badge>
            {series.length >= 2 ? (
              <Sparkline
                values={series}
                label={t('newsTrend')}
                tone={tone === 'success' ? 'accent' : tone}
                width={140}
                height={32}
              />
            ) : null}
          </div>
        </div>
        <p className="chart-news__response">{t(responseKey)}</p>
        <h3 className="chart-news__heading">{t('newsBreakdown')}</h3>
        <ul className="chart-news__params">
          {NEWS2_PARAMETERS.map((param) => {
            const points = result.sub[param];
            const pointsTone = subScoreTone(points);
            return (
              <li key={param} className="chart-news__param">
                <span className="chart-news__param-label">{t(`newsParam_${param}` as ChartMessageKey)}</span>
                <span className="chart-news__param-value">{paramValue(param, latestSet)}</span>
                <span
                  className={['chart-points', pointsTone === undefined ? '' : `chart-points--${pointsTone}`].filter(Boolean).join(' ')}
                  title={t('subPoints', { points })}
                >
                  {points}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="chart-footnote">{t('newsCalculated', { time: f.time(latestSet.iso) })}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------------------------------------

const PROBLEM_STATUS_TONE: Readonly<Record<ProblemStatus, Tone>> = { active: 'accent', chronic: 'info', resolved: 'neutral' };
const PROBLEM_STATUS_KEY: Readonly<Record<ProblemStatus, ChartMessageKey>> = {
  active: 'statusActive',
  chronic: 'statusChronic',
  resolved: 'statusResolved',
};

function ProblemsCard({ patientId }: { readonly patientId: string }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const problems = problemsOf(patientId);
  const since = (value: string): string => (value.length === 10 ? f.date(value) : value);
  const columns: readonly Column<Problem>[] = [
    {
      id: 'problem',
      header: t('colProblem'),
      cell: (row) => (
        <span className="chart-problem">
          <span className={row.status === 'resolved' ? 'chart-problem__text chart-problem__text--past' : 'chart-problem__text'}>{f.text(row.text)}</span>
          {row.primary ? (
            <Badge tone="accent" size="sm">
              {t('primaryDx')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    { id: 'code', header: t('colCode'), cell: (row) => <Code>{row.code}</Code>, nowrap: true, width: '6rem' },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge tone={PROBLEM_STATUS_TONE[row.status]} size="sm">
          {t(PROBLEM_STATUS_KEY[row.status])}
        </Badge>
      ),
      width: '8rem',
    },
    { id: 'since', header: t('colSince'), cell: (row) => <span className="chart-num">{since(row.since)}</span>, nowrap: true, width: '8rem' },
  ];
  return (
    <Card title={t('problemsTitle')} subtitle={t('problemsSubtitle')} icon="clipboard" flush>
      <DataTable columns={columns} rows={problems} rowKey={(row) => `${row.code}-${row.status}`} caption={t('problemsTitle')} emptyText={t('noProblems')} dense />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------------------------------------

const SEVERITY_TONE: Readonly<Record<'mild' | 'moderate' | 'severe', Tone>> = { mild: 'warning', moderate: 'warning', severe: 'danger' };

function AllergiesCard({ patient }: { readonly patient: Patient }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const status = patient.allergies;
  if (status.kind === 'nka') {
    return (
      <Card title={t('allergiesTitle')} icon="shield" tone="success">
        <p className="chart-allergy-none">
          <Icon name="check-circle" />
          <strong>{t('nka')}</strong>
        </p>
        <p className="chart-muted">{t('nkaBody')}</p>
      </Card>
    );
  }
  if (status.kind === 'not-assessed') {
    return (
      <Card title={t('allergiesTitle')} icon="shield" tone="warning">
        <Callout tone="warning" title={t('notAssessed')}>
          {t('notAssessedBody')}
        </Callout>
      </Card>
    );
  }
  return (
    <Card title={t('allergiesTitle')} icon="alert" tone="danger">
      <ul className="chart-allergies">
        {status.items.map((item) => (
          <li key={item.code} className="chart-allergy">
            <span className="chart-allergy__head">
              <Icon name="alert" className="chart-allergy__icon" />
              <strong className="chart-allergy__substance">{f.text(item.substance)}</strong>
              {item.severity === undefined ? (
                <Badge tone="neutral" size="sm">
                  {t('severityNotRecorded')}
                </Badge>
              ) : (
                <Badge tone={SEVERITY_TONE[item.severity]} strong={item.severity === 'severe'} size="sm">
                  {f.text(SEVERITY_LABEL[item.severity])}
                </Badge>
              )}
            </span>
            <span className="chart-allergy__reaction">
              {t('reaction')}: {item.reaction === undefined ? <span className="chart-muted">{t('reactionNotRecorded')}</span> : f.text(item.reaction)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Active medicines
// ---------------------------------------------------------------------------------------------------------

function MedicinesCard({ patientId }: { readonly patientId: string }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const meds = ordersOf(patientId).filter((order) => order.category === 'medication' && order.medication !== null && ACTIVE_STATUSES.has(order.status));
  const columns: readonly Column<Order>[] = [
    {
      id: 'medicine',
      header: t('colMedicine'),
      cell: (row) => (
        <span className="chart-med">
          <span className="chart-med__name">
            <Code>{row.medication?.drug ?? f.text(row.title)}</Code>
            {row.medication?.highAlert === true ? (
              <Badge tone="warning" icon="alert" size="sm">
                {t('highAlert')}
              </Badge>
            ) : null}
          </span>
          {row.medication?.prn === true && row.medication.prnReason !== null ? (
            <span className="chart-med__detail">{t('prn', { reason: f.text(row.medication.prnReason) })}</span>
          ) : null}
          {row.alerts.map((alert, i) => (
            <span key={i} className={`chart-med__alert chart-med__alert--${alert.tone}`}>
              <Icon name="alert" size="1em" /> {f.text(alert.text)}
            </span>
          ))}
        </span>
      ),
    },
    {
      id: 'dose',
      header: t('colDose'),
      cell: (row) => (row.medication === null ? null : <Qty value={row.medication.dose} unit={row.medication.doseUnit} />),
      nowrap: true,
    },
    { id: 'route', header: t('colRoute'), cell: (row) => (row.medication === null ? null : f.text(ROUTE_LABEL[row.medication.route])) },
    { id: 'frequency', header: t('colFrequency'), cell: (row) => (row.medication === null ? null : f.text(row.medication.frequency)) },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge tone={ORDER_STATUS_TONE[row.status]} size="sm">
          {f.text(ORDER_STATUS_LABEL[row.status])}
        </Badge>
      ),
    },
  ];
  return (
    <Card
      title={t('medsTitle')}
      subtitle={t('medsSubtitle')}
      icon="pill"
      flush
      footer={<TextLink href={href('emar', { patient: patientId })}>{t('openEmar')}</TextLink>}
    >
      <DataTable
        columns={columns}
        rows={meds}
        rowKey={(row) => row.id}
        caption={t('medsTitle')}
        emptyText={t('noMeds')}
        rowTone={(row) => (row.alerts.some((alert) => alert.tone === 'danger') ? 'danger' : row.status === 'on-hold' ? 'warning' : undefined)}
        dense
      />
    </Card>
  );
}
