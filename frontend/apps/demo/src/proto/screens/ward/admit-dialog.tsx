/**
 * Admit to a bed: choose a patient from the "awaiting a bed" list, then an available bed. Look-alike names
 * on the wards and allergies not assessed are called out before the admission is confirmed.
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { PRIORITY_LABEL, PRIORITY_TONE, WARDS, findPatient, getClinic, getWard } from '../../data/index.ts';
import type { Patient, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Dialog, EmptyState, Icon, PatientInline, SelectField, Stack } from '../../ui/index.ts';
import { BED_REQUESTS, lookAlikesOf, type BedRequest } from './board-data.ts';
import { BedChoice, useBedOptions } from './bed-choice.tsx';
import { messages } from './messages.ts';
import { liveBedsOfWard, wardCounts, type BoardState, type LiveBed } from './state.ts';

export interface AdmitDialogProps {
  readonly board: BoardState;
  readonly initialRequestId: string | null;
  readonly initialBedId: string | null;
  readonly initialWardId: WardId;
  readonly onClose: () => void;
  readonly onAdmit: (patientId: string, bedId: string, requestId: string) => void;
}

/** Occupants of every bed on the board. */
export function occupantsOf(board: BoardState): readonly { readonly bed: LiveBed; readonly patient: Patient }[] {
  return Object.values(board.beds).flatMap((bed) => {
    const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;
    return patient === undefined ? [] : [{ bed, patient }];
  });
}

export function LookAlikeCallout({ patient, board }: { readonly patient: Patient; readonly board: BoardState }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const occupants = occupantsOf(board);
  const similar = lookAlikesOf(
    patient,
    occupants.map((o) => o.patient),
  );
  if (similar.length === 0) {
    return null;
  }
  return (
    <>
      {similar.map((other) => {
        const where = occupants.find((o) => o.patient.id === other.id);
        if (where === undefined) {
          return null;
        }
        return (
          <Callout key={other.id} tone="warning" icon="users">
            <Stack gap="xs">
              <span>{t.rich('lookAlikeWarning', { ward: f.text(getWard(where.bed.wardId).name), bed: <Bdi dir="ltr">{where.bed.id}</Bdi> })}</span>
              <PatientInline patient={other} secondary />
            </Stack>
          </Callout>
        );
      })}
    </>
  );
}

function RequestOption({ request, board }: { readonly request: BedRequest; readonly board: BoardState }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const patient = findPatient(request.patientId);
  if (patient === undefined) {
    return null;
  }
  const similar = lookAlikesOf(
    patient,
    occupantsOf(board).map((o) => o.patient),
  );
  return (
    <Radio value={request.id} className="ward-choice__option ward-choice__option--patient">
      <span className="ward-choice__head">
        <span className="ward-choice__mark" aria-hidden="true">
          <Icon name="check" size="0.85em" />
        </span>
        <PatientInline patient={patient} secondary />
      </span>
      <span className="ward-choice__line">{f.text(request.reason)}</span>
      <span className="ward-choice__tags">
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
      </span>
    </Radio>
  );
}

export function AdmitDialog({ board, initialRequestId, initialBedId, initialWardId, onClose, onAdmit }: AdmitDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const bedOptions = useBedOptions();
  const waiting = BED_REQUESTS.filter((request) => board.waiting.includes(request.id));
  const firstRequest = waiting.find((request) => request.id === initialRequestId) ?? (waiting.length === 1 ? waiting[0] : undefined);
  const [requestId, setRequestId] = useState<string | null>(firstRequest?.id ?? null);
  const [wardId, setWardId] = useState<WardId>(initialBedId === null ? (firstRequest?.requestedWardId ?? initialWardId) : initialWardId);
  const [bedId, setBedId] = useState<string | null>(initialBedId);

  const request = waiting.find((candidate) => candidate.id === requestId);
  const patient = request === undefined ? undefined : findPatient(request.patientId);
  const choices = bedOptions(liveBedsOfWard(board, wardId), patient, wardId);
  const chosen = choices.options.find((option) => option.bed.id === bedId && option.selectable);

  const wardOptions = WARDS.map((ward) => ({
    id: ward.id,
    label: `${f.text(ward.name)} · ${t('wardFree', { count: wardCounts(board, ward.id).available })}`,
  }));

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('admitTitle')}
      subtitle={t('admitSubtitle')}
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="bed"
            isDisabled={request === undefined || chosen === undefined}
            onPress={() => {
              if (request !== undefined && chosen !== undefined) {
                onAdmit(request.patientId, chosen.bed.id, request.id);
              }
            }}
          >
            {chosen === undefined ? t('admitConfirmEmpty') : t('admitConfirm', { bed: chosen.bed.id })}
          </Button>
        </>
      }
    >
      <div className="ward-dialog">
        {waiting.length === 0 ? (
          <EmptyState compact icon="users" title={t('awaitingEmpty')} />
        ) : (
          <RadioGroup
            className="ward-choice"
            value={requestId}
            onChange={(id) => {
              setRequestId(id);
              const next = waiting.find((candidate) => candidate.id === id);
              if (next !== undefined && initialBedId === null) {
                setWardId(next.requestedWardId);
                setBedId(null);
              }
            }}
          >
            <Label className="ui-field__label">{t('admitPatientLabel')}</Label>
            <div className="ward-choice__list">
              {waiting.map((candidate) => (
                <RequestOption key={candidate.id} request={candidate} board={board} />
              ))}
            </div>
          </RadioGroup>
        )}
        {patient === undefined ? null : (
          <>
            <LookAlikeCallout patient={patient} board={board} />
            {patient.allergies.kind === 'not-assessed' ? (
              <Callout tone="warning" title={t('allergyNotAssessed')}>
                {t('notAssessedWarning')}
              </Callout>
            ) : null}
          </>
        )}
        <SelectField
          label={t('admitWardLabel')}
          options={wardOptions}
          selectedKey={wardId}
          onSelectionChange={(id) => {
            const next = WARDS.find((ward) => ward.id === id);
            if (next !== undefined) {
              setWardId(next.id);
              setBedId(null);
            }
          }}
        />
        {request !== undefined && request.requestedWardId !== wardId ? (
          <Callout tone="info">{t('requestedWardDiffers', { ward: f.text(getWard(request.requestedWardId).name) })}</Callout>
        ) : null}
        <BedChoice
          wardId={wardId}
          choices={choices}
          value={bedId}
          onChange={(id) => {
            setBedId(id);
          }}
        />
      </div>
    </Dialog>
  );
}
