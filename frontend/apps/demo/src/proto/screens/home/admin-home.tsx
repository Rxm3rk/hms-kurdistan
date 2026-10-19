/**
 * Home for the administrator (Hemin Aziz): hospital figures (bed occupancy per ward, emergency and outpatient
 * visits, length of stay, admissions), a system health panel (simulated hardware, labelled so) and the
 * latest audit events.
 */
import type { ReactNode } from 'react';
import {
  AUDIT_EVENTS,
  BED_STATE_LABEL,
  BED_STATE_TONE,
  TRENDS,
  TREND_DAYS,
  WARDS,
  bedCounts,
  findStaff,
  occupancy,
  todayAt,
  todaysFigures,
} from '../../data/index.ts';
import type { BedState } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  BarChart,
  Card,
  Code,
  Dot,
  Grid,
  Icon,
  LinkButton,
  StaffName,
  StatTile,
  type IconName,
} from '../../ui/index.ts';
import { messages } from './messages.ts';

const LEGEND_STATES: readonly BedState[] = ['occupied', 'available', 'cleaning', 'reserved', 'blocked'];
const NEAR_CAPACITY = 0.85;

interface HealthRow {
  readonly id: string;
  readonly icon: IconName;
  readonly label: string;
  readonly ok: boolean;
  readonly value: string;
  readonly detail: string;
}

