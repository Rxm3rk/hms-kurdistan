/**
 * `SignDialog`: the one sign and co-sign pattern (BUILD-PROMPT.md §2.1 SI-16 clause f, §6.5, §9.4, §14.2;
 * docs/specs/modules/design-system.md §2.3; CTRL-0016-7, client part).
 *
 * The dialog is a view of the window's patient context (`@hms/ui-core` patient-context.ts, the machine of
 * docs/specs/state-machines/patient-context.yaml). It never decides a safety rule itself: it shows the
 * machine's state and sends the machine's events, and the machine's guards decide. It is open exactly while
 * the window holds a sign session in `re-verification-required`, `signing` or `submitting`.
 *
 * Signing and co-signing are the same dialog, with the same steps in the same order and the same controls.
 * Two things differ: the intent statement, and the strength of authentication (a co-signature needs badge
 * tap plus PIN, §12.8).
 *
 * 1. **Review**: what is being signed (`review`), while the banner stays visible above the dialog.
 * 2. **Re-verification, when the machine requires it** (within 60 s of a context change, inclusive, DN-026;
 *    or after "Not this patient"): the patient's photo, every name form, the MRN and the date of birth, none
 *    truncated, and "This is the right patient" / "Not this patient". Nothing is preselected or focused on
 *    open; the authentication step is not shown and Sign stays disabled until it is confirmed. "This is the
 *    right patient" stays disabled while the window holds no valid banner identity (fail closed).
 *    The confirmation is recorded for the session user. When the dialog comes back to this step after the
 *    signer authenticated (`sign.reverify.signerDiffers`, or the server's `sign.refused.reverify`), the
 *    earlier authentication is dropped and the person signing authenticates again in this step before
 *    "This is the right patient" is enabled; the confirmation is recorded for that person, and that
 *    authentication is the one the signature uses (§2.3 "Bound to the signer"; DN-027).
 * 3. **Authentication**: simulated in WP-0.7 and labelled so (KA-032); a co-signer gives a PIN as well.
 * 4. **Intent and sign**: the intent statement and Sign or Co-sign, never focused on open.
 *
 * Outcomes: accepted closes with `sign.done`; a refusal for re-verification returns to step 2
 * (`sign.refused.reverify`); a rejection keeps the dialog open with `sign.failed`; a timeout, a lost response
 * or an error keeps it open with `sign.outcomeUnknown`, and a retry sends the same idempotency key (the
 * machine keeps it for the life of the sign session). "Not this patient" closes with `sign.reverify.rejected`
 * and moves focus to `rejectedFocusTarget` (the banner's close and change controls), never to a clinical
 * action.
 *
 * Messages for a closed dialog (`sign.done`, `sign.reverify.rejected`, `sign.contextChanged`,
 * `sign.blockedByBanner`, and `sign.outcomeUnknown` when the dialog closed, for example on a change of user,
 * while a sign command was in flight) are shown in a status region next to the dialog; it carries
 * `data-live-announcer`, so an open modal never hides it from assistive technology.
 */
import type { MessageKey } from '@hms/i18n';
import {
  effectiveReverificationWindowMs,
  type PatientContextDeps,
  type PatientContextEvent,
  type PatientContextMessageKey,
  type PatientContextSnapshot,
  type PatientContextState,
  type SignCommand,
  type SignerAuthentication,
  type SignKind,
  type TransitionResult,
  type UserId,
} from '@hms/ui-core';
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button, Heading, Input, TextField } from 'react-aria-components';
import { PatientIdentity } from '../banner/index.ts';
import { Message } from '../message/message.tsx';
import { Modal } from '../modal/modal.tsx';
import type { SignAuthenticator } from './authenticator.ts';
import { signingIdentityValid } from './sign-button.tsx';

/** What the server said about a sign command. Anything else, a rejected promise or a timeout is `unknown`. */
export type SignSubmissionOutcome =
  | { readonly status: 'accepted' }
  /** The server refused; only `reverification-required` returns to re-verification, any other is a rejection. */
  | { readonly status: 'refused'; readonly reason: string }
  /** The server confirmed that it rejected the signature: nothing was saved. */
  | { readonly status: 'rejected' }
  | { readonly status: 'unknown' };

/** Sends the sign command (CTRL-0016-7). The server side is not built in WP-0.7 (KA-025). */
export type SignSubmitter = (command: SignCommand) => Promise<SignSubmissionOutcome>;

