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
