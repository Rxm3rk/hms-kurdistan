/**
 * The patient's results: the cumulative table (newest first, reference ranges, H/L flags, critical values in
 * the danger tone, corrected values with the previous value struck through), small trend charts (potassium
 * and creatinine for the demo story), corrected results explained, and text or pending results.
 */
import { Fragment, useMemo, type ReactNode } from 'react';
import { RESULT_FLAG_LABEL, RESULT_FLAG_TONE, findStaff, resultsOf, type LabResult, type Patient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient } from '../../shell/index.ts';
import { Badge, Button, Card, Code, EmptyState, Grid, Icon, Qty, StaffName } from '../../ui/index.ts';
import { buildCumulative, buildTrends, correctionOf, type CumulativeCell, type LabSpecimen } from './lab-data.ts';
import { FlagMark, RangeText, StatusBadge, rangeText, unitText } from './lab-parts.tsx';
import { messages } from './messages.ts';
import { TrendChart } from './trend-chart.tsx';

export interface ResultsTabProps {
  readonly patient: Patient;
  /** Every specimen (for panel names) with the session's changes. */
  readonly specimens: readonly LabSpecimen[];
  readonly onShowSpecimens: () => void;
}

function cellTone(cell: CumulativeCell): string {
  const tone = RESULT_FLAG_TONE[cell.flag];
  return tone === 'danger' ? 'critical' : tone === 'warning' ? 'abnormal' : 'normal';
}

function Cell({ cell }: { readonly cell: CumulativeCell | undefined }): ReactNode {
  const t = useT(messages);
  if (cell === undefined) {
    return (
      <>
        <span aria-hidden="true" className="lab-muted">
          –
        </span>
        <span className="hms-visually-hidden">{t('notMeasured')}</span>
      </>
    );
  }
  const tone = cellTone(cell);
  return (
    <span className={`lab-cum__cell lab-cum__cell--${tone}`}>
      <span className="lab-cum__value">
        {tone === 'critical' ? <Icon name="alert" size="0.95em" /> : null}
        <Qty value={cell.value} />
        <FlagMark flag={cell.flag} />
      </span>
      {cell.correction === null ? null : (
        <span className="lab-cum__corrected">
          <Badge tone="info" size="sm" icon="refresh">
            {t('corrected')}
          </Badge>
          <del className="lab-del">
            <span className="hms-visually-hidden">{t('previouslyReported')} </span>
            <Qty value={cell.correction.previousValue} />
          </del>
        </span>
      )}
    </span>
  );
}