/** How long the dialog waits for the sign command's outcome before it reports the outcome as unknown. */
export const DEFAULT_SIGN_SUBMIT_TIMEOUT_MS = 30_000;

const DIALOG_STATES: readonly PatientContextState[] = ['re-verification-required', 'signing', 'submitting'];

function isDialogState(state: PatientContextState): boolean {
  return DIALOG_STATES.includes(state);
}

export interface SignDialogProps {
  /** The window's patient context. */
  readonly snapshot: PatientContextSnapshot;
  /**
   * Applies one event to the window's patient context (ui-core `transition`) and returns the result. The
   * dialog sends only events of the machine; the machine's guards decide.
   */
  readonly send: (event: PatientContextEvent) => TransitionResult;
  /**
   * The session user of this window. A re-verification is recorded for them, except on a return to
   * re-verification after authentication, when it is recorded for the person who authenticates again.
   */
  readonly sessionUser: UserId;
  readonly authenticator: SignAuthenticator;
  readonly submit: SignSubmitter;
  /** What is being signed (step 1). */
  readonly review: ReactNode;
  /** Where focus goes after "Not this patient": the banner's close and change controls. */
  readonly rejectedFocusTarget: RefObject<HTMLElement | null>;
  /**
   * The dependencies the window's patient context runs with (the store's own `PatientContextDeps` object):
   * the seconds the re-verification step shows are read from its `reverificationWindowMs`, the value the
   * machine's guard uses, so the two cannot disagree. Pass the same object, not a copy of the number.
   */
  readonly contextDeps: Pick<PatientContextDeps, 'reverificationWindowMs'>;
  readonly submitTimeoutMs?: number;
  /**
   * Called with every message the dialog shows (the machine's, and `sign.outcomeUnknown` when the dialog
   * closed while a sign command was in flight), for the application's own status display or log.
   */
  readonly onMessage?: (key: PatientContextMessageKey) => void;
}

interface ClosedMessage {
  readonly key: PatientContextMessageKey;
  readonly seq: number;
}

export function SignDialog({
  snapshot,
  send,
  rejectedFocusTarget,
  onMessage,
  ...bodyProps
}: SignDialogProps): ReactNode {
  const sign = snapshot.sign;
  const open = sign !== null && isDialogState(snapshot.state);
  const [closedMessage, setClosedMessage] = useState<ClosedMessage | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const statusRef = useRef<HTMLDivElement>(null);

  // A new sign session clears the message of the previous one (adjusting state while rendering).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setClosedMessage(null);
    }
  }

  const dispatch = (event: PatientContextEvent): TransitionResult => {
    const result = send(event);
    const key = result.messageKey;
    if (key !== undefined) {
      onMessage?.(key);
      if (!isDialogState(result.snapshot.state)) {
        setClosedMessage((previous) => ({ key, seq: (previous?.seq ?? 0) + 1 }));
        if (key === 'sign.reverify.rejected') {
          setFocusRequest((count) => count + 1);
        }
      }
    }
    return result;
  };

  // After "Not this patient", focus goes to the banner's close and change controls (or, without them, to
  // the status message), never to a clinical action. It is set again on the next frame, after the modal's
  // own focus restoration, which would otherwise return focus to the control that opened the dialog.
  useEffect(() => {
    if (focusRequest === 0) {
      return undefined;
    }
    const move = (): void => {
      const target = rejectedFocusTarget.current ?? statusRef.current;
      if (target !== null && document.activeElement !== target) {
        target.focus();
      }
    };
    move();
    const frame = requestAnimationFrame(move);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focusRequest, rejectedFocusTarget]);

  return (
    <>
      <Modal
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Escape: the machine decides (a cancel while submitting is refused and the dialog stays open).
            dispatch({ type: 'CancelSign' });
          }
        }}
      >
        {sign === null ? null : (
          <SignDialogBody
            key={sign.idempotencyKey}
            kind={sign.kind}
            snapshot={snapshot}
            dispatch={dispatch}
            onClosedWhileSubmitting={() => {
              onMessage?.('sign.outcomeUnknown');
              setClosedMessage((previous) => ({
                key: 'sign.outcomeUnknown',
                seq: (previous?.seq ?? 0) + 1,
              }));
            }}
            {...bodyProps}
          />
        )}
      </Modal>
      <div
        ref={statusRef}
        role="status"
        tabIndex={-1}
        data-live-announcer="true"
        className={closedMessage === null ? 'hms-visually-hidden' : 'hms-sign-status'}
        data-testid="hms-sign-status"
        data-message={closedMessage?.key}
      >
        {closedMessage === null ? null : (
          <span key={closedMessage.seq}>
            <Message id={closedMessage.key} />
          </span>
        )}
      </div>
    </>
  );
}

