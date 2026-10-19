/**
 * Vital signs tab: trend charts over the 72-hour window (blood pressure, heart rate, SpO2, temperature,
 * respiratory rate, NEWS2) and the observation chart, newest first, with every value that scores NEWS2
 * points shaded and the points shown as a number.
 */
import { Bdi } from '@hms/design-system';
import { Fragment, type ReactNode } from 'react';
import { findStaff, type Patient, type Tone } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, BloodPressure, Card, EmptyState, Qty, StaffName } from '../../ui/index.ts';
import { ageInYears, type ChartVitals } from './chart-data.ts';
import { OxygenText, acvpuKey, windowDays, type ChartMessageKey, type NewsView } from './chart-shared.tsx';
import { messages } from './messages.ts';
import { NEWS2_BAND_TONE, subScoreTone, type News2Parameter, type News2Result } from './news2.ts';
import { TrendChart, type TrendPoint } from './trend-chart.tsx';

export interface VitalsTabProps {
  readonly patient: Patient;
  readonly vitals: readonly ChartVitals[];
  readonly news: NewsView;
}

export function VitalsTab({ patient, vitals, news }: VitalsTabProps): ReactNode {
  const t = useT(messages);
  if (vitals.length === 0) {
    return (
      <Card title={t('vitalsTabTitle')} icon="activity">
        <EmptyState icon="activity" title={t('noVitals')} body={t('noVitalsBody')} />
      </Card>
    );
  }
  return (
    <div className="chart-vitals">
      <TrendsCard patient={patient} vitals={vitals} news={news} />
      <ObservationTable vitals={vitals} news={news} />
    </div>
  );
}

