/**
 * The window's query cache is keyed by patient and cleared when the patient changes
 * (docs/specs/modules/design-system.md §2.2 "What a switch clears", §4; CTRL-0016-6).
 *
 * Drives the web app's patient-context store (ui-core's machine) over the demo's synthetic patients, with a
 * modal stack guard of the test's own, and reads which patients' queries the cache holds after each step.
 */
import { createModalStackGuard } from '@hms/design-system/testing';
import { FakeClock } from '@hms/ui-core';
import { describe, expect, it } from 'vitest';
import { demoModule } from '../src/demo/index.ts';
import { createPatientContextStore, randomUuid } from '../src/patient/patient-context-store.ts';
import {
  cachedPatientIds,
  createAppQueryClient,
  patientQueryKey,
} from '../src/patient/patient-queries.ts';
import { patientIdOf } from './harness.tsx';

const A = patientIdOf('complete');
const B = patientIdOf('nka');

function setUp(sessionUser: string | null = demoModule.sessionUser) {
  const guard = createModalStackGuard('announce');
  const queryClient = createAppQueryClient();
  const store = createPatientContextStore({
    guard,
    queryClient,
    directory: demoModule.directory,
    sessionUser,
    clock: new FakeClock({ monotonicMs: 1_000_000 }),
  });
  return { guard, queryClient, store };
}

describe('patient query cache', () => {
  it('keys patient data by patient id', () => {
    expect(patientQueryKey(A, 'banner')).toEqual(['patient', A, 'banner']);
  });

  it('holds only the context patient, plus a requested one while its switch waits', async () => {
    const { queryClient, store } = setUp();
    await store.requestPatient(A);
    expect(store.getSnapshot().patient?.patientId).toBe(A);
    expect(cachedPatientIds(queryClient)).toEqual([A]);

    await store.requestPatient(B);
    expect(store.getSnapshot().state).toBe('switch-pending-confirmation');
    expect(store.getSnapshot().patient?.patientId).toBe(A);
    expect(cachedPatientIds(queryClient).sort()).toEqual([A, B].sort());

    store.send({ type: 'CancelSwitch' });
    expect(cachedPatientIds(queryClient)).toEqual([A]);

    await store.requestPatient(B);
    store.send({ type: 'ConfirmSwitch', requestedPatientId: B });
    expect(store.getSnapshot().patient?.patientId).toBe(B);
    expect(cachedPatientIds(queryClient)).toEqual([B]);
    expect(queryClient.getQueryData(patientQueryKey(A, 'banner'))).toBeUndefined();
  });

  it('removes every patient query when the patient is closed or the user changes', async () => {
    const { queryClient, store } = setUp();
    await store.requestPatient(A);
    // Another query of the same patient goes too.
    queryClient.setQueryData(patientQueryKey(A, 'notes'), ['synthetic']);
    store.send({ type: 'ClosePatient' });
    expect(cachedPatientIds(queryClient)).toEqual([]);

    await store.requestPatient(B);
    store.send({ type: 'UserChanged', userId: 'user-synthetic-other' });
    expect(store.getSnapshot().patient).toBeNull();
    expect(cachedPatientIds(queryClient)).toEqual([]);
  });

  it('keeps nothing of a request the machine refuses (a dialog is open)', async () => {
    const { guard, queryClient, store } = setUp();
    await store.requestPatient(A);
    const hold = guard.acquire('modal', { label: 'a synthetic dialog' });
    const result = await store.requestPatient(B);
    expect(result?.outcome).toBe('refused');
    expect(result?.messageKey).toBe('patientContext.switch.blockedByModal');
    expect(store.getMessage()?.key).toBe('patientContext.switch.blockedByModal');
    expect(cachedPatientIds(queryClient)).toEqual([A]);
    if (hold !== null) {
      guard.release(hold);
    }
  });

  it('a HAL capture waiting for a device counts as a modal', async () => {
    const { guard, store } = setUp();
    await store.requestPatient(A);
    guard.acquire('hal-capture', { label: 'a synthetic capture' });
    expect(store.deps.window.isHalCaptureWaiting()).toBe(true);
    expect(store.deps.window.isModalOpen()).toBe(false);
    expect((await store.requestPatient(B))?.outcome).toBe('refused');
  });

  it('requests nothing without a session user (fail closed)', async () => {
    const { queryClient, store } = setUp(null);
    expect(await store.requestPatient(A)).toBeUndefined();
    expect(store.getSnapshot().patient).toBeNull();
    expect(cachedPatientIds(queryClient)).toEqual([]);
  });

  it('gives each sign step a random UUID as its idempotency key', () => {
    const keys = new Set(Array.from({ length: 50 }, randomUuid));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