interface SignDialogBodyProps
  extends Omit<SignDialogProps, 'send' | 'rejectedFocusTarget' | 'onMessage' | 'snapshot'> {
  readonly kind: SignKind;
  readonly snapshot: PatientContextSnapshot;
  readonly dispatch: (event: PatientContextEvent) => TransitionResult;
  /** Called when the dialog closes while a sign command is in flight: the outcome is unknown. */
  readonly onClosedWhileSubmitting: () => void;
}

type Authenticated = Extract<SignerAuthentication, { status: 'authenticated' }>;

const KNOWN_OUTCOMES: ReadonlySet<string> = new Set(['accepted', 'refused', 'rejected', 'unknown']);

/** The outcome of one submission: a timeout, an error or a malformed answer is `unknown`, never `rejected`. */
function submitWithTimeout(
  submit: SignSubmitter,
  command: SignCommand,
  timeoutMs: number,
): Promise<SignSubmissionOutcome> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ status: 'unknown' });
    }, timeoutMs);
    let pending: Promise<SignSubmissionOutcome>;
    try {
      pending = submit(command);
    } catch {
      pending = Promise.resolve({ status: 'unknown' });
    }
    pending.then(
      (outcome: unknown) => {
        clearTimeout(timer);
        const status = (outcome as { status?: unknown } | null)?.status;
        resolve(
          typeof status === 'string' && KNOWN_OUTCOMES.has(status)
            ? (outcome as SignSubmissionOutcome)
            : { status: 'unknown' },
        );
      },
      () => {
        clearTimeout(timer);
        resolve({ status: 'unknown' });
      },
    );
  });
}

function outcomeEvent(outcome: SignSubmissionOutcome): PatientContextEvent {
  switch (outcome.status) {
    case 'accepted':
      return { type: 'SignAccepted' };
    case 'refused':
      return outcome.reason === 'reverification-required'
        ? { type: 'SignRefused', reason: outcome.reason }
        : { type: 'SignRejected' };
    case 'rejected':
      return { type: 'SignRejected' };
    case 'unknown':
      return { type: 'SignOutcomeUnknown' };
  }
}

/** The notice a refused authentication shows (KA-043: no key of its own yet). */
const AUTHENTICATION_REFUSED: MessageKey = 'hal.reason.stepUpRefused';

interface FocusRequest {
  /** `step`: the current step's heading; `sign`: the intent and sign section. Never a control. */
  readonly target: 'step' | 'sign';
  readonly seq: number;
}

