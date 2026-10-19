/**
 * The administration panel of one dose (inline, not a modal, so the design system's co-sign dialog can open
 * from it): scan the wristband (simulated; a wrong-wristband demo raises a hard stop), scan the medicine
 * (simulated), the five rights turning green, the second-nurse co-signature for high-alert medicines, then
 * "given" or "not given" with a reason. The rules panel shows what the dose's state allows now.
 */
import { PatientIdentity } from '@hms/design-system';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEMO_NOW,
  DEMO_NOW_ISO,
  findStaff,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  ROLE_LABEL,
  ROUTE_LABEL,
  STAFF,
  type Patient,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { bannerModelOf, SignAction, useClinicalPatient, useRole, useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  Dialog,
  Icon,
  IconButton,
  LinkButton,
  Qty,
  Segmented,
  SelectField,
  StaffName,
  TextInput,
  cx,
  staffName,
} from '../../ui/index.ts';
import { STATE_ICON, STATE_KEY, StateChip } from './grid.tsx';
import { messages, type EmarMessageKey } from './messages.ts';
import {
  clockOf,
  clockPlus,
  lastPrnGiven,
  NOT_GIVEN_REASONS,
  orderIsActive,
  prnIntervalHours,
  wrongPatientFor,
  type DoseState,
  type GridDose,
  type LocalDoc,
  type MedRow,
} from './model.ts';

export interface AdminPanelProps {
  readonly row: MedRow;
  readonly dose: GridDose;
  readonly patient: Patient;
  readonly onClose: () => void;
  readonly onDocument: (doc: LocalDoc) => void;
}

type Check = boolean | null;

function CheckIcon({ ok }: { readonly ok: Check }): ReactNode {
  return (
    <span className={cx('emar-check', ok === true && 'emar-check--ok', ok === false && 'emar-check--fail')} aria-hidden="true">
      <Icon name={ok === true ? 'check' : ok === false ? 'x' : 'clock'} size="0.9em" />
    </span>
  );
}

