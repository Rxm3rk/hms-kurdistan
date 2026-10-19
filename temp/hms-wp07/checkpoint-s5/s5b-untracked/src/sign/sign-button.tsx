/**
 * `SignButton`: the Sign or Co-sign action that opens the sign step (docs/specs/modules/design-system.md
 * §2.3 "The sign step cannot open on an incomplete identity"; §2.1 rule 4; DN-032).
 *
 * It sends `OpenSign` to the window's patient context; the machine decides whether re-verification comes
 * first. While the window's patient has no valid banner identity (the banner's error state, a missing or
 * invalid date of birth, or banner data not loaded yet) the button is disabled and says why
 * (`sign.blockedByBanner`). The machine refuses the step on its own as well, so a stale enabled button
 * cannot open it.
 */
import type { PatientContextEvent, PatientContextSnapshot, SignKind, TransitionResult } from '@hms/ui-core';
import { useId, useState, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { Message } from '../message/message.tsx';

export interface SignButtonProps {
  readonly kind: SignKind;
  readonly snapshot: PatientContextSnapshot;
  readonly send: (event: PatientContextEvent) => TransitionResult;
}

/** The window's patient has a banner identity that allows signing (the machine's bannerIdentityValid). */
export function signingIdentityValid(snapshot: PatientContextSnapshot): boolean {
  const patient = snapshot.patient;
  const banner = patient?.banner ?? null;
  return (
    patient !== null &&
    banner !== null &&
    banner.patientId.status === 'valid' &&
    banner.patientId.value === patient.patientId &&
    !banner.signingBlocked
  );
}

export function SignButton({ kind, snapshot, send }: SignButtonProps): ReactNode {
  const reasonId = useId();
  const [refused, setRefused] = useState(false);
  const identityValid = signingIdentityValid(snapshot);
  const showReason = snapshot.patient !== null && (!identityValid || refused);
  return (
    <span className="hms-sign-action">
      <Button
        className="hms-sign__button"
        isDisabled={!identityValid || snapshot.state !== 'patient-selected'}
        {...(showReason ? { 'aria-describedby': reasonId } : {})}
        onPress={() => {
          const result = send({ type: 'OpenSign', kind });
          setRefused(result.messageKey === 'sign.blockedByBanner');
        }}
      >
        <Message id={kind === 'cosign' ? 'sign.cosign.action' : 'sign.action'} />
      </Button>
      {showReason ? (
        <span id={reasonId} className="hms-sign-action__reason">
          <Message id="sign.blockedByBanner" />
        </span>
      ) : null}
    </span>
  );
}
