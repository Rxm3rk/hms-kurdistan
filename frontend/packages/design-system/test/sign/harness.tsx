/**
 * Test harness for the sign and co-sign dialog and the command palette (slice S5b): one window's patient
 * context driven through ui-core's real machine with a fake monotonic clock, the window's modal stack guard
 * as its modal state, and synthetic patients (§18.10, §3.4 item 7: synthetic only, NOT FOR CLINICAL USE;
 * the names, MRNs and codes are invented).
 */
import { CATALOGUES, type MessageKey } from '@hms/i18n';
import {
  FakeClock,
  initialPatientContext,
  parseBannerData,
  SYNTHETIC_BANNER_VOCABULARIES,
  transition,
  type BannerModel,
  type PatientContextDeps,
  type PatientContextEvent,
  type PatientContextSnapshot,
  type SignCommand,
  type TransitionResult,
} from '@hms/ui-core';
import { configure, render, screen, within, type RenderResult } from '@testing-library/react';
import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import { vi } from 'vitest';
import { LocaleProvider, Message, type ModalStackGuard } from '../../src/index.ts';
import {
  createSimulatedAuthenticator,
  SignButton,
  SignDialog,
  type SignAuthenticator,
  type SignDialogProps,
  type SignSubmissionOutcome,
  type SignSubmitter,
} from '../../src/sign/index.ts';
import { createModalStackGuard, ModalStackTestProvider } from '../../src/testing.tsx';

// Time limits for the test files that import this harness (the sign and palette tests of slice S5b). Their
// multi-step keyboard and pointer flows take 1 to 3 s each in jsdom on an idle Windows host, and several
// times that when the host is busy (for example with a parallel Gradle build); the package defaults, 5 s a
// test and 1 s a waitFor, made them fail on load alone. A longer limit only delays the report of a test
// that fails; it lets no failing assertion pass.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

export const en = CATALOGUES.en;
export const text = (key: MessageKey): string => en[key];

export const NURSE = 'user-synthetic-nurse';
export const DOCTOR = 'user-synthetic-doctor';
export const WINDOW_MS = 60_000;

export const PATIENT_A = 'SYN-PAT-0001';
export const PATIENT_B = 'SYN-PAT-0002';

/** Synthetic banner input; every field valid. */
export function bannerData(patientId: string, names: Partial<Record<'ckb' | 'ar' | 'latin', string>> = {}) {
  const suffix = patientId.slice(-1);
  return {
    provenance: 'synthetic',
    patientId,
    photo: { status: 'absent' },
    name: {
      ckb: names.ckb ?? 'هێمن ئازاد عومەر کەریم',
      ar: names.ar ?? 'هيمن آزاد عمر كريم',
      latin: names.latin ?? `Hêmin Azad Omer Kerîm ${suffix}`,
      ownScript: 'ckb',
    },
    mrn: `SYN-10023${suffix}-7`,
    dob: { value: '1984-03', precision: 'month', approximate: false },
    allergies: { status: 'nka' },
    codeStatus: { status: 'not-documented' },
    isolation: { status: 'none-recorded' },
    weight: { status: 'none-recorded' },
  };
}

export function banner(patientId: string, names?: Partial<Record<'ckb' | 'ar' | 'latin', string>>): BannerModel {
  return parseBannerData(bannerData(patientId, names), SYNTHETIC_BANNER_VOCABULARIES);
}

/** A banner whose date of birth is missing: signing is blocked (DN-032). */
export function bannerWithoutDob(patientId: string): BannerModel {
  const data: Record<string, unknown> = bannerData(patientId);
  delete data.dob;
  return parseBannerData(data, SYNTHETIC_BANNER_VOCABULARIES);
}

/** One window: its patient context, its clock and its modal stack guard. */
export class TestWindow {
  readonly guard: ModalStackGuard = createModalStackGuard();
  readonly clock = new FakeClock({ monotonicMs: 1_000_000 });
  snapshot: PatientContextSnapshot = initialPatientContext();
  readonly events: PatientContextEvent[] = [];
  readonly #listeners = new Set<() => void>();
  #keys = 0;
  readonly deps: PatientContextDeps;

  /** `reverificationWindowMs`: a configured window, as a hospital may set (only a longer one takes effect). */
  constructor(reverificationWindowMs?: number) {
    this.deps = {
      clock: this.clock,
      window: {
        isModalOpen: () => this.guard.isHeld(),
        isHalCaptureWaiting: () => false,
      },
      newIdempotencyKey: () => {
        this.#keys += 1;
        return `idem-${String(this.#keys)}`;
      },
      ...(reverificationWindowMs === undefined ? {} : { reverificationWindowMs }),
    };
  }