export function ResultsTab({ patient, specimens, onShowSpecimens }: ResultsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const openPatient = useOpenPatient();
  const results = useMemo(() => resultsOf(patient.id), [patient.id]);
  const cumulative = useMemo(() => buildCumulative(results, specimens), [results, specimens]);
  const trends = useMemo(() => buildTrends(cumulative), [cumulative]);
  const pending = specimens.filter(
    (specimen) => specimen.patientId === patient.id && (specimen.status === 'collected' || specimen.status === 'received' || specimen.status === 'in-progress' || specimen.status === 'ordered'),
  );
  const corrected = results
    .map((result) => ({ result, correction: correctionOf(result) }))
    .filter((entry): entry is { result: LabResult; correction: NonNullable<ReturnType<typeof correctionOf>> } => entry.correction !== undefined);

  if (results.length === 0) {
    return (
      <EmptyState
        icon="flask"
        title={t('noResultsTitle')}
        body={pending.length > 0 ? t('noResultsPending', { count: pending.length }) : t('noResultsBody')}
        action={
          <span className="lab-actions-row">
            {pending.length > 0 ? (
              <Button icon="droplet" onPress={onShowSpecimens}>
                {t('showSpecimens')}
              </Button>
            ) : null}
            {patient.id === 'SYN-PAT-0102' ? null : (
              <Button
                variant="ghost"
                icon="arrow-forward"
                onPress={() => {
                  openPatient('SYN-PAT-0102', 'lab');
                }}
              >
                {t('demoOpenCritical')}
              </Button>
            )}
          </span>
        }
      />
    );
  }

  const columns = cumulative.columns;

  return (
    <div className="lab-results">
      {cumulative.groups.length === 0 ? null : (
        <Card title={t('cumulativeTitle')} subtitle={t('cumulativeSubtitle')} icon="flask" flush>
          <div className="lab-cum-wrap" role="region" aria-label={t('cumulativeTitle')} tabIndex={0}>
            <table className="lab-cum">
              <caption className="hms-visually-hidden">{t('cumulativeCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="lab-cum__th lab-cum__th--test">
                    {t('colTest')}
                  </th>
                  <th scope="col" className="lab-cum__th">
                    {t('colRange')}
                  </th>
                  <th scope="col" className="lab-cum__th">
                    {t('colUnit')}
                  </th>
                  {columns.map((iso, index) => (
                    <th key={iso} scope="col" className={index === 0 ? 'lab-cum__th lab-cum__th--time lab-cum__th--latest' : 'lab-cum__th lab-cum__th--time'}>
                      <span className="lab-cum__date">{f.date(iso)}</span>
                      <span className="lab-cum__time">{f.time(iso)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cumulative.groups.map((group) => (
                  <Fragment key={group.id}>
                    <tr className="lab-cum__group">
                      <th scope="colgroup" colSpan={3 + columns.length}>
                        <span>{f.text(group.panel)}</span> <Code className="lab-muted">{group.specimenId}</Code>
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.code} className="lab-cum__row">
                        <th scope="row" className="lab-cum__test">
                          {f.text(row.analyte)}
                        </th>
                        <td className="lab-cum__range">
                          <RangeText refLow={row.refLow} refHigh={row.refHigh} />
                        </td>
                        <td className="lab-cum__unit">{unitText(row.unit)}</td>
                        {columns.map((iso, index) => (
                          <td key={iso} className={index === 0 ? 'lab-cum__td lab-cum__td--latest' : 'lab-cum__td'}>
                            <Cell cell={row.cells.get(iso)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lab-cum__legend">
            <span>{t('legendNewest')}</span>
            <span>
              <Code>H</Code> {f.text(RESULT_FLAG_LABEL.high)} · <Code>L</Code> {f.text(RESULT_FLAG_LABEL.low)}
            </span>
            <span>
              <Code>HH</Code> / <Code>LL</Code> {t('legendCritical')}
            </span>
            <span>
              <del className="lab-del">0.0</del> {t('legendCorrected')}
            </span>
          </p>
        </Card>
      )}

      <Grid min="20rem" gap="md">
        {trends.length === 0 ? null : (
          <Card title={t('trendTitle')} subtitle={t('trendSubtitle')} icon="activity">
            <div className="lab-trends">
              {trends.map((series) => {
                const unit = unitText(series.unit);
                const latest = series.points[series.points.length - 1];
                const first = series.points[0];
                const range = rangeText(series.latest.refLow, series.latest.refHigh);
                const direction =
                  latest === undefined || first === undefined ? 'flat' : latest.value > first.value ? 'up' : latest.value < first.value ? 'down' : 'flat';
                return (
                  <figure key={series.code} className="lab-trend-item">
                    <figcaption className="lab-trend-item__head">
                      <span className="lab-strong">{f.text(series.analyte)}</span>
                      {latest === undefined ? null : (
                        <span className="lab-trend-item__latest">
                          <Qty value={String(latest.value)} unit={series.unit} />
                          <FlagMark flag={latest.flag} />
                        </span>
                      )}
                    </figcaption>
                    <TrendChart
                      points={series.points}
                      refLow={series.refLow}
                      refHigh={series.refHigh}
                      criticalHigh={series.criticalHigh}
                      criticalLow={series.criticalLow}
                      label={t('trendAria', {
                        test: f.text(series.analyte),
                        values: series.points.map((point) => String(point.value)).join(', '),
                        unit,
                        direction,
                      })}
                      refLabel={range === '' ? null : t('refBand', { range })}
                      criticalLabel={series.criticalHigh === null ? null : t('criticalLine', { value: String(series.criticalHigh) })}
                      pointTitle={(point) => `${f.dateTime(point.iso)}: ${String(point.value)} ${unit} (${f.text(RESULT_FLAG_LABEL[point.flag])})`}
                    />
                    <p className="lab-muted lab-trend-item__note">{t('trendDirection', { direction, count: series.points.length })}</p>
                  </figure>
                );
              })}
            </div>
          </Card>
        )}

        {corrected.length === 0 ? null : (
          <Card title={t('correctionsTitle')} subtitle={t('correctionsSubtitle')} icon="refresh" tone="info">
            <ul className="lab-plain-list lab-corrections">
              {corrected.map(({ result, correction }) => {
                const by = findStaff(correction.correctedById);
                const notified = findStaff(correction.notifiedId);
                return (
                  <li key={result.id} className="lab-correction">
                    <p className="lab-correction__head">
                      <span className="lab-strong">{f.text(result.analyte)}</span>
                      <Badge tone="info" size="sm" icon="refresh">
                        {t('corrected')}
                      </Badge>
                    </p>
                    <p className="lab-correction__values">
                      <del className="lab-del">
                        <span className="hms-visually-hidden">{t('previouslyReported')} </span>
                        <Qty value={correction.previousValue} unit={result.unit} />
                      </del>
                      <Icon name="arrow-forward" size="1em" />
                      <span className="lab-strong">
                        <Qty value={result.value} unit={result.unit} />
                      </span>
                      <FlagMark flag={result.flag} />
                    </p>
                    <p className="lab-muted">{f.text(correction.reason)}</p>
                    <p className="lab-muted">
                      {t.rich('correctedBy', {
                        time: <Code>{f.time(correction.correctedIso)}</Code>,
                        name: by === undefined ? '' : <StaffName member={by} />,
                      })}{' '}
                      {notified === undefined ? null : t.rich('correctionNotified', { name: <StaffName member={notified} /> })}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {cumulative.textResults.length === 0 && pending.length === 0 ? null : (
          <Card title={t('pendingTitle')} subtitle={t('pendingSubtitle')} icon="clock">
            <ul className="lab-plain-list lab-pending">
              {cumulative.textResults.map((result) => (
                <li key={result.id} className="lab-pending__item">
                  <span className="lab-pending__main">
                    <span className="lab-strong">{f.text(result.analyte)}</span>
                    <span>{result.text === null ? '' : f.text(result.text)}</span>
                  </span>
                  <Badge tone="neutral" size="sm" icon="clock">
                    {t('preliminary')}
                  </Badge>
                </li>
              ))}
              {pending.map((specimen) => (
                <li key={specimen.id} className="lab-pending__item">
                  <span className="lab-pending__main">
                    <span className="lab-strong">{f.text(specimen.panel)}</span>
                    <Code className="lab-muted">{specimen.id}</Code>
                  </span>
                  <StatusBadge status={specimen.status} />
                </li>
              ))}
            </ul>
            {pending.length === 0 ? null : (
              <Button variant="ghost" size="sm" iconEnd="chevron-forward" onPress={onShowSpecimens}>
                {t('showSpecimens')}
              </Button>
            )}
          </Card>
        )}
      </Grid>
    </div>
  );
}