function TrendsCard({ patient, vitals, news }: VitalsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const span = windowDays(f.locale);
  const child = ageInYears(patient.dob) < 16;
  const adultBand = (band: readonly [number, number]): { band?: readonly [number, number]; bandLabel?: string } =>
    child ? {} : { band, bandLabel: t('bandLabel') };
  const pt = (set: ChartVitals, raw: string, unit: string): TrendPoint => ({
    iso: set.iso,
    value: Number.parseFloat(raw),
    label: `${f.weekday(set.iso)} ${f.time(set.iso)} · ${raw} ${unit}`,
  });
  const latest = vitals.at(-1);
  const common = {
    startIso: span.startIso,
    endIso: span.endIso,
    // The last day ends at the demo clock: call it "Today" so the right edge reads as now.
    days: span.days.map((day, i, all) => (i === all.length - 1 ? { ...day, label: t('today') } : day)),
    firstDayLabel: span.firstDayLabel,
  };
  const scored = vitals
    .map((set, i) => ({ set, score: news.scores[i] ?? null }))
    .filter((entry): entry is { set: ChartVitals; score: News2Result } => entry.score !== null);

  return (
    <Card
      title={t('trendsTitle')}
      subtitle={child ? t('trendsHintChild') : t('trendsHint')}
      icon="chart"
      actions={<Badge tone="neutral">{t('setsCount', { count: vitals.length })}</Badge>}
    >
      <div className="chart-trends">
        <TrendChart
          {...common}
          title={t('chartBp')}
          kind="range"
          latest={latest === undefined ? undefined : <BloodPressure systolic={latest.systolic} diastolic={latest.diastolic} />}
          points={vitals.map((set) => ({
            iso: set.iso,
            value: Number.parseFloat(set.systolic),
            low: Number.parseFloat(set.diastolic),
            label: `${f.weekday(set.iso)} ${f.time(set.iso)} · ${set.systolic}/${set.diastolic} mmHg`,
          }))}
          domain={child ? [20, 160] : [30, 200]}
          ticks={child ? [40, 80, 120, 160] : [40, 80, 120, 160, 200]}
          {...adultBand([111, 219])}
        />
        <TrendChart
          {...common}
          title={t('chartHr')}
          latest={latest === undefined ? undefined : <Qty value={latest.heartRate} unit="/min" />}
          points={vitals.map((set) => pt(set, set.heartRate, '/min'))}
          domain={child ? [60, 180] : [30, 170]}
          ticks={child ? [60, 90, 120, 150, 180] : [40, 70, 100, 130, 160]}
          {...adultBand([51, 90])}
        />
        <TrendChart
          {...common}
          title={t('chartSpo2')}
          latest={latest === undefined ? undefined : <Qty value={latest.spo2} unit="%" />}
          points={vitals.map((set) => pt(set, set.spo2, '%'))}
          domain={[84, 100]}
          ticks={[85, 90, 95, 100]}
          {...adultBand([96, 100])}
        />
        <TrendChart
          {...common}
          title={t('chartTemp')}
          latest={latest === undefined ? undefined : <Qty value={latest.tempC} unit="Cel" />}
          points={vitals.map((set) => pt(set, set.tempC, '°C'))}
          domain={[35, 40.5]}
          ticks={[35, 36, 37, 38, 39, 40]}
          {...adultBand([36.1, 38])}
        />
        <TrendChart
          {...common}
          title={t('chartRr')}
          latest={latest === undefined ? undefined : <Qty value={latest.respRate} unit="/min" />}
          points={vitals.map((set) => pt(set, set.respRate, '/min'))}
          domain={child ? [0, 60] : [0, 50]}
          ticks={child ? [0, 20, 40, 60] : [0, 10, 20, 30, 40, 50]}
          {...adultBand([12, 20])}
        />
        {scored.length === 0 ? (
          <div className="chart-trend chart-trend--empty">
            <p className="chart-trend__title">{t('chartNews')}</p>
            <p className="chart-muted">{t(news.applicability === 'paediatric' ? 'newsPaediatric' : 'newsIcu')}</p>
          </div>
        ) : (
          <TrendChart
            {...common}
            title={t('chartNews')}
            kind="bars"
            latest={news.latest === null ? undefined : <Bdi dir="ltr">{news.latest.total}</Bdi>}
            points={scored.map(({ set, score }) => ({
              iso: set.iso,
              value: score.total,
              tone: NEWS2_BAND_TONE[score.band],
              label: `${f.weekday(set.iso)} ${f.time(set.iso)} · NEWS2 ${String(score.total)} · ${t(`newsBand_${score.band}` as ChartMessageKey)}`,
            }))}
            domain={[0, 14]}
            ticks={[0, 3, 7, 10, 14]}
            thresholds={[
              { value: 5, label: '5' },
              { value: 7, label: '7' },
            ]}
          />
        )}
      </div>
      {scored.length === 0 ? null : (
        <ul className="chart-legend" aria-label={t('chartNews')}>
          {(['low', 'low-medium', 'medium', 'high'] as const).map((band) => (
            <li key={band} className="chart-legend__item">
              <span className={`chart-legend__swatch chart-legend__swatch--${NEWS2_BAND_TONE[band]}`} aria-hidden="true" />
              {t(`newsBand_${band}` as ChartMessageKey)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Cell({ points, children }: { readonly points: number | undefined; readonly children: ReactNode }): ReactNode {
  const t = useT(messages);
  const tone: Tone | undefined = points === undefined ? undefined : subScoreTone(points);
  return (
    <td className={['chart-obs__td', tone === undefined ? '' : `chart-obs__td--${tone}`].filter(Boolean).join(' ')}>
      <span className="chart-obs__value">{children}</span>
      {points === undefined || points === 0 ? null : (
        <sup className="chart-obs__points" title={t('subPoints', { points })}>
          <span className="hms-visually-hidden">{t('subPoints', { points })}</span>
          <span aria-hidden="true">{points}</span>
        </sup>
      )}
    </td>
  );
}

function ObservationTable({ vitals, news }: { readonly vitals: readonly ChartVitals[]; readonly news: NewsView }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const rows = vitals.map((set, i) => ({ set, score: news.scores[i] ?? null })).reverse();
  const columns: readonly ChartMessageKey[] = ['colTime', 'colTemp', 'colHr', 'colBp', 'colRr', 'colSpo2', 'colOxygen', 'colAcvpu', 'colPain', 'colNews', 'colBy'];
  let currentDay = '';
  const points = (score: (typeof rows)[number]['score'], param: News2Parameter): number | undefined => score?.sub[param];

  return (
    <Card title={t('tableTitle')} subtitle={t('tableLegend')} icon="clipboard" flush>
      <div className="chart-obs-wrap">
        <table className="chart-obs">
          <caption className="hms-visually-hidden">{t('tableCaption')}</caption>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key} scope="col" className="chart-obs__th">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ set, score }) => {
              const day = set.iso.slice(0, 10);
              const showDay = day !== currentDay;
              currentDay = day;
              const recorder = findStaff(set.recordedById);
              return (
                <Fragment key={set.iso}>
                  {showDay ? (
                    <tr className="chart-obs__day">
                      <th colSpan={columns.length} scope="colgroup">
                        {f.date(set.iso, 'long')}
                      </th>
                    </tr>
                  ) : null}
                  <tr className={set.beforeAdmission ? 'chart-obs__row chart-obs__row--ed' : 'chart-obs__row'}>
                    <th scope="row" className="chart-obs__time">
                      <Bdi dir="ltr">{f.time(set.iso)}</Bdi>
                      {set.beforeAdmission ? <span className="chart-obs__where">{t('beforeAdmission')}</span> : null}
                    </th>
                    <Cell points={points(score, 'temp')}>
                      <Qty value={set.tempC} unit="Cel" />
                    </Cell>
                    <Cell points={points(score, 'hr')}>
                      <Qty value={set.heartRate} />
                    </Cell>
                    <Cell points={points(score, 'sbp')}>
                      <Bdi dir="ltr">
                        {set.systolic}/{set.diastolic}
                      </Bdi>
                    </Cell>
                    <Cell points={points(score, 'rr')}>
                      <Qty value={set.respRate} />
                    </Cell>
                    <Cell points={points(score, 'spo2')}>
                      <Qty value={set.spo2} unit="%" />
                    </Cell>
                    <Cell points={points(score, 'oxygen')}>
                      <span className="chart-obs__small">
                        <OxygenText oxygen={set.oxygen} />
                      </span>
                    </Cell>
                    <Cell points={points(score, 'acvpu')}>
                      <span className="chart-obs__small">{t(acvpuKey(set.consciousness))}</span>
                    </Cell>
                    <td className="chart-obs__td">{set.painScore === null ? '–' : <Bdi dir="ltr">{set.painScore}</Bdi>}</td>
                    <td className="chart-obs__td">
                      {score === null ? (
                        <span className="chart-muted">{t('notApplicableShort')}</span>
                      ) : (
                        <Badge tone={NEWS2_BAND_TONE[score.band]} strong={score.band === 'high' || score.band === 'medium'} size="sm">
                          <Bdi dir="ltr">{score.total}</Bdi>
                        </Badge>
                      )}
                    </td>
                    <td className="chart-obs__td chart-obs__by">{recorder === undefined ? null : <StaffName member={recorder} />}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
