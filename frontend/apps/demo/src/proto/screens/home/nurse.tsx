/**
 * Home for the nurse (Rawa Hassan, charge nurse of Medical Ward A): ward census, the medication round due in
 * the next hour, overdue and outstanding tasks, and the patients in isolation or at high risk of falls.
 * Scope: her own ward, or every ward.
 */
import { useState, type ReactNode } from 'react';
import {
  BED_STATE_LABEL,
  BED_STATE_TONE,
  ISOLATION_LABEL,
  MAR_STATUS_LABEL,
  MAR_STATUS_TONE,
  ROUTE_LABEL,
  WARDS,
  bedCounts,
  occupancy,
  todayAt,
} from '../../data/index.ts';
import type { BedState, Tone, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient, useRole, useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Card,
  Code,
  DataTable,
  Dot,
  EmptyState,
  Grid,
  Icon,
  LinkButton,
  Meter,
  PatientInline,
  Qty,
  Segmented,
  StatTile,
  Toolbar,
  type Column,
  type IconName,
} from '../../ui/index.ts';
import { nurseTasks, roundsDue, safetyWatch, wardById, type NurseTask, type RoundRow } from './derive.ts';
import { messages } from './messages.ts';

type Scope = 'ward' | 'all';
const STATES: readonly BedState[] = ['available', 'cleaning', 'reserved', 'blocked'];

