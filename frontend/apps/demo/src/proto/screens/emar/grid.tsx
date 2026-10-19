/**
 * Today's administration grid: one row per medicine, one column per hour (00 to 23). The hour track runs left
 * to right in every locale (time is not mirrored); the medicine column stays at the reading start. Each dose
 * is a button in its hour's cell; continuous infusions show a running bar up to now.
 */
import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { ROUTE_LABEL } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Code, Icon, Qty, cx, type IconName } from '../../ui/index.ts';
import { messages, type EmarMessageKey } from './messages.ts';
import { clockOf, hourOf, lastPrnGiven, orderIsActive, type DoseState, type GridDose, type MedRow } from './model.ts';

export const STATE_ICON: Readonly<Record<DoseState, IconName>> = {
  scheduled: 'clock',
  due: 'clock',
  late: 'alert',
  missed: 'x',
  given: 'check',
  'not-given': 'x',
  held: 'minus',
  running: 'activity',
  blocked: 'lock',
};

export const STATE_KEY: Readonly<Record<DoseState, EmarMessageKey>> = {
  scheduled: 'stScheduled',
  due: 'stDue',
  late: 'stLate',
  missed: 'stMissed',
  given: 'stGiven',
  'not-given': 'stNotGiven',
  held: 'stHeld',
  running: 'stRunning',
  blocked: 'stBlocked',
};

export const NOW_HOUR = 9;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

function pad(hour: number): string {
  return String(hour).padStart(2, '0');
}

/** A state shown as a small chip (legend, panel, worklist). Not interactive. */
export function StateChip({ state, label }: { readonly state: DoseState; readonly label?: string }): ReactNode {
  const t = useT(messages);
  return (
    <span className={`emar-state emar-state--${state}`}>
      <span className={`emar-chip emar-chip--${state} emar-chip--static`} aria-hidden="true">
        <Icon name={STATE_ICON[state]} size="1em" />
      </span>
      <span>{label ?? t(STATE_KEY[state])}</span>
    </span>
  );
}

function DoseChip({ dose, drug, selected, onSelect }: { readonly dose: GridDose; readonly drug: string; readonly selected: boolean; readonly onSelect: () => void }): ReactNode {
  const t = useT(messages);
  const time = dose.state === 'running' ? clockOf(dose.mar?.givenIso ?? dose.scheduledIso) : clockOf(dose.doc?.iso ?? dose.scheduledIso);
  const { minute } = hourOf(dose.scheduledIso);
  return (
    <AriaButton
      className={cx('emar-chip', `emar-chip--${dose.state}`, selected && 'emar-chip--selected')}
      aria-label={t('doseAria', { time, drug, state: t(STATE_KEY[dose.state]) })}
      onPress={onSelect}
    >
      <Icon name={STATE_ICON[dose.state]} size="1em" />
      {minute === 0 || dose.state === 'running' ? null : <span className="emar-chip__min">:{String(minute).padStart(2, '0')}</span>}
    </AriaButton>
  );
}

function MedCell({ row, onGivePrn }: { readonly row: MedRow; readonly onGivePrn: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { order, med } = row;
  const running = row.doses.find((dose) => dose.state === 'running');
  const last = med.prn ? lastPrnGiven(row) : null;
  return (
    <div className="emar-med">
      <p className="emar-med__name">
        <Code>{med.drug}</Code>
      </p>
      <p className="emar-med__line">
        <Qty value={med.dose} unit={med.doseUnit} />
        <span aria-hidden="true">·</span>
        <span>{f.text(ROUTE_LABEL[med.route])}</span>
        <span aria-hidden="true">·</span>
        <span>{f.text(med.frequency)}</span>
      </p>
      <div className="emar-med__badges">
        {med.highAlert ? (
          <Badge tone="warning" size="sm" icon="shield">
            {t('highAlert')}
          </Badge>
        ) : null}
        {med.prn ? (
          <Badge tone="info" size="sm">
            {t('prnBadge')}
          </Badge>
        ) : null}
        {med.continuous ? (
          <Badge tone="info" size="sm" icon="activity">
            {t('continuousBadge')}
          </Badge>
        ) : null}
        {order.status === 'on-hold' ? (
          <Badge tone="warning" size="sm" icon="minus">
            {t('orderOnHold')}
          </Badge>
        ) : null}
        {!orderIsActive(order) && order.status !== 'on-hold' ? (
          <Badge tone="neutral" size="sm" icon="lock">
            {t('orderNotActive')}
          </Badge>
        ) : null}
      </div>
      {running?.mar?.givenIso === undefined || running.mar.givenIso === null ? null : (
        <p className="emar-med__meta">{t('runningSince', { time: f.dateTime(running.mar.givenIso) })}</p>
      )}
      {med.prn ? (
        <div className="emar-med__prn">
          <span className="emar-med__meta">{last === null ? t('noPrnToday') : t('lastGiven', { time: clockOf(last) })}</span>
          {orderIsActive(order) ? (
            <Button size="sm" variant="secondary" icon="plus" onPress={onGivePrn}>
              {t('givePrn')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface MarGridProps {
  readonly rows: readonly MedRow[];
  readonly selectedId: string | null;
  readonly onSelect: (dose: GridDose) => void;
  readonly onGivePrn: (row: MedRow) => void;
}

export function MarGrid({ rows, selectedId, onSelect, onGivePrn }: MarGridProps): ReactNode {
  const t = useT(messages);
  return (
    <div className="emar-grid-scroll">
      <div className="emar-grid" role="table" aria-label={t('gridLabel')}>
        <div className="emar-grid__row emar-grid__row--head" role="row">
          <div className="emar-grid__med emar-grid__med--head" role="columnheader">
            {t('colMedicine')}
          </div>
          <div className="emar-track" dir="ltr">
            {HOURS.map((hour) => (
              <div key={hour} role="columnheader" className={cx('emar-hour', hour === NOW_HOUR && 'emar-hour--now')} aria-label={`${pad(hour)}:00`}>
                <span aria-hidden="true">{pad(hour)}</span>
                {hour === NOW_HOUR ? <span className="emar-now-label">{t('nowMarker', { time: '09:30' })}</span> : null}
              </div>
            ))}
          </div>
        </div>
        {rows.map((row) => {
          const running = row.kind === 'continuous' && row.doses.some((dose) => dose.state === 'running');
          return (
            <div
              key={row.order.id}
              role="row"
              className={cx(
                'emar-grid__row',
                row.order.status === 'on-hold' && 'emar-grid__row--held',
                !orderIsActive(row.order) && row.order.status !== 'on-hold' && 'emar-grid__row--blocked',
                row.doses.some((dose) => dose.state === 'late' || dose.state === 'missed') && 'emar-grid__row--late',
              )}
            >
              <div className="emar-grid__med" role="rowheader">
                <MedCell row={row} onGivePrn={() => onGivePrn(row)} />
              </div>
              <div className="emar-track" dir="ltr">
                {HOURS.map((hour) => {
                  const inHour = row.doses.filter((dose) => hourOf(dose.scheduledIso).hour === hour);
                  return (
                    <div
                      key={hour}
                      role="cell"
                      className={cx(
                        'emar-cell',
                        hour === NOW_HOUR && 'emar-cell--now',
                        running && hour <= NOW_HOUR && 'emar-cell--run',
                        running && hour > NOW_HOUR && 'emar-cell--run-planned',
                      )}
                    >
                      {inHour.map((dose) => (
                        <DoseChip key={dose.id} dose={dose} drug={row.med.drug} selected={dose.id === selectedId} onSelect={() => onSelect(dose)} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
