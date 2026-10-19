/**
 * `SwitchConfirmation`: the confirmation a patient switch needs (BUILD-PROMPT.md §2.1 SI-16 clause e;
 * docs/specs/modules/design-system.md §2.2 "A context switch needs confirmation"; CTRL-0016-6).
 *
 * It is a view of the window's patient context and opens exactly while the machine is in
 * `switch-pending-confirmation`. It shows the current and the requested patient side by side, each with the
 * banner's PatientIdentity (photo, every name form, MRN, date of birth with the approximate-DOB flag, each
 * with its missing or unavailable state, never truncated).
 *
 * - "Keep current patient" is the safe choice and comes first. Escape does the same.
 * - "Switch to requested patient" names the requested patient's panel (`aria-describedby`), is never the
 *   default action, is not focused when the dialog opens (the dialog itself takes focus) and is never
 *   activated by Enter alone: there is no form and no default button, so Enter acts only on the control that
 *   has focus.
 * - While the requested patient's identity data is invalid the confirm control is disabled and says why
 *   (`patientContext.switch.requestedInvalid`); only "Keep current patient" is offered (DN-032). Whether a
 *   confirmation is possible is asked of the machine itself (ui-core `enabledTransitions`), so the dialog and
 *   the machine's guard cannot disagree.
 *
 * Until the user confirms, the current patient stays. The dialog is a design-system `Modal`, so it holds the
 * window's modal stack guard and never opens over another dialog.
 */
import { Message, Modal, PatientIdentity } from '@hms/design-system';
import {
  enabledTransitions,
  parseBannerData,
  type BannerModel,
  type PatientCandidate,
} from '@hms/ui-core';
import { useId, type ReactNode } from 'react';
import { Button, Heading } from 'react-aria-components';
import { useAppServices, usePatientContext } from '../app/services.tsx';

/** A candidate's banner; data not loaded yet shows the banner's error state (fail visibly). */
function identityOf(candidate: PatientCandidate, fallback: () => BannerModel): BannerModel {
  return candidate.banner ?? fallback();
}

export function SwitchConfirmation(): ReactNode {
  const { store, directory } = useAppServices();
  const snapshot = usePatientContext();
  const current = snapshot.patient;
  const requested = snapshot.requested;
  const open = snapshot.state === 'switch-pending-confirmation' && current !== null && requested !== null;
  const titleId = useId();
  const currentHeadingId = useId();
  const requestedHeadingId = useId();
  const requestedPanelId = useId();
  const reasonId = useId();

  const missing = (): BannerModel => parseBannerData(undefined, directory.vocabularies);
  const canConfirm =
    requested !== null &&
    enabledTransitions(
      snapshot,
      { type: 'ConfirmSwitch', requestedPatientId: requested.patientId },
      store.deps,
    ).length > 0;

  return (
    <Modal
      isOpen={open}
      role="alertdialog"
      aria-labelledby={titleId}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          store.send({ type: 'CancelSwitch' });
        }
      }}
    >
      {current === null || requested === null ? null : (
        <div className="hms-switch">
          <Heading id={titleId} level={2} className="hms-switch__title">
            <Message id="patientContext.switch.title" />
          </Heading>
          <p className="hms-switch__text">
            <Message id="patientContext.switch.body" />
          </p>
          <div className="hms-switch__patients">
            <section className="hms-switch__patient" aria-labelledby={currentHeadingId} data-patient="current">
              <h3 id={currentHeadingId} className="hms-switch__heading">
                <Message id="patientContext.switch.current" />
              </h3>
              <PatientIdentity model={identityOf(current, missing)} />
            </section>
            <section
              id={requestedPanelId}
              className="hms-switch__patient hms-switch__patient--requested"
              aria-labelledby={requestedHeadingId}
              data-patient="requested"
            >
              <h3 id={requestedHeadingId} className="hms-switch__heading">
                <Message id="patientContext.switch.requested" />
              </h3>
              <PatientIdentity model={identityOf(requested, missing)} />
            </section>
          </div>
          {canConfirm ? null : (
            <p id={reasonId} className="hms-switch__reason">
              <Message id="patientContext.switch.requestedInvalid" />
            </p>
          )}
          <div className="hms-switch__actions">
            <Button
              className="hms-switch__button"
              onPress={() => {
                store.send({ type: 'CancelSwitch' });
              }}
            >
              <Message id="patientContext.switch.cancel" />
            </Button>
            <Button
              className="hms-switch__button"
              isDisabled={!canConfirm}
              aria-describedby={canConfirm ? requestedPanelId : `${requestedPanelId} ${reasonId}`}
              onPress={() => {
                store.send({ type: 'ConfirmSwitch', requestedPatientId: requested.patientId });
              }}
            >
              <Message id="patientContext.switch.confirm" />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
