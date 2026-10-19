/**
 * The orders screen's dialogs (each uses the window's single modal slot; never two at once):
 * - AllergyAlertDialog: the blocking allergy alert, with an override that needs a reason and a second
 *   prescriber's co-signature.
 * - IdentityCheckDialog: "Confirm the patient before signing", with the banner's identity (PatientIdentity).
 * - StatusDialog: put an order on hold or discontinue it, with a reason.
 */
import { PatientIdentity } from '@hms/design-system';
import type { BannerModel } from '@hms/ui-core';
import { useState, type ReactNode } from 'react';
import { SEVERITY_LABEL, type Allergy, type Order, type Text3 } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Callout, Checkbox, Code, Dialog, Icon, SelectField, TextInput } from '../../ui/index.ts';
import { DISCONTINUE_REASONS, HOLD_REASONS, OVERRIDE_REASONS, type FormularyDrug } from './catalogue.ts';
import { messages } from './messages.ts';
import { allergyText, type DraftOverride } from './model.ts';
import { OrderReview } from './parts.tsx';

// ---------------------------------------------------------------------------------------------------------
// Allergy alert
// ---------------------------------------------------------------------------------------------------------

export interface AllergyAlertDialogProps {
  /** The medicine that triggered the alert; the dialog is open while it is set. */
  readonly drug: FormularyDrug | null;
  readonly allergy: Allergy | null;
  /** The safe choice: do not order it (also Escape). */
  readonly onRemove: () => void;
  /** Override with a reason; the caller then asks for the second prescriber's co-signature. */
  readonly onOverride: (override: DraftOverride) => void;
}

export function AllergyAlertDialog({ drug, allergy, onRemove, onOverride }: AllergyAlertDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [showOverride, setShowOverride] = useState(false);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [second, setSecond] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const reason = OVERRIDE_REASONS.find((candidate) => candidate.id === reasonId);
  const complete = reason !== undefined && comment.trim().length > 0 && second;
  const drugName = drug?.drug ?? '';

  return (
    <Dialog
      isOpen={drug !== null}
      onOpenChange={(open) => {
        if (!open) {
          onRemove();
        }
      }}
      role="alertdialog"
      size="lg"
      title={
        <span className="orders-alert-title">
          <Icon name="alert" />
          <span>{t('alertTitle', { drug: drugName })}</span>
        </span>
      }
      subtitle={t('alertSubtitle')}
      actions={
        <>
          <Button variant="primary" icon="x" onPress={onRemove}>
            {t('alertRemove', { drug: drugName })}
          </Button>
          {showOverride ? (
            <Button
              variant="danger"
              icon="pen"
              onPress={() => {
                setAttempted(true);
                if (complete && reason !== undefined) {
                  onOverride({ reason: reason.text, comment: comment.trim() });
                }
              }}
            >
              {t('overrideConfirm')}
            </Button>
          ) : (
            <Button variant="ghost" onPress={() => setShowOverride(true)}>
              {t('alertShowOverride')}
            </Button>
          )}
        </>
      }
    >
      <div className="orders-dialog-body">
        <p>{t('alertLead')}</p>
        {allergy === null ? null : (
          <Callout tone="danger" title={allergyText(allergy, f.locale, (severity) => f.text(SEVERITY_LABEL[severity]))}>
            {t.rich('alertWhy', { drug: <Code>{drugName}</Code> })}
          </Callout>
        )}
        <p className="orders-dialog-strong">{t('alertRecommend')}</p>
        {showOverride ? (
          <fieldset className="orders-override">
            <legend className="orders-override__legend">{t('overrideTitle')}</legend>
            <SelectField
              label={t('overrideReason')}
              options={OVERRIDE_REASONS.map((candidate) => ({ id: candidate.id, label: f.text(candidate.text) }))}
              selectedKey={reasonId}
              onSelectionChange={setReasonId}
            />
            <TextInput label={t('overrideComment')} value={comment} onChange={setComment} multiline isRequired />
            <Checkbox isSelected={second} onChange={setSecond}>
              {t('overrideSecond')}
            </Checkbox>
            {attempted && !complete ? (
              <p className="orders-field-error" role="alert">
                {t('overrideIncomplete')}
              </p>
            ) : null}
          </fieldset>
        ) : null}
      </div>
    </Dialog>
  );
}