function SignDialogBody({
  kind,
  snapshot,
  dispatch,
  sessionUser,
  authenticator,
  submit,
  review,
  contextDeps,
  submitTimeoutMs = DEFAULT_SIGN_SUBMIT_TIMEOUT_MS,
  onClosedWhileSubmitting,
}: SignDialogBodyProps): ReactNode {
  const [authentication, setAuthentication] = useState<Authenticated | null>(null);
  const [pin, setPin] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  // Set when this sign session came back to re-verification after the signer authenticated
  // (`sign.reverify.signerDiffers` or the server's `sign.refused.reverify`): the person signing must then
  // authenticate again in the re-verification step, and the confirmation is recorded for them.
  const [signerMustReauthenticate, setSignerMustReauthenticate] = useState(false);
  const [seenState, setSeenState] = useState(snapshot.state);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const mounted = useRef(true);
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const signSection = useRef<HTMLElement>(null);
  const reviewHeadingId = useId();
  const stepHeadingId = useId();
  const authenticationLabelId = useId();
  const pinHelpId = useId();
  const intentId = useId();

  const state = snapshot.state;
  const patient = snapshot.patient;
  const identity = patient?.banner ?? null;
  const identityValid = signingIdentityValid(snapshot);
  const reverifying = state === 're-verification-required';
  const step = reverifying ? 'reverify' : 'authenticate';
  const windowSeconds = Math.floor(effectiveReverificationWindowMs(contextDeps.reverificationWindowMs) / 1000);

  // Back in re-verification within this sign session (adjusting state while rendering): the earlier
  // authentication no longer counts, so a confirmation is never credited to a signer who did not
  // authenticate after it was asked for (§2.3 "Bound to the signer").
  if (state !== seenState) {
    setSeenState(state);
    if (state === 're-verification-required') {
      setAuthentication(null);
      setPin('');
      setSignerMustReauthenticate(true);
    }
  }

  // The dialog can close while a sign command is in flight (a change of user closes it without signing,
  // DN-028). The signature may still be saved, so the outcome is reported as unknown, never dropped.
  const closedWhileInFlight = useEffectEvent(() => {
    if (inFlight.current) {
      inFlight.current = false;
      onClosedWhileSubmitting();
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      closedWhileInFlight();
    };
  }, []);

  // Moving between re-verification and authentication puts focus on the new step's heading: never on a
  // control, so nothing is confirmed or signed by a key press meant for the previous step.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      stepHeading.current?.focus();
    }
  }, [step]);

  // A control that was just pressed and is now disabled (the sign-in once it succeeded; Sign and Cancel
  // while submitting) must not keep focus, or the browser drops it to the page. Focus goes to the step's
  // heading or to the intent and sign section, never to a control.
  useEffect(() => {
    if (focusRequest === null) {
      return;
    }
    (focusRequest.target === 'sign' ? signSection.current : stepHeading.current)?.focus();
  }, [focusRequest]);

  const requestFocus = (target: FocusRequest['target']): void => {
    setFocusRequest((previous) => ({ target, seq: (previous?.seq ?? 0) + 1 }));
  };

  /** Sends an event; while the dialog stays open, shows the machine's message (or clears the last one). */
  const sendAndShow = (event: PatientContextEvent): TransitionResult => {
    const result = dispatch(event);
    if (mounted.current && result.outcome === 'transitioned' && isDialogState(result.snapshot.state)) {
      setNotice(result.messageKey ?? null);
    }
    return result;
  };

  const confirmPatient = (): void => {
    if (patient === null || !identityValid) {
      return;
    }
    // The session user; or, once the person signing had to authenticate again in this step, that person.
    let confirmedBy: UserId = sessionUser;
    if (signerMustReauthenticate) {
      if (authentication === null) {
        return;
      }
      confirmedBy = authentication.userId;
    }
    sendAndShow({ type: 'Reverify', patientId: patient.patientId, confirmedBy });
  };

  const authenticate = async (): Promise<void> => {
    const focusAfter: FocusRequest['target'] = reverifying ? 'step' : 'sign';
    setAuthenticating(true);
    setNotice((previous) => (previous === AUTHENTICATION_REFUSED ? null : previous));
    const typedPin = kind === 'cosign' ? pin : undefined;
    setPin('');
    let result: SignerAuthentication;
    try {
      result = await authenticator.authenticate({ kind, pin: typedPin });
    } catch {
      result = { status: 'failed' };
    }
    if (!mounted.current) {
      return;
    }
    setAuthenticating(false);
    if (
      result.status === 'authenticated' &&
      result.userId.length > 0 &&
      (kind === 'sign' || result.factors === 'badge-and-pin')
    ) {
      setAuthentication(result);
      requestFocus(focusAfter);
    } else {
      setNotice(AUTHENTICATION_REFUSED);
    }
  };

  const signNow = async (): Promise<void> => {
    if (authentication === null) {
      return;
    }
    const result = sendAndShow({ type: 'SubmitSign', authentication });
    const command = result.signCommand;
    if (result.outcome !== 'transitioned' || command === undefined) {
      return;
    }
    requestFocus('sign');
    attempt.current += 1;
    const thisAttempt = attempt.current;
    inFlight.current = true;
    const outcome = await submitWithTimeout(submit, command, submitTimeoutMs);
    if (!mounted.current || thisAttempt !== attempt.current) {
      return;
    }
    inFlight.current = false;
    sendAndShow(outcomeEvent(outcome));
  };

  const authenticationOpen = state === 'signing' || (reverifying && signerMustReauthenticate);
  const canAuthenticate =
    authenticationOpen && authentication === null && !authenticating && (kind === 'sign' || pin.length > 0);
  const canConfirm = identityValid && (!signerMustReauthenticate || authentication !== null);
  const canSign = state === 'signing' && authentication !== null;

  const authenticationControls = (labelId: string): ReactNode => (
    <>
      {kind === 'cosign' ? (
        <>
          <p id={pinHelpId} className="hms-sign__text">
            <Message id="sign.authenticate.cosignPin" />
          </p>
          <TextField
            className="hms-sign__pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={setPin}
            isDisabled={authentication !== null || !authenticationOpen}
            aria-labelledby={labelId}
            aria-describedby={pinHelpId}
          >
            <Input className="hms-sign__input" data-testid="hms-sign-pin" />
          </TextField>
        </>
      ) : null}
      <Button
        className="hms-sign__button"
        isDisabled={!canAuthenticate}
        data-authenticated={authentication !== null}
        onPress={() => {
          void authenticate();
        }}
      >
        <Message id="sign.authenticate.simulated" />
      </Button>
    </>
  );

  return (
    <div className="hms-sign" data-kind={kind} data-state={state}>
      <Heading slot="title" className="hms-sign__title">
        <Message id={kind === 'cosign' ? 'sign.cosign.title' : 'sign.title'} />
      </Heading>

      <section className="hms-sign__step" data-step="review" aria-labelledby={reviewHeadingId}>
        <h3 id={reviewHeadingId} className="hms-sign__heading">
          <Message id="sign.review.heading" />
        </h3>
        <div className="hms-sign__review">{review}</div>
      </section>

      {reverifying ? (
        <section
          className="hms-sign__step"
          data-step="reverify"
          data-signer-must-authenticate={signerMustReauthenticate}
          aria-labelledby={stepHeadingId}
        >
          <h3 id={stepHeadingId} ref={stepHeading} tabIndex={-1} className="hms-sign__heading">
            <Message id="sign.reverify.title" />
          </h3>
          {/* The reason is shown only when it is the reason, a recent context change. For a disputed
              identity, or a return after authentication, it would be false; the notice says why (KA-043). */}
          {signerMustReauthenticate || snapshot.disputed ? null : (
            <p className="hms-sign__text">
              <Message id="sign.reverify.reason" values={{ windowSeconds }} />
            </p>
          )}
          {identity === null ? (
            <p className="hms-sign__text">
              <Message id="banner.dataUnavailable" />
            </p>
          ) : (
            <PatientIdentity model={identity} />
          )}
          {signerMustReauthenticate ? (
            <>
              <p id={authenticationLabelId} className="hms-sign__text">
                <Message id="sign.authenticate.heading" />
              </p>
              {authenticationControls(authenticationLabelId)}
            </>
          ) : null}
          <div className="hms-sign__actions">
            <Button className="hms-sign__button" isDisabled={!canConfirm} onPress={confirmPatient}>
              <Message id="sign.reverify.confirm" />
            </Button>
            <Button
              className="hms-sign__button"
              onPress={() => {
                sendAndShow({ type: 'RejectPatient' });
              }}
            >
              <Message id="sign.reverify.reject" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="hms-sign__step" data-step="authenticate" aria-labelledby={stepHeadingId}>
          <h3 id={stepHeadingId} ref={stepHeading} tabIndex={-1} className="hms-sign__heading">
            <Message id="sign.authenticate.heading" />
          </h3>
          {authenticationControls(stepHeadingId)}
        </section>
      )}

      <section
        ref={signSection}
        tabIndex={-1}
        className="hms-sign__step"
        data-step="sign"
        data-testid="hms-sign-section"
        aria-labelledby={intentId}
      >
        <p id={intentId} className="hms-sign__intent">
          <Message id={kind === 'cosign' ? 'sign.intent.cosign' : 'sign.intent.author'} />
        </p>
        <div role="alert" className="hms-sign__notice" data-message={notice ?? undefined}>
          {notice === null ? null : <Message id={notice} />}
        </div>
        <div className="hms-sign__actions">
          <Button
            className="hms-sign__button hms-sign__button--primary"
            isDisabled={!canSign}
            data-action="sign"
            onPress={() => {
              void signNow();
            }}
          >
            <Message id={kind === 'cosign' ? 'sign.cosign.action' : 'sign.action'} />
          </Button>
          <Button
            className="hms-sign__button"
            isDisabled={state === 'submitting'}
            onPress={() => {
              sendAndShow({ type: 'CancelSign' });
            }}
          >
            <Message id="sign.cancel" />
          </Button>
        </div>
      </section>
    </div>
  );
}