export function AdminPanel({ row, dose, patient, onClose, onDocument }: AdminPanelProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { banner, actionsDisabled } = useClinicalPatient();
  const { roleId, user, setRole } = useRole();
  const href = useScreenHref();
  const rootRef = useRef<HTMLDivElement>(null);

  const { med, order } = row;
  const workflow = (dose.state === 'due' || dose.state === 'late' || dose.state === 'missed') && orderIsActive(order);

  const [wristband, setWristband] = useState<'none' | 'ok' | 'stopped'>('none');
  const [wrongOpen, setWrongOpen] = useState(false);
  const [medScan, setMedScan] = useState<'none' | 'ok' | 'wrong'>('none');
  const [routeOk, setRouteOk] = useState(false);
  const [witnessId, setWitnessId] = useState<string | null>(null);
  const [witnessSigned, setWitnessSigned] = useState(false);
  const [outcome, setOutcome] = useState<'given' | 'not-given'>(dose.state === 'missed' ? 'not-given' : 'given');
  const [lateReason, setLateReason] = useState('');
  const [prnReason, setPrnReason] = useState(med.prnReason === null ? '' : f.text(med.prnReason));
  const [comment, setComment] = useState('');
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  // --------------------------------------------------------------------------------------- the rules
  const high = med.highAlert;
  const orderOk = orderIsActive(order);
  const canRole = roleId === 'nurse' || roleId === 'physician';
  const interval = med.prn ? prnIntervalHours(med) : null;
  const last = med.prn ? lastPrnGiven(row) : null;
  const nextAllowed = last !== null && interval !== null ? clockPlus(last, interval * 60) : null;
  const prnOk = !med.prn || last === null || interval === null || Date.parse(last) + interval * 3600000 <= DEMO_NOW.getTime();
  const windowOk = med.prn ? prnOk : dose.state === 'due' || dose.state === 'late';
  const rights: readonly { readonly key: EmarMessageKey; readonly ok: Check; readonly detail: ReactNode }[] = [
    {
      key: 'rightPatient',
      ok: wristband === 'ok' ? true : wristband === 'stopped' ? false : null,
      detail: wristband === 'ok' ? <Code>{patient.mrn}</Code> : wristband === 'stopped' ? t('wrongTitle') : t('rightPending'),
    },
    { key: 'rightDrug', ok: medScan === 'none' ? null : true, detail: medScan === 'none' ? t('rightPending') : <Code>{med.drug}</Code> },
    {
      key: 'rightDose',
      ok: medScan === 'none' ? null : medScan === 'ok',
      detail: medScan === 'none' ? t('rightPending') : <Qty value={med.dose} unit={med.doseUnit} />,
    },
    { key: 'rightRoute', ok: routeOk ? true : null, detail: routeOk ? f.text(ROUTE_LABEL[med.route]) : t('rightPending') },
    {
      key: 'rightTime',
      ok: windowOk,
      detail: med.prn
        ? last === null
          ? t('prnFirst')
          : prnOk
            ? t('prnIntervalOk', { last: clockOf(last), next: nextAllowed ?? '' })
            : t('prnIntervalWait', { last: clockOf(last), next: nextAllowed ?? '' })
        : dose.state === 'late'
          ? t('timeLate')
          : dose.state === 'missed'
            ? t('timeMissed')
            : t('timeOk'),
    },
  ];
  const allRights = rights.every((right) => right.ok === true);
  const witnessOk = !high || witnessSigned;
  const lateNeedsReason = dose.state === 'late' && !med.prn;
  const reasonsOk = (!lateNeedsReason || lateReason.trim() !== '') && (!med.prn || prnReason.trim() !== '');
  const givenReady = orderOk && canRole && !actionsDisabled && allRights && witnessOk && reasonsOk;
  const notGivenReady = orderOk && canRole && !actionsDisabled && reasonId !== null;
  const scansOk = wristband === 'ok' && medScan === 'ok';

  const giveGuards: readonly { readonly key: EmarMessageKey; readonly ok: Check }[] = [
    { key: 'guardOrder', ok: orderOk },
    { key: med.prn ? 'guardPrn' : 'guardWindow', ok: windowOk },
    { key: 'guardWristband', ok: rights[0]?.ok ?? null },
    { key: 'guardMedicine', ok: medScan === 'none' ? null : medScan === 'ok' },
    { key: 'guardRoute', ok: routeOk ? true : null },
    ...(high ? [{ key: 'guardWitness' as const, ok: witnessSigned ? true : null }] : []),
    { key: 'guardRole', ok: canRole },
  ];
  const notGivenGuards: readonly { readonly key: EmarMessageKey; readonly ok: Check }[] = [
    { key: 'guardOrder', ok: orderOk },
    { key: 'guardReason', ok: reasonId === null ? null : true },
    { key: 'guardRole', ok: canRole },
  ];

  const witnesses = STAFF.filter((member) => member.role === 'nurse' && member.active && member.id !== user.id);
  const witness = findStaff(witnessId);
  const orderer = findStaff(order.orderedById);
  const other = wrongPatientFor(patient);
  const scheduledClock = clockOf(dose.scheduledIso);
  const titleDrug = <Code>{med.drug}</Code>;

  const submitDocumentation = (): void => {
    setAttempted(true);
    if (outcome === 'given') {
      if (!givenReady) {
        return;
      }
      onDocument({
        kind: 'given',
        iso: DEMO_NOW_ISO,
        byId: user.id,
        witnessId: high ? witnessId : null,
        reason: null,
        note: [prnReason.trim(), lateReason.trim(), comment.trim()].filter((part) => part !== '').join(' · '),
      });
      return;
    }
    const reason = NOT_GIVEN_REASONS.find((candidate) => candidate.id === reasonId);
    if (!notGivenReady || reason === undefined) {
      return;
    }
    onDocument({ kind: 'not-given', iso: DEMO_NOW_ISO, byId: user.id, witnessId: null, reason: reason.text, note: comment.trim() });
  };

  const ackWrong = (): void => {
    setWrongOpen(false);
    setWristband('stopped');
    setMedScan('none');
    setWitnessSigned(false);
  };

  const stepNumber = { wristband: 1, medicine: 2, witness: 3, document: high ? 4 : 3 };

  return (
    <div className="emar-panel" ref={rootRef}>
      <Card
        tone={dose.state === 'late' || dose.state === 'missed' ? 'warning' : workflow ? 'accent' : 'neutral'}
        icon="pill"
        title={workflow ? t.rich('panelGive', { drug: titleDrug }) : t.rich('panelView', { drug: titleDrug })}
        subtitle={dose.fresh ? t('panelPrnNow', { time: '09:30' }) : t('panelScheduled', { time: scheduledClock })}
        actions={<IconButton icon="x" label={t('closePanel')} onPress={onClose} />}
      >
        <div className="emar-panel__grid">
          <div className="emar-panel__main">
            <dl className="emar-facts">
              <div>
                <dt>{t('orderLabel')}</dt>
                <dd className="emar-facts__dose">
                  <Code>{med.drug}</Code> <Qty value={med.dose} unit={med.doseUnit} /> · {f.text(ROUTE_LABEL[med.route])} · {f.text(med.frequency)}
                </dd>
              </div>
              <div>
                <dt>{t('orderStatusLabel')}</dt>
                <dd>
                  <Badge tone={ORDER_STATUS_TONE[order.status]} size="sm">
                    {f.text(ORDER_STATUS_LABEL[order.status])}
                  </Badge>{' '}
                  <Code className="emar-muted">{order.id}</Code>
                </dd>
              </div>
              <div>
                <dt>{t('orderedBy')}</dt>
                <dd>{orderer === undefined ? null : <StaffName member={orderer} />}</dd>
              </div>
              {order.detail === null ? null : (
                <div>
                  <dt>{t('indication')}</dt>
                  <dd>{f.text(order.detail)}</dd>
                </div>
              )}
            </dl>

            {workflow ? (
              <>
                {!canRole ? (
                  <Callout
                    tone="info"
                    icon="lock"
                    actions={
                      <Button size="sm" variant="secondary" onPress={() => setRole('nurse')}>
                        {t('switchToNurse')}
                      </Button>
                    }
                  >
                    {t('roleCannot', { role: f.text(ROLE_LABEL[roleId]) })}
                  </Callout>
                ) : (
                  <p className="emar-muted emar-small">{t('documentingAs', { name: staffName(user, f.locale) })}</p>
                )}

                {/* Step 1: wristband */}
                <section className={cx('emar-step', wristband === 'ok' && 'emar-step--done', wristband === 'stopped' && 'emar-step--stop')}>
                  <h3 className="emar-step__title">
                    <CheckIcon ok={wristband === 'ok' ? true : wristband === 'stopped' ? false : null} />
                    <span>
                      {t('step', { n: stepNumber.wristband })} · {t('stepWristband')}
                    </span>
                    <Badge size="sm" tone="neutral" icon="scan">
                      {t('simulated')}
                    </Badge>
                  </h3>
                  <p className="emar-muted emar-small">{t('simulatedScanner')}</p>
                  <div className="emar-step__actions">
                    <Button variant={wristband === 'ok' ? 'secondary' : 'primary'} icon="scan" onPress={() => setWristband('ok')} isDisabled={!canRole || actionsDisabled}>
                      {t('scanWristband')}
                    </Button>
                    <Button variant="ghost" icon="alert" onPress={() => setWrongOpen(true)} isDisabled={!canRole || actionsDisabled}>
                      {t('scanWrongWristband')}
                    </Button>
                  </div>
                  {wristband === 'ok' ? (
                    <div className="emar-scan emar-scan--ok" role="status">
                      <Icon name="check-circle" />
                      <div>
                        <p className="emar-scan__title">{t('wristbandOk')}</p>
                        <p className="emar-scan__ids">
                          {t('scannedMrn')}: <Code>{patient.mrn}</Code> · {t('scannedDob')}: <Code>{patient.dob}</Code>
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {wristband === 'stopped' ? (
                    <div className="emar-scan emar-scan--stop" role="status">
                      <Icon name="alert" />
                      <p className="emar-scan__title">{t('wristbandStopped', { time: '09:30' })}</p>
                    </div>
                  ) : null}
                </section>

                {/* Step 2: medicine */}
                <section className={cx('emar-step', medScan === 'ok' && 'emar-step--done', medScan === 'wrong' && 'emar-step--stop')}>
                  <h3 className="emar-step__title">
                    <CheckIcon ok={medScan === 'ok' ? true : medScan === 'wrong' ? false : null} />
                    <span>
                      {t('step', { n: stepNumber.medicine })} · {t('stepMedicine')}
                    </span>
                    <Badge size="sm" tone="neutral" icon="scan">
                      {t('simulated')}
                    </Badge>
                  </h3>
                  <div className="emar-step__actions">
                    <Button
                      variant={medScan === 'ok' ? 'secondary' : 'primary'}
                      icon="scan"
                      isDisabled={wristband !== 'ok'}
                      onPress={() => setMedScan('ok')}
                    >
                      {t('scanMedicine')}
                    </Button>
                    <Button variant="ghost" icon="alert" isDisabled={wristband !== 'ok'} onPress={() => setMedScan('wrong')}>
                      {t('scanWrongStrength')}
                    </Button>
                  </div>
                  {wristband !== 'ok' ? <p className="emar-muted emar-small">{t('needWristbandFirst')}</p> : null}
                  {medScan === 'ok' ? (
                    <div className="emar-scan emar-scan--ok" role="status">
                      <Icon name="check-circle" />
                      <div>
                        <p className="emar-scan__title">
                          {t.rich('medScanned', {
                            product: (
                              <span className="emar-nowrap">
                                <Code>{med.drug}</Code> <Qty value={med.dose} unit={med.doseUnit} />
                              </span>
                            ),
                          })}
                        </p>
                        <p className="emar-scan__ids">
                          {t.rich('medLot', { lot: <Code>{`SYN-LOT-${order.id.slice(-4)}`}</Code>, expiry: <Code>03/2027</Code> })}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {medScan === 'wrong' ? (
                    <div className="emar-scan emar-scan--stop" role="status">
                      <Icon name="alert" />
                      <p className="emar-scan__title">
                        {t.rich('medWrongStrength', {
                          scanned: <Qty value={String(Number(med.dose) * 2)} unit={med.doseUnit} />,
                          ordered: <Qty value={med.dose} unit={med.doseUnit} />,
                        })}
                      </p>
                    </div>
                  ) : null}
                  <Checkbox isSelected={routeOk} onChange={setRouteOk} isDisabled={medScan !== 'ok'}>
                    {t('routeConfirm', { route: f.text(ROUTE_LABEL[med.route]) })}
                  </Checkbox>
                </section>

                {/* Step 3: second nurse (high-alert) */}
                {high ? (
                  <section className={cx('emar-step', witnessSigned && 'emar-step--done')}>
                    <h3 className="emar-step__title">
                      <CheckIcon ok={witnessSigned ? true : null} />
                      <span>
                        {t('step', { n: stepNumber.witness })} · {t('stepWitness')}
                      </span>
                      <Badge size="sm" tone="warning" icon="shield">
                        {t('highAlert')}
                      </Badge>
                    </h3>
                    <p className="emar-muted emar-small">{t('witnessHint')}</p>
                    {witnessSigned && witness !== undefined ? (
                      <div className="emar-scan emar-scan--ok" role="status">
                        <Icon name="check-circle" />
                        <p className="emar-scan__title">{t.rich('witnessDone', { name: <StaffName member={witness} /> })}</p>
                      </div>
                    ) : (
                      <div className="emar-step__actions emar-step__actions--end">
                        <SelectField
                          label={t('witnessLabel')}
                          options={witnesses.map((member) => ({ id: member.id, label: staffName(member, f.locale) }))}
                          selectedKey={witnessId}
                          onSelectionChange={setWitnessId}
                          isDisabled={!scansOk}
                        />
                        <SignAction
                          kind="cosign"
                          variant="secondary"
                          label={t('witnessCosign')}
                          isDisabled={!scansOk || witnessId === null || !canRole}
                          review={
                            <div className="emar-review">
                              <p className="emar-review__title">{t.rich('witnessReviewTitle', { drug: <Code>{med.drug}</Code> })}</p>
                              <p>
                                {t.rich('witnessReviewBody', {
                                  dose: <Qty value={med.dose} unit={med.doseUnit} />,
                                  route: f.text(ROUTE_LABEL[med.route]),
                                  time: '09:30',
                                })}
                              </p>
                              {witness === undefined ? null : <p>{t.rich('witnessReviewWitness', { name: <StaffName member={witness} /> })}</p>}
                            </div>
                          }
                          onSigned={() => setWitnessSigned(true)}
                        />
                      </div>
                    )}
                    {!scansOk ? <p className="emar-muted emar-small">{t('witnessNeedScans')}</p> : null}
                  </section>
                ) : null}

                {/* Document */}
                <section className="emar-step emar-step--document">
                  <h3 className="emar-step__title">
                    <CheckIcon ok={null} />
                    <span>
                      {t('step', { n: stepNumber.document })} · {t('stepDocument')}
                    </span>
                  </h3>
                  <Segmented
                    label={t('outcomeLabel')}
                    options={[
                      { id: 'given', label: t('outcomeGiven') },
                      { id: 'not-given', label: t('outcomeNotGiven') },
                    ]}
                    value={outcome}
                    onChange={(id) => setOutcome(id === 'not-given' ? 'not-given' : 'given')}
                  />
                  {outcome === 'given' ? (
                    <div className="emar-step__fields">
                      {med.prn ? <TextInput label={t('prnReason')} value={prnReason} onChange={setPrnReason} isRequired /> : null}
                      {lateNeedsReason ? <TextInput label={t('lateReason')} value={lateReason} onChange={setLateReason} isRequired /> : null}
                      {attempted && !reasonsOk ? (
                        <p className="emar-error" role="alert">
                          {t('reasonTextRequired')}
                        </p>
                      ) : null}
                      <TextInput label={t('commentLabel')} value={comment} onChange={setComment} />
                    </div>
                  ) : (
                    <div className="emar-step__fields">
                      <SelectField
                        label={t('notGivenReason')}
                        options={NOT_GIVEN_REASONS.map((reason) => ({ id: reason.id, label: f.text(reason.text) }))}
                        selectedKey={reasonId}
                        onSelectionChange={setReasonId}
                      />
                      {attempted && reasonId === null ? (
                        <p className="emar-error" role="alert">
                          {t('reasonRequired')}
                        </p>
                      ) : null}
                      <TextInput label={t('commentLabel')} value={comment} onChange={setComment} />
                    </div>
                  )}
                  <div className="emar-step__footer">
                    {outcome === 'given' && !givenReady ? <p className="emar-muted emar-small">{t('documentBlocked')}</p> : <span />}
                    <Button
                      variant={outcome === 'given' ? 'primary' : 'danger'}
                      size="lg"
                      icon={outcome === 'given' ? 'check' : 'x'}
                      isDisabled={outcome === 'given' ? !givenReady : !orderOk || !canRole || actionsDisabled}
                      onPress={submitDocumentation}
                    >
                      {outcome === 'given' ? t('documentGiven') : t('documentNotGiven')}
                    </Button>
                  </div>
                </section>
              </>
            ) : (
              <DoseInfo row={row} dose={dose} ordersHref={href('orders')} />
            )}
          </div>

          <aside className="emar-panel__side">
            {workflow ? (
              <section className="emar-rights" aria-labelledby="emar-rights-title">
                <h3 id="emar-rights-title" className="emar-side-title">
                  {t('rightsTitle')}
                </h3>
                <ul className="emar-rights__list">
                  {rights.map((right) => (
                    <li key={right.key} className={cx('emar-right', right.ok === true && 'emar-right--ok', right.ok === false && 'emar-right--fail')}>
                      <CheckIcon ok={right.ok} />
                      <span className="emar-right__label">{t(right.key)}</span>
                      <span className="emar-right__detail">{right.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <DoseMachine
              state={dose.state}
              {...(workflow
                ? {
                    give: { guards: giveGuards, ok: givenReady },
                    notGiven: { guards: notGivenGuards, ok: notGivenReady },
                  }
                : {})}
              orderOk={orderOk}
            />
          </aside>
        </div>
      </Card>

      <Dialog
        isOpen={wrongOpen}
        onOpenChange={(open) => {
          if (!open) {
            ackWrong();
          }
        }}
        role="alertdialog"
        size="lg"
        title={
          <span className="emar-stop-title">
            <Icon name="alert" />
            <span>{t('wrongTitle')}</span>
          </span>
        }
        actions={
          <Button variant="primary" icon="scan" onPress={ackWrong}>
            {t('wrongAck')}
          </Button>
        }
      >
        <div className="emar-stop">
          <Callout tone="danger" title={t('wrongLead')} />
          <div className="emar-compare">
            <section className="emar-compare__side emar-compare__side--wrong">
              <h3 className="emar-compare__title">
                <Icon name="x" /> {t('wrongScanned')}
              </h3>
              <PatientIdentity model={bannerModelOf(other.id)} />
            </section>
            <section className="emar-compare__side">
              <h3 className="emar-compare__title">
                <Icon name="user" /> {t('wrongOpen')}
              </h3>
              <PatientIdentity model={banner} />
            </section>
          </div>
          <p>{t('wrongAdvice')}</p>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Read-only view of a dose that cannot be given now
// ---------------------------------------------------------------------------------------------------------

function DoseInfo({ row, dose, ordersHref }: { readonly row: MedRow; readonly dose: GridDose; readonly ordersHref: string }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { order } = row;
  const doc = dose.doc;
  const by = findStaff(doc?.byId ?? dose.mar?.givenById ?? null);
  const witness = findStaff(doc?.witnessId ?? dose.mar?.witnessId ?? null);
  const note = dose.mar?.note ?? null;
  const name = by === undefined ? '' : staffName(by, f.locale);
  const lines: ReactNode[] = [];

  switch (dose.state) {
    case 'given':
      lines.push(<p key="given">{t('infoGiven', { time: clockOf(doc?.iso ?? dose.mar?.givenIso ?? dose.scheduledIso), name })}</p>);
      break;
    case 'not-given':
      lines.push(<p key="ng">{t('infoNotGiven', { time: clockOf(doc?.iso ?? dose.scheduledIso), name })}</p>);
      if (doc?.reason !== null && doc?.reason !== undefined) {
        lines.push(<p key="reason">{t('infoReason', { reason: f.text(doc.reason) })}</p>);
      }
      break;
    case 'held':
      if (by !== undefined) {
        lines.push(<p key="held">{t('infoHeld', { name })}</p>);
      }
      lines.push(
        <Callout key="rule" tone="warning" icon="minus">
          {t('blockedHeld')}
        </Callout>,
      );
      break;
    case 'running':
      lines.push(
        <Callout key="run" tone="info" icon="activity">
          {t('infoRunning', { time: f.dateTime(dose.mar?.givenIso ?? dose.scheduledIso), name })}
        </Callout>,
      );
      break;
    case 'blocked':
      lines.push(
        <Callout key="blocked" tone="danger" icon="lock" actions={<LinkButton href={ordersHref} size="sm" icon="clipboard">{t('goOrders')}</LinkButton>}>
          {order.status === 'pending-signature' || order.status === 'draft' ? t('blockedPending') : t('blockedStopped')}
        </Callout>,
      );
      for (const alert of order.alerts) {
        lines.push(
          <Callout key={alert.text.en} tone={alert.tone}>
            {f.text(alert.text)}
          </Callout>,
        );
      }
      break;
    case 'scheduled':
      lines.push(
        <Callout key="sched" tone="neutral" icon="clock">
          {t('infoScheduled', { time: clockPlus(dose.scheduledIso, -30) })}
        </Callout>,
      );
      break;
    default:
      if (!orderIsActive(order)) {
        lines.push(
          <Callout key="inactive" tone="warning">
            {order.status === 'on-hold' ? t('blockedHeld') : t('blockedPending')}
          </Callout>,
        );
      }
      break;
  }
  if (witness !== undefined && (dose.state === 'given' || dose.state === 'running')) {
    lines.push(<p key="witness">{t('infoWitness', { name: staffName(witness, f.locale) })}</p>);
  }
  if (note !== null) {
    lines.push(<p key="note">{t('infoNote', { note: f.text(note) })}</p>);
  }
  if (doc !== null && doc.note !== '') {
    lines.push(
      <p key="docnote">
        {t('infoNote', { note: '' })}
        <bdi>{doc.note}</bdi>
      </p>,
    );
  }
  if (dose.state === 'given' || dose.state === 'not-given') {
    lines.push(
      <p key="corr" className="emar-muted emar-small">
        {t('infoCorrection')}
      </p>,
    );
  }
  if (doc !== null) {
    lines.push(
      <p key="demo" className="emar-muted emar-small">
        {t('demoOnly')}
      </p>,
    );
  }
  return (
    <div className="emar-info">
      <StateChip state={dose.state} />
      {lines}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// The rules: dose states and what is allowed now
// ---------------------------------------------------------------------------------------------------------

interface ActionRule {
  readonly guards: readonly { readonly key: EmarMessageKey; readonly ok: Check }[];
  readonly ok: boolean;
}

const FLOW: readonly DoseState[] = ['scheduled', 'due', 'late', 'missed'];
const OUTCOMES: readonly DoseState[] = ['given', 'not-given'];
const SIDE: readonly DoseState[] = ['held', 'blocked', 'running'];

function DoseMachine({ state, give, notGiven, orderOk }: { readonly state: DoseState; readonly give?: ActionRule; readonly notGiven?: ActionRule; readonly orderOk: boolean }): ReactNode {
  const t = useT(messages);
  const pill = (candidate: DoseState): ReactNode => (
    <li key={candidate} className={cx('emar-flow__item', candidate === state && 'emar-flow__item--here')} {...(candidate === state ? { 'aria-current': 'step' as const } : {})}>
      <span className={`emar-chip emar-chip--${candidate} emar-chip--static`} aria-hidden="true">
        <Icon name={STATE_ICON[candidate]} size="0.9em" />
      </span>
      <span>{t(STATE_KEY[candidate])}</span>
      {candidate === state ? <span className="emar-flow__here">{t('machineHere')}</span> : null}
    </li>
  );
  const rule = (label: EmarMessageKey, action: ActionRule): ReactNode => (
    <div className={cx('emar-rule', action.ok ? 'emar-rule--ok' : 'emar-rule--blocked')}>
      <p className="emar-rule__head">
        <span>{t(label)}</span>
        <Badge size="sm" tone={action.ok ? 'success' : 'neutral'} icon={action.ok ? 'check' : 'lock'}>
          {action.ok ? t('allowed') : t('blocked')}
        </Badge>
      </p>
      <ul className="emar-rule__guards">
        {action.guards.map((guard) => (
          <li key={guard.key} className={cx('emar-guard', guard.ok === true && 'emar-guard--ok', guard.ok === false && 'emar-guard--fail')}>
            <CheckIcon ok={guard.ok} />
            <span>{t(guard.key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <section className="emar-machine" aria-labelledby="emar-machine-title">
      <h3 id="emar-machine-title" className="emar-side-title">
        {t('machineTitle')}
      </h3>
      <p className="emar-muted emar-small">{t('machineFlow')}</p>
      <ol className="emar-flow">
        {FLOW.map((candidate, index) => (
          <FlowStep key={candidate} last={index === FLOW.length - 1}>
            {pill(candidate)}
          </FlowStep>
        ))}
      </ol>
      <ul className="emar-flow emar-flow--outcomes">{OUTCOMES.map(pill)}</ul>
      <ul className="emar-flow emar-flow--side">{SIDE.map(pill)}</ul>
      {give === undefined ? (
        state === 'given' || state === 'not-given' || state === 'running' ? null : (
          <div className="emar-rule emar-rule--blocked">
            <p className="emar-rule__head">
              <span>{t('actionGive')}</span>
              <Badge size="sm" tone="neutral" icon="lock">
                {t('blocked')}
              </Badge>
            </p>
            <ul className="emar-rule__guards">
              <li className={cx('emar-guard', orderOk ? 'emar-guard--ok' : 'emar-guard--fail')}>
                <CheckIcon ok={orderOk} />
                <span>{t('guardOrder')}</span>
              </li>
              <li className={cx('emar-guard', state === 'scheduled' ? 'emar-guard--fail' : orderOk ? 'emar-guard--ok' : '')}>
                <CheckIcon ok={state === 'scheduled' ? false : orderOk ? true : null} />
                <span>{t('guardWindow')}</span>
              </li>
            </ul>
          </div>
        )
      ) : (
        rule('actionGive', give)
      )}
      {notGiven === undefined ? null : rule('actionNotGiven', notGiven)}
    </section>
  );
}

function FlowStep({ children, last }: { readonly children: ReactNode; readonly last: boolean }): ReactNode {
  return (
    <>
      {children}
      {last ? null : (
        <li className="emar-flow__arrow" aria-hidden="true">
          <Icon name="chevron-forward" size="0.9em" />
        </li>
      )}
    </>
  );
}
