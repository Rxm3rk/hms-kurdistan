/**
 * SI-16 clause f, client part (CTRL-0016-7; docs/specs/modules/design-system.md §2.3 and §9;
 * patient-context.yaml). With a fake monotonic clock: re-verification is required at 59.999 s and 60.000 s
 * after a context change and not at 60.001 s (the inclusive reading, DN-026); an unknown change time, an
 * unreadable clock and a negative elapsed time count as within the window; only a re-verification after the
 * last change clears it; "Not this patient" requires it again until a change or a re-verification; a
 * re-verification confirmed by another user than the signer does not count (DN-027); no sign step opens on
 * an invalid banner identity (DN-032). The server-side refusal is not built (KA-025). The last property
 * drives random event sequences against a hand-written model that predicts every result (see the model at
 * the end of the file).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  REVERIFICATION_WINDOW_MS,
  type PatientContextEvent,
  type PatientContextMessageKey,
  type PatientContextState,
  type SignKind,
} from '../src/index.ts';
import { errorBanner, noDobBanner, validBanner } from './fixtures.ts';
import { DOCTOR, NURSE, WindowHarness } from './harness.ts';

const A = 'SYN-PAT-000A';
const B = 'SYN-PAT-000B';

/** Opens A, waits `elapsedMs` on the monotonic clock, opens the sign step and returns the state reached. */
function openSignAfter(elapsedMs: number, startMs = 1_000_000): string {
  const window = new WindowHarness({ startMs });
  window.select(A);
  window.clock.advance(elapsedMs);
  return window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state;
}