  readonly send = (event: PatientContextEvent): TransitionResult => {
    const result = transition(this.snapshot, event, this.deps);
    this.snapshot = result.snapshot;
    this.events.push(event);
    for (const listener of this.#listeners) {
      listener();
    }
    return result;
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): PatientContextSnapshot => this.snapshot;

  select(patientId: string, model: BannerModel | null = banner(patientId), user = NURSE): TransitionResult {
    return this.send({ type: 'SelectPatient', patient: { patientId, banner: model }, user });
  }

  /** A window holding `patientId`, opened `elapsedMs` ago. */
  static holding(patientId: string, elapsedMs: number, model?: BannerModel): TestWindow {
    const window = new TestWindow();
    window.select(patientId, model);
    window.clock.advance(elapsedMs);
    return window;
  }
}

/** A submitter that records every command and answers with the queued outcomes, in order. */
export class FakeServer {
  readonly commands: SignCommand[] = [];
  readonly #answers: (SignSubmissionOutcome | 'never' | 'throw')[];

  constructor(...answers: (SignSubmissionOutcome | 'never' | 'throw')[]) {
    this.#answers = answers;
  }

  readonly submit: SignSubmitter = (command) => {
    this.commands.push(command);
    const answer = this.#answers.shift() ?? { status: 'accepted' };
    if (answer === 'never') {
      return new Promise<SignSubmissionOutcome>(() => undefined);
    }
    if (answer === 'throw') {
      return Promise.reject(new Error('synthetic transport failure'));
    }
    return Promise.resolve(answer);
  };
}

export interface SignHarnessOptions {
  readonly window: TestWindow;
  readonly server?: FakeServer;
  readonly sessionUser?: string;
  readonly authenticator?: SignAuthenticator;
  readonly withCloseControl?: boolean;
  readonly submitTimeoutMs?: number;
  readonly dialogProps?: Partial<SignDialogProps>;
}

function SignHarness({
  window,
  server,
  sessionUser,
  authenticator,
  withCloseControl,
  submitTimeoutMs,
  dialogProps,
}: Required<SignHarnessOptions>): ReactNode {
  const snapshot = useSyncExternalStore(window.subscribe, window.getSnapshot, window.getSnapshot);
  const closeControl = useRef<HTMLButtonElement>(null);
  return (
    <>
      {withCloseControl ? (
        <button type="button" ref={closeControl} data-testid="banner-close">
          <Message id="patientContext.close" />
        </button>
      ) : null}
      <SignButton kind="sign" snapshot={snapshot} send={window.send} />
      <SignButton kind="cosign" snapshot={snapshot} send={window.send} />
      <SignDialog
        snapshot={snapshot}
        send={window.send}
        sessionUser={sessionUser}
        authenticator={authenticator}
        submit={server.submit}
        review={<Message id="demo.syntheticNotice" />}
        rejectedFocusTarget={closeControl}
        contextDeps={window.deps}
        submitTimeoutMs={submitTimeoutMs}
        {...dialogProps}
      />
    </>
  );
}

export function renderSign(options: SignHarnessOptions): RenderResult & { readonly server: FakeServer } {
  const server = options.server ?? new FakeServer();
  const sessionUser = options.sessionUser ?? NURSE;
  const view = render(
    <LocaleProvider locale="en">
      <ModalStackTestProvider guard={options.window.guard}>
        <SignHarness
          window={options.window}
          server={server}
          sessionUser={sessionUser}
          authenticator={options.authenticator ?? createSimulatedAuthenticator(sessionUser)}
          withCloseControl={options.withCloseControl ?? true}
          submitTimeoutMs={options.submitTimeoutMs ?? 30_000}
          dialogProps={options.dialogProps ?? {}}
        />
      </ModalStackTestProvider>
    </LocaleProvider>,
  );
  return Object.assign(view, { server });
}

/** The open sign dialog. */
export const dialog = (): HTMLElement => screen.getByRole('dialog');

/** The Sign (or Co-sign) action that opens the dialog, outside it. */
export const openAction = (kind: 'sign' | 'cosign'): HTMLElement =>
  screen.getByRole('button', { name: text(kind === 'cosign' ? 'sign.cosign.action' : 'sign.action') });

/** A button inside the open dialog, by its catalogue text. */
export const dialogButton = (key: MessageKey): HTMLElement =>
  within(dialog()).getByRole('button', { name: text(key) });

/** The steps the dialog shows, in order. */
export const steps = (): string[] =>
  [...dialog().querySelectorAll<HTMLElement>('[data-step]')].map((element) => element.dataset.step ?? '');

/** An authenticator for a fixed user that reports the factors it is told to (to test refusals). */
export function fixedAuthenticator(userId: string, factors: 'single' | 'badge-and-pin'): SignAuthenticator {
  return {
    authenticate: () => Promise.resolve({ status: 'authenticated', userId, factors }),
  };
}
