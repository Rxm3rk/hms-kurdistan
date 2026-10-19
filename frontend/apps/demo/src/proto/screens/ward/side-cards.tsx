/**
 * The cards under the board: patients awaiting a bed, pending transfers, today's bed activity on the ward,
 * and the bed rules (the state machine the board enforces).
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { BEDS, PRIORITY_LABEL, PRIORITY_TONE, findPatient, findStaff, getClinic, getWard, isToday } from '../../data/index.ts';
import type { BedState, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import type { ScreenId } from '../../shell/index.ts';
import { Badge, Button, Card, EmptyState, Icon, PatientInline, PatientName, StaffName, cx } from '../../ui/index.ts';
import { BED_REQUESTS, TRANSFER_REQUESTS, lookAlikesOf } from './board-data.ts';
import { BedStateBadge } from './bits.tsx';
import { occupantsOf } from './admit-dialog.tsx';
import { messages } from './messages.ts';
import { useReasonLabel } from './transfer-dialog.tsx';
import { liveBedOfPatient, type BoardEventKind, type BoardState } from './state.ts';

// ---------------------------------------------------------------------------------------------------------
// Awaiting a bed
// ---------------------------------------------------------------------------------------------------------

export function AwaitingCard({
  board,
  wardId,
  onAdmit,
  onOpenPatient,
}: {
  readonly board: BoardState;
  readonly wardId: WardId;
  readonly onAdmit: (requestId: string) => void;
  readonly onOpenPatient: (patientId: string, screen: ScreenId) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const occupants = occupantsOf(board).map((o) => o.patient);
  const waiting = BED_REQUESTS.filter((request) => board.waiting.includes(request.id)).toSorted(
    (a, b) => Number(b.requestedWardId === wardId) - Number(a.requestedWardId === wardId),
  );
  return (
    <Card
      title={t('awaitingTitle')}
      subtitle={t('awaitingSubtitle')}
      icon="users"
      actions={<Badge tone={waiting.length > 0 ? 'warning' : 'success'}>{waiting.length}</Badge>}
    >
      {waiting.length === 0 ? (
        <EmptyState compact icon="check-circle" title={t('awaitingEmpty')} />
      ) : (
        <ul className="ward-list">
          {waiting.map((request) => {
            const patient = findPatient(request.patientId);
            if (patient === undefined) {
              return null;
            }
            const requester = findStaff(request.requestedById);
            const similar = lookAlikesOf(patient, occupants);
            return (
              <li key={request.id} className={cx('ward-list__item', request.requestedWardId === wardId && 'ward-list__item--here')}>
                <div className="ward-list__main">
                  <PatientInline patient={patient} secondary />
                  <p className="ward-list__reason">{f.text(request.reason)}</p>
                  <div className="ward-list__tags">
                    <Badge tone={PRIORITY_TONE[request.priority]} size="sm">
                      {f.text(PRIORITY_LABEL[request.priority])}
                    </Badge>
                    <Badge tone="info" icon="bed" size="sm">
                      {t('forWard', { ward: f.text(getWard(request.requestedWardId).name) })}
                    </Badge>
                    <Badge size="sm" icon="stethoscope">
                      {t('fromClinic', { clinic: f.text(getClinic(request.fromClinicId).name) })}
                    </Badge>
                    {similar.length > 0 ? (
                      <Badge tone="warning" icon="users" size="sm">
                        {t('flagLookAlike')}
                      </Badge>
                    ) : null}
                    {patient.allergies.kind === 'not-assessed' ? (
                      <Badge tone="warning" icon="alert" size="sm">
                        {t('allergyNotAssessed')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="ward-list__meta">
                    <Icon name="clock" size="1em" />
                    <span>{t('waitingSince', { time: f.time(request.requestedIso), relative: f.relative(request.requestedIso) })}</span>
                    {requester === undefined ? null : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t.rich('requestedBy', { name: <StaffName member={requester} /> })}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="ward-list__actions">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="bed"
                    onPress={() => {
                      onAdmit(request.id);
                    }}
                  >
                    {t('actionAdmit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="chart"
                    onPress={() => {
                      onOpenPatient(patient.id, 'chart');
                    }}
                  >
                    {t('openChart')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Pending transfers
// ---------------------------------------------------------------------------------------------------------

export function TransfersCard({
  board,
  wardId,
  onChooseBed,
}: {
  readonly board: BoardState;
  readonly wardId: WardId;
  readonly onChooseBed: (requestId: string, fromBedId: string) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const reasonLabel = useReasonLabel();
  const pending = TRANSFER_REQUESTS.filter((request) => board.transfers.includes(request.id)).flatMap((request) => {
    const patient = findPatient(request.patientId);
    const bed = liveBedOfPatient(board, request.patientId);
    return patient === undefined || bed === undefined ? [] : [{ request, patient, bed }];
  });
  const sorted = pending.toSorted(
    (a, b) => Number(b.bed.wardId === wardId || b.request.toWardId === wardId) - Number(a.bed.wardId === wardId || a.request.toWardId === wardId),
  );
  return (
    <Card
      title={t('transfersTitle')}
      subtitle={t('transfersSubtitle')}
      icon="arrow-forward"
      actions={<Badge tone={sorted.length > 0 ? 'info' : 'success'}>{sorted.length}</Badge>}
    >
      {sorted.length === 0 ? (
        <EmptyState compact icon="check-circle" title={t('transfersEmpty')} />
      ) : (
        <ul className="ward-list">
          {sorted.map(({ request, patient, bed }) => {
            const requester = findStaff(request.requestedById);
            const here = bed.wardId === wardId || request.toWardId === wardId;
            return (
              <li key={request.id} className={cx('ward-list__item', here && 'ward-list__item--here')}>
                <div className="ward-list__main">
                  <PatientInline patient={patient} secondary />
                  <p className="ward-list__route">
                    <Icon name="arrow-forward" size="1em" />
                    <span>
                      {t.rich('transferRoute', {
                        from: (
                          <strong>
                            {f.text(getWard(bed.wardId).name)} <Bdi dir="ltr">{bed.id}</Bdi>
                          </strong>
                        ),
                        to: <strong>{f.text(getWard(request.toWardId).name)}</strong>,
                      })}
                    </span>
                  </p>
                  <p className="ward-list__reason">{f.text(request.note)}</p>
                  <div className="ward-list__tags">
                    <Badge tone={PRIORITY_TONE[request.priority]} size="sm">
                      {f.text(PRIORITY_LABEL[request.priority])}
                    </Badge>
                    <Badge size="sm">{reasonLabel(request.reason)}</Badge>
                  </div>
                  <p className="ward-list__meta">
                    <Icon name="clock" size="1em" />
                    <span>{t('waitingSince', { time: f.time(request.requestedIso), relative: f.relative(request.requestedIso) })}</span>
                    {requester === undefined ? null : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t.rich('requestedBy', { name: <StaffName member={requester} /> })}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="ward-list__actions">
                  <Button
                    size="sm"
                    icon="bed"
                    onPress={() => {
                      onChooseBed(request.id, bed.id);
                    }}
                  >
                    {t('actionChooseBed')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Today's bed activity
// ---------------------------------------------------------------------------------------------------------

interface ActivityRow {
  readonly key: string;
  readonly iso: string;
  readonly bedId: string;
  readonly text: ReactNode;
  readonly demo: boolean;
  readonly state: BedState;
}

const KIND_STATE: Readonly<Record<BoardEventKind, BedState>> = {
  admitted: 'occupied',
  'transferred-in': 'occupied',
  'transferred-out': 'cleaning',
  discharged: 'cleaning',
  cleaned: 'available',
  returned: 'cleaning',
  released: 'available',
};

export function ActivityCard({ board, wardId }: { readonly board: BoardState; readonly wardId: WardId }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const name = (patientId: string | null): ReactNode => {
    const patient = findPatient(patientId);
    return patient === undefined ? '' : <PatientName patient={patient} />;
  };

  const demoRows: ActivityRow[] = board.events
    .filter((event) => event.wardId === wardId)
    .map((event) => {
      const bed = <Bdi dir="ltr">{event.otherBedId ?? ''}</Bdi>;
      const text =
        event.kind === 'admitted'
          ? t.rich('evAdmitted', { patient: name(event.patientId) })
          : event.kind === 'transferred-in'
            ? t.rich('evTransferredIn', { patient: name(event.patientId), bed })
            : event.kind === 'transferred-out'
              ? t.rich('evTransferredOut', { patient: name(event.patientId), bed })
              : event.kind === 'discharged'
                ? t.rich('evDischarged', { patient: name(event.patientId) })
                : event.kind === 'cleaned'
                  ? t('evCleaned')
                  : event.kind === 'returned'
                    ? t('evReturned')
                    : t('evReleased');
      return { key: `demo-${String(event.seq)}`, iso: event.iso, bedId: event.bedId, text, demo: true, state: KIND_STATE[event.kind] };
    });

  const morningRows: ActivityRow[] = BEDS.filter((bed) => bed.wardId === wardId && isToday(bed.sinceIso))
    .map((bed) => {
      const text =
        bed.state === 'occupied'
          ? t.rich('evAdmitted', { patient: name(bed.patientId) })
          : bed.state === 'cleaning'
            ? t('evCleaning')
            : bed.state === 'reserved'
              ? t('evReserved')
              : bed.state === 'blocked'
                ? t('evBlocked')
                : t('evAvailable');
      return { key: `am-${bed.id}`, iso: bed.sinceIso, bedId: bed.id, text, demo: false, state: bed.state };
    })
    .toSorted((a, b) => b.iso.localeCompare(a.iso));

  const rows = [...demoRows, ...morningRows];

  return (
    <Card title={t('activityTitle')} subtitle={t('activitySubtitle')} icon="clock">
      {rows.length === 0 ? (
        <EmptyState compact icon="clock" title={t('activityEmpty')} />
      ) : (
        <ol className="ward-activity">
          {rows.map((row) => (
            <li key={row.key} className={cx('ward-activity__item', `ward-activity__item--${row.state}`)}>
              <span className="ward-activity__time">{f.time(row.iso)}</span>
              <span className="ward-activity__bed">
                <Bdi dir="ltr">{row.bedId}</Bdi>
              </span>
              <span className="ward-activity__text">
                {row.text}
                {row.demo ? (
                  <>
                    {' '}
                    <Badge size="sm" tone="info">
                      {t('demoAction')}
                    </Badge>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Bed rules (the state machine)
// ---------------------------------------------------------------------------------------------------------

export function RulesCard(): ReactNode {
  const t = useT(messages);
  const rules: readonly { readonly from: BedState; readonly to: BedState; readonly label: string }[] = [
    { from: 'available', to: 'occupied', label: t('ruleAdmit') },
    { from: 'occupied', to: 'cleaning', label: t('ruleDischarge') },
    { from: 'cleaning', to: 'available', label: t('ruleClean') },
    { from: 'blocked', to: 'cleaning', label: t('ruleReturn') },
    { from: 'reserved', to: 'available', label: t('ruleRelease') },
    { from: 'reserved', to: 'occupied', label: t('ruleArrive') },
  ];
  return (
    <Card title={t('rulesTitle')} subtitle={t('rulesSubtitle')} icon="shield">
      <ul className="ward-rules">
        {rules.map((rule) => (
          <li key={`${rule.from}-${rule.to}`} className="ward-rules__item">
            <span className="ward-rules__flow">
              <BedStateBadge state={rule.from} size="sm" />
              <span className="ward-rules__arrow">
                <Icon name="arrow-forward" size="1em" />
              </span>
              <BedStateBadge state={rule.to} size="sm" />
            </span>
            <span className="ward-rules__label">{rule.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
