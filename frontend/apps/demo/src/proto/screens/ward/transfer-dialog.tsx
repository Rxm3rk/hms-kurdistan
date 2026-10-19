/**
 * Transfer a patient to another bed (same ward or another ward). The old bed goes to cleaning; the new bed
 * must be available (and an isolation room for airborne precautions).
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import { WARDS, findPatient, getWard } from '../../data/index.ts';
import type { WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Callout, Dialog, PatientInline, SelectField } from '../../ui/index.ts';
import { TRANSFER_REASONS, TRANSFER_REQUESTS, type TransferReason } from './board-data.ts';
import { BedChoice, useBedOptions } from './bed-choice.tsx';
import { IsolationBadge, NameBdi } from './bits.tsx';
import { messages } from './messages.ts';
import { liveBedsOfWard, wardCounts, type BoardState } from './state.ts';

export function useReasonLabel(): (reason: TransferReason) => string {
  const t = useT(messages);
  return (reason) => {
    switch (reason) {
      case 'step-down':
        return t('reasonStepDown');
      case 'step-up':
        return t('reasonStepUp');
      case 'specialty':
        return t('reasonSpecialty');
      case 'isolation':
        return t('reasonIsolation');
      case 'other':
        return t('reasonOther');
    }
  };
}

export interface TransferDialogProps {
  readonly board: BoardState;
  readonly fromBedId: string;
  readonly requestId: string | null;
  readonly onClose: () => void;
  readonly onTransfer: (fromBedId: string, toBedId: string, requestId: string | null, reason: TransferReason) => void;
}

export function TransferDialog({ board, fromBedId, requestId, onClose, onTransfer }: TransferDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const reasonLabel = useReasonLabel();
  const bedOptions = useBedOptions();
  const from = board.beds[fromBedId];
  const patient = from === undefined ? undefined : findPatient(from.patientId);
  const request =
    TRANSFER_REQUESTS.find((candidate) => candidate.id === requestId) ??
    TRANSFER_REQUESTS.find((candidate) => candidate.patientId === patient?.id && board.transfers.includes(candidate.id));
  const [wardId, setWardId] = useState<WardId>(request?.toWardId ?? from?.wardId ?? 'med-a');
  const [bedId, setBedId] = useState<string | null>(null);
  const [reason, setReason] = useState<TransferReason>(request?.reason ?? 'other');

  if (from === undefined || patient === undefined) {
    return null;
  }
  const choices = bedOptions(liveBedsOfWard(board, wardId), patient, wardId, from.id);
  const chosen = choices.options.find((option) => option.bed.id === bedId && option.selectable);

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t.rich('transferTitle', { name: <NameBdi patient={patient} /> })}
      subtitle={t.rich('transferSubtitle', { ward: f.text(getWard(from.wardId).name), bed: <Bdi dir="ltr">{from.id}</Bdi> })}
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="arrow-forward"
            isDisabled={chosen === undefined}
            onPress={() => {
              if (chosen !== undefined) {
                onTransfer(from.id, chosen.bed.id, request?.id ?? null, reason);
              }
            }}
          >
            {chosen === undefined ? t('transferConfirmEmpty') : t('transferConfirm', { bed: chosen.bed.id })}
          </Button>
        </>
      }
    >
      <div className="ward-dialog">
        <div className="ward-dialog__patient">
          <PatientInline patient={patient} secondary />
          <IsolationBadge patient={patient} size="md" />
        </div>
        {request === undefined ? null : (
          <Callout tone="info" icon="arrow-forward" title={reasonLabel(request.reason)}>
            {t.rich('transferRequest', { note: f.text(request.note) })} · <Bdi dir="ltr">{request.id}</Bdi>
          </Callout>
        )}
        <div className="ward-dialog__row">
          <SelectField
            label={t('transferToWard')}
            options={WARDS.map((ward) => ({
              id: ward.id,
              label: `${f.text(ward.name)} · ${t('wardFree', { count: wardCounts(board, ward.id).available })}`,
            }))}
            selectedKey={wardId}
            onSelectionChange={(id) => {
              const next = WARDS.find((ward) => ward.id === id);
              if (next !== undefined) {
                setWardId(next.id);
                setBedId(null);
              }
            }}
          />
          <SelectField
            label={t('transferReason')}
            options={TRANSFER_REASONS.map((id) => ({ id, label: reasonLabel(id) }))}
            selectedKey={reason}
            onSelectionChange={(id) => {
              const next = TRANSFER_REASONS.find((candidate) => candidate === id);
              if (next !== undefined) {
                setReason(next);
              }
            }}
          />
        </div>
        <BedChoice wardId={wardId} choices={choices} value={bedId} onChange={setBedId} />
      </div>
    </Dialog>
  );
}