describe('PropertyTest:SI-16-re-verification-at-signing-after-recent-context-change', () => {
  it('requires re-verification at 59.999 s and 60.000 s, and not at 60.001 s', () => {
    expect(openSignAfter(59_999)).toBe('re-verification-required');
    expect(openSignAfter(60_000)).toBe('re-verification-required');
    expect(openSignAfter(60_001)).toBe('signing');
    expect(openSignAfter(0)).toBe('re-verification-required');
    expect(REVERIFICATION_WINDOW_MS).toBe(60_000);
  });

  it('requires re-verification exactly when the elapsed time is at most 60 000 ms, or negative (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 40 }),
        fc.oneof(
          fc.constantFrom(59_999, 60_000, 60_001),
          fc.integer({ min: 59_000, max: 61_000 }),
          fc.integer({ min: -10_000_000, max: 10_000_000 }),
        ),
        (startMs, elapsedMs) => {
          const expected = elapsedMs <= REVERIFICATION_WINDOW_MS ? 're-verification-required' : 'signing';
          expect(openSignAfter(elapsedMs, startMs)).toBe(expected);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('reads sub-millisecond times inclusively too', () => {
    expect(openSignAfter(60_000.0, 0.5)).toBe('re-verification-required');
    expect(openSignAfter(59_999.999, 0)).toBe('re-verification-required');
    expect(openSignAfter(60_000.001, 0)).toBe('signing');
  });

  it('requires re-verification when the change time is unknown, however long ago, and no earlier re-verification counts', () => {
    const window = new WindowHarness();
    window.clock.setUnreadable(true);
    window.select(A);
    expect(window.snapshot.lastChange.monotonicMs).toBeUndefined();
    window.clock.setUnreadable(false);
    window.clock.advance(3_600_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    window.reverify(NURSE);
    expect(window.snapshot.state).toBe('signing');
    window.send({ type: 'CancelSign' });
    window.clock.advance(3_600_000);
    // The re-verification just confirmed is not "since the last change" when that change time is unknown.
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    // Signing is still possible after re-verifying in this dialog.
    window.reverify(NURSE);
    expect(window.submit(NURSE).snapshot.state).toBe('submitting');
  });

  it('requires re-verification when the clock cannot be read at the sign step', () => {
    const window = WindowHarness.settledOn(A);
    window.clock.setUnreadable(true);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
  });

  it('requires re-verification when the monotonic clock reads earlier than the change (negative elapsed time)', () => {
    const window = new WindowHarness({ startMs: 1_000_000 });
    window.select(A);
    window.clock.setMonotonicMs(1_000_000 - 120_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
  });

  it('ignores the wall clock: a wall-clock jump neither opens nor closes the window', () => {
    const window = new WindowHarness();
    window.select(A);
    window.clock.setWallTimeMs(Date.UTC(2030, 0, 1));
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    window.send({ type: 'CancelSign' });
    window.clock.setMonotonicMs(1_000_000 + 60_001);
    window.clock.setWallTimeMs(Date.UTC(2020, 0, 1));
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('signing');
  });

  it('is cleared only by a re-verification after the last change', () => {
    const window = new WindowHarness();
    window.select(A);
    window.clock.advance(10_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    // Cancelling without confirming leaves it required.
    window.send({ type: 'CancelSign' });
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    window.reverify(NURSE);
    window.send({ type: 'CancelSign' });
    window.clock.advance(10_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('signing');
    window.send({ type: 'CancelSign' });
    // A confirmed switch is a new change: the earlier re-verification no longer counts.
    window.select(B);
    window.confirmSwitch();
    window.clock.advance(1_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
  });

  it('requires re-verification only for the patient shown: a confirmation for another patient id does nothing', () => {
    const window = new WindowHarness();
    window.select(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    const wrong = window.send({ type: 'Reverify', patientId: B, confirmedBy: NURSE });
    expect(wrong.outcome).toBe('refused');
    expect(window.snapshot.state).toBe('re-verification-required');
  });

  it('requires re-verification again after "Not this patient", even after 60 s, until a change or a re-verification', () => {
    const window = new WindowHarness();
    window.select(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    const rejected = window.send({ type: 'RejectPatient' });
    expect(rejected.messageKey).toBe('sign.reverify.rejected');
    expect(window.snapshot).toMatchObject({ state: 'patient-selected', sign: null, disputed: true });
    window.clock.advance(10 * 60_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    window.reverify(NURSE);
    expect(window.snapshot.disputed).toBe(false);
    window.send({ type: 'CancelSign' });
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('signing');

    // Disputed again, after the server asked for re-verification, then resolved by a context change, not by time.
    expect(window.submit(NURSE).snapshot.state).toBe('submitting');
    const refusedByServer = window.send({ type: 'SignRefused', reason: 'reverification-required' });
    expect(refusedByServer.snapshot.state).toBe('re-verification-required');
    window.send({ type: 'RejectPatient' });
    expect(window.snapshot).toMatchObject({ state: 'patient-selected', sign: null, disputed: true });
    window.clock.advance(10 * 60_000);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    window.send({ type: 'CancelSign' });
    const closed = window.send({ type: 'ClosePatient' });
    expect(closed.contextChange).toEqual({ previousPatientId: A, patientId: null });
    expect(window.snapshot.disputed).toBe(false);
    window.select(A);
    window.clock.advance(60_001);
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('signing');
  });

  it('does not count a re-verification confirmed by another user than the signer', () => {
    const window = new WindowHarness();
    window.select(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    window.reverify(NURSE);
    const differs = window.submit(DOCTOR);
    expect(differs.messageKey).toBe('sign.reverify.signerDiffers');
    expect(differs.signCommand).toBeUndefined();
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(window.snapshot.reverification).toBeNull();
    window.reverify(DOCTOR);
    const signed = window.submit(DOCTOR);
    expect(signed.signCommand?.reverification?.confirmedBy).toBe(DOCTOR);

    // An earlier re-verification by another user, still within the window, does not count either.
    const earlier = new WindowHarness();
    earlier.select(A);
    earlier.send({ type: 'OpenSign', kind: 'sign' });
    earlier.reverify(NURSE);
    earlier.send({ type: 'CancelSign' });
    earlier.clock.advance(20_000);
    earlier.send({ type: 'OpenSign', kind: 'cosign' });
    expect(earlier.snapshot.state).toBe('signing');
    expect(earlier.submit(DOCTOR, 'badge-and-pin').snapshot.state).toBe('re-verification-required');
  });

  it('needs no re-verification, and no matching user, when the context is stable beyond the window', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    const result = window.submit(DOCTOR);
    expect(window.snapshot.state).toBe('submitting');
    expect(result.signCommand?.reverification).toBeNull();
  });

  it('opens no sign step on an invalid banner identity', () => {
    for (const [name, banner] of [
      ['error state', errorBanner(A)],
      ['date of birth missing', noDobBanner(A)],
      ['not loaded', null],
      ['data of another patient', validBanner(B)],
    ] as const) {
      for (const elapsed of [0, 120_000]) {
        const window = new WindowHarness();
        window.select(A, banner);
        window.clock.advance(elapsed);
        const result = window.send({ type: 'OpenSign', kind: 'sign' });
        expect(result.messageKey, name).toBe('sign.blockedByBanner');
        expect(window.snapshot.state, name).toBe('patient-selected');
        expect(window.snapshot.sign, name).toBeNull();
      }
    }
    // Banner data that turns invalid while the dialog is open blocks the submission.
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    window.snapshot = { ...window.snapshot, patient: { patientId: A, banner: noDobBanner(A) } };
    const blocked = window.submit();
    expect(blocked.messageKey).toBe('sign.blockedByBanner');
    expect(blocked.signCommand).toBeUndefined();
  });

  it('applies a lengthened window and ignores a shortened one', () => {
    const longer = new WindowHarness({ reverificationWindowMs: 90_000 });
    longer.select(A);
    longer.clock.advance(90_000);
    expect(longer.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
    const shorter = new WindowHarness({ reverificationWindowMs: 30_000 });
    shorter.select(A);
    shorter.clock.advance(45_000);
    expect(shorter.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('re-verification-required');
  });

  it('never opens signing without re-verification within the window, nor submits with another user’s re-verification (model)', () => {
    const users = [NURSE, DOCTOR] as const;
    const send = (weight: number, arbitrary: fc.Arbitrary<PatientContextEvent>) => ({ weight, arbitrary });
    const action = fc.oneof(
      {
        weight: 3,
        arbitrary: fc.record({
          kind: fc.constant('advance' as const),
          ms: fc.oneof(fc.constantFrom(59_999, 60_000, 60_001, 1), fc.integer({ min: 0, max: 130_000 })),
        }),
      },
      { weight: 1, arbitrary: fc.record({ kind: fc.constant('clock' as const), unreadable: fc.boolean() }) },
      // Opens the sign step exactly at a boundary after the model's last change (59.999, 60.000, 60.001 s).
      {
        weight: 3,
        arbitrary: fc.record({
          kind: fc.constant('openAt' as const),
          offsetMs: fc.constantFrom(-1, 0, 59_999, 60_000, 60_001),
          signKind: fc.constantFrom<SignKind>('sign', 'cosign'),
        }),
      },
      send(
        2,
        fc.constantFrom(A, B).map((id) => ({
          type: 'SelectPatient',
          patient: { patientId: id, banner: validBanner(id) },
          user: NURSE,
        })),
      ),
      send(
        2,
        fc.constantFrom(A, B).map((id) => ({ type: 'ConfirmSwitch', requestedPatientId: id })),
      ),
      send(1, fc.constantFrom<PatientContextEvent>({ type: 'CancelSwitch' }, { type: 'ClosePatient' })),
      send(
        3,
        fc.constantFrom<PatientContextEvent>(
          { type: 'OpenSign', kind: 'sign' },
          { type: 'OpenSign', kind: 'cosign' },
        ),
      ),
      {
        weight: 3,
        arbitrary: fc.record({
          kind: fc.constant('reverify' as const),
          by: fc.constantFrom(...users),
          patient: fc.constantFrom('shown' as const, 'other' as const),
        }),
      },
      send(2, fc.constant<PatientContextEvent>({ type: 'RejectPatient' })),
      send(1, fc.constant<PatientContextEvent>({ type: 'CancelSign' })),
      {
        weight: 3,
        arbitrary: fc.record({
          kind: fc.constant('submit' as const),
          by: fc.constantFrom(...users),
          factors: fc.constantFrom('single' as const, 'badge-and-pin' as const),
        }),
      },
      send(
        2,
        fc.constantFrom<PatientContextEvent>(
          { type: 'SignRefused', reason: 'reverification-required' },
          { type: 'SignRefused', reason: 'synthetic-other-reason' },
        ),
      ),
      send(
        2,
        fc.constantFrom<PatientContextEvent>(
          { type: 'SignAccepted' },
          { type: 'SignRejected' },
          { type: 'SignOutcomeUnknown' },
        ),
      ),
      send(1, fc.constant<PatientContextEvent>({ type: 'UserChanged', userId: DOCTOR })),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 80 }), (actions) => {
        const window = new WindowHarness();
        let model = initialModel();
        for (const step of actions) {
          if ('kind' in step && step.kind === 'advance') {
            window.clock.advance(step.ms);
            continue;
          }
          if ('kind' in step && step.kind === 'clock') {
            window.clock.setUnreadable(step.unreadable);
            continue;
          }
          if ('kind' in step && step.kind === 'openAt' && model.changeAt !== undefined) {
            window.clock.setMonotonicMs(model.changeAt + step.offsetMs);
          }
          let now: number | undefined;
          try {
            now = window.clock.monotonicMs();
          } catch {
            now = undefined;
          }
          let event: PatientContextEvent;
          if ('kind' in step && step.kind === 'openAt') {
            event = { type: 'OpenSign', kind: step.signKind };
          } else if ('kind' in step && step.kind === 'reverify') {
            const other = model.patient === A ? B : A;
            event = {
              type: 'Reverify',
              patientId: step.patient === 'shown' ? (model.patient ?? '') : other,
              confirmedBy: step.by,
            };
          } else if ('kind' in step && step.kind === 'submit') {
            event = {
              type: 'SubmitSign',
              authentication: { status: 'authenticated', userId: step.by, factors: step.factors },
            };
          } else {
            event = step;
          }

          const expected = predict(model, event, now);
          const before = window.snapshot;
          const result = window.send(event);
          const after = window.snapshot;
          const path = `${event.type} from ${model.state}`;

          expect(result.outcome, path).toBe(expected.outcome);
          if (result.outcome === 'refused') {
            expect(after, path).toBe(before);
          }
          expect(after.state, path).toBe(expected.model.state);
          expect(after.patient?.patientId ?? null, path).toBe(expected.model.patient);
          expect(after.requested?.patientId ?? null, path).toBe(expected.model.requested);
          expect(after.disputed, path).toBe(expected.model.disputed);
          expect(after.reverification?.confirmedBy ?? null, path).toBe(expected.model.reverifiedBy);
          expect(after.sign?.idempotencyKey ?? null, path).toBe(expected.model.sign?.key ?? null);
          expect(result.contextChange, path).toEqual(expected.contextChange);
          if (expected.messageKey !== undefined) {
            expect(result.messageKey, path).toBe(expected.messageKey);
          }
          if (expected.signCommand === undefined) {
            expect(result.signCommand, path).toBeUndefined();
          } else {
            expect(result.signCommand, path).toMatchObject(expected.signCommand);
          }

          // SI-16 clause f, stated on the model: a submission that relies on a re-verification (the context
          // changed within the window, or the identity was disputed, when the sign step opened) is made only
          // by the user who re-verified since the last change.
          if (after.state === 'submitting' && before.state === 'signing' && model.sign?.due === true) {
            expect(result.signCommand?.reverification?.confirmedBy, path).toBe(
              result.signCommand?.signerUserId,
            );
          }
          model = expected.model;
        }
      }),
      { numRuns: 1000 },
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// A hand-written model of patient-context.yaml, until WP-0.5 generates one from the YAML. It keeps its own
// state, patients, change time, re-verifier, dispute and open sign step from the events and the fake clock
// alone, and never reads the machine's results: the property above compares every result with its
// prediction, including whether a context change is reported. The model's banners are always valid and no
// modal is ever open, so those guards hold throughout.
// ---------------------------------------------------------------------------------------------------------

interface ModelSign {
  readonly kind: SignKind;
  /** The signature relies on a re-verification. */
  readonly due: boolean;
  /** The harness issues idem-1, idem-2, ... in the order sign steps open. */
  readonly key: string;
}

interface Model {
  readonly state: PatientContextState;
  readonly patient: string | null;
  readonly requested: string | null;
  /** Monotonic time of the last change; undefined when the clock could not be read then. */
  readonly changeAt: number | undefined;
  /** The user who re-verified since the last change, if any. */
  readonly reverifiedBy: string | null;
  readonly disputed: boolean;
  readonly sign: ModelSign | null;
  readonly keysIssued: number;
}

interface Prediction {
  readonly outcome: 'transitioned' | 'refused';
  readonly model: Model;
  readonly contextChange:
    { readonly previousPatientId: string | null; readonly patientId: string | null } | undefined;
  readonly messageKey?: PatientContextMessageKey;
  readonly signCommand?: {
    readonly kind: SignKind;
    readonly patientId: string;
    readonly signerUserId: string;
    readonly idempotencyKey: string;
    readonly reverification: { readonly confirmedBy: string } | null;
  };
}

function initialModel(): Model {
  return {
    state: 'no-patient',
    patient: null,
    requested: null,
    changeAt: undefined,
    reverifiedBy: null,
    disputed: false,
    sign: null,
    keysIssued: 0,
  };
}

const SIGN_STEP_STATES: readonly PatientContextState[] = ['re-verification-required', 'signing'];
const USER_CHANGE_STATES: readonly PatientContextState[] = [
  'patient-selected',
  'switch-pending-confirmation',
  're-verification-required',
  'signing',
  'submitting',
];

function predict(model: Model, event: PatientContextEvent, now: number | undefined): Prediction {
  const refused: Prediction = { outcome: 'refused', model, contextChange: undefined };
  const to = (next: Partial<Model>, extra: Partial<Prediction> = {}): Prediction => ({
    outcome: 'transitioned',
    model: { ...model, ...next },
    contextChange: undefined,
    ...extra,
  });
  // A context change: the patient id changes, the time is taken, and re-verification and dispute are reset.
  const change = (state: PatientContextState, patient: string | null): Prediction =>
    to(
      { state, patient, requested: null, changeAt: now, reverifiedBy: null, disputed: false, sign: null },
      { contextChange: { previousPatientId: model.patient, patientId: patient } },
    );

  switch (event.type) {
    case 'SelectPatient': {
      const id = event.patient.patientId;
      if (model.state === 'no-patient') {
        return change('patient-selected', id);
      }
      if (model.state === 'patient-selected') {
        return id === model.patient ? to({}) : to({ state: 'switch-pending-confirmation', requested: id });
      }
      return refused;
    }
    case 'ConfirmSwitch':
      return model.state === 'switch-pending-confirmation' && event.requestedPatientId === model.requested
        ? change('patient-selected', model.requested)
        : refused;
    case 'CancelSwitch':
      return model.state === 'switch-pending-confirmation'
        ? to({ state: 'patient-selected', requested: null })
        : refused;
    case 'ClosePatient':
      return model.state === 'patient-selected' ? change('no-patient', null) : refused;
    case 'OpenSign': {
      if (model.state !== 'patient-selected') {
        return refused;
      }
      // Within the window: the change time or the clock is unknown, or at most 60 000 ms have passed (a
      // negative elapsed time included). A re-verification counts only after a change whose time is known.
      const within = model.changeAt === undefined || now === undefined || now - model.changeAt <= 60_000;
      const reverified = model.changeAt !== undefined && model.reverifiedBy !== null;
      const needsReverification = model.disputed || (within && !reverified);
      const keysIssued = model.keysIssued + 1;
      return to({
        state: needsReverification ? 're-verification-required' : 'signing',
        keysIssued,
        sign: { kind: event.kind, due: within || model.disputed, key: `idem-${String(keysIssued)}` },
      });
    }
    case 'Reverify':
      return model.state === 're-verification-required' &&
        event.patientId === model.patient &&
        event.confirmedBy !== ''
        ? to({ state: 'signing', reverifiedBy: event.confirmedBy, disputed: false })
        : refused;
    case 'RejectPatient':
      return model.state === 're-verification-required'
        ? to(
            { state: 'patient-selected', reverifiedBy: null, disputed: true, sign: null },
            { messageKey: 'sign.reverify.rejected' },
          )
        : refused;
    case 'CancelSign':
      return SIGN_STEP_STATES.includes(model.state) ? to({ state: 'patient-selected', sign: null }) : refused;
    case 'SubmitSign': {
      const sign = model.sign;
      const authentication = event.authentication;
      if (model.state !== 'signing' || sign === null || model.patient === null) {
        return refused;
      }
      if (
        authentication.status !== 'authenticated' ||
        authentication.userId === '' ||
        (sign.kind === 'cosign' && authentication.factors !== 'badge-and-pin')
      ) {
        return refused;
      }
      if (sign.due && model.reverifiedBy !== authentication.userId) {
        return to(
          { state: 're-verification-required', reverifiedBy: null, sign: { ...sign, due: true } },
          { messageKey: 'sign.reverify.signerDiffers' },
        );
      }
      return to(
        { state: 'submitting' },
        {
          signCommand: {
            kind: sign.kind,
            patientId: model.patient,
            signerUserId: authentication.userId,
            idempotencyKey: sign.key,
            reverification: model.reverifiedBy === null ? null : { confirmedBy: model.reverifiedBy },
          },
        },
      );
    }
    case 'SignAccepted':
      return model.state === 'submitting' ? to({ state: 'patient-selected', sign: null }) : refused;
    case 'SignRefused':
      return model.state === 'submitting' && event.reason === 'reverification-required' && model.sign !== null
        ? to(
            { state: 're-verification-required', reverifiedBy: null, sign: { ...model.sign, due: true } },
            { messageKey: 'sign.refused.reverify' },
          )
        : refused;
    case 'SignRejected':
    case 'SignOutcomeUnknown':
      return model.state === 'submitting' ? to({ state: 'signing' }) : refused;
    case 'UserChanged':
      return USER_CHANGE_STATES.includes(model.state) ? change('no-patient', null) : refused;
    case 'WindowClosed':
      throw new Error('the model does not generate WindowClosed');
  }
}
