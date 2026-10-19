/**
 * Signing on patient-scoped screens, with the design system's sign pattern (SignDialog: review, patient
 * re-verification when the patient changed in the last 60 seconds, simulated sign-in, intent, sign).
 *
 * The clinical layout mounts one SignHost (and so one SignDialog) per window. Screens ask it to sign:
 *
 *   <SignAction review={<OrderSummary order={order} />} onSigned={() => setSigned(order.id)} />
 *
 * or, with their own button:
 *
 *   const sign = useSign();
 *   <Button isDisabled={!sign.canSign} onPress={() => sign.requestSign({ review, onSigned })}>…</Button>
 *
 * `onSigned` runs when the simulated server accepts (nothing is stored; keep the "signed" state in your
 * screen). Co-signing (`kind: 'cosign'`) asks for a 4 to 8 digit PIN (any digits in the demo).
 */
import { Message, SignDialog, signingIdentityValid } from '@hms/design-system';
import type { SignKind } from '@hms/ui-core';
import { createContext, use, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useAppServices, usePatientContext } from '../../app/services.tsx';
import { useT } from '../i18n/use-t.ts';
import { Button, useToast, type ButtonSize, type ButtonVariant } from '../ui/index.ts';
import { shellMessages } from './messages.ts';

export interface SignRequest {
  readonly kind?: SignKind;
  /** What is being signed, shown in the dialog's review step. */
  readonly review: ReactNode;
  /** Runs after the (simulated) server accepted the signature. */
  readonly onSigned?: () => void;
}

export interface SignApi {
  /** True when the window's patient has a valid identity and no dialog is open. */
  readonly canSign: boolean;
  /** True when signing is blocked by the banner (identity incomplete or unavailable). */
  readonly blockedByBanner: boolean;
  /** Opens the sign dialog for this request. Returns false when the patient context refused. */
  readonly requestSign: (request: SignRequest) => boolean;
}

const SignContext = createContext<SignApi | null>(null);

export function SignHost({
  closeControl,
  children,
}: {
  readonly closeControl: RefObject<HTMLButtonElement | null>;
  readonly children?: ReactNode;
}): ReactNode {
  const { store, demo } = useAppServices();
  const snapshot = usePatientContext();
  const toast = useToast();
  const t = useT(shellMessages);
  const [current, setCurrent] = useState<SignRequest | null>(null);
  const currentRef = useRef<SignRequest | null>(null);

  if (demo === null) {
    throw new Error('SignHost: the prototype always runs with its demo module');
  }

  const identityValid = signingIdentityValid(snapshot);
  const api: SignApi = {
    canSign: identityValid && snapshot.state === 'patient-selected',
    blockedByBanner: snapshot.patient !== null && !identityValid,
    requestSign: (request) => {
      currentRef.current = request;
      setCurrent(request);
      const result = store.send({ type: 'OpenSign', kind: request.kind ?? 'sign' });
      return result.outcome !== 'refused';
    },
  };

  return (
    <SignContext value={api}>
      {children}
      <SignDialog
        snapshot={snapshot}
        send={store.send}
        sessionUser={demo.sessionUser}
        authenticator={demo.authenticator}
        submit={demo.submit}
        review={current?.review ?? null}
        rejectedFocusTarget={closeControl}
        contextDeps={store.deps}
        onMessage={(key) => {
          if (key === 'sign.done') {
            const request = currentRef.current;
            currentRef.current = null;
            request?.onSigned?.();
            toast({ tone: 'success', title: t('signedToast'), body: t('signedToastBody') });
          }
        }}
      />
    </SignContext>
  );
}

/** The sign API of the current patient-scoped screen. Throws outside the clinical layout. */
export function useSign(): SignApi {
  const value = use(SignContext);
  if (value === null) {
    throw new Error('useSign: only patient-scoped screens (inside the clinical layout) can sign');
  }
  return value;
}

export interface SignActionProps {
  readonly review: ReactNode;
  readonly onSigned?: () => void;
  readonly kind?: SignKind;
  /** The button text; "Sign" or "Co-sign" from the catalogue by default. */
  readonly label?: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Disable for a reason of your own (for example an allergy conflict); say why next to it. */
  readonly isDisabled?: boolean;
}

/** A Sign (or Co-sign) button that opens the design system's sign dialog for `review`. */
export function SignAction({ review, onSigned, kind = 'sign', label, variant = 'primary', size = 'md', isDisabled = false }: SignActionProps): ReactNode {
  const sign = useSign();
  return (
    <span className="shell-sign-action">
      <Button
        variant={variant}
        size={size}
        icon="pen"
        isDisabled={isDisabled || !sign.canSign}
        onPress={() => {
          sign.requestSign({ kind, review, ...(onSigned === undefined ? {} : { onSigned }) });
        }}
      >
        {label ?? <Message id={kind === 'cosign' ? 'sign.cosign.action' : 'sign.action'} />}
      </Button>
      {sign.blockedByBanner ? (
        <span className="shell-sign-action__reason">
          <Message id="sign.blockedByBanner" />
        </span>
      ) : null}
    </span>
  );
}
