/** A window driven through the patient-context machine with a fake clock and a fake modal stack. */
import {
  FakeClock,
  initialPatientContext,
  transition,
  type BannerModel,
  type PatientContextDeps,
  type PatientContextEvent,
  type PatientContextSnapshot,
  type TransitionResult,
} from '../src/index.ts';
import { validBanner } from './fixtures.ts';

export const NURSE = 'user-synthetic-nurse';
export const DOCTOR = 'user-synthetic-doctor';

export class WindowHarness {
  readonly clock: FakeClock;
  modalOpen = false;
  halCaptureWaiting = false;
  snapshot: PatientContextSnapshot = initialPatientContext();
  readonly deps: PatientContextDeps;
  #keys = 0;

  constructor(options: { readonly startMs?: number; readonly reverificationWindowMs?: number } = {}) {
    this.clock = new FakeClock({ monotonicMs: options.startMs ?? 1_000_000 });
    this.deps = {
      clock: this.clock,
      window: {
        isModalOpen: () => this.modalOpen,
        isHalCaptureWaiting: () => this.halCaptureWaiting,
      },
      newIdempotencyKey: () => {
        this.#keys += 1;
        return `idem-${String(this.#keys)}`;
      },
      ...(options.reverificationWindowMs === undefined
        ? {}
        : { reverificationWindowMs: options.reverificationWindowMs }),
    };
  }

  send(event: PatientContextEvent): TransitionResult {
    const result = transition(this.snapshot, event, this.deps);
    this.snapshot = result.snapshot;
    return result;
  }

  select(
    patientId: string,
    banner: BannerModel | null = validBanner(patientId),
    user = NURSE,
  ): TransitionResult {
    return this.send({ type: 'SelectPatient', patient: { patientId, banner }, user });
  }

  confirmSwitch(): TransitionResult {
    return this.send({
      type: 'ConfirmSwitch',
      requestedPatientId: this.snapshot.requested?.patientId ?? '',
    });
  }

  reverify(by = NURSE): TransitionResult {
    return this.send({
      type: 'Reverify',
      patientId: this.snapshot.patient?.patientId ?? '',
      confirmedBy: by,
    });
  }

  submit(userId = NURSE, factors: 'single' | 'badge-and-pin' = 'single'): TransitionResult {
    return this.send({ type: 'SubmitSign', authentication: { status: 'authenticated', userId, factors } });
  }

  /** Opens patient A and lets the re-verification window pass, so signing needs no re-verification. */
  static settledOn(patientId: string): WindowHarness {
    const harness = new WindowHarness();
    harness.select(patientId);
    harness.clock.advance(120_000);
    return harness;
  }
}