export function NurseHome(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const openPatient = useOpenPatient();
  const { user } = useRole();
  const [scope, setScope] = useState<Scope>('ward');
  const wardName = (id: WardId): string => {
    const ward = wardById(id);
    return ward === undefined ? id : f.text(ward.name);
  };

  const myWard = WARDS.find((ward) => ward.chargeNurseId === user.id) ?? WARDS[0];
  const wardId: WardId | null = scope === 'ward' && myWard !== undefined ? myWard.id : null;
  const counts = bedCounts(wardId ?? undefined);
  const rounds = roundsDue(wardId);
  const overdue = rounds.filter((row) => row.dose.status === 'overdue');
  const dueSoon = rounds.filter((row) => row.dose.status !== 'overdue');
  const tasks = nurseTasks(wardId);
  const watch = safetyWatch(wardId);
  const firstDue = dueSoon[0];
  const firstOverdue = overdue[0];

  const roundColumns: readonly Column<RoundRow>[] = [
    {
      id: 'time',
      header: t('colTime'),
      nowrap: true,
      cell: (row) => (
        <span className="home-two-line">
          <span className="home-num home-strong">{f.time(row.dose.scheduledIso)}</span>
          <span className="home-muted">{f.relative(row.dose.scheduledIso)}</span>
        </span>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (row) => (
        <span className="home-two-line">
          <PatientInline patient={row.patient} />
          {row.bed === undefined ? null : (
            <span className="home-muted">
              {wardName(row.bed.wardId)} · {t('bed')} <Code>{row.bed.id}</Code>
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'medicine',
      header: t('colMedicine'),
      cell: (row) => {
        const medication = row.order?.medication ?? null;
        if (medication === null) {
          return <span>{row.order === undefined ? <Code>{row.dose.orderId}</Code> : f.text(row.order.title)}</span>;
        }
        return (
          <span className="home-two-line">
            <span>
              <Code className="home-strong">{medication.drug}</Code> <Qty value={medication.dose} unit={medication.doseUnit} />
            </span>
            <span className="home-muted">
              {f.text(ROUTE_LABEL[medication.route])} · {f.text(medication.frequency)}
            </span>
            {medication.highAlert ? (
              <Badge tone="warning" icon="shield" size="sm">
                {t('highAlert')}
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge tone={MAR_STATUS_TONE[row.dose.status]} strong={row.dose.status === 'overdue'} icon={row.dose.status === 'overdue' ? 'clock' : 'pill'} size="sm">
          {f.text(MAR_STATUS_LABEL[row.dose.status])}
        </Badge>
      ),
    },
  ];

  const scopeOptions = [
    { id: 'ward', label: myWard === undefined ? t('scopeAll') : t('scopeMyWard', { ward: f.text(myWard.name) }) },
    { id: 'all', label: t('scopeAll') },
  ];

  return (
    <>
      <Toolbar label={t('scopeLabel')}>
        <Segmented
          label={t('scopeLabel')}
          options={scopeOptions}
          value={scope}
          onChange={(id) => {
            setScope(id === 'all' ? 'all' : 'ward');
          }}
        />
      </Toolbar>

      <Grid min="14rem">
        <StatTile
          label={wardId === null || myWard === undefined ? t('tileCensusAll') : t('tileCensus', { ward: f.text(myWard.name) })}
          value={f.number(counts.occupied)}
          unit={t('ofBeds', { count: counts.total })}
          icon="bed"
          hint={t('tileCensusHint', { available: counts.available, cleaning: counts.cleaning, reserved: counts.reserved })}
          href={href('ward')}
        />
        <StatTile
          label={t('tileDue')}
          value={f.number(dueSoon.length)}
          tone="accent"
          icon="pill"
          hint={firstDue === undefined ? t('tileDueNone') : t('tileDueNext', { time: f.time(firstDue.dose.scheduledIso) })}
          href={firstDue === undefined ? href('emar') : href('emar', { patient: firstDue.patient.id })}
        />
        <StatTile
          label={t('tileOverdue')}
          value={f.number(overdue.length)}
          tone={overdue.length > 0 ? 'danger' : 'success'}
          icon="clock"
          hint={overdue.length > 0 ? t('tileOverdueHint') : t('tileOverdueNone')}
          href={firstOverdue === undefined ? href('emar') : href('emar', { patient: firstOverdue.patient.id })}
        />
        <StatTile
          label={t('tileWatch')}
          value={f.number(watch.length)}
          tone={watch.length > 0 ? 'warning' : 'success'}
          icon="isolation"
          hint={t('tileWatchHint', { isolation: watch.filter((row) => row.isolation).length, fall: watch.filter((row) => row.fall).length })}
          href={href('ward')}
        />
      </Grid>

      <div className="home-columns">
        <div className="home-main">
          <Card title={t('roundTitle')} subtitle={t('roundSubtitle', { time: f.time(todayAt('10:30')) })} icon="pill" flush footer={t('rowHintEmar')}>
            <DataTable
              caption={t('roundTitle')}
              columns={roundColumns}
              rows={rounds}
              rowKey={(row) => row.dose.id}
              rowTone={(row) => (row.dose.status === 'overdue' ? 'danger' : undefined)}
              onRowAction={(row) => {
                openPatient(row.patient.id, 'emar');
              }}
              emptyText={t('roundEmpty')}
            />
          </Card>

          <Card title={t('tasksTitle')} subtitle={t('tasksSubtitle', { count: tasks.length })} icon="clipboard">
            {tasks.length === 0 ? (
              <EmptyState compact icon="check-circle" title={t('tasksEmpty')} />
            ) : (
              <ul className="home-list">
                {tasks.map((task) => (
                  <TaskItem key={`${task.kind}-${task.id}`} task={task} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="home-side">
          <Card title={t('watchTitle')} subtitle={t('watchSubtitle')} icon="isolation" {...(watch.length > 0 ? { tone: 'warning' as const } : {})}>
            {watch.length === 0 ? (
              <EmptyState compact icon="check-circle" title={t('watchEmpty')} />
            ) : (
              <ul className="home-list">
                {watch.map((row) => (
                  <li key={row.patient.id} className="home-list__item">
                    <div className="home-list__main">
                      <PatientInline patient={row.patient} />
                      {row.bed === undefined ? null : (
                        <span className="home-muted">
                          {wardName(row.bed.wardId)} · {t('bed')} <Code>{row.bed.id}</Code>
                        </span>
                      )}
                      <span className="home-flags">
                        {row.patient.isolation === null
                          ? null
                          : row.patient.isolation.types.map((type) => (
                              <Badge key={type} tone="warning" icon="isolation" size="sm">
                                {f.text(ISOLATION_LABEL[type])}
                              </Badge>
                            ))}
                        {row.fall ? (
                          <Badge tone="warning" icon="activity" size="sm">
                            {t('flagFall')}
                          </Badge>
                        ) : null}
                      </span>
                      {row.patient.isolation === null ? null : <span className="home-small">{f.text(row.patient.isolation.reason)}</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconEnd="chevron-forward"
                      onPress={() => {
                        openPatient(row.patient.id, 'chart');
                      }}
                    >
                      {t('openChart')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t('censusTitle')}
            icon="bed"
            footer={
              <LinkButton href={href('ward')} variant="ghost" size="sm" iconEnd="arrow-forward">
                {t('openWard')}
              </LinkButton>
            }
          >
            <div className="home-census">
              {WARDS.map((ward) => {
                const wardCounts = bedCounts(ward.id);
                const usable = wardCounts.total - wardCounts.blocked;
                const fraction = occupancy(ward.id);
                return (
                  <div key={ward.id} className={ward.id === myWard?.id ? 'home-census__ward home-census__ward--mine' : 'home-census__ward'}>
                    <div className="home-census__head">
                      <span className="home-strong">{f.text(ward.name)}</span>
                      {ward.id === myWard?.id ? (
                        <Badge tone="accent" size="sm">
                          {t('yourWard')}
                        </Badge>
                      ) : null}
                    </div>
                    <Meter
                      value={fraction}
                      label={t('occupancyOf', { ward: f.text(ward.name) })}
                      valueLabel={t('occupiedOf', { occupied: wardCounts.occupied, usable, percent: f.percent(fraction) })}
                      tone={fraction >= 0.85 ? 'warning' : 'accent'}
                    />
                    <div className="home-legend">
                      {STATES.map((state) =>
                        wardCounts[state] === 0 ? null : (
                          <span key={state} className="home-legend__item">
                            <Dot tone={BED_STATE_TONE[state]} />
                            {f.text(BED_STATE_LABEL[state])} {f.number(wardCounts[state])}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

const TASK_LOOK: Readonly<Record<NurseTask['kind'], { readonly tone: Tone; readonly icon: IconName }>> = {
  critical: { tone: 'danger', icon: 'alert' },
  'overdue-dose': { tone: 'danger', icon: 'clock' },
  'held-dose': { tone: 'warning', icon: 'pill' },
  'refused-dose': { tone: 'warning', icon: 'pill' },
  discharges: { tone: 'info', icon: 'logout' },
  'bed-reserved': { tone: 'accent', icon: 'bed' },
  'bed-cleaning': { tone: 'warning', icon: 'refresh' },
  'bed-blocked': { tone: 'neutral', icon: 'lock' },
};

function TaskItem({ task }: { readonly task: NurseTask }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const openPatient = useOpenPatient();
  const look = TASK_LOOK[task.kind];
  const wardName = (id: WardId): string => {
    const ward = wardById(id);
    return ward === undefined ? id : f.text(ward.name);
  };
  const className = `home-list__item home-task home-task--${look.tone}`;
  const icon = <Icon name={look.icon} className="home-task__icon" />;

  switch (task.kind) {
    case 'critical':
      return (
        <li className={className}>
          {icon}
          <div className="home-list__main">
            <p className="home-list__title">
              {t.rich('taskCritical', { analyte: f.text(task.result.analyte), value: <Qty value={task.result.value} unit={task.result.unit} /> })}
            </p>
            <PatientInline patient={task.patient} />
            <span className="home-small">{t('taskCriticalHint')}</span>
          </div>
          <Button
            size="sm"
            variant="danger"
            onPress={() => {
              openPatient(task.patient.id, 'lab');
            }}
          >
            {t('openLab')}
          </Button>
        </li>
      );
    case 'overdue-dose':
    case 'held-dose':
    case 'refused-dose': {
      const drug = task.order?.medication?.drug;
      const key = task.kind === 'overdue-dose' ? 'taskOverdue' : task.kind === 'held-dose' ? 'taskHeld' : 'taskRefused';
      return (
        <li className={className}>
          {icon}
          <div className="home-list__main">
            <p className="home-list__title">
              {t.rich(key, {
                time: f.time(task.dose.scheduledIso),
                drug: drug === undefined ? <Code>{task.dose.orderId}</Code> : <Code>{drug}</Code>,
              })}
            </p>
            <PatientInline patient={task.patient} />
            {task.dose.note === null ? null : <span className="home-small">{f.text(task.dose.note)}</span>}
          </div>
          <Button
            size="sm"
            variant={task.kind === 'overdue-dose' ? 'danger' : 'secondary'}
            onPress={() => {
              openPatient(task.patient.id, 'emar');
            }}
          >
            {t('openEmar')}
          </Button>
        </li>
      );
    }
    case 'discharges':
      return (
        <li className={className}>
          {icon}
          <div className="home-list__main">
            <p className="home-list__title">{t('taskDischarges', { count: task.count })}</p>
            <span className="home-small">{t('taskDischargesHint')}</span>
          </div>
          <LinkButton href={href('ward')} size="sm">
            {t('openWardShort')}
          </LinkButton>
        </li>
      );
    case 'bed-reserved':
    case 'bed-cleaning':
    case 'bed-blocked':
      return (
        <li className={className}>
          {icon}
          <div className="home-list__main">
            <p className="home-list__title">
              {t.rich(task.kind === 'bed-reserved' ? 'taskBedReserved' : task.kind === 'bed-cleaning' ? 'taskBedCleaning' : 'taskBedBlocked', {
                bed: <Code>{task.bed.id}</Code>,
                ward: wardName(task.bed.wardId),
              })}
            </p>
            {task.bed.note === null ? null : <span className="home-small">{f.text(task.bed.note)}</span>}
          </div>
          <LinkButton href={href('ward')} size="sm">
            {t('openWardShort')}
          </LinkButton>
        </li>
      );
  }
}
