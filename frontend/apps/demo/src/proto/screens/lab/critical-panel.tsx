/**
 * The critical result panel above the lab tabs: the value large, in the danger tone with icon and text; how
 * long it has waited; "Acknowledge critical result" (a clinician's signature plus the read-back record).
 * Once acknowledged in this session it shows who signed, who was informed by the lab and when.
 */
import { useId, type ReactNode } from 'react';
import { RESULT_FLAG_LABEL, findStaff, minutesFromNow, specimensOf as dataSpecimensOf, type LabResult } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useScreenHref } from '../../shell/index.ts';
import { Badge, Button, Code, Icon, KeyValueList, Qty, StaffName, TextLink, type KeyValueItem } from '../../ui/index.ts';
import { ACK_ACTION_IDS, clockTime, dayMonth } from './lab-data.ts';
import { RangeText, unitText } from './lab-parts.tsx';
import type { CriticalAck } from './lab-store.ts';
import { ACK_ACTION_KEY } from './ack-dialog.tsx';
import { messages } from './messages.ts';

const ACK_TARGET_MIN = 30;

export interface CriticalPanelProps {
  readonly result: LabResult;
  readonly ack: CriticalAck | undefined;
  readonly onAcknowledge: () => void;
  /** Why the current user cannot acknowledge, or null. */
  readonly blockedReason: string | null;
  /** Offered when the role, not the banner, blocks: switch the demo role to the physician. */
  readonly onActAsPhysician: (() => void) | null;
}

export function CriticalPanel({ result, ack, onAcknowledge, blockedReason, onActAsPhysician }: CriticalPanelProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const titleId = useId();
  const test = f.text(result.analyte);
  const unit = unitText(result.unit);
  const previous = result.history[result.history.length - 1];
  const verifier = findStaff(dataSpecimensOf(result.patientId).find((s) => s.id === result.specimenId)?.verifiedById);
  const waited = -minutesFromNow(result.resultedIso);
  const value = <Qty value={result.value} unit={result.unit} />;

  const facts: KeyValueItem[] = [
    { id: 'range', label: t('referenceRange'), value: <span><RangeText refLow={result.refLow} refHigh={result.refHigh} /> {unit}</span> },
    {
      id: 'previous',
      label: t('previousValue'),
      value:
        previous === undefined ? (
          <span className="lab-muted">–</span>
        ) : (
          <span>
            <Qty value={previous.value} unit={result.unit} /> <span className="lab-muted">({f.dateTime(previous.iso)})</span>
          </span>
        ),
    },
    {
      id: 'resulted',
      label: t('resultedAt'),
      value: (
        <span>
          {f.time(result.resultedIso)}
          {verifier === undefined ? null : <> · {t.rich('verifiedBy', { name: <StaffName member={verifier} /> })}</>}
        </span>
      ),
    },
    { id: 'specimen', label: t('specimenId'), value: <Code>{result.specimenId}</Code> },
  ];

  if (ack !== undefined) {
    const signer = findStaff(ack.acknowledgedById);
    const caller = findStaff(ack.callerId);
    const informed = findStaff(ack.informedId);
    const ackFacts: KeyValueItem[] = [
      ...facts.slice(0, 1),
      {
        id: 'readback',
        label: t('readBack'),
        value: (
          <span>
            {t.rich('readBackDone', {
              caller: caller === undefined ? '' : <StaffName member={caller} />,
              informed: informed === undefined ? '' : <StaffName member={informed} />,
              time: <Code>{ack.informedAt}</Code>,
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        label: t('immediateActions'),
        value:
          ack.actions.length === 0 ? (
            <span className="lab-muted">{t('noneRecorded')}</span>
          ) : (
            <ul className="lab-plain-list">
              {ACK_ACTION_IDS.filter((id) => ack.actions.includes(id)).map((id) => (
                <li key={id}>
                  <Icon name="check" size="1em" /> {t(ACK_ACTION_KEY[id])}
                </li>
              ))}
            </ul>
          ),
      },
      facts[3] ?? { id: 'none', label: '', value: null },
    ];
    return (
      <section className="lab-critical lab-critical--done" aria-labelledby={titleId}>
        <div className="lab-critical__head">
          <Icon name="check-circle" size="1.75rem" className="lab-critical__icon" />
          <div className="lab-critical__titles">
            <h2 id={titleId} className="lab-critical__title">
              {t('criticalAckTitle')}
            </h2>
            <p className="lab-critical__lead">
              {t.rich('criticalAckLead', {
                test,
                value,
                name: signer === undefined ? '' : <StaffName member={signer} />,
                time: <Code>{f.time(ack.acknowledgedIso)}</Code>,
              })}
            </p>
          </div>
          <div className="lab-critical__value lab-critical__value--small">
            <span className="lab-critical__number">{value}</span>
            <Badge tone="danger" icon="alert" size="sm">
              {f.text(RESULT_FLAG_LABEL[result.flag])}
            </Badge>
          </div>
        </div>
        <KeyValueList items={ackFacts} columns={2} />
      </section>
    );
  }

  return (
    <section className="lab-critical" aria-labelledby={titleId}>
      <div className="lab-critical__head">
        <Icon name="alert" size="1.75rem" className="lab-critical__icon" />
        <div className="lab-critical__titles">
          <h2 id={titleId} className="lab-critical__title">
            {t('criticalTitle')}
          </h2>
          <p className="lab-critical__lead" role="alert">
            {t.rich('criticalLead', { test, value })}
          </p>
        </div>
        <div className="lab-critical__value">
          <span className="lab-critical__test">{test}</span>
          <span className="lab-critical__number">{value}</span>
          <Badge tone="danger" strong icon="alert">
            {f.text(RESULT_FLAG_LABEL[result.flag])}
          </Badge>
        </div>
      </div>
      <div className="lab-critical__facts">
        <KeyValueList items={facts} columns={2} />
        <div className="lab-critical__wait">
          <Icon name="clock" />
          <span>{t('waitingFor', { minutes: waited })}</span>
          {waited > ACK_TARGET_MIN ? (
            <Badge tone="warning" icon="alert" size="sm">
              {t('overdueAck', { target: ACK_TARGET_MIN })}
            </Badge>
          ) : null}
          {previous === undefined ? null : (
            <span className="lab-muted">
              {t('trendLine', { from: previous.value, to: result.value ?? '', day: dayMonth(previous.iso), time: clockTime(previous.iso) })}
            </span>
          )}
        </div>
      </div>
      <div className="lab-critical__actions">
        <Button variant="danger" size="lg" icon="check-circle" onPress={onAcknowledge} isDisabled={blockedReason !== null}>
          {t('acknowledge')}
        </Button>
        <TextLink href={href('emar', { patient: result.patientId })}>{t('openMedication')}</TextLink>
        {blockedReason === null ? null : (
          <span className="lab-critical__blocked">
            <Icon name="lock" size="1em" /> {blockedReason}
          </span>
        )}
        {onActAsPhysician === null ? null : (
          <Button variant="ghost" size="sm" icon="user" onPress={onActAsPhysician}>
            {t('actAsPhysician')}
          </Button>
        )}
      </div>
    </section>
  );
}
