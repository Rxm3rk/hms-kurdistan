/**
 * The patient-context machine (docs/specs/state-machines/patient-context.yaml; docs/specs/modules/design-system.md
 * §2.2, §2.3 and §9). `UnitTest:context-switch-requires-confirmation` is the CTRL-0016-6 test of slice S3; the
 * re-verification rule (CTRL-0016-7) is in reverification.property.test.ts.
 */
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  contextUserMismatch,
  effectiveReverificationWindowMs,
  PATIENT_CONTEXT_STATES,
  PREDICATES,
  REVERIFICATION_WINDOW_MS,
  TERMINAL_STATES,
  TRANSITIONS,
  updateBannerData,
  type PatientContextEvent,
  type PredicateName,
} from '../src/index.ts';
import { errorBanner, noDobBanner, validBanner } from './fixtures.ts';
import { DOCTOR, NURSE, WindowHarness } from './harness.ts';

const A = 'SYN-PAT-000A';
const B = 'SYN-PAT-000B';

describe('UnitTest:context-switch-requires-confirmation', () => {
  it('opens the first patient in an empty window without confirmation, as a context change', () => {
    const window = new WindowHarness();
    const result = window.select(A);
    expect(result.outcome).toBe('transitioned');
    expect(window.snapshot.state).toBe('patient-selected');
    expect(window.snapshot.patient?.patientId).toBe(A);
    expect(result.contextChange).toEqual({ previousPatientId: null, patientId: A });
    expect(window.snapshot.lastChange.monotonicMs).toBe(1_000_000);
  });

  it('never replaces the patient without ConfirmSwitch: the request waits, and the current patient stays', () => {
    const window = WindowHarness.settledOn(A);
    const before = window.snapshot.lastChange;
    const result = window.select(B);
    expect(result.outcome).toBe('transitioned');
    expect(result.contextChange).toBeUndefined();
    expect(window.snapshot.state).toBe('switch-pending-confirmation');
    expect(window.snapshot.patient?.patientId).toBe(A);
    expect(window.snapshot.requested?.patientId).toBe(B);
    expect(window.snapshot.lastChange).toEqual(before);

    // Nothing but the confirm control changes the patient while the confirmation is open.
    const others: PatientContextEvent[] = [
      { type: 'SelectPatient', patient: { patientId: B, banner: validBanner(B) }, user: NURSE },
      { type: 'ClosePatient' },
      { type: 'OpenSign', kind: 'sign' },
      { type: 'Reverify', patientId: B, confirmedBy: NURSE },
      { type: 'SubmitSign', authentication: { status: 'authenticated', userId: NURSE, factors: 'single' } },
      { type: 'SignAccepted' },
      { type: 'ConfirmSwitch', requestedPatientId: 'SYN-PAT-OTHER' },
    ];
    for (const event of others) {
      const refused = window.send(event);
      expect(refused.outcome, event.type).toBe('refused');
      expect(window.snapshot.patient?.patientId).toBe(A);
      expect(window.snapshot.state).toBe('switch-pending-confirmation');
    }
    expect(
      window.send({ type: 'SelectPatient', patient: { patientId: B, banner: null }, user: NURSE }).messageKey,
    ).toBe('patientContext.switch.blockedByModal');

    window.clock.advance(5_000);
    const confirmed = window.confirmSwitch();
    expect(confirmed.outcome).toBe('transitioned');
    expect(confirmed.contextChange).toEqual({ previousPatientId: A, patientId: B });
    expect(window.snapshot.state).toBe('patient-selected');
    expect(window.snapshot.patient?.patientId).toBe(B);
    expect(window.snapshot.requested).toBeNull();
    expect(window.snapshot.lastChange.monotonicMs).toBe(1_125_000);
    expect(window.snapshot.lastChange.version).toBe(before.version + 1);
  });

  it('keeps the patient and the change time when the switch is cancelled', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    window.send({ type: 'CancelSign' });
    const before = window.snapshot;
    window.select(B);
    const result = window.send({ type: 'CancelSwitch' });
    expect(result.outcome).toBe('transitioned');
    expect(result.contextChange).toBeUndefined();
    expect(window.snapshot.state).toBe('patient-selected');
    expect(window.snapshot.patient?.patientId).toBe(A);
    expect(window.snapshot.requested).toBeNull();
    expect(window.snapshot.lastChange).toEqual(before.lastChange);
    // The cancelled request did not start a new 60 s window: signing still needs no re-verification.
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).snapshot.state).toBe('signing');
  });

  it('changes nothing when the patient already open is selected again', () => {
    const window = WindowHarness.settledOn(A);
    const before = window.snapshot;
    const result = window.select(A);
    expect(result.outcome).toBe('transitioned');
    expect(result.contextChange).toBeUndefined();
    expect(window.snapshot).toEqual(before);
  });

  it('refuses a switch while a modal or a HAL capture is open, and does not queue it', () => {
    for (const blocker of ['modal', 'capture'] as const) {
      const window = WindowHarness.settledOn(A);
      if (blocker === 'modal') window.modalOpen = true;
      else window.halCaptureWaiting = true;
      const result = window.select(B);
      expect(result.outcome).toBe('refused');
      expect(result.messageKey).toBe('patientContext.switch.blockedByModal');
      expect(window.snapshot.state).toBe('patient-selected');
      expect(window.snapshot.requested).toBeNull();
      expect(window.send({ type: 'ClosePatient' }).messageKey).toBe('patientContext.switch.blockedByModal');
      window.modalOpen = false;
      window.halCaptureWaiting = false;
      expect(window.snapshot.patient?.patientId).toBe(A);
      expect(window.snapshot.requested).toBeNull(); // nothing was queued
    }
    const empty = new WindowHarness();
    empty.modalOpen = true;
    expect(empty.select(A).outcome).toBe('refused');
    expect(empty.snapshot.patient).toBeNull();
  });

  it('refuses a switch when the modal state cannot be read (fail closed)', () => {
    const window = WindowHarness.settledOn(A);
    window.deps.window.isModalOpen = () => {
      throw new Error('stack guard unavailable');
    };
    expect(window.select(B).outcome).toBe('refused');
  });

  it('refuses a switch while the sign dialog is open', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    expect(window.snapshot.state).toBe('signing');
    const result = window.select(B);
    expect(result.outcome).toBe('refused');
    expect(result.messageKey).toBe('patientContext.switch.blockedByModal');
    expect(window.snapshot.patient?.patientId).toBe(A);
  });

  it('cannot confirm while the requested patient identity is invalid', () => {
    const invalid = [
      ['not loaded', null],
      ['error state', errorBanner(B)],
      ['data of another patient', validBanner('SYN-PAT-000C')],
    ] as const;
    for (const [name, banner] of invalid) {
      const window = WindowHarness.settledOn(A);
      window.select(B, banner);
      const result = window.confirmSwitch();
      expect(result.outcome, name).toBe('refused');
      expect(result.messageKey, name).toBe('patientContext.switch.requestedInvalid');
      expect(window.snapshot.patient?.patientId, name).toBe(A);
      expect(window.send({ type: 'CancelSwitch' }).snapshot.patient?.patientId).toBe(A);
    }
    // Once valid data for the requested patient arrives, the switch can be confirmed.
    const window = WindowHarness.settledOn(A);
    window.select(B, null);
    window.snapshot = updateBannerData(window.snapshot, B, validBanner(B));
    expect(window.confirmSwitch().outcome).toBe('transitioned');
    // A missing date of birth blocks signing, not the switch (DN-032).
    const noDob = WindowHarness.settledOn(A);
    noDob.select(B, noDobBanner(B));
    expect(noDob.confirmSwitch().outcome).toBe('transitioned');
  });

  it('changes the patient only through the transitions that allow it (property)', () => {
    const patients = [A, B, 'SYN-PAT-000C'];
    const event = fc.oneof(
      fc.constantFrom(...patients).map((id): PatientContextEvent => ({
        type: 'SelectPatient',
        patient: { patientId: id, banner: id === 'SYN-PAT-000C' ? errorBanner(id) : validBanner(id) },
        user: NURSE,
      })),
      fc.constant<PatientContextEvent>({ type: 'CancelSwitch' }),
      fc.constant<PatientContextEvent>({ type: 'ClosePatient' }),
      fc.constant<PatientContextEvent>({ type: 'OpenSign', kind: 'sign' }),
      fc.constant<PatientContextEvent>({ type: 'CancelSign' }),
      fc.constant<PatientContextEvent>({ type: 'RejectPatient' }),
      fc.constantFrom(...patients).map((id): PatientContextEvent => ({
        type: 'ConfirmSwitch',
        requestedPatientId: id,
      })),
    );
    const step = fc.record({ event, modal: fc.boolean(), advance: fc.integer({ min: 0, max: 90_000 }) });
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        const window = new WindowHarness();
        for (const { event: next, modal, advance } of steps) {
          window.modalOpen = modal;
          window.clock.advance(advance);
          const before = window.snapshot;
          const result = window.send(next);
          const changed = before.patient?.patientId !== window.snapshot.patient?.patientId;
          if (changed) {
            const allowed =
              (next.type === 'SelectPatient' && before.state === 'no-patient') ||
              (next.type === 'ConfirmSwitch' && before.state === 'switch-pending-confirmation') ||
              (next.type === 'ClosePatient' && before.state === 'patient-selected');
            expect(allowed).toBe(true);
            expect(modal && next.type !== 'ConfirmSwitch').toBe(false);
            expect(result.contextChange).toEqual({
              previousPatientId: before.patient?.patientId ?? null,
              patientId: window.snapshot.patient?.patientId ?? null,
            });
          }
          if (next.type === 'ConfirmSwitch' && changed) {
            expect(window.snapshot.patient?.patientId).toBe(before.requested?.patientId);
            expect(before.requested?.banner?.errorState).toBe(false);
          }
          // One patient per window: the snapshot holds at most one current patient, and a pending request
          // exists only while the confirmation is open.
          expect(window.snapshot.requested === null).toBe(
            window.snapshot.state !== 'switch-pending-confirmation',
          );
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('patient context: the rest of the machine (design-system §2.2, §2.3)', () => {
  it('closes the patient as a context change to none', () => {
    const window = WindowHarness.settledOn(A);
    const result = window.send({ type: 'ClosePatient' });
    expect(result.contextChange).toEqual({ previousPatientId: A, patientId: null });
    expect(window.snapshot.state).toBe('no-patient');
    expect(window.snapshot.patient).toBeNull();
  });

  it('clears the context and closes any dialog without signing when the user changes', () => {
    for (const setUp of [
      (window: WindowHarness) => window.select(B),
      (window: WindowHarness) => window.send({ type: 'OpenSign', kind: 'sign' }),
      (window: WindowHarness) => {
        window.send({ type: 'OpenSign', kind: 'sign' });
        window.submit();
      },
    ]) {
      const window = WindowHarness.settledOn(A);
      setUp(window);
      const result = window.send({ type: 'UserChanged', userId: DOCTOR });
      expect(result.outcome).toBe('transitioned');
      expect(result.messageKey).toBe('patientContext.clearedByUserChange');
      expect(result.contextChange).toEqual({ previousPatientId: A, patientId: null });
      expect(window.snapshot).toMatchObject({
        state: 'no-patient',
        patient: null,
        requested: null,
        sign: null,
      });
      expect(window.send({ type: 'SignAccepted' }).outcome).toBe('refused');
    }
  });

  it('detects a window opened under another user', () => {
    const window = WindowHarness.settledOn(A);
    expect(contextUserMismatch(window.snapshot, NURSE)).toBe(false);
    expect(contextUserMismatch(window.snapshot, DOCTOR)).toBe(true);
    expect(contextUserMismatch(window.snapshot, null)).toBe(true);
    window.send({ type: 'ClosePatient' });
    expect(contextUserMismatch(window.snapshot, DOCTOR)).toBe(false);
  });

  it('stores banner data only for the current or the requested patient', () => {
    const window = WindowHarness.settledOn(A);
    const other = updateBannerData(window.snapshot, 'SYN-PAT-000C', validBanner('SYN-PAT-000C'));
    expect(other).toBe(window.snapshot);
    const refreshed = updateBannerData(window.snapshot, A, noDobBanner(A));
    expect(refreshed.patient?.banner?.dob.status).toBe('missing');
  });

  it('sends the sign command with the change time, the re-verification and the idempotency key', () => {
    const window = new WindowHarness();
    window.clock.setWallTimeMs(Date.UTC(2026, 9, 19, 8, 0, 0));
    window.select(A);
    window.clock.advance(10_000);
    window.send({ type: 'OpenSign', kind: 'sign' });
    window.reverify(NURSE);
    const result = window.submit(NURSE);
    expect(window.snapshot.state).toBe('submitting');
    expect(result.signCommand).toEqual({
      kind: 'sign',
      patientId: A,
      signerUserId: NURSE,
      idempotencyKey: 'idem-1',
      lastContextChangeWallTimeMs: Date.UTC(2026, 9, 19, 8, 0, 0),
      reverification: { confirmedBy: NURSE, wallTimeMs: Date.UTC(2026, 9, 19, 8, 0, 10) },
    });
    // A second submission while the first is in flight is refused.
    expect(window.submit(NURSE).outcome).toBe('refused');
  });

  it('keeps the dialog open and the idempotency key after a rejection or an unknown outcome', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    const first = window.submit().signCommand;
    expect(window.send({ type: 'SignOutcomeUnknown' }).messageKey).toBe('sign.outcomeUnknown');
    expect(window.snapshot.state).toBe('signing');
    const retry = window.submit().signCommand;
    expect(retry?.idempotencyKey).toBe(first?.idempotencyKey);
    expect(window.send({ type: 'SignRejected' }).messageKey).toBe('sign.failed');
    expect(window.snapshot.state).toBe('signing');
    window.submit();
    const accepted = window.send({ type: 'SignAccepted' });
    expect(accepted.messageKey).toBe('sign.done');
    expect(window.snapshot).toMatchObject({ state: 'patient-selected', sign: null });
  });

  it('returns to re-verification when the server refuses for re-verification', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    window.submit();
    const refused = window.send({ type: 'SignRefused', reason: 'reverification-required' });
    expect(refused.messageKey).toBe('sign.refused.reverify');
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(window.submit().outcome).toBe('refused');
    window.reverify(NURSE);
    expect(window.submit(DOCTOR).messageKey).toBe('sign.reverify.signerDiffers');
    window.reverify(NURSE);
    expect(window.submit(NURSE).snapshot.state).toBe('submitting');
  });

  it('closes the dialog without signing when the context changed after the sign step opened', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    // A forced change (switches are refused while the dialog is open): the patient differs from the one
    // recorded when the step opened.
    window.snapshot = { ...window.snapshot, patient: { patientId: B, banner: validBanner(B) } };
    const result = window.submit();
    expect(result.messageKey).toBe('sign.contextChanged');
    expect(result.signCommand).toBeUndefined();
    expect(window.snapshot).toMatchObject({ state: 'patient-selected', sign: null });
  });

  it('refuses to submit without an authenticated signer, and a co-signature without badge plus PIN', () => {
    const window = WindowHarness.settledOn(A);
    window.send({ type: 'OpenSign', kind: 'sign' });
    expect(window.send({ type: 'SubmitSign', authentication: { status: 'failed' } }).outcome).toBe('refused');
    expect(window.snapshot.state).toBe('signing');
    window.send({ type: 'CancelSign' });
    window.send({ type: 'OpenSign', kind: 'cosign' });
    expect(window.submit(DOCTOR, 'single').outcome).toBe('refused');
    expect(window.submit(DOCTOR, 'badge-and-pin').snapshot.state).toBe('submitting');
  });

  it('lets a tenant lengthen the 60 s window and never shorten it', () => {
    expect(REVERIFICATION_WINDOW_MS).toBe(60_000);
    expect(effectiveReverificationWindowMs()).toBe(60_000);
    expect(effectiveReverificationWindowMs(30_000)).toBe(60_000);
    expect(effectiveReverificationWindowMs(Number.NaN)).toBe(60_000);
    expect(effectiveReverificationWindowMs(Number.POSITIVE_INFINITY)).toBe(60_000);
    expect(effectiveReverificationWindowMs(90_000)).toBe(90_000);
  });

  it('ends in window-closed from every state', () => {
    for (const state of PATIENT_CONTEXT_STATES) {
      const window = WindowHarness.settledOn(A);
      window.snapshot = { ...window.snapshot, state };
      expect(window.send({ type: 'WindowClosed' }).snapshot).toMatchObject({
        state: 'window-closed',
        patient: null,
      });
    }
    expect(TERMINAL_STATES).toEqual(['window-closed']);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Conformance with patient-context.yaml
// ---------------------------------------------------------------------------------------------------------

/**
 * Reads the parts of patient-context.yaml the machine restates. The file is Appendix B.3's flow style, one
 * transition per line, so a line reader suffices and no YAML dependency is needed. It reads the key `on` as
 * written (a YAML 1.1 parser would read it as `true`; patient-context.md).
 */
function readSpec() {
  const yaml = readFileSync(
    new URL('../../../../docs/specs/state-machines/patient-context.yaml', import.meta.url),
    'utf8',
  ).replace(/\r\n/gu, '\n');
  const list = (text: string): string[] =>
    text
      .replace(/^\[|\]$/gu, '')
      .split(',')
      .map((item) => item.trim().replace(/^"|"$/gu, ''))
      .filter((item) => item.length > 0);
  const states = list(/^states: (\[.*\])$/mu.exec(yaml)?.[1] ?? '');
  const terminal = list(/^terminal: (\[.*\])$/mu.exec(yaml)?.[1] ?? '');
  const predicatesBlock = /^predicates:.*\n((?: {2}\w+: .*\n)+)/mu.exec(yaml)?.[1] ?? '';
  const predicates = [...predicatesBlock.matchAll(/^ {2}(\w+): /gmu)].map((match) => match[1] ?? '');
  const transitions = [
    ...yaml.matchAll(
      /^ {2}- \{from: (\[[^\]]*\]|"\*"|[\w-]+), on: (\w+)(?:, guard: (\[[^\]]*\]))?, to: ([\w-]+)\}$/gmu,
    ),
  ].map((match) => ({
    from:
      match[1] === '"*"'
        ? '*'
        : list(match[1] ?? '')
            .sort()
            .join(','),
    on: match[2] ?? '',
    guard: list(match[3] ?? '')
      .sort()
      .join(','),
    to: match[4] ?? '',
  }));
  const transitionLines = yaml.split('\n').filter((line) => /^ {2}- \{from:/u.test(line)).length;
  return { states, terminal, predicates, transitions, transitionLines };
}

describe('patient context: conformance with patient-context.yaml', () => {
  const spec = readSpec();

  it('reads every transition line of the YAML', () => {
    expect(spec.transitions.length).toBeGreaterThan(20);
    expect(spec.transitions.length).toBe(spec.transitionLines);
  });

  it('has the states and the terminal state of the YAML', () => {
    expect([...PATIENT_CONTEXT_STATES]).toEqual(spec.states);
    expect([...TERMINAL_STATES]).toEqual(spec.terminal);
  });

  it('implements each predicate of the YAML exactly once, and no other', () => {
    expect(Object.keys(PREDICATES).sort()).toEqual([...spec.predicates].sort());
    expect(new Set(spec.predicates).size).toBe(spec.predicates.length);
  });

  it('restates the transitions of the YAML one for one', () => {
    const implemented = TRANSITIONS.map((definition) => ({
      from: definition.from === '*' ? '*' : [...definition.from].sort().join(','),
      on: definition.on,
      guard: [...definition.guard].sort().join(','),
      to: definition.to,
    }));
    expect(implemented).toEqual(spec.transitions);
  });

  it('is deterministic: no two transitions to different states can be enabled together', () => {
    const complements: [PredicateName, PredicateName][] = [
      ['bannerIdentityValid', 'bannerIdentityInvalid'],
      ['contextChangedWithinWindow', 'contextStableBeyondWindow'],
      ['reverifiedSinceLastChange', 'notReverifiedSinceLastChange'],
      ['identityDisputed', 'identityNotDisputed'],
      ['reverificationHeldBySigner', 'reverificationNotHeldBySigner'],
      ['contextUnchangedSinceSignOpened', 'contextChangedSinceSignOpened'],
      // Not declared complements in the YAML, but complements wherever both are used: in patient-selected
      // the window holds a patient, so a requested id either equals its id or differs from it.
      ['samePatientRequested', 'differentPatientRequested'],
    ];
    const complementOf = new Map<PredicateName, PredicateName>();
    for (const [base, complement] of complements) complementOf.set(complement, base);
    const groups = new Map<string, typeof TRANSITIONS>();
    for (const definition of TRANSITIONS) {
      const states = definition.from === '*' ? PATIENT_CONTEXT_STATES : definition.from;
      for (const state of states) {
        const key = `${state}|${definition.on}`;
        groups.set(key, [...(groups.get(key) ?? []), definition]);
      }
    }
    for (const [key, definitions] of groups) {
      const bases = [
        ...new Set(
          definitions.flatMap((definition) => definition.guard.map((name) => complementOf.get(name) ?? name)),
        ),
      ];
      for (let mask = 0; mask < 2 ** bases.length; mask += 1) {
        const value = (name: PredicateName): boolean => {
          const base = complementOf.get(name);
          const index = bases.indexOf(base ?? name);
          const bit = (mask >> index) % 2 === 1;
          return base === undefined ? bit : !bit;
        };
        const targets = new Set(
          definitions
            .filter((definition) => definition.guard.every(value))
            .map((definition) => definition.to),
        );
        expect(targets.size, `${key} with mask ${String(mask)}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
