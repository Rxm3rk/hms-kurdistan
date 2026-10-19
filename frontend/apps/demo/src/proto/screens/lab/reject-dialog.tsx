/**
 * Rejecting a specimen in the lab (haemolysed, clotted, unlabelled …). The rejection creates a recollection
 * task for the ward (an urgent "to collect" item that names the rejected specimen). Lab-side: the specimen is
 * identified by its barcode, and the patient is shown with two identifiers.
 */
import { useState, type ReactNode } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import type { Patient, StaffMember } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Checkbox, Code, Dialog, PatientInline, TextInput, useToast } from '../../ui/index.ts';
import { REJECT_REASON_IDS, REJECT_REASON_TEXT, type LabSpecimen, type RejectReasonId } from './lab-data.ts';
import { StatusBadge, TubeSwatch } from './lab-parts.tsx';
import { labActions } from './lab-store.ts';
import { messages } from './messages.ts';

const HINT_KEY = {
  haemolysed: 'hintHaemolysed',
  clotted: 'hintClotted',
  unlabelled: 'hintUnlabelled',
  mislabelled: 'hintMislabelled',
  insufficient: 'hintInsufficient',
  'wrong-tube': 'hintWrongTube',
} as const satisfies Record<RejectReasonId, string>;

export interface RejectDialogProps {
  readonly specimen: LabSpecimen;
  readonly patient: Patient;
  readonly user: StaffMember;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function RejectDialog({ specimen, patient, user, isOpen, onClose }: RejectDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [reason, setReason] = useState<RejectReasonId | null>(null);
  const [comment, setComment] = useState('');
  const [recollect, setRecollect] = useState(true);
  const [notify, setNotify] = useState(true);

  const confirm = (): void => {
    if (reason === null) {
      return;
    }
    const newId = labActions.reject(specimen, reason, comment, user.id, recollect);
    toast({
      tone: 'warning',
      title: t('rejectedToast', { reason: f.text(REJECT_REASON_TEXT[reason]) }),
      body: [newId === null ? t('rejectedToastNoTask') : t('rejectedToastBody', { id: newId }), notify ? t('wardNotified') : '']
        .filter((part) => part !== '')
        .join(' '),
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t('rejectTitle')}
      subtitle={t('rejectSubtitle')}
      size="lg"
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="danger" icon="x" isDisabled={reason === null} onPress={confirm}>
            {t('rejectConfirm')}
          </Button>
        </>
      }
    >
      <div className="lab-reject">
        <div className="lab-reject__specimen">
          <PatientInline patient={patient} secondary />
          <div className="lab-reject__meta">
            <span className="lab-strong">{f.text(specimen.panel)}</span>
            <TubeSwatch container={specimen.container} />
            <Code>{specimen.id}</Code>
            <StatusBadge status={specimen.status} />
          </div>
        </div>
        <RadioGroup
          className="lab-reasons"
          value={reason}
          onChange={(value) => {
            setReason(REJECT_REASON_IDS.find((id) => id === value) ?? null);
          }}
          isRequired
        >
          <Label className="lab-reasons__label">{t('rejectReason')}</Label>
          <div className="lab-reasons__grid">
            {REJECT_REASON_IDS.map((id) => (
              <Radio key={id} value={id} className="lab-reason">
                <span className="lab-reason__dot" aria-hidden="true" />
                <span className="lab-reason__text">
                  <span className="lab-reason__title">{f.text(REJECT_REASON_TEXT[id])}</span>
                  <span className="lab-reason__hint">{t(HINT_KEY[id])}</span>
                </span>
              </Radio>
            ))}
          </div>
        </RadioGroup>
        <TextInput label={t('rejectComment')} value={comment} onChange={setComment} multiline dir="auto" />
        <div className="lab-fieldset__options">
          <Checkbox isSelected={recollect} onChange={setRecollect}>
            {t('createRecollect')}
          </Checkbox>
          <Checkbox isSelected={notify} onChange={setNotify}>
            {t('notifyWard')}
          </Checkbox>
        </div>
      </div>
    </Dialog>
  );
}
