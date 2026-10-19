/**
 * "Acknowledge critical result", step 1: the read-back record (who in the clinical team received the lab's
 * call, when, and that the value was read back and confirmed with two patient identifiers), plus optional
 * immediate actions. Step 2 is the design system's sign dialog, opened by the screen once this dialog has
 * released the window's modal slot. Also the review shown inside the sign dialog.
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, RESULT_FLAG_LABEL, STAFF, findStaff, type LabResult, type Patient, type StaffMember } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Callout, Checkbox, Code, Dialog, KeyValueList, PatientInline, PatientName, Qty, SelectField, StaffName, TextInput, staffName } from '../../ui/index.ts';
import { ACK_ACTION_IDS, clockTime, type AckActionId } from './lab-data.ts';
import { RangeText, unitText } from './lab-parts.tsx';
import { messages } from './messages.ts';

/** The laboratory scientist who phoned (the lab's call log). */
export const LAB_CALLER_ID = 'SYN-STF-011';
/** When the lab phoned the ward (the lab's call log, see the specimen note). */
export const LAB_CALL_TIME = '08:12';

export const ACK_ACTION_KEY = {
  ecg: 'actionEcg',
  repeat: 'actionRepeat',
  treatment: 'actionTreatment',
  senior: 'actionSenior',
} as const satisfies Record<AckActionId, string>;

export interface AckDraft {
  readonly callerId: string;
  readonly informedId: string;
  readonly informedAt: string;
  readonly actions: readonly AckActionId[];
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

export interface AckDialogProps {
  readonly result: LabResult;
  readonly patient: Patient;
  readonly user: StaffMember;
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onContinue: (draft: AckDraft) => void;
}

export function AckDialog({ result, patient, user, isOpen, onCancel, onContinue }: AckDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const clinicians = STAFF.filter((member) => member.active && (member.role === 'physician' || member.role === 'nurse'));
  const [informedId, setInformedId] = useState<string>(
    clinicians.some((member) => member.id === user.id) ? user.id : 'SYN-STF-002',
  );
  const [informedAt, setInformedAt] = useState(LAB_CALL_TIME);
  const [readBack, setReadBack] = useState(false);
  const [actions, setActions] = useState<ReadonlySet<AckActionId>>(new Set(['repeat']));
  const caller = findStaff(LAB_CALLER_ID);
  const from = clockTime(result.resultedIso);
  const to = clockTime(DEMO_NOW_ISO);

  let timeError: string | null = null;
  if (!TIME_PATTERN.test(informedAt)) {
    timeError = t('timeInvalid');
  } else if (informedAt < from || informedAt > to) {
    timeError = t('timeRange', { from, to });
  }
  const ready = readBack && timeError === null;

  const toggle = (id: AckActionId, on: boolean): void => {
    setActions((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      title={t('ackTitle')}
      subtitle={t('ackSubtitle')}
      size="lg"
      actions={
        <>
          <Button variant="secondary" onPress={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="pen"
            isDisabled={!ready}
            onPress={() => {
              onContinue({ callerId: LAB_CALLER_ID, informedId, informedAt, actions: ACK_ACTION_IDS.filter((id) => actions.has(id)) });
            }}
          >
            {t('continueToSign')}
          </Button>
        </>
      }
    >
      <div className="lab-ack">
        <div className="lab-ack__summary">
          <div className="lab-ack__value">
            <span className="lab-ack__test">{f.text(result.analyte)}</span>
            <span className="lab-critical__number">
              <Qty value={result.value} unit={result.unit} />
            </span>
            <span className="lab-flag-text">{f.text(RESULT_FLAG_LABEL[result.flag])}</span>
          </div>
          <div className="lab-ack__patient">
            <PatientInline patient={patient} secondary />
          </div>
          <p className="lab-muted">
            {t('referenceRange')}: <RangeText refLow={result.refLow} refHigh={result.refHigh} /> {unitText(result.unit)} · {t('resultedAt')}{' '}
            <Code>{f.time(result.resultedIso)}</Code> · <Code>{result.specimenId}</Code>
          </p>
        </div>

        <KeyValueList
          columns={1}
          items={[
            {
              id: 'caller',
              label: t('calledBy'),
              value: (
                <span>
                  {caller === undefined ? null : <StaffName member={caller} />} · {caller === undefined ? '' : f.text(caller.title)} ·{' '}
                  {t('callLogged', { time: LAB_CALL_TIME })}
                </span>
              ),
            },
          ]}
        />

        <div className="lab-ack__fields">
          <SelectField
            label={t('informedWho')}
            options={clinicians.map((member) => ({ id: member.id, label: `${staffName(member, f.locale)} · ${f.text(member.title)}` }))}
            selectedKey={informedId}
            onSelectionChange={setInformedId}
          />
          <TextInput
            label={t('informedWhen')}
            value={informedAt}
            onChange={setInformedAt}
            dir="ltr"
            inputMode="numeric"
            description={t('timeHint', { from, to })}
            isRequired
          />
        </div>
        {timeError === null ? null : (
          <Callout tone="warning" role="status">
            {timeError}
          </Callout>
        )}

        <div className={readBack ? 'lab-ack__readback lab-ack__readback--done' : 'lab-ack__readback'}>
          <Checkbox isSelected={readBack} onChange={setReadBack}>
            {t.rich('readBackCheck', {
              test: f.text(result.analyte),
              value: <Qty value={result.value} unit={result.unit} />,
              name: <PatientName patient={patient} />,
              mrn: <Bdi dir="ltr">{patient.mrn}</Bdi>,
            })}
          </Checkbox>
        </div>

        <fieldset className="lab-fieldset">
          <legend className="lab-fieldset__legend">{t('immediateActionsOptional')}</legend>
          <div className="lab-fieldset__options">
            {ACK_ACTION_IDS.map((id) => (
              <Checkbox
                key={id}
                isSelected={actions.has(id)}
                onChange={(on) => {
                  toggle(id, on);
                }}
              >
                {t(ACK_ACTION_KEY[id])}
              </Checkbox>
            ))}
          </div>
        </fieldset>

        <Callout tone="info" icon="pen">
          {t('ackSignNote')}
        </Callout>
      </div>
    </Dialog>
  );
}

/** What the sign dialog shows for review. */
export function AckReview({ result, patient, draft }: { readonly result: LabResult; readonly patient: Patient; readonly draft: AckDraft }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const caller = findStaff(draft.callerId);
  const informed = findStaff(draft.informedId);
  return (
    <div className="lab-review">
      <p className="lab-review__title">{t('reviewTitle')}</p>
      <KeyValueList
        columns={1}
        items={[
          { id: 'patient', label: t('patient'), value: <PatientInline patient={patient} /> },
          {
            id: 'result',
            label: t('result'),
            value: (
              <span>
                {f.text(result.analyte)} <Qty value={result.value} unit={result.unit} /> · {f.text(RESULT_FLAG_LABEL[result.flag])} · {t('referenceRange')}{' '}
                <RangeText refLow={result.refLow} refHigh={result.refHigh} />
              </span>
            ),
          },
          {
            id: 'readback',
            label: t('readBack'),
            value: t.rich('readBackDone', {
              caller: caller === undefined ? '' : <StaffName member={caller} />,
              informed: informed === undefined ? '' : <StaffName member={informed} />,
              time: <Code>{draft.informedAt}</Code>,
            }),
          },
          {
            id: 'actions',
            label: t('immediateActions'),
            value: draft.actions.length === 0 ? t('noneRecorded') : draft.actions.map((id) => t(ACK_ACTION_KEY[id])).join(' · '),
          },
        ]}
      />
    </div>
  );
}