export function AdminHome(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();

  const figures = todaysFigures();
  const usable = figures.beds.total - figures.beds.blocked;
  const last = TREND_DAYS.length - 1;
  const lastOf = (series: readonly number[]): number => series[series.length - 1] ?? 0;
  const alosSeries = TRENDS.averageLengthOfStayDays.map(Number);
  const dayLabel = (index: number): string => (index === last ? t('todayShort') : String(Number((TREND_DAYS[index] ?? '').slice(8, 10))));
  const columnData = (series: readonly number[]) =>
    series.map((value, index) => ({ id: TREND_DAYS[index] ?? String(index), label: dayLabel(index), value, valueLabel: f.number(value) }));

  const wardBars = WARDS.map((ward) => {
    const counts = bedCounts(ward.id);
    const fraction = occupancy(ward.id);
    const near = fraction >= NEAR_CAPACITY;
    return {
      id: ward.id,
      label: (
        <span className="home-bar-label">
          <span>{f.text(ward.name)}</span>
          {near ? (
            <Badge tone="warning" icon="alert" size="sm">
              {t('nearCapacity')}
            </Badge>
          ) : null}
        </span>
      ),
      value: Math.round(fraction * 100),
      valueLabel: t('occupiedOf', { occupied: counts.occupied, usable: counts.total - counts.blocked, percent: f.percent(fraction) }),
      ...(near ? { tone: 'warning' as const } : {}),
    };
  });

  const health: readonly HealthRow[] = [
    { id: 'server', icon: 'building', label: t('healthServer'), ok: true, value: t('online'), detail: t('healthServerDetail') },
    { id: 'offline', icon: 'shield', label: t('healthOffline'), ok: true, value: t('ready'), detail: t('healthOfflineDetail') },
    { id: 'sync', icon: 'refresh', label: t('healthSync'), ok: true, value: f.time(todayAt('09:28')), detail: f.relative(todayAt('09:28')) },
    { id: 'internet', icon: 'phone', label: t('healthInternet'), ok: true, value: t('online'), detail: t('healthInternetDetail') },
    { id: 'backup', icon: 'check-circle', label: t('healthBackup'), ok: true, value: f.time(todayAt('02:05')), detail: t('healthBackupDetail') },
    { id: 'printers', icon: 'printer', label: t('healthPrinters'), ok: false, value: t('countOf', { count: 11, total: 12 }), detail: t('healthPrintersDetail') },
    { id: 'scanners', icon: 'scan', label: t('healthScanners'), ok: true, value: t('countOf', { count: 18, total: 18 }), detail: t('healthScannersDetail') },
    { id: 'power', icon: 'activity', label: t('healthPower'), ok: true, value: t('mains'), detail: t('healthPowerDetail') },
  ];

  return (
    <>
      <Grid min="12.5rem">
        <StatTile
          label={t('tileOccupancy')}
          value={f.percent(occupancy())}
          icon="bed"
          hint={t('tileOccupancyHint', { occupied: figures.beds.occupied, usable })}
          trend={TRENDS.occupancyPct}
          trendLabel={t('trendOccupancy')}
          href={href('ward')}
        />
        <StatTile
          label={t('tileEmergency')}
          value={f.number(lastOf(TRENDS.emergencyAttendances))}
          icon="activity"
          hint={t('sinceMidnight')}
          trend={TRENDS.emergencyAttendances}
          trendLabel={t('trendEmergency')}
          href={href('patients')}
        />
        <StatTile
          label={t('tileOutpatients')}
          value={f.number(lastOf(TRENDS.outpatientVisits))}
          icon="stethoscope"
          hint={t('tileOutpatientsHint', { count: figures.appointmentsToday })}
          trend={TRENDS.outpatientVisits}
          trendLabel={t('trendOutpatients')}
          href={href('outpatient')}
        />
        <StatTile
          label={t('tileAlos')}
          value={f.number(lastOf(alosSeries), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          unit={t('days')}
          icon="calendar"
          hint={t('tileAlosHint')}
          trend={alosSeries}
          trendLabel={t('trendAlos')}
          href={href('ward')}
        />
        <StatTile
          label={t('tileAdmissions')}
          value={f.number(lastOf(TRENDS.admissions))}
          icon="plus"
          hint={t('tileAdmissionsHint', { discharged: lastOf(TRENDS.discharges), expected: figures.expectedDischargesToday })}
          trend={TRENDS.admissions}
          trendLabel={t('trendAdmissions')}
          href={href('ward')}
        />
      </Grid>

      <div className="home-columns">
        <div className="home-main">
          <Card
            title={t('occupancyTitle')}
            subtitle={t('occupancySubtitle', { percent: f.percent(occupancy()) })}
            icon="bed"
            actions={
              <LinkButton href={href('ward')} variant="ghost" size="sm" iconEnd="arrow-forward">
                {t('openWard')}
              </LinkButton>
            }
            footer={t('occupancyNote')}
          >
            <BarChart data={wardBars} label={t('occupancyTitle')} max={100} />
            <div className="home-legend home-legend--spaced">
              {LEGEND_STATES.map((state) => (
                <span key={state} className="home-legend__item">
                  <Dot tone={BED_STATE_TONE[state]} />
                  {f.text(BED_STATE_LABEL[state])} {f.number(figures.beds[state])}
                </span>
              ))}
            </div>
          </Card>

          <Grid min="18rem">
            <Card title={t('emergencyTitle')} subtitle={t('weekSubtitle')} icon="activity" headingLevel={3}>
              <BarChart data={columnData(TRENDS.emergencyAttendances)} label={t('emergencyTitle')} orientation="vertical" height="8rem" />
            </Card>
            <Card title={t('outpatientTitle')} subtitle={t('weekSubtitle')} icon="stethoscope" headingLevel={3}>
              <BarChart data={columnData(TRENDS.outpatientVisits)} label={t('outpatientTitle')} orientation="vertical" height="8rem" />
            </Card>
          </Grid>
          <p className="home-small home-chart-note">{t('weekNote')}</p>
        </div>

        <div className="home-side">
          <Card
            title={t('healthTitle')}
            icon="shield"
            actions={
              <Badge tone="neutral" icon="info" size="sm">
                {t('simulated')}
              </Badge>
            }
            footer={t('healthNote')}
          >
            <ul className="home-health">
              {health.map((row) => (
                <li key={row.id} className="home-health__row">
                  <Icon name={row.icon} className="home-health__icon" />
                  <div className="home-health__text">
                    <span className="home-strong">{row.label}</span>
                    <span className="home-small">{row.detail}</span>
                  </div>
                  <Badge tone={row.ok ? 'success' : 'warning'} icon={row.ok ? 'check-circle' : 'alert'} size="sm">
                    {row.value}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title={t('auditTitle')}
            icon="clipboard"
            footer={
              <LinkButton href={href('admin')} variant="ghost" size="sm" iconEnd="arrow-forward">
                {t('openAdmin')}
              </LinkButton>
            }
          >
            <ul className="home-list">
              {AUDIT_EVENTS.slice(0, 5).map((event) => {
                const actor = findStaff(event.actorId);
                return (
                  <li key={event.id} className="home-list__item">
                    <Dot tone={event.tone} />
                    <div className="home-list__main">
                      <p className="home-list__title">{f.text(event.action)}</p>
                      <span className="home-muted">
                        {f.time(event.iso)} · {actor === undefined ? <Code>{event.actorId}</Code> : <StaffName member={actor} />}
                        {event.target === null ? null : (
                          <>
                            {' · '}
                            <Code>{event.target}</Code>
                          </>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