/** The sign dialog's review for the override co-signature. */
export function OverrideReview({ drug, allergy, override }: { readonly drug: FormularyDrug; readonly allergy: Allergy | null; readonly override: DraftOverride }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <div className="orders-review">
      <p className="orders-review__heading">{t.rich('overrideReviewTitle', { drug: <Code>{drug.drug}</Code> })}</p>
      <dl className="orders-review__facts">
        {allergy === null ? null : (
          <div>
            <dt>{t('overrideReviewAllergy')}</dt>
            <dd className="orders-danger-text">{allergyText(allergy, f.locale, (severity) => f.text(SEVERITY_LABEL[severity]))}</dd>
          </div>
        )}
        <div>
          <dt>{t('overrideReviewReason')}</dt>
          <dd>{f.text(override.reason)}</dd>
        </div>
        <div>
          <dt>{t('overrideReviewComment')}</dt>
          <dd>
            <bdi>{override.comment}</bdi>
          </dd>
        </div>
      </dl>
      <p className="orders-muted">{t('overrideReviewNote')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Identity check before signing
// ---------------------------------------------------------------------------------------------------------

export interface IdentityCheckDialogProps {
  readonly isOpen: boolean;
  readonly banner: BannerModel;
  readonly count: number;
  readonly onConfirm: () => void;
  readonly onReject: () => void;
  readonly onCancel: () => void;
}

export function IdentityCheckDialog({ isOpen, banner, count, onConfirm, onReject, onCancel }: IdentityCheckDialogProps): ReactNode {
  const t = useT(messages);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      size="lg"
      title={t('idTitle')}
      subtitle={t('idOrders', { count })}
      actions={
        <>
          <Button variant="secondary" icon="x" onPress={onReject}>
            {t('idNotThis')}
          </Button>
          <Button variant="primary" icon="check" isDisabled={!confirmed} onPress={onConfirm}>
            {t('idContinue')}
          </Button>
        </>
      }
    >
      <div className="orders-dialog-body">
        <p>{t('idLead')}</p>
        <div className="orders-identity">
          <PatientIdentity model={banner} />
        </div>
        <Checkbox isSelected={confirmed} onChange={setConfirmed}>
          {t('idConfirmBox')}
        </Checkbox>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hold or discontinue
// ---------------------------------------------------------------------------------------------------------

export interface StatusTarget {
  readonly order: Order;
  readonly mode: 'hold' | 'discontinue';
}

export function StatusDialog({
  target,
  onConfirm,
  onCancel,
}: {
  readonly target: StatusTarget | null;
  readonly onConfirm: (reason: Text3) => void;
  readonly onCancel: () => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const reasons = target?.mode === 'hold' ? HOLD_REASONS : DISCONTINUE_REASONS;
  const reason = reasons.find((candidate) => candidate.id === reasonId);
  const hold = target?.mode === 'hold';
  return (
    <Dialog
      isOpen={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      title={hold ? t('holdTitle') : t('discontinueTitle')}
      subtitle={t('statusDialogLead')}
      actions={
        <>
          <Button variant="secondary" onPress={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            variant={hold ? 'primary' : 'danger'}
            onPress={() => {
              setAttempted(true);
              if (reason !== undefined) {
                onConfirm(reason.text);
              }
            }}
          >
            {hold ? t('confirmHold') : t('confirmDiscontinue')}
          </Button>
        </>
      }
    >
      <div className="orders-dialog-body">
        {target === null ? null : <OrderReview order={target.order} />}
        <SelectField
          label={t('reasonLabel')}
          options={reasons.map((candidate) => ({ id: candidate.id, label: f.text(candidate.text) }))}
          selectedKey={reasonId}
          onSelectionChange={setReasonId}
        />
        {attempted && reason === undefined ? (
          <p className="orders-field-error" role="alert">
            {t('reasonRequired')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
